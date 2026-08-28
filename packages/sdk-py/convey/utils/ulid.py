"""
convey.utils.ulid
High-performance Crockford Base32 ULID generator.
"""

import os
import threading
import time

CROCKFORD_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

_lock = threading.Lock()
_last_time = 0
_last_entropy = bytearray(10)


def generate_ulid() -> str:
    """Generate a canonical 26-character Crockford Base32 ULID."""
    global _last_time, _last_entropy

    now_ms = int(time.time() * 1000)

    with _lock:
        if now_ms == _last_time:
            # Monotonic increment
            for i in reversed(range(10)):
                _last_entropy[i] = (_last_entropy[i] + 1) & 0xFF
                if _last_entropy[i] != 0:
                    break
            entropy = bytes(_last_entropy)
        else:
            _last_time = now_ms
            entropy = os.urandom(10)
            _last_entropy = bytearray(entropy)

    chars = []

    # 10 chars timestamp (48 bits)
    chars.append(CROCKFORD_CHARS[(now_ms >> 45) & 0x1F])
    chars.append(CROCKFORD_CHARS[(now_ms >> 40) & 0x1F])
    chars.append(CROCKFORD_CHARS[(now_ms >> 35) & 0x1F])
    chars.append(CROCKFORD_CHARS[(now_ms >> 30) & 0x1F])
    chars.append(CROCKFORD_CHARS[(now_ms >> 25) & 0x1F])
    chars.append(CROCKFORD_CHARS[(now_ms >> 20) & 0x1F])
    chars.append(CROCKFORD_CHARS[(now_ms >> 15) & 0x1F])
    chars.append(CROCKFORD_CHARS[(now_ms >> 10) & 0x1F])
    chars.append(CROCKFORD_CHARS[(now_ms >> 5) & 0x1F])
    chars.append(CROCKFORD_CHARS[now_ms & 0x1F])

    # 16 chars entropy (80 bits)
    chars.append(CROCKFORD_CHARS[(entropy[0] >> 3) & 0x1F])
    chars.append(CROCKFORD_CHARS[((entropy[0] & 0x07) << 2) | ((entropy[1] >> 6) & 0x03)])
    chars.append(CROCKFORD_CHARS[(entropy[1] >> 1) & 0x1F])
    chars.append(CROCKFORD_CHARS[((entropy[1] & 0x01) << 4) | ((entropy[2] >> 4) & 0x0F)])
    chars.append(CROCKFORD_CHARS[((entropy[2] & 0x0F) << 1) | ((entropy[3] >> 7) & 0x01)])
    chars.append(CROCKFORD_CHARS[(entropy[3] >> 2) & 0x1F])
    chars.append(CROCKFORD_CHARS[((entropy[3] & 0x03) << 3) | ((entropy[4] >> 5) & 0x07)])
    chars.append(CROCKFORD_CHARS[entropy[4] & 0x1F])

    chars.append(CROCKFORD_CHARS[(entropy[5] >> 3) & 0x1F])
    chars.append(CROCKFORD_CHARS[((entropy[5] & 0x07) << 2) | ((entropy[6] >> 6) & 0x03)])
    chars.append(CROCKFORD_CHARS[(entropy[6] >> 1) & 0x1F])
    chars.append(CROCKFORD_CHARS[((entropy[6] & 0x01) << 4) | ((entropy[7] >> 4) & 0x0F)])
    chars.append(CROCKFORD_CHARS[((entropy[7] & 0x0F) << 1) | ((entropy[8] >> 7) & 0x01)])
    chars.append(CROCKFORD_CHARS[(entropy[8] >> 2) & 0x1F])
    chars.append(CROCKFORD_CHARS[((entropy[8] & 0x03) << 3) | ((entropy[9] >> 5) & 0x07)])
    chars.append(CROCKFORD_CHARS[entropy[9] & 0x1F])

    return "".join(chars)
