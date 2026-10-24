"""Microphone recording (sounddevice/PortAudio), speaker playback (the OS's own player,
sounddevice as fallback), plus WAV helpers.

Hardware is imported lazily so the rest of the client (and the tests) work on a
computer without sounddevice, a microphone or a speaker.
"""

from __future__ import annotations

import atexit
import io
import logging
import math
import re
import shutil
import subprocess
import tempfile
import sys
import threading
import time
import wave
from pathlib import Path
from typing import Callable, List, Optional, Union

import numpy as np

log = logging.getLogger(__name__)

TARGET_RATE = 16000  # plenty for speech recognition and keeps uploads small
SILENCE_PEAK = 0.01  # a recording whose loudest sample is under 1 % of full scale has no speech


class AudioDeviceError(Exception):
    """Microphone or speaker missing / unusable. `message` is shown on screen."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# -- WAV helpers (pure) ---------------------------------------------------------


def encode_wav(samples: np.ndarray, rate: int) -> bytes:
    """int16 samples (mono, or shaped [frames, channels]) → WAV bytes."""
    samples = np.asarray(samples)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(samples.shape[1] if samples.ndim == 2 else 1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(np.asarray(samples, dtype=np.int16).tobytes())
    return buffer.getvalue()


def decode_wav(data: bytes) -> "tuple[np.ndarray, int]":
    """WAV bytes → (int16 samples shaped [frames, channels], sample rate). 16-bit PCM only."""
    try:
        with wave.open(io.BytesIO(data), "rb") as wav:
            if wav.getsampwidth() != 2:
                raise AudioDeviceError("Desteklenmeyen ses biçimi.")
            frames = wav.readframes(wav.getnframes())
            channels, rate = wav.getnchannels(), wav.getframerate()
    except (wave.Error, EOFError) as exc:
        raise AudioDeviceError("Ses dosyası okunamadı.") from exc
    samples = np.frombuffer(frames, dtype=np.int16).reshape(-1, channels)
    return samples, rate


def loudness_envelope(data: bytes, step_seconds: float = 0.05) -> List[float]:
    """0..1 loudness per `step_seconds`, used to animate the mouth while speaking."""
    try:
        samples, rate = decode_wav(data)
    except AudioDeviceError:
        return []
    mono = samples.astype(np.float32).mean(axis=1)
    step = max(1, int(rate * step_seconds))
    usable = len(mono) - len(mono) % step
    if usable == 0:
        return []
    rms = np.sqrt((mono[:usable].reshape(-1, step) ** 2).mean(axis=1))
    peak = float(rms.max()) or 1.0
    return [min(1.0, float(v) / peak) for v in rms]


def wav_duration(data: bytes) -> float:
    samples, rate = decode_wav(data)
    return len(samples) / rate


def is_silent(data: bytes) -> bool:
    """True for a muted microphone or missing microphone permission (macOS records pure zeros)."""
    samples, _ = decode_wav(data)
    return samples.size == 0 or int(np.abs(samples.astype(np.int32)).max()) < SILENCE_PEAK * 32768


def input_level(block: np.ndarray) -> float:
    """0..1 loudness of an int16 block on a -60…0 dBFS scale, for the on-screen meter."""
    rms = float(np.sqrt(np.mean(block.astype(np.float32) ** 2))) / 32768
    return 0.0 if rms <= 0 else min(1.0, max(0.0, (20 * math.log10(rms) + 60) / 60))


def _downsample(samples: np.ndarray, rate: int) -> "tuple[np.ndarray, int]":
    """Averages blocks when the device rate is a multiple of 16 kHz (48000 → 16000)."""
    if rate == TARGET_RATE or rate % TARGET_RATE:
        return samples, rate
    factor = rate // TARGET_RATE
    usable = len(samples) - len(samples) % factor
    return samples[:usable].reshape(-1, factor).mean(axis=1).astype(np.int16), TARGET_RATE


def _resample(samples: np.ndarray, rate: int, target: int) -> np.ndarray:
    """Linear-interpolation resampling for devices that reject the file's rate."""
    if rate == target:
        return samples
    frames = len(samples)
    positions = np.linspace(0, frames - 1, int(frames * target / rate))
    channels = [np.interp(positions, np.arange(frames), samples[:, c]) for c in range(samples.shape[1])]
    return np.stack(channels, axis=1).astype(np.int16)


