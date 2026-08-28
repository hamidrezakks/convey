"""
Live End-to-End Test Suite for Python SDK against real running Convey server.
"""

import os
import unittest

from convey import (
    AsyncConvey,
    Channel,
    Convey,
    MessagePriority,
    MessageStatus,
    SuppressionReason,
)


class TestLiveE2E(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_url = os.getenv("CONVEY_BASE_URL")
        cls.api_key = os.getenv("CONVEY_API_KEY", "cv_live_secret_key_e2e_testing_99887766554433221100")
        if not cls.base_url:
            raise unittest.SkipTest("CONVEY_BASE_URL not set; skipping live E2E server test")

    def test_sync_live_e2e(self):
        client = Convey(
            api_key=self.api_key,
            base_url=self.base_url,
            is_sandbox=True,
            timeout=10.0,
            max_retries=2,
        )

        # 1. Live Telemetry
        telemetry = client.admin.get_live_telemetry()
        self.assertIsNotNone(telemetry)
        self.assertTrue(telemetry.subsystems is not None or telemetry.system_health is not None)

        # 2. Single Message Send
        res = client.messages.send(
            channel=Channel.EMAIL,
            recipient="py_e2e@example.com",
            priority=MessagePriority.HIGH,
            content={
                "subject": "Python SDK E2E Live Test",
                "body": "<p>Testing live Convey server with Python SDK</p>",
            },
            category="TESTING",
        )
        self.assertTrue(res.public_id.startswith("msg_"))
        self.assertEqual(res.status, "ACCEPTED")

        # 3. Bulk Messages
        bulk = client.messages.send_bulk([
            {"channel": "EMAIL", "recipient": "py_bulk_1@example.com", "content": {"body": "B1"}},
            {"channel": "EMAIL", "recipient": "py_bulk_2@example.com", "content": {"body": "B2"}},
        ])
        self.assertEqual(bulk.total, 2)
        self.assertEqual(len(bulk.items), 2)
        self.assertTrue(bulk.items[0].public_id.startswith("msg_"))

        # 4. Template Preview
        preview = client.messages.preview_template(
            template="Hello {{user}}, your order {{orderNum}} is confirmed.",
            variables={"user": "PySnake", "orderNum": "#PY99"},
            recipient="py_e2e@example.com",
        )
        self.assertEqual(preview.rendered, "Hello PySnake, your order #PY99 is confirmed.")

        # 5. Suppressions Add & List
        sup = client.suppressions.add(
            recipient="py_blocked@example.com",
            channel=Channel.EMAIL,
            reason=SuppressionReason.MANUAL_BLOCK,
        )
        self.assertTrue(sup.recipient == "py_blocked@example.com" or sup.id != "")

        listing = client.suppressions.list(limit=10)
        self.assertGreaterEqual(listing["total"], 1)

        # 6. Sandbox Inspect & Clear
        sandbox_res = client.sandbox.list_messages()
        sandbox_msgs = sandbox_res.get("messages", sandbox_res) if isinstance(sandbox_res, dict) else sandbox_res
        self.assertIsInstance(sandbox_msgs, list)

        clear_res = client.sandbox.clear_messages()
        self.assertTrue(clear_res.get("success", True))

    async def test_async_live_e2e(self):
        client = AsyncConvey(
            api_key=self.api_key,
            base_url=self.base_url,
            is_sandbox=True,
            timeout=10.0,
            max_retries=2,
        )

        res = await client.messages.send(
            channel=Channel.SMS,
            recipient="+14155552671",
            priority=MessagePriority.CRITICAL,
            content={"body": "Async Python verification code: 884-102"},
            category="SECURITY",
        )
        self.assertTrue(res.public_id.startswith("msg_"))
        self.assertEqual(res.status, "ACCEPTED")


if __name__ == "__main__":
    unittest.main()
