"""Push-to-talk triggers.

  KeyboardTrigger – press Enter to start talking, Enter again to stop (desktop / SSH)
  ScreenTrigger   – the talk button in the face window, or Space (desktop simulator, touchscreens)
  GpioTrigger     – hold a button wired to a GPIO pin while talking (the robot)
  OnceTrigger     – start immediately, once (automated tests with --once)
"""

from __future__ import annotations

import queue
import sys
import threading
import time
from typing import Optional, Tuple


class Trigger:
    def wait_start(self, stop: threading.Event) -> bool:
        """Blocks until the user wants to talk. False if the app is stopping."""
        raise NotImplementedError

    def wait_stop(self, done: threading.Event, timeout: float) -> None:
        """Blocks until the user stops talking, `done` is set, or `timeout` passes."""
        raise NotImplementedError


class KeyboardTrigger(Trigger):
    def __init__(self, prompt: str = "Konuşmak için Enter'a basın…") -> None:
        self.prompt = prompt
        self._lines: "queue.Queue[str]" = queue.Queue()
        threading.Thread(target=self._read_stdin, daemon=True).start()

    def _read_stdin(self) -> None:
        for line in sys.stdin:
            self._lines.put(line)

    def _get(self, timeout: float) -> Optional[str]:
        try:
            return self._lines.get(timeout=timeout)
        except queue.Empty:
            return None

    def wait_start(self, stop: threading.Event) -> bool:
        # Ignore presses made while the robot was busy.
        while not self._lines.empty():
            self._lines.get_nowait()
        print(self.prompt, flush=True)
        while not stop.is_set():
            if self._get(0.2) is not None:
                return True
        return False

    def wait_stop(self, done: threading.Event, timeout: float) -> None:
        print("Dinliyorum… bitirmek için tekrar Enter'a basın.", flush=True)
        waited = 0.0
        while not done.is_set() and waited < timeout:
            if self._get(0.2) is not None:
                return
            waited += 0.2


class ScreenTrigger(Trigger):
    """Push-to-talk from the face window: click/tap the talk button or press Space.

    Tap once to start and again to stop, or hold and release (walkie-talkie style).
    The display's render loop calls press()/release(); the companion thread waits here.
    """

    HOLD_SECONDS = 0.6  # a press held at least this long ends the recording on release

    def __init__(self) -> None:
        self._events: "queue.Queue[Tuple[str, float]]" = queue.Queue()
        self._pressed_at = 0.0

    def press(self, at: Optional[float] = None) -> None:
        self._events.put(("press", time.monotonic() if at is None else at))

    def release(self, at: Optional[float] = None) -> None:
        self._events.put(("release", time.monotonic() if at is None else at))

    def _get(self, timeout: float) -> Optional[Tuple[str, float]]:
        try:
            return self._events.get(timeout=timeout)
        except queue.Empty:
            return None

    def wait_start(self, stop: threading.Event) -> bool:
        # Ignore presses made while the robot was busy.
        while not self._events.empty():
            self._events.get_nowait()
        while not stop.is_set():
            event = self._get(0.1)
            if event and event[0] == "press":
                self._pressed_at = event[1]
                return True
        return False

    def wait_stop(self, done: threading.Event, timeout: float) -> None:
        deadline = time.monotonic() + timeout
        while not done.is_set() and time.monotonic() < deadline:
            event = self._get(0.1)
            if event is None:
                continue
            kind, at = event
            if kind == "press" or at - self._pressed_at >= self.HOLD_SECONDS:
                return


class GpioTrigger(Trigger):
    """Momentary button between `pin` (BCM numbering) and GND; uses the internal pull-up."""

    def __init__(self, pin: int) -> None:
        from gpiozero import Button  # noqa: PLC0415 - only on the Raspberry Pi

        self.button = Button(pin, pull_up=True, bounce_time=0.05)

    def wait_start(self, stop: threading.Event) -> bool:
        while not stop.is_set():
            if self.button.wait_for_press(timeout=0.2):
                return True
        return False

    def wait_stop(self, done: threading.Event, timeout: float) -> None:
        waited = 0.0
        while not done.is_set() and waited < timeout:
            if self.button.wait_for_release(timeout=0.1):
                return
            waited += 0.1


class OnceTrigger(Trigger):
    def __init__(self) -> None:
        self._used = False

    def wait_start(self, stop: threading.Event) -> bool:
        if self._used or stop.is_set():
            stop.set()
            return False
        self._used = True
        return True

    def wait_stop(self, done: threading.Event, timeout: float) -> None:
        return
