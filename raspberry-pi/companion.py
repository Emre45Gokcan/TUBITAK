"""The robot's interaction loop: push-to-talk → record → backend → speak + show emotion.

Hardware-independent: microphone, speaker, display, trigger and API client are
passed in, so the same loop runs on the Raspberry Pi, on a laptop with a WAV
file, or in tests with fakes.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional

from api_client import ApiError, AuthError, NetworkError, RobotApiClient, TalkResponse
from audio import AudioDeviceError, is_silent, loudness_envelope, wav_duration
from controls import Trigger
from display import Display

log = logging.getLogger(__name__)

MIN_RECORDING_SECONDS = 0.4
ERROR_SHOW_SECONDS = 3.0


class Companion:
    def __init__(
        self,
        api: RobotApiClient,
        heartbeat_api: Optional[RobotApiClient],
        microphone,
        speaker,
        display: Display,
        trigger: Trigger,
        max_recording_seconds: float = 30,
        heartbeat_seconds: float = 30,
    ) -> None:
        self.api = api
        self.heartbeat_api = heartbeat_api
        self.microphone = microphone
        self.speaker = speaker
        self.display = display
        self.trigger = trigger
        self.max_recording_seconds = max_recording_seconds
        self.heartbeat_seconds = heartbeat_seconds
        self.last_response: Optional[TalkResponse] = None
        self.failures = 0

    # -- main loop ------------------------------------------------------------------

    def run(self, stop: threading.Event) -> None:
        if self.heartbeat_api is not None:
            threading.Thread(target=self._heartbeat_loop, args=(stop,), daemon=True).start()
        try:
            while not stop.is_set():
                if self.display.state.mode != "idle":
                    self.display.idle(self.display.state.emotion)
                if not self.trigger.wait_start(stop):
                    break
                self.interact(stop)
        except Exception:  # never leave the robot frozen on an unexpected bug
            log.exception("companion loop crashed")
            self.display.error("Beklenmeyen hata")
            self.failures += 1
        finally:
            stop.set()

    def interact(self, stop: threading.Event) -> Optional[TalkResponse]:
        """One push-to-talk turn. Every failure ends in a visible message and a return to idle."""
        # 1. Record
        try:
            self.microphone.check()
            self.display.listening()
            done = threading.Event()
            if getattr(self.microphone, "live", True):
                threading.Thread(target=self._stop_recording_when_released, args=(done,), daemon=True).start()
            wav = self.microphone.record(done, self.max_recording_seconds)
            done.set()
        except AudioDeviceError as exc:
            return self._fail(exc.message, stop)

        try:
            duration = wav_duration(wav)
            silent = is_silent(wav)
        except AudioDeviceError as exc:
            return self._fail(exc.message, stop)
        if duration < MIN_RECORDING_SECONDS:
            return self._fail("Kayıt çok kısa. Konuşurken düğmeyi basılı tutun.", stop)
        if silent:  # muted mic / no permission: don't pay for transcribing silence
            return self._fail("Ses algılanmadı. Mikrofonu kontrol edin.", stop)

        # 2. Ask the backend (STT → LLM → emotion → TTS)
        self.display.thinking()
        try:
            response = self.api.talk(wav)
        except AuthError as exc:
            self.display.set_connection("auth_error")
            log.error("authentication failed (%s): check ROBOT_DEVICE_ID / ROBOT_DEVICE_TOKEN", exc.code)
            return self._fail(exc.message, stop)
        except NetworkError as exc:
            self.display.set_connection("offline")
            return self._fail(exc.message, stop)
        except ApiError as exc:
            return self._fail(exc.message, stop)

        self.display.set_connection("online")
        log.info("heard: %r", response.transcript)
        log.info("reply (%s): %s", response.emotion, response.text)
        print(f"Robot ({response.emotion}): {response.text}", flush=True)

        # 3. Speak. If audio fails, the face and text still show the answer.
        audio = None
        if response.audio_url:
            try:
                audio = self.api.download_audio(response.audio_url)
            except ApiError as exc:
                log.warning("audio download failed: %s", exc.message)

        envelope = loudness_envelope(audio) if audio else []
        self.display.speaking(response.emotion, envelope, response.text)
        if audio:
            try:
                self.speaker.play(audio, on_start=lambda: self.display.speaking(response.emotion, envelope, response.text))
            except AudioDeviceError as exc:
                log.warning("playback failed: %s", exc.message)
                self.display.error(exc.message)
                stop.wait(ERROR_SHOW_SECONDS)
        else:
            stop.wait(ERROR_SHOW_SECONDS)

        self.display.idle()  # the conversation is over: back to the neutral face
        self.last_response = response
        self.failures = 0
        return response

    # -- helpers --------------------------------------------------------------------

    def _stop_recording_when_released(self, done: threading.Event) -> None:
        self.trigger.wait_stop(done, self.max_recording_seconds)
        done.set()

    def _fail(self, message: str, stop: threading.Event) -> None:
        log.warning("interaction failed: %s", message)
        self.failures += 1
        self.display.error(message)
        stop.wait(ERROR_SHOW_SECONDS)
        return None

    def _heartbeat_loop(self, stop: threading.Event) -> None:
        """Keeps the dashboard's 'connected' status fresh; backs off while offline."""
        delay = 0.0
        while not stop.wait(delay):
            try:
                self.heartbeat_api.heartbeat()
                self.display.set_connection("online")
                delay = self.heartbeat_seconds
            except AuthError as exc:
                log.error("heartbeat rejected (%s): %s", exc.code, exc.message)
                self.display.set_connection("auth_error")
                delay = 300
            except NetworkError as exc:
                log.warning("heartbeat failed: %s", exc.message)
                self.display.set_connection("offline")
                delay = min(max(delay * 2, 5), 60)
            except ApiError as exc:
                log.warning("heartbeat error: %s", exc.message)
                delay = self.heartbeat_seconds
