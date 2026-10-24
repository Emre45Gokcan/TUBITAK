#!/usr/bin/env python3
"""Raspberry Pi AI companion client.

  python main.py                       # robot mode (microphone, speaker, screen)
  python main.py --desktop             # desktop simulator: face window with a talk button (Space / click)
  python main.py --check               # test configuration, audio devices and backend
  python main.py --wav test.wav        # no microphone: send a WAV file on each Enter
  python main.py --wav test.wav --once --no-audio --display console   # one-shot, no hardware
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import threading
from pathlib import Path

from api_client import ApiError, RobotApiClient
from audio import AudioDeviceError, Microphone, SilentSpeaker, Speaker, WavFileSource
from companion import Companion
from config import Config, ConfigError
from controls import GpioTrigger, KeyboardTrigger, OnceTrigger, ScreenTrigger
from display import make_display

log = logging.getLogger("robot")

DESKTOP_WINDOW = (800, 620)  # the robot's LCD is smaller; the window is resizable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Raspberry Pi yardımcı robot istemcisi")
    parser.add_argument(
        "--desktop", action="store_true", help="masaüstü simülatörü: yüz penceresi ve Konuş düğmesi (Boşluk / tıklama)"
    )
    parser.add_argument("--check", action="store_true", help="yapılandırmayı, ses aygıtlarını ve sunucuyu test et")
    parser.add_argument("--wav", type=Path, help="mikrofon yerine bu WAV dosyasını gönder")
    parser.add_argument("--once", action="store_true", help="tek bir konuşma yap ve çık")
    parser.add_argument("--no-audio", action="store_true", help="hoparlör kullanma; yanıtı dosyaya kaydet")
    parser.add_argument("--save-reply", type=Path, default=Path("last-reply.wav"), help="--no-audio ile yanıt dosyası")
    parser.add_argument("--display", choices=["window", "fullscreen", "console"], help="ROBOT_DISPLAY değerini geçersiz kıl")
    parser.add_argument("--env-file", type=Path, help=".env dosyasının yolu (varsayılan: bu klasördeki .env)")
    return parser.parse_args()


def run_checks(config: Config, args: argparse.Namespace) -> int:
    ok = True

    def report(name: str, fn) -> None:
        nonlocal ok
        try:
            print(f"  ✓ {name}: {fn()}")
        except (AudioDeviceError, ApiError) as exc:
            ok = False
            print(f"  ✗ {name}: {exc.message}")

    print("Yapılandırma:")
    print(f"  sunucu     {config.api_url}")
    print(f"  cihaz      {config.device_id}")
    print(f"  anahtar    {config.device_token[:10]}…")
    print(f"  tetikleyici {'screen' if args.desktop else config.trigger}, ekran {display_kind(config, args)}")
    print("Kontroller:")
    source = WavFileSource(args.wav) if args.wav else Microphone(config.input_device)
    report("mikrofon", source.check)
    if not args.no_audio:
        report("hoparlör", Speaker(config.output_device).check)
    api = RobotApiClient(config.api_url, config.device_id, config.device_token, timeout=15)
    report("sunucu", lambda: f"bağlandı ({api.heartbeat().get('name', '')})")
    return 0 if ok else 1


def display_kind(config: Config, args: argparse.Namespace) -> str:
    return args.display or ("window" if args.desktop else config.display)


def main() -> int:
    args = parse_args()
    try:
        config = Config.from_env(args.env_file)
    except ConfigError as exc:
        print(f"Yapılandırma hatası: {exc}", file=sys.stderr)
        return 2

    logging.basicConfig(level=config.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if args.check:
        return run_checks(config, args)

    def client(timeout: float) -> RobotApiClient:
        return RobotApiClient(config.api_url, config.device_id, config.device_token, timeout=timeout)

    microphone = WavFileSource(args.wav) if args.wav else Microphone(config.input_device)
    speaker = SilentSpeaker(save_to=args.save_reply) if args.no_audio else Speaker(config.output_device)
    kind = display_kind(config, args)
    trigger_kind = "screen" if args.desktop else config.trigger
    if args.once:
        trigger = OnceTrigger()
    elif trigger_kind == "screen" and kind != "console":
        trigger = ScreenTrigger()
    elif trigger_kind == "gpio" and not args.wav:
        trigger = GpioTrigger(config.button_pin)
    else:
        trigger = KeyboardTrigger("WAV dosyasını göndermek için Enter'a basın…" if args.wav else "Konuşmak için Enter'a basın…")
    display = make_display(
        kind,
        *(DESKTOP_WINDOW if args.desktop else (config.screen_width, config.screen_height)),
        controls=trigger if isinstance(trigger, ScreenTrigger) else None,
        level_source=lambda: getattr(microphone, "level", 0.0),
    )

    companion = Companion(
        api=client(config.request_timeout_seconds),
        # Separate HTTP session: requests.Session isn't safe to share across threads.
        heartbeat_api=None if args.once else client(10),
        microphone=microphone,
        speaker=speaker,
        display=display,
        trigger=trigger,
        max_recording_seconds=config.max_recording_seconds,
        heartbeat_seconds=config.heartbeat_seconds,
    )

    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())

    worker = threading.Thread(target=companion.run, args=(stop,), name="companion", daemon=True)
    worker.start()
    display.run(stop)  # the screen needs the main thread
    stop.set()
    worker.join(timeout=5)

    if args.once:
        return 0 if companion.last_response is not None else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
