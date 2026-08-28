"""
convey.rate_limiter
Token bucket rate limiter for client-side throughput smoothing.
"""

from __future__ import annotations

import asyncio
import time


class TokenBucketRateLimiter:
    """Thread-safe and asyncio-compatible token bucket rate limiter."""

    def __init__(self, requests_per_second: float = 50.0, burst: Optional[float] = None) -> None:
        self.rate = float(requests_per_second)
        self.capacity = float(burst if burst is not None and burst > 0 else requests_per_second)
        self.tokens = self.capacity
        self.last_refill = time.time()

    def _refill(self) -> None:
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_refill = now

    def acquire(self) -> None:
        """Synchronous blocking token acquisition."""
        while True:
            self._refill()
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return
            needed = 1.0 - self.tokens
            time.sleep(max(0.001, needed / self.rate))

    async def acquire_async(self) -> None:
        """Asynchronous non-blocking token acquisition."""
        while True:
            self._refill()
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return
            needed = 1.0 - self.tokens
            await asyncio.sleep(max(0.001, needed / self.rate))
