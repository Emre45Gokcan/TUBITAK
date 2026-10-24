"""Configuration from environment variables (and an optional .env file next to this script)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent


class ConfigError(Exception):
    pass


def load_dotenv(path: Path) -> None:
    """Minimal .env reader (KEY=value lines). Real environment variables win."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


def _device(value: Optional[str]) -> Optional[Union[int, str]]:
    """sounddevice accepts a device index or (part of) a device name."""
    if not value:
        return None
    return int(value) if value.isdigit() else value


@dataclass(frozen=True)
class Config:
    api_url: str
    device_id: str
    device_token: str
    trigger: str = "keyboard"  # keyboard | gpio | screen
    button_pin: int = 17
    display: str = "window"  # window | fullscreen | console
    screen_width: int = 480
    screen_height: int = 320
    input_device: Optional[Union[int, str]] = None
    output_device: Optional[Union[int, str]] = None
    max_recording_seconds: int = 30
    heartbeat_seconds: int = 30
    request_timeout_seconds: int = 75
    log_level: str = "INFO"

    @staticmethod
    def from_env(env_file: Optional[Path] = None) -> "Config":
        load_dotenv(env_file or HERE / ".env")
        missing = [k for k in ("ROBOT_API_URL", "ROBOT_DEVICE_ID", "ROBOT_DEVICE_TOKEN") if not os.environ.get(k)]
        if missing:
            raise ConfigError(f"Eksik ortam değişkeni: {', '.join(missing)} (.env.example dosyasına bakın)")

        api_url = os.environ["ROBOT_API_URL"].rstrip("/")
        parsed = urlparse(api_url)
        local = parsed.hostname in ("localhost", "127.0.0.1", "::1")
        if parsed.scheme != "https" and not local and os.environ.get("ROBOT_ALLOW_INSECURE") != "1":
            raise ConfigError("ROBOT_API_URL https:// ile başlamalı (yerel test için localhost kullanılabilir).")

        def number(key: str, default: int) -> int:
            try:
                return int(os.environ.get(key, default))
            except ValueError as exc:
                raise ConfigError(f"{key} bir sayı olmalı") from exc

        trigger = os.environ.get("ROBOT_TRIGGER", "keyboard")
        display = os.environ.get("ROBOT_DISPLAY", "window")
        if trigger not in ("keyboard", "gpio", "screen"):
            raise ConfigError("ROBOT_TRIGGER keyboard, gpio veya screen olmalı")
        if display not in ("window", "fullscreen", "console"):
            raise ConfigError("ROBOT_DISPLAY window, fullscreen veya console olmalı")

        return Config(
            api_url=api_url,
            device_id=os.environ["ROBOT_DEVICE_ID"].strip(),
            device_token=os.environ["ROBOT_DEVICE_TOKEN"].strip(),
            trigger=trigger,
            button_pin=number("ROBOT_BUTTON_PIN", 17),
            display=display,
            screen_width=number("ROBOT_SCREEN_WIDTH", 480),
            screen_height=number("ROBOT_SCREEN_HEIGHT", 320),
            input_device=_device(os.environ.get("ROBOT_INPUT_DEVICE")),
            output_device=_device(os.environ.get("ROBOT_OUTPUT_DEVICE")),
            max_recording_seconds=min(number("ROBOT_MAX_RECORDING_SECONDS", 30), 60),
            heartbeat_seconds=max(number("ROBOT_HEARTBEAT_SECONDS", 30), 10),
            request_timeout_seconds=number("ROBOT_REQUEST_TIMEOUT_SECONDS", 75),
            log_level=os.environ.get("ROBOT_LOG_LEVEL", "INFO").upper(),
        )