# -- Recording ------------------------------------------------------------------


def _sounddevice():
    try:
        import sounddevice as sd  # noqa: PLC0415 - optional hardware dependency

        return sd
    except (ImportError, OSError) as exc:  # OSError: PortAudio library missing
        raise AudioDeviceError("Ses sistemi kullanılamıyor (sounddevice/PortAudio kurulu değil).") from exc


class Microphone:
    """Records from a USB microphone until `stop` is set or `max_seconds` pass."""

    live = True  # recording length is controlled by push-to-talk

    def __init__(self, device: Optional[Union[int, str]] = None):
        self.device = device
        self.level = 0.0  # live loudness (0..1) while recording; read by the display's meter

    def check(self) -> str:
        sd = _sounddevice()
        try:
            info = sd.query_devices(self.device, kind="input")
        except (ValueError, sd.PortAudioError) as exc:
            raise AudioDeviceError("Mikrofon bulunamadı.") from exc
        return str(info["name"])

    def record(self, stop: threading.Event, max_seconds: float) -> bytes:
        sd = _sounddevice()
        chunks: List[np.ndarray] = []

        def callback(indata, _frames, _time, status):
            if status:
                log.debug("input status: %s", status)
            chunks.append(indata.copy())
            self.level = input_level(indata)

        rate = TARGET_RATE
        try:
            stream = sd.InputStream(samplerate=rate, channels=1, dtype="int16", device=self.device, callback=callback)
        except (ValueError, sd.PortAudioError):
            # Many USB microphones only offer 44.1/48 kHz; record natively, downsample after.
            try:
                rate = int(sd.query_devices(self.device, kind="input")["default_samplerate"])
                stream = sd.InputStream(
                    samplerate=rate, channels=1, dtype="int16", device=self.device, callback=callback
                )
            except (ValueError, sd.PortAudioError) as exc:
                raise AudioDeviceError("Mikrofon bulunamadı.") from exc

        try:
            with stream:
                stop.wait(timeout=max_seconds)
        finally:
            self.level = 0.0
        if not chunks:
            return encode_wav(np.zeros(0, dtype=np.int16), TARGET_RATE)
        samples, rate = _downsample(np.concatenate(chunks)[:, 0], rate)
        return encode_wav(samples, rate)


class WavFileSource:
    """Development stand-in for the microphone: 'records' an existing WAV file."""

    live = False

    def __init__(self, path: Path):
        self.path = path

    def check(self) -> str:
        if not self.path.exists():
            raise AudioDeviceError(f"WAV dosyası bulunamadı: {self.path}")
        return f"WAV dosyası ({self.path.name})"

    def record(self, stop: threading.Event, max_seconds: float) -> bytes:
        self.check()
        return self.path.read_bytes()


# -- Playback -------------------------------------------------------------------


# Fixed-size callback blocks for sounddevice playback. With blocksize 0, PortAudio on macOS asked
# the Python callback for 0.6 ms blocks (24 kHz speech on 48 kHz speakers), and the simulator crackled.
PLAYBACK_BLOCK = 2048
# Measured on a MacBook: afplay's sound starts ≈150 ms after launch. The mouth waits as long.
START_LATENCY = {"afplay": 0.15}

_players: "set[subprocess.Popen]" = set()


@atexit.register
def _stop_players() -> None:
    """Closing the app mid-sentence (Esc, Ctrl+C) also stops the voice."""
    for process in list(_players):
        process.terminate()


