"""
Comprehensive tests for advanced features in Convey Python SDK:
- Environment presets & Base URL resolution
- Mandatory Base URL validation
- Request/Response/Error Middlewares
- Token Bucket Rate Limiting
- Fluent MessageBuilder
- Lifecycle Polling Awaiters
- Webhook Handler & Test Event Generator
"""

import json
import os
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict

from convey import (
    Channel,
    Convey,
    ConveyConfigurationError,
    ConveyEnvironment,
    ConveyMiddleware,
    MessagePriority,
    TokenBucketRateLimiter,
    generate_test_event,
    normalize_base_url,
    resolve_base_url,
    resolve_environment_url,
)
from convey.webhook_handler import WebhookHandler


class FeaturesMockServerHandler(BaseHTTPRequestHandler):
    poll_count = 0

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if self.path == "/v1/messages":
            self.send_response(202)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "publicId": "msg_py_builder_01",
                "status": "ACCEPTED",
                "receivedBody": body,
            }).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        if self.path == "/v1/messages/msg_poll_py":
            FeaturesMockServerHandler.poll_count += 1
            status = "SENDING" if FeaturesMockServerHandler.poll_count < 3 else "DELIVERED"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "publicId": "msg_poll_py",
                "status": status,
                "channel": "EMAIL",
                "recipient": "user@test.com",
            }).encode("utf-8"))
            return

        if self.path == "/v1/batches/batch_poll_py":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "batch": {
                    "id": "batch_poll_py",
                    "state": "COMPLETED",
                    "totalCount": 50,
                    "processedCount": 50,
                },
            }).encode("utf-8"))
            return

        if self.path == "/test-mw":
            header_val = self.headers.get("x-custom-mw-header", "")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"receivedHeader": header_val}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


class TestFeatures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), FeaturesMockServerHandler)
        cls.port = cls.server.server_address[1]
        cls.server_thread = threading.Thread(target=cls.server.serve_forever)
        cls.server_thread.daemon = True
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_environment_presets_and_base_url_resolution(self):
        self.assertEqual(resolve_environment_url("production"), "https://api.convey.dev")
        self.assertEqual(resolve_environment_url(ConveyEnvironment.US), "https://us.api.convey.dev")
        self.assertEqual(resolve_environment_url(ConveyEnvironment.EU), "https://eu.api.convey.dev")
        self.assertEqual(resolve_environment_url(ConveyEnvironment.STAGING), "https://staging.api.convey.dev")
        self.assertEqual(resolve_environment_url(ConveyEnvironment.LOCAL), "http://localhost:3000")

        self.assertEqual(normalize_base_url("https://api.convey.dev///"), "https://api.convey.dev")

        # Test mandatory base URL fail-fast
        prev_env = os.environ.get("CONVEY_BASE_URL")
        if "CONVEY_BASE_URL" in os.environ:
            del os.environ["CONVEY_BASE_URL"]
        try:
            with self.assertRaises(ConveyConfigurationError):
                Convey(api_key="sk_test_123")
        finally:
            if prev_env is not None:
                os.environ["CONVEY_BASE_URL"] = prev_env

    def test_environment_option_initialization(self):
        client = Convey(api_key="sk_test_123", environment=ConveyEnvironment.EU)
        self.assertEqual(client.base_url, "https://eu.api.convey.dev")

        client.set_base_url("https://custom.endpoint.internal")
        self.assertEqual(client.base_url, "https://custom.endpoint.internal")

    def test_middleware_interceptor_pipeline(self):
        class HeaderInjectorMiddleware(ConveyMiddleware):
            def on_request(self, context: Dict[str, Any]) -> Dict[str, Any]:
                context["headers"]["x-custom-mw-header"] = "py_middleware_token"
                return context

        client = Convey(api_key="sk_test_123", base_url=self.base_url)
        client.use(HeaderInjectorMiddleware())

        res = client.http.request("GET", "/test-mw")
        self.assertEqual(res.get("receivedHeader"), "py_middleware_token")

    def test_fluent_message_builder(self):
        client = Convey(api_key="sk_test_123", base_url=self.base_url)

        res = (
            client.message()
            .to("alice@example.com")
            .email(subject="Welcome to Convey", html="<p>Welcome!</p>")
            .priority(MessagePriority.HIGH)
            .team("team_growth")
            .idempotency_key("idem_py_999")
            .send()
        )

        self.assertEqual(res.public_id, "msg_py_builder_01")
        self.assertEqual(res.status, "ACCEPTED")

    def test_polling_awaiters(self):
        FeaturesMockServerHandler.poll_count = 0
        client = Convey(api_key="sk_test_123", base_url=self.base_url)

        poll_history = []
        msg = client.messages.wait_for_delivery(
            "msg_poll_py",
            poll_interval_s=0.01,
            timeout_s=2.0,
            on_poll=lambda d: poll_history.append(d.status),
        )

        self.assertEqual(msg.status, "DELIVERED")
        self.assertEqual(len(poll_history), 3)

        batch = client.batches.wait_for_completion(
            "batch_poll_py",
            poll_interval_s=0.01,
            timeout_s=2.0,
        )
        self.assertEqual(batch.state, "COMPLETED")

    def test_webhook_handler_and_test_fixture_generator(self):
        secret = "whsec_test_secret_py123"
        received_events = []

        handler = WebhookHandler(
            secret=secret,
            handlers={
                "message.delivered": lambda evt: received_events.append(evt.id),
            },
        )

        fixture = generate_test_event(
            secret=secret,
            event_type="message.delivered",
            data={"messageId": "msg_wh_01"},
        )

        event = handler.process_raw(fixture["raw_body"], fixture["signature"])
        self.assertEqual(event.type, "message.delivered")
        self.assertEqual(len(received_events), 1)

    def test_token_bucket_rate_limiter(self):
        limiter = TokenBucketRateLimiter(requests_per_second=100, burst=5)
        # 5 immediate burst
        for _ in range(5):
            limiter.acquire()

        start = time.time()
        limiter.acquire()
        elapsed = time.time() - start
        self.assertGreaterEqual(elapsed, 0.005)


if __name__ == "__main__":
    unittest.main()
