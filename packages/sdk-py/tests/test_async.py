"""
Tests for AsyncConvey client in Python SDK.
"""

import asyncio
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from convey import AsyncConvey, Channel, MessagePriority


class AsyncMockServerHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/v1/messages":
            self.send_response(202)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "publicId": "msg_async_123",
                "state": "accepted",
                "status": "ACCEPTED",
                "createdAt": "2026-08-28T10:00:00Z",
            }).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


class TestAsyncConvey(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), AsyncMockServerHandler)
        cls.port = cls.server.server_address[1]
        cls.server_thread = threading.Thread(target=cls.server.serve_forever)
        cls.server_thread.daemon = True
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    async def test_async_send_message(self):
        client = AsyncConvey(api_key="sk_test_mock", base_url=self.base_url)
        res = await client.messages.send(
            channel=Channel.SMS,
            recipient="+14155552671",
            content={"body": "Async verification code: 123456"},
            priority=MessagePriority.CRITICAL,
        )
        self.assertEqual(res.public_id, "msg_async_123")
        self.assertEqual(res.status, "ACCEPTED")


if __name__ == "__main__":
    unittest.main()
