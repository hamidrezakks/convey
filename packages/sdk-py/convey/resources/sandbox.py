"""
convey.resources.sandbox
Sandbox resource for inspecting and resetting simulated zero-cost messages.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List


class SyncSandboxResource:
    """Synchronous Sandbox resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def list_messages(self) -> List[Dict[str, Any]]:
        """List simulated sandbox messages."""
        res = self._http.request("GET", "/v1/sandbox/messages")
        return res.get("messages", [])

    def clear_messages(self) -> Dict[str, Any]:
        """Clear all simulated sandbox messages for the authenticated team."""
        return self._http.request("DELETE", "/v1/sandbox/messages")


class AsyncSandboxResource:
    """Asynchronous Sandbox resource client."""

    def __init__(self, sync_res: SyncSandboxResource) -> None:
        self._sync = sync_res

    async def list_messages(self) -> List[Dict[str, Any]]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.list_messages)

    async def clear_messages(self) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.clear_messages)
