"""
Tests for Convey client initialization and resource routing.
"""

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from convey import (
    Channel,
    Convey,
    ConveyError,
    MessagePriority,
    MessageStatus,
)


class MockServerHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if self.path == "/v1/messages":
            self.send_response(202)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "messageId": "msg_01J8K9P2X",
                "publicId": "msg_01J8K9P2X",
                "state": "accepted",
                "status": "ACCEPTED",
                "createdAt": "2026-08-28T10:00:00Z",
            }).encode("utf-8"))
            return

        if self.path == "/v1/messages/bulk":
            self.send_response(202)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "total": len(body.get("messages", [])),
                "items": [
                    {"publicId": f"msg_{i}", "state": "accepted"}
                    for i in range(len(body.get("messages", [])))
                ],
            }).encode("utf-8"))
            return

        if self.path == "/v1/batches":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "batch": {"id": "batch_123", "state": "INITIALIZING"},
            }).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        if self.path == "/v1/messages/msg_01J8K9P2X":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "publicId": "msg_01J8K9P2X",
                "channel": "EMAIL",
                "recipient": "alex@example.com",
                "status": "DELIVERED",
                "costUsd": 0.001,
            }).encode("utf-8"))
            return

        if self.path == "/v1/admin/telemetry/live":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "heapSaturation": 0.42,
                "activeWorkers": 8,
                "p95LatencyMs": 14.5,
                "systemHealth": "HEALTHY",
            }).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


class TestConveyClient(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), MockServerHandler)
        cls.port = cls.server.server_address[1]
        cls.server_thread = threading.Thread(target=cls.server.serve_forever)
        cls.server_thread.daemon = True
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_missing_api_key(self):
        with self.assertRaises(ConveyError):
            Convey(api_key="")

    def test_send_message_sync(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url)
        res = client.messages.send(
            channel=Channel.EMAIL,
            recipient="alex@example.com",
            content={"subject": "Test", "body": "Hello"},
            priority=MessagePriority.HIGH,
        )
        self.assertEqual(res.public_id, "msg_01J8K9P2X")
        self.assertEqual(res.status, "ACCEPTED")

    def test_send_bulk_sync(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url)
        bulk = client.messages.send_bulk([
            {"channel": "email", "recipient": "u1@example.com"},
            {"channel": "email", "recipient": "u2@example.com"},
        ])
        self.assertEqual(bulk.total, 2)
        self.assertEqual(len(bulk.items), 2)

    def test_get_message_sync(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url)
        msg = client.messages.get("msg_01J8K9P2X")
        self.assertEqual(msg.public_id, "msg_01J8K9P2X")
        self.assertEqual(msg.status, "DELIVERED")

    def test_live_telemetry(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url)
        telemetry = client.admin.get_live_telemetry()
        self.assertEqual(telemetry.heap_saturation, 0.42)
        self.assertEqual(telemetry.system_health, "HEALTHY")


if __name__ == "__main__":
    unittest.main()
