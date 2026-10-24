"""Face display. Runs its own render loop on the main thread, so the face keeps
animating (blinking, talking) while audio and network work happen elsewhere.

Backends:
  PygameDisplay  – a window on a desktop (optionally with an on-screen talk button),
                   or fullscreen on the robot's LCD
  ConsoleDisplay – no screen at all; prints state changes (headless/dev)
"""

from __future__ import annotations

import logging
import math
import os
import random
import threading
import time
from dataclasses import dataclass, field, replace
from typing import Callable, Dict, List, Optional, Tuple

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class FaceState:
    mode: str = "idle"  # idle | listening | thinking | speaking | error
    emotion: str = "neutral"
    message: str = ""
    envelope: List[float] = field(default_factory=list)
    since: float = 0.0  # when this state started (monotonic)
    connection: str = "unknown"  # unknown | online | offline | auth_error


class Display:
    """Thread-safe state shared between the companion loop and the render loop."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state = FaceState(since=time.monotonic())

    @property
    def state(self) -> FaceState:
        with self._lock:
            return self._state

    def _set(self, **changes) -> None:
        with self._lock:
            if "mode" in changes or "emotion" in changes:
                changes.setdefault("since", time.monotonic())
            self._state = replace(self._state, **changes)
        self.on_change(self.state)

    def on_change(self, state: FaceState) -> None:  # hook for subclasses
        pass

    # Convenience setters used by the companion loop.
    def idle(self, emotion: str = "neutral", message: str = "") -> None:
        self._set(mode="idle", emotion=emotion, message=message, envelope=[])

    def listening(self) -> None:
        self._set(mode="listening", emotion="neutral", message="Dinliyorum…", envelope=[])

    def thinking(self) -> None:
        self._set(mode="thinking", emotion="neutral", message="Düşünüyorum…", envelope=[])

    def speaking(self, emotion: str, envelope: List[float], message: str = "") -> None:
        self._set(mode="speaking", emotion=emotion, envelope=envelope, message=message)

    def error(self, message: str) -> None:
        self._set(mode="error", emotion="neutral", message=message, envelope=[])

    def set_connection(self, connection: str) -> None:
        if self.state.connection != connection:
            self._set(connection=connection)

    def run(self, stop: threading.Event) -> None:
        raise NotImplementedError


class ConsoleDisplay(Display):
    def on_change(self, state: FaceState) -> None:
        label = {"happy": ":-D", "neutral": ":-|", "angry": ">:-("}.get(state.emotion, ":-|")
        extra = f" — {state.message}" if state.message else ""
        print(f"[yüz] {label} {state.mode} ({state.emotion}){extra}  [bağlantı: {state.connection}]", flush=True)

    def run(self, stop: threading.Event) -> None:
        stop.wait()


class PygameDisplay(Display):
    """The face in a window or fullscreen.

    With `controls` (a ScreenTrigger) it also draws a state label, subtitles, a microphone
    level meter and a talk button that works with the mouse, a touchscreen or the Space key.
    Without it, the face fills the screen (robot with a GPIO button).
    """

    FPS = 30

    def __init__(
        self,
        width: int,
        height: int,
        fullscreen: bool,
        controls=None,
        level_source: Optional[Callable[[], float]] = None,
    ) -> None:
        super().__init__()
        self.size = (width, height)
        self.fullscreen = fullscreen
        self.controls = controls
        self.level_source = level_source
        self._button = None  # pygame.Rect of the talk button in the last frame
        self._pressed = False
        self._level = 0.0
        self._next_blink = 0.0
        self._fonts: Dict[Tuple[int, bool], object] = {}

    def run(self, stop: threading.Event) -> None:
        os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
        import pygame  # noqa: PLC0415 - optional until a screen is used

        pygame.display.init()
        pygame.font.init()
        if self.fullscreen:
            pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
            pygame.mouse.set_visible(False)
        else:
            pygame.display.set_mode(self.size, pygame.RESIZABLE)
        pygame.display.set_caption("Robot")
        clock = pygame.time.Clock()

        try:
            while not stop.is_set():
                for event in pygame.event.get():
                    if event.type == pygame.QUIT or (event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE):
                        stop.set()
                    elif self.controls is not None:
                        self._handle_input(event)
                self.render(pygame.display.get_surface(), time.monotonic())
                pygame.display.flip()
                clock.tick(self.FPS)
        finally:
            pygame.display.quit()

    # -- input ------------------------------------------------------------------------

    def _talk_enabled(self) -> bool:
        return self.state.mode in ("idle", "listening")

    def _handle_input(self, event) -> None:
        import pygame  # noqa: PLC0415

        talk_keys = (pygame.K_SPACE, pygame.K_RETURN, pygame.K_KP_ENTER)
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self._button is not None and self._button.collidepoint(event.pos) and self._talk_enabled():
                self._pressed = True
                self.controls.press()
        elif event.type == pygame.MOUSEBUTTONUP and event.button == 1 and self._pressed:
            self._pressed = False
            self.controls.release()
        elif event.type == pygame.KEYDOWN and event.key in talk_keys and self._talk_enabled():
            self._pressed = True
            self.controls.press()
        elif event.type == pygame.KEYUP and event.key in talk_keys:
            self._pressed = False
            self.controls.release()

    # -- drawing ----------------------------------------------------------------------

    def render(self, screen, now: float) -> None:
        """Draws one frame (separate from run() so tests can render without a window)."""
        import pygame  # noqa: PLC0415

        from faces import BACKGROUND, COLORS, draw_face  # noqa: PLC0415

        state = self.state
        elapsed = now - state.since

        # Blink every few seconds (120 ms).
        if not self._next_blink:
            self._next_blink = now + random.uniform(2.5, 5.5)
        blink = 0.0
        if now >= self._next_blink:
            progress = (now - self._next_blink) / 0.12
            blink = 1 - abs(1 - 2 * progress) if progress < 1 else 0.0
            if progress >= 1:
                self._next_blink = now + random.uniform(2.5, 5.5)

        mouth = 0.0
        if state.mode == "speaking" and state.envelope:
            index = int(elapsed / 0.05)
            if index < len(state.envelope):
                mouth = state.envelope[index]

        if self.controls is None:
            draw_face(screen, state.emotion, mode=state.mode, t=now, blink=blink, mouth_open=mouth)
            font = self._font(max(14, screen.get_height() // 18))
            self._draw_status(screen, font, state, COLORS, BACKGROUND)
            return

        w, h = screen.get_size()
        header = max(28, int(h * 0.09))
        footer = max(96, int(h * 0.30))
        screen.fill(BACKGROUND)
        face = screen.subsurface(pygame.Rect(0, header, w, max(1, h - header - footer)))
        draw_face(face, state.emotion, mode=state.mode, t=now, blink=blink, mouth_open=mouth)
        self._draw_header(screen, state, header, now)
        self._draw_footer(screen, state, pygame.Rect(0, h - footer, w, footer), COLORS)

    def _font(self, size: int, bold: bool = False):
        import pygame  # noqa: PLC0415

        key = (size, bold)
        if key not in self._fonts:
            self._fonts[key] = pygame.font.SysFont("dejavusans,arial,helvetica", size, bold=bold)
        return self._fonts[key]

    def _draw_header(self, screen, state: FaceState, height: int, now: float) -> None:
        import pygame  # noqa: PLC0415

        w = screen.get_width()
        label, color = STATE_LABELS.get(state.mode, STATE_LABELS["idle"])
        font = self._font(max(13, int(height * 0.42)), bold=True)
        text = font.render(label, True, TEXT)
        dot = max(4, height // 9)
        pad = max(8, height // 4)
        chip = pygame.Rect(0, 0, text.get_width() + dot * 2 + pad * 3, int(height * 0.72))
        chip.center = (w // 2, height // 2 + 2)
        pygame.draw.rect(screen, PANEL, chip, border_radius=chip.height // 2)
        pulse = 1.0 if state.mode == "idle" else 0.75 + 0.25 * math.sin(now * 6)
        pygame.draw.circle(screen, color, (chip.x + pad + dot, chip.centery), max(2, round(dot * pulse)))
        screen.blit(text, (chip.x + pad * 2 + dot * 2, chip.centery - text.get_height() // 2))

        # Backend connection, top right.
        conn_label, conn_color = CONNECTION_LABELS.get(state.connection, CONNECTION_LABELS["unknown"])
        small = self._font(max(11, int(height * 0.28)))
        conn = small.render(conn_label, True, MUTED)
        x = w - conn.get_width() - pad
        if x > chip.right + pad:
            screen.blit(conn, (x, height // 2 - conn.get_height() // 2 + 2))
        else:
            x = w - pad  # narrow screen: dot only
        pygame.draw.circle(screen, conn_color, (x - dot * 2, height // 2 + 2), dot)

    def _draw_footer(self, screen, state: FaceState, area, colors) -> None:
        import pygame  # noqa: PLC0415

        w = area.width
        info = pygame.Rect(16, area.y, w - 32, int(area.height * 0.40))
        body = self._font(max(13, int(area.height * 0.11)))

        # Smoothed microphone level: rises instantly, falls slowly.
        level = self.level_source() if self.level_source and state.mode == "listening" else 0.0
        self._level = max(level, self._level * 0.85)

        if state.mode == "listening":
            hint = body.render("Konuş; bitince tekrar bas (ya da basılı tutup bırak)", True, MUTED)
            screen.blit(hint, (info.centerx - hint.get_width() // 2, info.y))
            meter = pygame.Rect(0, 0, min(360, int(w * 0.6)), max(8, info.height // 5))
            meter.midtop = (info.centerx, info.y + hint.get_height() + 8)
            pygame.draw.rect(screen, PANEL, meter, border_radius=meter.height // 2)
            if self._level > 0.02:
                fill = meter.copy()
                fill.width = max(meter.height, int(meter.width * self._level))
                pygame.draw.rect(screen, STATE_LABELS["listening"][1], fill, border_radius=meter.height // 2)
        else:
            text, color = {
                "idle": (state.message or "Benimle konuşmak için düğmeye bas ya da Boşluk tuşuna dokun.", MUTED),
                "thinking": ("Yanıtımı hazırlıyorum…", MUTED),
                "speaking": (state.message, TEXT),
                "error": (state.message, ERROR),
            }.get(state.mode, ("", MUTED))
            lines = _wrap(body, text, info.width, max_lines=max(1, info.height // body.get_linesize()))
            y = info.y
            for line in lines:
                surf = body.render(line, True, color)
                screen.blit(surf, (info.centerx - surf.get_width() // 2, y))
                y += body.get_linesize()

        # Talk button.
        enabled = self._talk_enabled()
        listening = state.mode == "listening"
        button = pygame.Rect(0, 0, min(320, int(w * 0.55)), max(36, min(64, int(area.height * 0.32))))
        button.midtop = (area.centerx, area.y + int(area.height * 0.46))
        self._button = button
        if listening:
            fill, ink, label = STATE_LABELS["listening"][1], TEXT, "Bitir"
        elif enabled:
            fill, ink, label = colors["neutral"], INK, "Konuş"
        else:
            fill, ink, label = PANEL, MUTED, "Bekle…"
        if self._pressed and enabled:
            fill = tuple(int(c * 0.8) for c in fill)
        pygame.draw.rect(screen, fill, button, border_radius=button.height // 2)
        font = self._font(max(14, int(button.height * 0.42)), bold=True)
        text = font.render(label, True, ink)
        icon = int(button.height * 0.46)
        gap = icon // 2
        has_icon = listening or enabled
        x = button.centerx - (text.get_width() + (icon + gap if has_icon else 0)) // 2
        if listening:
            square = pygame.Rect(0, 0, int(icon * 0.7), int(icon * 0.7))
            square.center = (x + icon // 2, button.centery)
            pygame.draw.rect(screen, ink, square, border_radius=max(2, icon // 8))
        elif enabled:
            _draw_mic(screen, ink, (x + icon // 2, button.centery), icon)
        if has_icon:
            x += icon + gap
        screen.blit(text, (x, button.centery - text.get_height() // 2))

        if w >= 600:
            small = self._font(max(11, int(area.height * 0.075)))
            tip = small.render("Boşluk ya da tıklama: başlat / bitir   ·   Esc: çıkış", True, FAINT)
            screen.blit(tip, (area.centerx - tip.get_width() // 2, area.bottom - tip.get_height() - 8))

    @staticmethod
    def _draw_status(screen, font, state: FaceState, colors, background) -> None:
        import pygame  # noqa: PLC0415

        w, h = screen.get_size()
        dot = CONNECTION_LABELS.get(state.connection, CONNECTION_LABELS["unknown"])[1]
        pygame.draw.circle(screen, dot, (w - 14, 14), 6)
        if state.message and state.mode in ("listening", "thinking", "error"):
            color = (240, 120, 110) if state.mode == "error" else colors["neutral"]
            text = font.render(state.message, True, color, background)
            screen.blit(text, ((w - text.get_width()) // 2, h - text.get_height() - 10))


# Colours for the on-screen controls (the face colours live in faces.py).
TEXT = (236, 240, 246)
MUTED = (150, 160, 175)
FAINT = (90, 100, 115)
INK = (12, 16, 24)
PANEL = (30, 37, 50)
ERROR = (240, 120, 110)
STATE_LABELS = {
    "idle": ("Hazır", (125, 222, 255)),
    "listening": ("Dinliyorum", (235, 87, 87)),
    "thinking": ("Düşünüyorum", (255, 212, 96)),
    "speaking": ("Konuşuyorum", (80, 200, 120)),
    "error": ("Bir sorun var", ERROR),
}
CONNECTION_LABELS = {
    "unknown": ("Bağlanıyor…", (90, 90, 90)),
    "online": ("Sunucuya bağlı", (80, 200, 120)),
    "offline": ("Sunucu yok", (160, 160, 160)),
    "auth_error": ("Anahtar reddedildi", (230, 80, 70)),
}


def _wrap(font, text: str, width: int, max_lines: int) -> List[str]:
    """Word-wraps `text` to `width` pixels; the last line ends with … if it doesn't fit."""
    lines: List[str] = []
    line = ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if font.size(candidate)[0] <= width or not line:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and font.size(last + "…")[0] > width:
            last = last[:-1]
        lines[-1] = last.rstrip() + "…"
    return lines


def _draw_mic(screen, color, center: Tuple[int, int], size: int) -> None:
    import pygame  # noqa: PLC0415

    x, y = center
    stroke = max(2, size // 10)
    body = pygame.Rect(0, 0, int(size * 0.4), int(size * 0.62))
    body.midtop = (x, y - size // 2)
    pygame.draw.rect(screen, color, body, border_radius=body.width // 2)
    cradle = pygame.Rect(0, 0, int(size * 0.72), int(size * 0.66))
    cradle.midtop = (x, y - size // 2 + int(size * 0.12))
    pygame.draw.arc(screen, color, cradle, math.pi, 2 * math.pi, stroke)
    pygame.draw.line(screen, color, (x, cradle.bottom - 1), (x, y + size // 2), stroke)
    pygame.draw.line(screen, color, (x - size // 4, y + size // 2), (x + size // 4, y + size // 2), stroke)


def make_display(
    kind: str,
    width: int,
    height: int,
    controls=None,
    level_source: Optional[Callable[[], float]] = None,
) -> Display:
    if kind == "console":
        return ConsoleDisplay()
    return PygameDisplay(width, height, fullscreen=kind == "fullscreen", controls=controls, level_source=level_source)
