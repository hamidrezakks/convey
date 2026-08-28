"""
convey.resources.dlq
Dead-Letter Queue (DLQ) resource for inspecting failed messages and executing replays.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from convey.types import MessageDetailDto
from convey.utils.pagination import AsyncAutoPaginator, SyncAutoPaginator


class SyncDLQResource:
    """Synchronous Dead-Letter Queue resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def list(
        self,
        limit: int = 50,
        offset: int = 0,
        team: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Query failed messages in the Dead-Letter Queue."""
        query: Dict[str, Any] = {"limit": limit, "offset": offset}
        if team:
            query["team"] = team

        res = self._http.request("GET", "/v1/dlq", query=query)
        items_raw = res.get("items") or res.get("messages") or []
        items = [
            MessageDetailDto(
                public_id=m.get("publicId", ""),
                team=m.get("team", ""),
                channel=m.get("channel", ""),
                recipient=m.get("recipient", ""),
                status=m.get("status", ""),
                priority=m.get("priority", "normal"),
                cost_usd=float(m.get("costUsd", 0.0)),
                created_at=m.get("createdAt", ""),
                delivered_at=m.get("deliveredAt"),
                metadata=m.get("metadata"),
            )
            for m in items_raw
        ]
        return {
            "items": items,
            "total": res.get("total", len(items)),
            "limit": res.get("limit", limit),
            "offset": res.get("offset", offset),
        }

    def list_auto_paging(
        self,
        limit: int = 50,
        team: Optional[str] = None,
    ) -> SyncAutoPaginator[MessageDetailDto]:
        """Auto-paginating iterator for Dead-Letter Queue messages."""
        def fetcher(offset: int, _page: int) -> tuple[List[MessageDetailDto], bool]:
            page_data = self.list(limit=limit, offset=offset, team=team)
            items = page_data["items"]
            has_more = offset + len(items) < page_data["total"]
            return items, has_more

        return SyncAutoPaginator(fetcher, limit)

    def replay(self, message_ids: List[str], team: Optional[str] = None) -> Dict[str, Any]:
        """Replay failed messages through the outbox delivery pipeline."""
        payload = {"messageIds": message_ids}
        if team:
            payload["team"] = team
        return self._http.request("POST", "/v1/dlq/replay", body=payload)

    def replay_mutated(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Run dry-run simulation or mutated replay with adjusted concurrency."""
        return self._http.request("POST", "/v1/dlq/replay-mutated", body=request)


class AsyncDLQResource:
    """Asynchronous Dead-Letter Queue resource client."""

    def __init__(self, sync_res: SyncDLQResource) -> None:
        self._sync = sync_res

    async def list(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.list(*args, **kwargs))

    def list_auto_paging(self, limit: int = 50, team: Optional[str] = None) -> AsyncAutoPaginator[MessageDetailDto]:
        async def fetcher(offset: int, _page: int) -> tuple[List[MessageDetailDto], bool]:
            loop = asyncio.get_running_loop()
            page_data = await loop.run_in_executor(None, lambda: self._sync.list(limit=limit, offset=offset, team=team))
            items = page_data["items"]
            has_more = offset + len(items) < page_data["total"]
            return items, has_more

        return AsyncAutoPaginator(fetcher, limit)

    async def replay(self, message_ids: List[str], team: Optional[str] = None) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.replay(message_ids, team))

    async def replay_mutated(self, request: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.replay_mutated(request))
