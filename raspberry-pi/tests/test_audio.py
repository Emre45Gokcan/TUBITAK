"""Speaker playback: native player choice per OS, blocking until done, sounddevice fallback."""

from __future__ import annotations

import sys
import time
import unittest
from unittest import mock

import numpy as np

import audio
from audio import AudioDeviceError, Speaker, decode_wav, encode_wav

SPEECH = encode_wav((np.sin(np.arange(2400) / 5) * 8000).astype(np.int16), 24000)  # 0.1 s at 24 kHz


def streamed(wav: bytes) -> bytes:
    """Same audio with the placeholder sizes a streaming TTS response puts in the header."""
    data = bytearray(wav)
    data[4:8] = data[40:44] = b"\xff\xff\xff\xff"
    return bytes(data)


class FakeSoundDevice:
    PortAudioError = RuntimeError

    def __init__(self, name="USB Audio Device: - (hw:2,0)"):
        self.name, self.played = name, []

    def query_devices(self, device=None, kind=None):
        return {"name": self.name}

    def play(self, audio_data, samplerate, device=None, blocksize=None):
        self.played.append((len(audio_data), samplerate, blocksize))

    def wait(self):
        pass


def which(*available):
    return lambda name: f"/usr/bin/{name}" if name in available else None


class NativePlayerChoiceTest(unittest.TestCase):
    def test_macos_uses_afplay_for_the_default_device(self):
        with mock.patch.object(sys, "platform", "darwin"), mock.patch("shutil.which", which("afplay")):
            self.assertEqual(Speaker()._native_player(), ["afplay"])
            self.assertIsNone(Speaker("USB")._native_player())  # afplay can't pick a device

    def test_linux_uses_aplay_and_maps_the_configured_card(self):
        fake = FakeSoundDevice()
        with mock.patch.object(sys, "platform", "linux"), mock.patch("shutil.which", which("aplay")), \
                mock.patch.object(audio, "_sounddevice", return_value=fake):
            self.assertEqual(Speaker()._native_player(), ["aplay", "-q"])
            self.assertEqual(Speaker("USB")._native_player(), ["aplay", "-q", "-D", "plughw:2,0"])
            fake.name = "pulse"  # not an ALSA card: leave it to sounddevice
            self.assertIsNone(Speaker("pulse")._native_player())

    def test_no_native_player(self):
        with mock.patch.object(sys, "platform", "linux"), mock.patch("shutil.which", which()):
            self.assertIsNone(Speaker()._native_player())


class PlaybackTest(unittest.TestCase):
    def player(self, script: str):
        """A stand-in native player: a Python one-liner that receives the WAV path."""
        return mock.patch.object(Speaker, "_native_player", return_value=[sys.executable, "-c", script])

    def test_blocks_until_the_player_finishes(self):
        events = []
        with self.player("import time; time.sleep(0.3)"):
            began = time.monotonic()
            Speaker().play(SPEECH, on_start=lambda: events.append("start"))
        self.assertGreaterEqual(time.monotonic() - began, 0.3)
        self.assertEqual(events, ["start"])

    def test_player_gets_a_clean_wav_header(self):
        # Exits non-zero unless the file it receives has correct sizes and the same audio.
        check = (
            "import sys, wave; w = wave.open(sys.argv[1]); "
            "sys.exit(0 if (w.getnchannels(), w.getframerate(), w.getnframes()) == (1, 24000, 2400) else 3)"
        )
        fallback = mock.patch.object(Speaker, "_play_with_sounddevice", side_effect=AssertionError("fell back"))
        with self.player(check), fallback:
            Speaker().play(streamed(SPEECH))

    def test_failed_player_falls_back_to_sounddevice(self):
        fake = FakeSoundDevice()
        with self.player("import sys; sys.exit(1)"), mock.patch.object(audio, "_sounddevice", return_value=fake):
            Speaker().play(SPEECH)
        self.assertEqual(fake.played, [(2400, 24000, audio.PLAYBACK_BLOCK)])

    def test_nothing_works(self):
        with mock.patch.object(Speaker, "_native_player", return_value=None), \
                mock.patch.object(audio, "_sounddevice", side_effect=AudioDeviceError("Ses sistemi yok.")):
            with self.assertRaises(AudioDeviceError):
                Speaker().play(SPEECH)


class WavHelpersTest(unittest.TestCase):
    def test_streamed_header_decodes(self):
        samples, rate = decode_wav(streamed(SPEECH))
        self.assertEqual((samples.shape, rate), ((2400, 1), 24000))

    def test_stereo_round_trip(self):
        stereo = np.stack([np.arange(100), -np.arange(100)], axis=1).astype(np.int16)
        samples, rate = decode_wav(encode_wav(stereo, 48000))
        self.assertEqual(rate, 48000)
        np.testing.assert_array_equal(samples, stereo)


if __name__ == "__main__":
    unittest.main()