def _run_player(
    command: List[str], data: bytes, on_start: Optional[Callable[[], None]], start_latency: float = 0.0
) -> None:
    """Plays a WAV file with an external player and waits until it has finished."""
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            process = subprocess.Popen([*command, tmp.name], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        except OSError as exc:
            raise AudioDeviceError("Hoparlör bulunamadı veya ses çalınamadı.") from exc
        _players.add(process)
        try:
            if on_start:
                try:
                    process.wait(timeout=start_latency)  # keeps the mouth in step with the voice
                except subprocess.TimeoutExpired:
                    pass
                on_start()
            _, err = process.communicate()
        finally:
            _players.discard(process)
    if process.returncode != 0:
        log.warning("%s exited with %s: %s", command[0], process.returncode, err.decode(errors="replace").strip()[:200])
        raise AudioDeviceError("Hoparlör bulunamadı veya ses çalınamadı.")


class Speaker:
    """Plays WAV bytes on the speaker. Blocks until the sound has finished.

    The operating system's own player does the playback in a separate process (afplay on
    macOS, aplay on Linux), so no Python code runs in the real-time audio path and the face's
    render loop can't disturb the sound. sounddevice is the fallback, and handles a
    ROBOT_OUTPUT_DEVICE that the native player can't address.
    """

    def __init__(self, device: Optional[Union[int, str]] = None):
        self.device = device

    def check(self) -> str:
        player = self._native_player()
        try:
            sd = _sounddevice()
        except AudioDeviceError:
            if player:
                return f"varsayılan hoparlör ({player[0]})"
            raise
        try:
            info = sd.query_devices(self.device, kind="output")
        except (ValueError, sd.PortAudioError) as exc:
            raise AudioDeviceError("Hoparlör bulunamadı.") from exc
        return f"{info['name']} ({player[0] if player else 'sounddevice'})"

    def play(self, data: bytes, on_start: Optional[Callable[[], None]] = None) -> None:
        samples, rate = decode_wav(data)
        player = self._native_player()
        if player:
            try:
                # Re-encoded: streamed TTS WAVs carry placeholder sizes (0xFFFFFFFF) in the header.
                return _run_player(player, encode_wav(samples, rate), on_start, START_LATENCY.get(player[0], 0.0))
            except AudioDeviceError:
                log.warning("%s failed; trying sounddevice", player[0])
        self._play_with_sounddevice(samples, rate, on_start)

    def _native_player(self) -> Optional[List[str]]:
        if sys.platform == "darwin":
            # afplay always uses the system output device; a chosen device goes through sounddevice.
            return ["afplay"] if self.device is None and shutil.which("afplay") else None
        if not shutil.which("aplay"):
            return None
        if self.device is None:
            return ["aplay", "-q"]
        alsa = self._alsa_device()
        return ["aplay", "-q", "-D", alsa] if alsa else None

    def _alsa_device(self) -> Optional[str]:
        """ALSA name for ROBOT_OUTPUT_DEVICE: sounddevice lists cards as 'USB Audio: - (hw:2,0)'."""
        try:
            sd = _sounddevice()
        except AudioDeviceError:
            return None
        try:
            name = str(sd.query_devices(self.device, kind="output")["name"])
        except (ValueError, sd.PortAudioError):
            return None
        match = re.search(r"\(hw:(\d+),(\d+)\)", name)
        return f"plughw:{match.group(1)},{match.group(2)}" if match else None

    def _play_with_sounddevice(
        self, samples: np.ndarray, rate: int, on_start: Optional[Callable[[], None]]
    ) -> None:
        sd = _sounddevice()
        for target in (rate, 48000, 44100):
            try:
                audio = _resample(samples, rate, target)
                if on_start:
                    on_start()
                sd.play(audio, samplerate=target, device=self.device, blocksize=PLAYBACK_BLOCK)
                sd.wait()
                return
            except (ValueError, sd.PortAudioError) as exc:
                log.warning("playback at %s Hz failed: %s", target, exc)
        raise AudioDeviceError("Hoparlör bulunamadı veya ses çalınamadı.")


class SilentSpeaker:
    """Development stand-in: saves the reply instead of playing it, and waits as long as it would play."""

    def __init__(self, save_to: Optional[Path] = None, realtime: bool = True):
        self.save_to = save_to
        self.realtime = realtime

    def check(self) -> str:
        return f"Hoparlör yok (yanıt {self.save_to} dosyasına kaydedilir)" if self.save_to else "Hoparlör yok"

    def play(self, data: bytes, on_start: Optional[Callable[[], None]] = None) -> None:
        if self.save_to:
            self.save_to.write_bytes(data)
        if on_start:
            on_start()
        if self.realtime:
            time.sleep(min(wav_duration(data), 30))
