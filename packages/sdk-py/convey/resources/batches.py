"""
convey.resources.batches
Batches resource for campaign dispatch containers and lifecycle controls.
"""

from __future__ import annotations

import asyncio
import urllib.parse
from typing import Any, Dict, List, Optional

from convey.types import BatchActionResponse, BatchDto


class SyncBatchesResource:
    """Synchronous Batches resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def create(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new campaign batch dispatch container."""
        return self._http.request("POST", "/v1/batches", body=request)

    def list(self) -> List[BatchDto]:
        """List all campaign batches for the team."""
        res = self._http.request("GET", "/v1/batches")
        batches_raw = res.get("batches") or []
        return [
            BatchDto(
                id=b.get("id", ""),
                team=b.get("team", ""),
                state=b.get("state", ""),
                total_count=b.get("totalCount", 0),
                processed_count=b.get("processedCount", 0),
                success_count=b.get("successCount", 0),
                failed_count=b.get("failedCount", 0),
                created_at=b.get("createdAt", ""),
                completed_at=b.get("completedAt"),
            )
            for b in batches_raw
        ]

    def get(self, batch_id: str) -> BatchDto:
        """Retrieve status and counters for a specific batch."""
        res = self._http.request("GET", f"/v1/batches/{urllib.parse.quote(batch_id)}")
        b = res.get("batch") or res
        return BatchDto(
            id=b.get("id", batch_id),
            team=b.get("team", ""),
            state=b.get("state", ""),
            total_count=b.get("totalCount", 0),
            processed_count=b.get("processedCount", 0),
            success_count=b.get("successCount", 0),
            failed_count=b.get("failedCount", 0),
            created_at=b.get("createdAt", ""),
            completed_at=b.get("completedAt"),
        )

    def pause(self, batch_id: str) -> Dict[str, Any]:
        """Pause active dispatching of an in-flight batch."""
        return self._http.request("POST", f"/v1/batches/{urllib.parse.quote(batch_id)}/pause")

    def resume(self, batch_id: str) -> Dict[str, Any]:
        """Resume dispatching of a paused batch."""
        return self._http.request("POST", f"/v1/batches/{urllib.parse.quote(batch_id)}/resume")

    def cancel(self, batch_id: str) -> Dict[str, Any]:
        """Cancel execution of an active or paused batch."""
        return self._http.request("POST", f"/v1/batches/{urllib.parse.quote(batch_id)}/cancel")

    def wait_for_completion(self, batch_id: str, **kwargs: Any) -> BatchDto:
        """Poll batch completion status synchronously until finished."""
        from convey.polling import wait_for_batch_completion
        return wait_for_batch_completion(self, batch_id, **kwargs)


class AsyncBatchesResource:
    """Asynchronous Batches resource client."""

    def __init__(self, sync_res: SyncBatchesResource) -> None:
        self._sync = sync_res

    async def wait_for_completion(self, batch_id: str, **kwargs: Any) -> BatchDto:
        """Poll batch completion status asynchronously until finished."""
        from convey.polling import wait_for_batch_completion_async
        return await wait_for_batch_completion_async(self, batch_id, **kwargs)

    async def create(self, request: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.create(request))

    async def list(self) -> List[BatchDto]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.list)

    async def get(self, batch_id: str) -> BatchDto:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get(batch_id))

    async def pause(self, batch_id: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.pause(batch_id))

    async def resume(self, batch_id: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.resume(batch_id))

    async def cancel(self, batch_id: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.cancel(batch_id))

