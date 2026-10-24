"""RobotApiClient against a local fake backend (real HTTP, no network, no hardware)."""

from __future__ import annotations

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from api_client import (
    AuthError,
    InvalidResponseError,
    NetworkError,
    RateLimitedError,
    RobotApiClient,
    ServerError,
    parse_talk_response,
)

TOKEN = "rbt_test"
DEVICE = "robot_test"


class FakeBackend(BaseHTTPRequestHandler):
    mode = "ok"
    last_upload = b""

    def log_message(self, *_):
        pass

    def _json(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        ok = self.headers.get("Authorization") == f"Bearer {TOKEN}" and self.headers.get("X-Robot-Id") == DEVICE
        if not ok:
            self._json(401, {"success": False, "error": {"code": "UNAUTHORIZED", "message": "Geçersiz anahtar."}})
        return ok

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        FakeBackend.last_upload = self.rfile.read(length)
        if not self._authorized():
            return
        if self.path == "/api/robot/heartbeat":
            return self._json(200, {"success": True, "robotId": DEVICE, "name": "Test"})
        mode = FakeBackend.mode
        if mode == "ratelimit":
            return self._json(429, {"success": False, "error": {"code": "RATE_LIMITED", "message": "Bekleyin."}})
        if mode == "server":
            return self._json(503, {"success": False, "error": {"code": "AI_UNAVAILABLE", "message": "Meşgul."}})
        if mode == "garbage":
            self.send_response(200)
            self.end_headers()
            return self.wfile.write(b"<html>not json</html>")
        port = self.server.server_address[1]
        self._json(
            200,
            {
                "success": True,
                "robotId": DEVICE,
                "transcript": "merhaba",
                "text": "Merhaba!",
                "emotion": "ecstatic" if mode == "weird-emotion" else "happy",
                "audioUrl": f"http://127.0.0.1:{port}/api/robot/audio/abc",
            },
        )

    def do_GET(self):  # noqa: N802
        if not self._authorized():
            return
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", "4")
        self.end_headers()
        self.wfile.write(b"RIFF")


class ApiClientTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), FakeBackend)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        FakeBackend.mode = "ok"
        self.client = RobotApiClient(self.url, DEVICE, TOKEN, timeout=5)

    def test_talk_uploads_wav_and_parses_response(self):
        result = self.client.talk(b"RIFF....WAVE")
        self.assertEqual(result.text, "Merhaba!")
        self.assertEqual(result.emotion, "happy")
        self.assertIn(b'name="audio"', FakeBackend.last_upload)
        self.assertEqual(self.client.download_audio(result.audio_url), b"RIFF")

    def test_unknown_emotion_becomes_neutral(self):
        FakeBackend.mode = "weird-emotion"
        self.assertEqual(self.client.talk(b"x").emotion, "neutral")

    def test_errors_are_typed(self):
        with self.assertRaises(AuthError):
            RobotApiClient(self.url, DEVICE, "wrong", timeout=5).talk(b"x")
        FakeBackend.mode = "ratelimit"
        with self.assertRaises(RateLimitedError):
            self.client.talk(b"x")
        FakeBackend.mode = "server"
        with self.assertRaises(ServerError) as ctx:
            self.client.talk(b"x")
        self.assertEqual(ctx.exception.message, "Meşgul.")
        FakeBackend.mode = "garbage"
        with self.assertRaises(InvalidResponseError):
            self.client.talk(b"x")

    def test_offline_is_a_network_error(self):
        with self.assertRaises(NetworkError):
            RobotApiClient("http://127.0.0.1:9", DEVICE, TOKEN, timeout=1).heartbeat()

    def test_refuses_audio_from_other_hosts(self):
        with self.assertRaises(InvalidResponseError):
            self.client.download_audio("https://evil.example.com/a.wav")

    def test_heartbeat(self):
        self.assertTrue(self.client.heartbeat()["success"])


class ParseTalkResponseTest(unittest.TestCase):
    def test_rejects_missing_text(self):
        with self.assertRaises(InvalidResponseError):
            parse_talk_response({"success": True, "text": "  ", "emotion": "happy"})

    def test_rejects_failure_payload(self):
        with self.assertRaises(InvalidResponseError):
            parse_talk_response({"success": False})


if __name__ == "__main__":
    unittest.main()
