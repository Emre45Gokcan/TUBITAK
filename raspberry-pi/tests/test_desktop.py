"""On-screen push-to-talk (ScreenTrigger) and the desktop face window, rendered without a real window."""

from __future__ import annotations

import os
import threading
import time
import unittest

from controls import ScreenTrigger

try:
    os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
    os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
    import pygame
except ImportError:  # pygame is optional for the non-display tests
    pygame = None


def start_trigger(trigger: ScreenTrigger, at: float) -> None:
    """Presses once wait_start is listening (presses made before it are ignored on purpose)."""
    threading.Timer(0.05, trigger.press, kwargs={"at": at}).start()
    assert trigger.wait_start(threading.Event())


class ScreenTriggerTest(unittest.TestCase):
    def test_tap_to_start_and_tap_to_stop(self):
        trigger = ScreenTrigger()
        start_trigger(trigger, at=100.0)
        trigger.release(at=100.1)  # a quick tap keeps recording...
        trigger.press(at=103.0)  # ...until the next press
        began = time.monotonic()
        trigger.wait_stop(threading.Event(), timeout=5)
        self.assertLess(time.monotonic() - began, 1)

    def test_tap_release_does_not_stop(self):
        trigger = ScreenTrigger()
        start_trigger(trigger, at=100.0)
        trigger.release(at=100.1)
        began = time.monotonic()
        trigger.wait_stop(threading.Event(), timeout=0.3)
        self.assertGreaterEqual(time.monotonic() - began, 0.3)

    def test_hold_and_release_stops(self):
        trigger = ScreenTrigger()
        start_trigger(trigger, at=100.0)
        trigger.release(at=102.0)
        began = time.monotonic()
        trigger.wait_stop(threading.Event(), timeout=5)
        self.assertLess(time.monotonic() - began, 1)

    def test_presses_while_busy_are_ignored(self):
        trigger = ScreenTrigger()
        trigger.press()
        stop = threading.Event()
        threading.Timer(0.2, stop.set).start()
        self.assertFalse(trigger.wait_start(stop))


@unittest.skipIf(pygame is None, "pygame not installed")
class DesktopDisplayTest(unittest.TestCase):
    def setUp(self):
        from display import PygameDisplay

        pygame.display.init()
        pygame.font.init()
        self.screen = pygame.display.set_mode((800, 620))
        self.trigger = ScreenTrigger()
        self.display = PygameDisplay(800, 620, False, controls=self.trigger, level_source=lambda: 0.5)

    def tearDown(self):
        pygame.display.quit()

    def events(self):
        out = []
        while not self.trigger._events.empty():
            out.append(self.trigger._events.get_nowait()[0])
        return out

    def test_renders_every_state_at_any_size(self):
        d = self.display
        for size in ((800, 620), (480, 320), (320, 240)):
            screen = pygame.display.set_mode(size)
            for show in (d.idle, d.listening, d.thinking, lambda: d.speaking("happy", [0.5], "Merhaba! " * 30),
                         lambda: d.speaking("angry", [], "Hayır."), lambda: d.error("Sunucuya bağlanılamadı.")):
                show()
                d.render(screen, time.monotonic())
                self.assertTrue(screen.get_rect().contains(d._button))

    def test_click_and_space_press_the_trigger_only_when_ready(self):
        d = self.display
        d.render(self.screen, 1.0)
        click = pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=d._button.center)
        unclick = pygame.event.Event(pygame.MOUSEBUTTONUP, button=1, pos=d._button.center)
        space = pygame.event.Event(pygame.KEYDOWN, key=pygame.K_SPACE)
        d._handle_input(click)
        d._handle_input(unclick)
        self.assertEqual(self.events(), ["press", "release"])

        d._handle_input(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(5, 5)))  # not on the button
        self.assertEqual(self.events(), [])

        d.thinking()  # busy: the button is disabled
        d._handle_input(click)
        d._handle_input(space)
        self.assertEqual(self.events(), [])

        d.listening()  # a press while listening stops the recording
        d._handle_input(space)
        self.assertEqual(self.events(), ["press"])


if __name__ == "__main__":
    unittest.main()
