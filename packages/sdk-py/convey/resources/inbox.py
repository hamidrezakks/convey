"""
convey.resources.inbox
Inbox resource for creating and managing in-app notifications and feeds.
"""

from __future__ import annotations

import asyncio
import urllib.parse
from typing import Any, Dict, List, Optional


class SyncInboxResource:
    """Synchronous Inbox resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create an in-app notification."""
        return self._http.request("POST", "/api/v1/plugins/inbox", body=data)

    def get_feed(
        self,
        tenant_id: str,
        recipient_id: str,
        unread_only: bool = False,
        page: int = 1,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """Get in-app notification feed."""
        query = {
            "tenantId": tenant_id,
            "unreadOnly": str(unread_only).lower(),
            "page": page,
            "limit": limit,
        }
        return self._http.request("GET", f"/api/v1/plugins/inbox/{urllib.parse.quote(recipient_id)}", query=query)

    def mark_read(self, tenant_id: str, recipient_id: str, notification_ids: List[str]) -> int:
        """Mark notifications as read."""
        payload = {"tenantId": tenant_id, "notificationIds": notification_ids}
        res = self._http.request("PATCH", f"/api/v1/plugins/inbox/{urllib.parse.quote(recipient_id)}/read", body=payload)
        return int(res.get("updatedCount", len(notification_ids)))

    def mark_all_read(self, tenant_id: str, recipient_id: str) -> bool:
        """Mark all notifications as read."""
        res = self._http.request("PATCH", f"/api/v1/plugins/inbox/{urllib.parse.quote(recipient_id)}/read-all", body={"tenantId": tenant_id})
        return bool(res.get("success", True))

    def archive(self, tenant_id: str, recipient_id: str, notification_ids: List[str]) -> int:
        """Archive notifications."""
        payload = {"tenantId": tenant_id, "notificationIds": notification_ids}
        res = self._http.request("PATCH", f"/api/v1/plugins/inbox/{urllib.parse.quote(recipient_id)}/archive", body=payload)
        return int(res.get("archivedCount", len(notification_ids)))


class AsyncInboxResource:
    """Asynchronous Inbox resource client."""

    def __init__(self, sync_res: SyncInboxResource) -> None:
        self._sync = sync_res

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.create(data))

    async def get_feed(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_feed(*args, **kwargs))

    async def mark_read(self, *args: Any, **kwargs: Any) -> int:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.mark_read(*args, **kwargs))

    async def mark_all_read(self, *args: Any, **kwargs: Any) -> bool:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.mark_all_read(*args, **kwargs))

    async def archive(self, *args: Any, **kwargs: Any) -> int:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.archive(*args, **kwargs))
