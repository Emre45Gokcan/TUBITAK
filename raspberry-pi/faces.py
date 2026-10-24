"""Cartoon robot faces drawn with pygame, scaled to any screen size.

Expressions: happy, neutral, angry. Drawn in code (not bitmaps) so they stay
sharp on any LCD and can blink and move the mouth while the robot speaks.
To use your own artwork instead, put happy.png / neutral.png / angry.png in faces/.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import pygame
from pygame import gfxdraw

FACES_DIR = Path(__file__).resolve().parent / "faces"

BACKGROUND = (12, 16, 24)
COLORS = {
    "neutral": (125, 222, 255),
    "happy": (255, 212, 96),
    "angry": (255, 92, 76),
}
CHEEK = (255, 120, 150)

Point = Tuple[float, float]


class Canvas:
    """Maps a 480×320 design grid onto the real surface, centred and scaled."""

    def __init__(self, surface: pygame.Surface):
        self.surface = surface
        w, h = surface.get_size()
        self.scale = min(w / 480, h / 320)
        self.ox = (w - 480 * self.scale) / 2
        self.oy = (h - 320 * self.scale) / 2

    def p(self, x: float, y: float) -> Tuple[int, int]:
        return round(self.ox + x * self.scale), round(self.oy + y * self.scale)

    def s(self, v: float) -> int:
        return max(1, round(v * self.scale))

    def polygon(self, color, points: Sequence[Point]) -> None:
        pts = [self.p(x, y) for x, y in points]
        if len(pts) >= 3:
            gfxdraw.aapolygon(self.surface, pts, color)
            gfxdraw.filled_polygon(self.surface, pts, color)

    def circle(self, color, center: Point, radius: float) -> None:
        x, y = self.p(*center)
        r = self.s(radius)
        gfxdraw.aacircle(self.surface, x, y, r, color)
        gfxdraw.filled_circle(self.surface, x, y, r, color)

    def ellipse(self, color, center: Point, rx: float, ry: float) -> None:
        x, y = self.p(*center)
        a, b = self.s(rx), self.s(ry)
        gfxdraw.aaellipse(self.surface, x, y, a, b, color)
        gfxdraw.filled_ellipse(self.surface, x, y, a, b, color)

    def pill(self, color, center: Point, width: float, height: float) -> None:
        """Vertical capsule (rounded eye)."""
        cx, cy = center
        r = width / 2
        if height <= width:
            self.ellipse(color, center, r, height / 2)
            return
        top, bottom = cy - height / 2 + r, cy + height / 2 - r
        self.polygon(color, [(cx - r, top), (cx + r, top), (cx + r, bottom), (cx - r, bottom)])
        self.circle(color, (cx, top), r)
        self.circle(color, (cx, bottom), r)

    def arc(self, color, center: Point, rx: float, ry: float, start: float, end: float, width: float) -> None:
        """Thick arc with round caps. Angles in radians, counter-clockwise, 0 = right, y up."""
        cx, cy = center
        steps = 32
        ts = [start + (end - start) * i / steps for i in range(steps + 1)]
        half = width / 2
        outer = [(cx + (rx + half) * math.cos(t), cy - (ry + half) * math.sin(t)) for t in ts]
        inner = [(cx + (rx - half) * math.cos(t), cy - (ry - half) * math.sin(t)) for t in reversed(ts)]
        self.polygon(color, outer + inner)
        for t in (start, end):
            self.circle(color, (cx + rx * math.cos(t), cy - ry * math.sin(t)), half)

    def line(self, color, a: Point, b: Point, width: float) -> None:
        (x1, y1), (x2, y2) = a, b
        angle = math.atan2(y2 - y1, x2 - x1)
        dx, dy = math.sin(angle) * width / 2, -math.cos(angle) * width / 2
        self.polygon(color, [(x1 + dx, y1 + dy), (x2 + dx, y2 + dy), (x2 - dx, y2 - dy), (x1 - dx, y1 - dy)])
        self.circle(color, a, width / 2)
        self.circle(color, b, width / 2)


EYES = ((150.0, 135.0), (330.0, 135.0))


def _neutral(c: Canvas, color, blink: float, mouth_open: float, look_up: float) -> None:
    for x, y in EYES:
        c.pill(color, (x, y - look_up), 64, max(10, 104 * (1 - blink)))
    if mouth_open > 0.05:
        c.ellipse(color, (240, 250), 34, 6 + 26 * mouth_open)
    else:
        c.arc(color, (240, 228), 46, 18, math.pi * 1.2, math.pi * 1.8, 12)


def _happy(c: Canvas, color, blink: float, mouth_open: float, look_up: float) -> None:
    for x, y in EYES:
        # Closed, smiling eyes: ∩ arcs.
        c.arc(color, (x, y + 12 - look_up), 38, 34 * (1 - 0.5 * blink), 0.15, math.pi - 0.15, 15)
    for x in (92, 388):
        c.circle(CHEEK, (x, 206), 22)
    # Wide "D" smile; a dark opening appears while talking.
    depth = 46 + 18 * mouth_open
    steps = [math.pi + math.pi * i / 32 for i in range(33)]
    c.polygon(color, [(240 + 78 * math.cos(t), 222 - depth * math.sin(t)) for t in steps])
    if mouth_open > 0.15:
        c.ellipse(BACKGROUND, (240, 222 + depth * 0.45), 40, 6 + 14 * mouth_open)


def _angry(c: Canvas, color, blink: float, mouth_open: float, look_up: float) -> None:
    for (x, y), side in zip(EYES, (1, -1)):
        c.pill(color, (x, y + 8 - look_up), 64, max(10, 84 * (1 - blink)))
        # Slanted lid cuts the inner top corner of each eye.
        inner = x + side * 40
        outer = x - side * 40
        c.polygon(BACKGROUND, [(outer, y - 60), (inner, y - 60), (inner, y + 18), (outer, y - 26)])
        # Eyebrows slope down towards the nose.
        c.line(color, (x - side * 52, y - 62), (x + side * 46, y - 30), 14)
    if mouth_open > 0.05:
        c.ellipse(color, (240, 258), 30, 6 + 20 * mouth_open)
    else:
        c.arc(color, (240, 272), 54, 26, math.pi * 0.15, math.pi * 0.85, 13)


DRAWERS = {"neutral": _neutral, "happy": _happy, "angry": _angry}


def _thinking_dots(c: Canvas, color, t: float) -> None:
    for i in range(3):
        phase = (t * 2.5 - i * 0.35) % 1.0
        lift = 10 * max(0.0, math.sin(phase * math.pi))
        c.circle(color, (205 + i * 35, 250 - lift), 9)


def _listening_waves(c: Canvas, color, t: float) -> None:
    pulse = 0.5 + 0.5 * math.sin(t * 6)
    for side in (-1, 1):
        for k, r in enumerate((26, 44)):
            alpha = 0.35 + 0.65 * pulse if k == 0 else 0.25 + 0.5 * pulse
            shade = tuple(int(BACKGROUND[i] + (color[i] - BACKGROUND[i]) * alpha) for i in range(3))
            cx = 240 + side * 210
            start, end = (math.pi * 0.7, math.pi * 1.3) if side < 0 else (-math.pi * 0.3, math.pi * 0.3)
            c.arc(shade, (cx - side * 30, 140), r, r, start, end, 6)


_custom_cache: Dict[Tuple[str, Tuple[int, int]], Optional[pygame.Surface]] = {}


def _custom_face(emotion: str, size: Tuple[int, int]) -> Optional[pygame.Surface]:
    key = (emotion, size)
    if key not in _custom_cache:
        path = FACES_DIR / f"{emotion}.png"
        image = None
        if path.exists():
            try:
                image = pygame.transform.smoothscale(pygame.image.load(str(path)).convert_alpha(), size)
            except pygame.error:
                image = None
        _custom_cache[key] = image
    return _custom_cache[key]


def draw_face(
    surface: pygame.Surface,
    emotion: str,
    *,
    mode: str = "idle",
    t: float = 0.0,
    blink: float = 0.0,
    mouth_open: float = 0.0,
) -> None:
    """Draws one frame. mode: idle | listening | thinking | speaking | error."""
    emotion = emotion if emotion in DRAWERS else "neutral"
    surface.fill(BACKGROUND)
    custom = _custom_face(emotion, surface.get_size()) if pygame.display.get_init() else None
    if custom is not None:
        surface.blit(custom, (0, 0))
        return

    c = Canvas(surface)
    color = COLORS[emotion]
    look_up = 10 if mode == "thinking" else 0
    if mode == "thinking":
        DRAWERS["neutral"](c, COLORS["neutral"], blink, 0.0, look_up)
        # Cover the mouth with animated "…" dots.
        c.polygon(BACKGROUND, [(180, 205), (300, 205), (300, 270), (180, 270)])
        _thinking_dots(c, COLORS["neutral"], t)
        return
    DRAWERS[emotion](c, color, blink, mouth_open, look_up)
    if mode == "listening":
        _listening_waves(c, color, t)


def export_previews(out_dir: Path, size: Tuple[int, int] = (480, 320)) -> List[Path]:
    """Writes PNG previews of each expression (handy for checking the art)."""
    pygame.init()
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    frames = [(e, "idle", 0.0) for e in DRAWERS] + [("happy", "speaking", 0.7), ("neutral", "thinking", 0.0),
                                                   ("neutral", "listening", 0.0)]
    for emotion, mode, mouth in frames:
        surface = pygame.Surface(size)
        draw_face(surface, emotion, mode=mode, mouth_open=mouth, t=0.2)
        path = out_dir / f"{emotion}-{mode}.png"
        pygame.image.save(surface, str(path))
        written.append(path)
    return written


if __name__ == "__main__":
    import sys

    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("face-previews")
    for p in export_previews(target):
        print(p)
