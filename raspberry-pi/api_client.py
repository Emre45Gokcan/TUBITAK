"""HTTPS client for the web app's robot API. No hardware dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import requests

EMOTIONS = ("happy", "neutral", "angry")


def normalize_emotion(value: object) -> str:
    """The backend picks the emotion; anything unexpected is shown as neutral."""
    return value if isinstance(value, str) and value in EMOTIONS else "neutral"


class ApiError(Exception):
    """Base class; `message` is short and safe to show on the robot's screen."""

    def __init__(self, message: str, code: str = "ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class NetworkError(ApiError):
    """No connection (Wi-Fi down, DNS failure, server unreachable) or a timeout."""


class AuthError(ApiError):
    """Wrong device id/token, or the robot was deactivated in the dashboard."""


class RateLimitedError(ApiError):
    pass


class ServerError(ApiError):
    """The backend answered with an error (e.g. AI service unavailable)."""


class InvalidResponseError(ApiError):
    pass


@dataclass(frozen=True)
class TalkResponse:
    robot_id: str
    transcript: str
    text: str
    emotion: str
    audio_url: Optional[str]


class RobotApiClient:
    def __init__(self, api_url: str, device_id: str, device_token: str, timeout: float = 75.0):
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {device_token}",
                "X-Robot-Id": device_id,
                "User-Agent": "robot-companion/1.0",
            }
        )

    # -- requests -----------------------------------------------------------------

    def _request(self, method: str, path_or_url: str, timeout: float, **kwargs) -> requests.Response:
        url = path_or_url if path_or_url.startswith("http") else f"{self.api_url}{path_or_url}"
        try:
            response = self.session.request(method, url, timeout=(10, timeout), **kwargs)
        except requests.Timeout as exc:
            raise NetworkError("Sunucu zamanında yanıt vermedi.", "TIMEOUT") from exc
        except requests.ConnectionError as exc:
            raise NetworkError("Sunucuya bağlanılamadı. İnternet bağlantısını kontrol edin.", "OFFLINE") from exc
        except requests.RequestException as exc:
            raise NetworkError(f"İstek başarısız: {exc.__class__.__name__}", "REQUEST_FAILED") from exc

        if response.status_code < 400:
            return response

        code, message = "HTTP_ERROR", f"Sunucu hatası ({response.status_code})."
        try:
            error = response.json().get("error") or {}
            code = str(error.get("code") or code)
            message = str(error.get("message") or message)
        except ValueError:
            pass
        if response.status_code in (401, 403):
            raise AuthError(message, code)
        if response.status_code == 429:
            raise RateLimitedError(message, code)
        raise ServerError(message, code)

    def heartbeat(self) -> dict:
        response = self._request("POST", "/api/robot/heartbeat", timeout=10)
        try:
            body = response.json()
        except ValueError as exc:
            raise InvalidResponseError("Sunucudan geçersiz yanıt.") from exc
        if not isinstance(body, dict) or body.get("success") is not True:
            raise InvalidResponseError("Sunucudan geçersiz yanıt.")
        return body

    def talk(self, wav_bytes: bytes) -> TalkResponse:
        response = self._request(
            "POST",
            "/api/robot/talk",
            timeout=self.timeout,
            files={"audio": ("recording.wav", wav_bytes, "audio/wav")},
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise InvalidResponseError("Sunucudan geçersiz yanıt.") from exc
        return parse_talk_response(body)

    def download_audio(self, url: str) -> bytes:
        # Audio URLs must point at our own backend: the token is sent with the request.
        own, target = urlparse(self.api_url), urlparse(url)
        if (target.scheme, target.netloc) != (own.scheme, own.netloc):
            raise InvalidResponseError("Ses adresi beklenen sunucuya ait değil.")
        response = self._request("GET", url, timeout=30)
        if not response.content:
            raise InvalidResponseError("Boş ses dosyası.")
        return response.content


def parse_talk_response(body: object) -> TalkResponse:
    """Validates the /api/robot/talk JSON so the rest of the client can trust it."""
    if not isinstance(body, dict) or body.get("success") is not True:
        raise InvalidResponseError("Sunucudan geçersiz yanıt.")
    text = body.get("text")
    if not isinstance(text, str) or not text.strip():
        raise InvalidResponseError("Yanıt metni eksik.")
    audio_url = body.get("audioUrl")
    return TalkResponse(
        robot_id=str(body.get("robotId", "")),
        transcript=str(body.get("transcript") or ""),
        text=text.strip(),
        emotion=normalize_emotion(body.get("emotion")),
        audio_url=audio_url if isinstance(audio_url, str) and audio_url else None,
    )
