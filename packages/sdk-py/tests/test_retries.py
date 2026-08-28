"""
Tests for HTTP client retries, error mappings, and timeout management in Python SDK.
"""

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from convey import (
    Convey,
    ConveyAuthenticationError,
    ConveyConflictError,
    ConveyRateLimitError,
    ConveyValidationError,
)


class ChaosServerHandler(BaseHTTPRequestHandler):
    attempts = 0

    def do_GET(self):
        if self.path == "/test-retry":
            ChaosServerHandler.attempts += 1
            if ChaosServerHandler.attempts < 3:
                self.send_response(429)
                self.send_header("Retry-After", "0")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": {"code": "RATE_LIMITED", "message": "Rate limited"}}).encode("utf-8"))
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
            return

        if self.path == "/test-400":
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": {"code": "VALIDATION_ERROR", "message": "Invalid recipient"}}).encode("utf-8"))
            return

        if self.path == "/test-401":
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": {"code": "UNAUTHORIZED", "message": "Invalid API key"}}).encode("utf-8"))
            return

        if self.path == "/test-409":
            self.send_response(409)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": {"code": "CONFLICT", "message": "Idempotency key mismatch"}}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


class TestHttpRetries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ChaosServerHandler.attempts = 0
        cls.server = HTTPServer(("127.0.0.1", 0), ChaosServerHandler)
        cls.port = cls.server.server_address[1]
        cls.server_thread = threading.Thread(target=cls.server.serve_forever)
        cls.server_thread.daemon = True
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_retry_success(self):
        ChaosServerHandler.attempts = 0
        client = Convey(api_key="sk_test_mock", base_url=self.base_url, max_retries=3)
        res = client.http.request("GET", "/test-retry")
        self.assertTrue(res.get("success"))
        self.assertEqual(ChaosServerHandler.attempts, 3)

    def test_validation_error_mapping(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url, max_retries=0)
        with self.assertRaises(ConveyValidationError) as ctx:
            client.http.request("GET", "/test-400")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.error_code, "VALIDATION_ERROR")

    def test_authentication_error_mapping(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url, max_retries=0)
        with self.assertRaises(ConveyAuthenticationError) as ctx:
            client.http.request("GET", "/test-401")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_conflict_error_mapping(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url, max_retries=0)
        with self.assertRaises(ConveyConflictError) as ctx:
            client.http.request("GET", "/test-409")
        self.assertEqual(ctx.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
