"""
Comprehensive resource and pagination tests for Python SDK.
"""

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from convey import (
    Channel,
    Convey,
    SuppressionReason,
)


class ResourcesMockServerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/v1/suppressions"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "items": [
                    {"id": "sup_1", "recipient": "b1@example.com", "channel": "EMAIL", "reason": "HARD_BOUNCE"},
                    {"id": "sup_2", "recipient": "b2@example.com", "channel": "EMAIL", "reason": "SPAM_COMPLAINT"},
                ],
                "total": 2,
                "limit": 50,
                "offset": 0,
            }).encode("utf-8"))
            return

        if self.path.startswith("/v1/templates/welcome"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "template": {
                    "id": "tpl_1",
                    "slug": "welcome",
                    "name": "Welcome Email",
                    "category": "ONBOARDING",
                }
            }).encode("utf-8"))
            return

        if self.path.startswith("/api/v1/plugins/preferences/usr_123"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "recipientId": "usr_123",
                "topics": {"newsletter": True, "promotions": False},
            }).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path.startswith("/v1/suppressions"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "suppression": {
                    "id": "sup_new",
                    "recipient": "blocked@example.com",
                    "channel": "EMAIL",
                    "reason": "MANUAL_BLOCK",
                }
            }).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


class TestResources(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), ResourcesMockServerHandler)
        cls.port = cls.server.server_address[1]
        cls.server_thread = threading.Thread(target=cls.server.serve_forever)
        cls.server_thread.daemon = True
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_suppressions_add_and_list(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url)
        sup = client.suppressions.add(
            recipient="blocked@example.com",
            channel=Channel.EMAIL,
            reason=SuppressionReason.MANUAL_BLOCK,
        )
        self.assertEqual(sup.id, "sup_new")
        self.assertEqual(sup.recipient, "blocked@example.com")

        listing = client.suppressions.list()
        self.assertEqual(listing["total"], 2)
        self.assertEqual(len(listing["items"]), 2)

    def test_auto_pagination(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url)
        paginator = client.suppressions.list_auto_paging(limit=50)
        items = list(paginator)
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].recipient, "b1@example.com")

    def test_templates_get(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url)
        tpl = client.templates.get("welcome")
        self.assertEqual(tpl["template"]["slug"], "welcome")

    def test_preferences_get(self):
        client = Convey(api_key="sk_test_mock", base_url=self.base_url)
        prefs = client.preferences.get_preferences(tenant_id="tenant_1", recipient_id="usr_123")
        self.assertEqual(prefs["recipientId"], "usr_123")


if __name__ == "__main__":
    unittest.main()
