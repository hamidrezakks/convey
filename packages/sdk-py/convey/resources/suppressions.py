"""
convey.resources.suppressions
Suppressions resource for bounce, complaint, unsubscribe, and manual blocks.
"""

from __future__ import annotations

import asyncio
import urllib.parse
from typing import Any, Dict, List, Optional, Union

from convey.types import Channel, SuppressionDto, SuppressionReason
from convey.utils.pagination import AsyncAutoPaginator, SyncAutoPaginator


class SyncSuppressionsResource:
    """Synchronous Suppressions resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def add(
        self,
        recipient: str,
        channel: Union[Channel, str] = Channel.EMAIL,
        reason: Union[SuppressionReason, str] = SuppressionReason.MANUAL_BLOCK,
        category: Optional[str] = None,
        team: Optional[str] = None,
    ) -> SuppressionDto:
        """Add a single recipient to the suppression ledger."""
        payload: Dict[str, Any] = {
            "identifier": recipient,
            "reason": str(reason),
        }
        if channel:
            payload["channel"] = str(channel)
        if category:
            payload["category"] = category
        if team:
            payload["team"] = team

        res = self._http.request("POST", "/v1/suppressions", body=payload)
        sup = res.get("suppression") or res
        return SuppressionDto(
            id=sup.get("id", ""),
            team=sup.get("team", ""),
            recipient=sup.get("recipient") or sup.get("identifier", recipient),
            channel=sup.get("channel", str(channel)),
            reason=sup.get("reason", str(reason)),
            created_at=sup.get("createdAt", ""),
            category=sup.get("category"),
        )

    def add_bulk(self, items: List[Dict[str, Any]]) -> List[SuppressionDto]:
        """Bulk register recipient suppression records."""
        res = self._http.request("POST", "/v1/suppressions/bulk", body={"items": items})
        items_raw = res.get("suppressions") or []
        return [
            SuppressionDto(
                id=s.get("id", ""),
                team=s.get("team", ""),
                recipient=s.get("recipient", ""),
                channel=s.get("channel", ""),
                reason=s.get("reason", ""),
                created_at=s.get("createdAt", ""),
                category=s.get("category"),
            )
            for s in items_raw
        ]

    def list(
        self,
        limit: int = 50,
        offset: int = 0,
        channel: Optional[Union[Channel, str]] = None,
        reason: Optional[Union[SuppressionReason, str]] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Query suppressions with search, filter, and pagination parameters."""
        query: Dict[str, Any] = {"limit": limit, "offset": offset}
        if channel:
            query["channel"] = str(channel)
        if reason:
            query["reason"] = str(reason)
        if category:
            query["category"] = category
        if search:
            query["search"] = search

        res = self._http.request("GET", "/v1/suppressions", query=query)
        items_raw = res.get("suppressions") or res.get("items") or []
        items = [
            SuppressionDto(
                id=s.get("id", ""),
                team=s.get("team", ""),
                recipient=s.get("recipient", ""),
                channel=s.get("channel", ""),
                reason=s.get("reason", ""),
                created_at=s.get("createdAt", ""),
                category=s.get("category"),
            )
            for s in items_raw
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
        channel: Optional[Union[Channel, str]] = None,
        reason: Optional[Union[SuppressionReason, str]] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> SyncAutoPaginator[SuppressionDto]:
        """Auto-paginating iterator to stream through suppression records."""
        def fetcher(offset: int, _page: int) -> tuple[List[SuppressionDto], bool]:
            page_data = self.list(limit=limit, offset=offset, channel=channel, reason=reason, category=category, search=search)
            items = page_data["items"]
            has_more = offset + len(items) < page_data["total"]
            return items, has_more

        return SyncAutoPaginator(fetcher, limit)

    def delete(self, suppression_id: str) -> bool:
        """Delete a suppression record by ID."""
        res = self._http.request("DELETE", f"/v1/suppressions/{urllib.parse.quote(suppression_id)}")
        return bool(res.get("success", True))


class AsyncSuppressionsResource:
    """Asynchronous Suppressions resource client."""

    def __init__(self, sync_res: SyncSuppressionsResource) -> None:
        self._sync = sync_res

    async def add(self, *args: Any, **kwargs: Any) -> SuppressionDto:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.add(*args, **kwargs))

    async def add_bulk(self, items: List[Dict[str, Any]]) -> List[SuppressionDto]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.add_bulk(items))

    async def list(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.list(*args, **kwargs))

    def list_auto_paging(
        self,
        limit: int = 50,
        channel: Optional[Union[Channel, str]] = None,
        reason: Optional[Union[SuppressionReason, str]] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> AsyncAutoPaginator[SuppressionDto]:
        async def fetcher(offset: int, _page: int) -> tuple[List[SuppressionDto], bool]:
            loop = asyncio.get_running_loop()
            page_data = await loop.run_in_executor(
                None, lambda: self._sync.list(limit=limit, offset=offset, channel=channel, reason=reason, category=category, search=search)
            )
            items = page_data["items"]
            has_more = offset + len(items) < page_data["total"]
            return items, has_more

        return AsyncAutoPaginator(fetcher, limit)

    async def delete(self, suppression_id: str) -> bool:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.delete(suppression_id))
