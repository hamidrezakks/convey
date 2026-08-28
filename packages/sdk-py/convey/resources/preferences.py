"""
convey.resources.preferences
Preferences resource for topic subscriptions, recipient consent, and quiet hours.
"""

from __future__ import annotations

import asyncio
import urllib.parse
from typing import Any, Dict, List, Optional


class SyncPreferencesResource:
    """Synchronous Preferences resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def list_topics(self, tenant_id: str, team: str) -> List[Dict[str, Any]]:
        """List subscription topics."""
        res = self._http.request("GET", "/api/v1/plugins/preferences/topics", query={"tenantId": tenant_id, "team": team})
        return res.get("topics", [])

    def create_topic(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update a subscription topic."""
        return self._http.request("POST", "/api/v1/plugins/preferences/topics", body=data)

    def get_preferences(self, tenant_id: str, recipient_id: str) -> Dict[str, Any]:
        """Get recipient preferences."""
        return self._http.request("GET", f"/api/v1/plugins/preferences/{urllib.parse.quote(recipient_id)}", query={"tenantId": tenant_id})

    def check(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Check dispatch consent and quiet hours."""
        return self._http.request("POST", "/api/v1/plugins/preferences/check", body=data)


class AsyncPreferencesResource:
    """Asynchronous Preferences resource client."""

    def __init__(self, sync_res: SyncPreferencesResource) -> None:
        self._sync = sync_res

    async def list_topics(self, tenant_id: str, team: str) -> List[Dict[str, Any]]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.list_topics(tenant_id, team))

    async def create_topic(self, data: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.create_topic(data))

    async def get_preferences(self, tenant_id: str, recipient_id: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_preferences(tenant_id, recipient_id))

    async def check(self, data: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.check(data))
