"""
Tests for webhook cryptographic signature verification in Python SDK.
"""

import hashlib
import hmac
import time
import unittest

from convey import (
    ConveySecurityError,
    construct_webhook_event,
    verify_webhook_signature,
)


class TestCrypto(unittest.TestCase):
    def test_verify_webhook_signature(self):
        secret = "whsec_test_python_secret"
        payload = b'{"id":"evt_01J8K9P2X","type":"message.delivered","timestamp":1724800000}'
        timestamp = int(time.time())

        signed_content = f"{timestamp}.".encode("utf-8") + payload
        expected_sig = hmac.new(secret.encode("utf-8"), signed_content, hashlib.sha256).hexdigest()
        header = f"t={timestamp},v1={expected_sig}"

        # 1. Valid signature
        self.assertTrue(verify_webhook_signature(payload, header, secret, tolerance_seconds=300))

        # 2. Tampered payload
        self.assertFalse(verify_webhook_signature(b'{"id":"evt_tampered"}', header, secret, tolerance_seconds=300))

        # 3. Expired timestamp
        expired_ts = timestamp - 600
        expired_signed = f"{expired_ts}.".encode("utf-8") + payload
        expired_sig = hmac.new(secret.encode("utf-8"), expired_signed, hashlib.sha256).hexdigest()
        expired_header = f"t={expired_ts},v1={expired_sig}"
        self.assertFalse(verify_webhook_signature(payload, expired_header, secret, tolerance_seconds=300))

        # 4. Construct event
        event = construct_webhook_event(payload, header, secret, tolerance_seconds=300)
        self.assertEqual(event.id, "evt_01J8K9P2X")
        self.assertEqual(event.type, "message.delivered")

        # 5. Invalid signature raises ConveySecurityError
        with self.assertRaises(ConveySecurityError):
            construct_webhook_event(payload, "t=1000,v1=invalid_hex", secret, tolerance_seconds=300)


if __name__ == "__main__":
    unittest.main()
