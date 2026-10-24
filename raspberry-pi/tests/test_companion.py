"""The interaction loop with fake hardware and a fake backend."""

from __future__ import annotations

import threading
import unittest

import numpy as np

from api_client import AuthError, NetworkError, TalkResponse
from audio import AudioDeviceError, encode_wav, input_level, is_silent, loudness_envelope, _downsample
from companion import Companion
from controls import OnceTrigger
from display import Display

SPEECH = encode_wav((np.sin(np.arange(16000) / 5) * 8000).astype(np.int16), 16000)  # 1 s


class RecordingDisplay(Display):
    def __init__(self):
        super().__init__()
        self.history = []

    def on_change(self, state):
        self.history.append((state.mode, state.emotion, state.message))

    def run(self, stop):
        stop.wait()


class FakeMicrophone:
    live = False

    def __init__(self, wav=SPEECH, error=None):
        self.wav, self.error = wav, error

    def check(self):
        if self.error:
            raise AudioDeviceError(self.error)
        return "fake"

    def record(self, stop, max_seconds):
        return self.wav


class FakeSpeaker:
    def __init__(self, error=None):
        self.played, self.error = [], error

    def play(self, data, on_start=None):
        if self.error:
            raise AudioDeviceError(self.error)
        if on_start:
            on_start()
        self.played.append(data)


class FakeApi:
    def __init__(self, response=None, error=None):
        self.response, self.error, self.uploads = response, error, []

    def talk(self, wav):
        self.uploads.append(wav)
        if self.error:
            raise self.error
        return self.response

    def download_audio(self, url):
        return SPEECH


REPLY = TalkResponse("robot_test", "merhaba", "Merhaba!", "happy", "https://x/api/robot/audio/1")


def run_once(api, mic=None, speaker=None):
    display = RecordingDisplay()
    companion = Companion(api, None, mic or FakeMicrophone(), speaker or FakeSpeaker(), display, OnceTrigger())
    stop = threading.Event()
    # Speed up error pauses in tests.
    original = stop.wait
    stop.wait = lambda timeout=None: original(0)  # type: ignore[method-assign]
    companion.run(stop)
    return companion, display


class CompanionTest(unittest.TestCase):
    def test_happy_path_speaks_with_emotion(self):
        speaker = FakeSpeaker()
        companion, display = run_once(FakeApi(REPLY), speaker=speaker)
        modes = [m for i, (m, _, _) in enumerate(display.history) if i == 0 or display.history[i - 1][0] != m]
        self.assertEqual(modes, ["listening", "thinking", "speaking", "idle"])
        self.assertIn(("speaking", "happy", "Merhaba!"), display.history)
        self.assertEqual(display.state.mode, "idle")
        self.assertEqual(display.state.emotion, "neutral")  # back to neutral once the reply ends
        self.assertEqual(len(speaker.played), 1)
        self.assertIs(companion.last_response, REPLY)

    def test_missing_microphone_shows_error(self):
        companion, display = run_once(FakeApi(REPLY), mic=FakeMicrophone(error="Mikrofon bulunamadı."))
        self.assertIn(("error", "neutral", "Mikrofon bulunamadı."), display.history)
        self.assertIsNone(companion.last_response)

    def test_short_recording_is_not_sent(self):
        api = FakeApi(REPLY)
        run_once(api, mic=FakeMicrophone(wav=encode_wav(np.zeros(1600, dtype=np.int16), 16000)))
        self.assertEqual(api.uploads, [])

    def test_silent_recording_is_not_sent(self):
        # A muted microphone (or no microphone permission on macOS) records pure zeros.
        api = FakeApi(REPLY)
        _, display = run_once(api, mic=FakeMicrophone(wav=encode_wav(np.zeros(16000, dtype=np.int16), 16000)))
        self.assertEqual(api.uploads, [])
        self.assertIn(("error", "neutral", "Ses algılanmadı. Mikrofonu kontrol edin."), display.history)

    def test_offline_and_auth_errors(self):
        _, display = run_once(FakeApi(error=NetworkError("Sunucuya bağlanılamadı.")))
        self.assertEqual(display.state.connection, "offline")
        _, display = run_once(FakeApi(error=AuthError("Geçersiz anahtar.")))
        self.assertEqual(display.state.connection, "auth_error")
        self.assertIn(("error", "neutral", "Geçersiz anahtar."), display.history)

    def test_speaker_failure_still_shows_answer(self):
        companion, display = run_once(FakeApi(REPLY), speaker=FakeSpeaker(error="Hoparlör bulunamadı."))
        self.assertIn(("speaking", "happy", "Merhaba!"), display.history)
        self.assertIn(("error", "neutral", "Hoparlör bulunamadı."), display.history)
        self.assertIs(companion.last_response, REPLY)


class AudioHelpersTest(unittest.TestCase):
    def test_envelope_is_normalized(self):
        env = loudness_envelope(SPEECH)
        self.assertEqual(len(env), 20)
        self.assertAlmostEqual(max(env), 1.0)

    def test_silence_and_level(self):
        self.assertTrue(is_silent(encode_wav(np.zeros(1600, dtype=np.int16), 16000)))
        self.assertFalse(is_silent(SPEECH))
        self.assertEqual(input_level(np.zeros((160, 1), dtype=np.int16)), 0.0)
        self.assertAlmostEqual(input_level(np.full((160, 1), 8000, dtype=np.int16)), 0.796, places=2)  # -12 dBFS

    def test_downsample_48k(self):
        samples, rate = _downsample(np.ones(48000, dtype=np.int16), 48000)
        self.assertEqual((len(samples), rate), (16000, 16000))


if __name__ == "__main__":
    unittest.main()
