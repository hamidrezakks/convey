"""
convey.resources.admin
Admin Studio resource for telemetry, provider health, circuit breaker controls, and audit logs.
"""

from __future__ import annotations

import asyncio
import urllib.parse
from typing import Any, Dict, List, Optional, Union

from convey.types import (
    AuditLogDto,
    Channel,
    LiveTelemetrySnapshot,
    MessageDetailDto,
    MessageStatus,
    ProviderHealthDto,
)
from convey.utils.pagination import AsyncAutoPaginator, SyncAutoPaginator


class SyncAdminResource:
    """Synchronous Admin resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def get_overview(self) -> Dict[str, Any]:
        """Retrieve operational overview metrics."""
        return self._http.request("GET", "/v1/admin/overview")

    def get_live_telemetry(self) -> LiveTelemetrySnapshot:
        """Retrieve real-time live telemetry snapshot."""
        res = self._http.request("GET", "/v1/admin/telemetry/live")
        return LiveTelemetrySnapshot(
            heap_saturation=float(res.get("heapSaturation", 0.0)),
            queue_depths=res.get("queueDepths", {}),
            active_workers=res.get("activeWorkers", 0),
            p95_latency_ms=float(res.get("p95LatencyMs", 0.0)),
            circuit_breakers=res.get("circuitBreakers", {}),
            system_health=res.get("systemHealth", "UNKNOWN"),
            timestamp=res.get("timestamp", ""),
            extra_diagnostics=res.get("extraDiagnostics"),
        )

    def list_messages(
        self,
        page: int = 1,
        limit: int = 50,
        team_id: Optional[str] = None,
        channel: Optional[Union[Channel, str]] = None,
        status: Optional[Union[MessageStatus, str]] = None,
        search: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        is_sandbox: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Query messages across all tenants and teams."""
        query: Dict[str, Any] = {"page": page, "limit": limit}
        if team_id:
            query["teamId"] = team_id
        if channel:
            query["channel"] = str(channel)
        if status:
            query["status"] = str(status)
        if search:
            query["search"] = search
        if start_date:
            query["startDate"] = start_date
        if end_date:
            query["endDate"] = end_date
        if is_sandbox is not None:
            query["isSandbox"] = str(is_sandbox).lower()

        res = self._http.request("GET", "/v1/admin/messages", query=query)
        msgs_raw = res.get("messages") or []
        messages = [
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
            for m in msgs_raw
        ]
        return {
            "messages": messages,
            "total": res.get("total", len(messages)),
            "page": res.get("page", page),
            "limit": res.get("limit", limit),
        }

    def list_messages_auto_paging(
        self,
        limit: int = 50,
        team_id: Optional[str] = None,
        channel: Optional[Union[Channel, str]] = None,
        status: Optional[Union[MessageStatus, str]] = None,
        search: Optional[str] = None,
    ) -> SyncAutoPaginator[MessageDetailDto]:
        """Auto-paginating iterator for messages across all tenants."""
        def fetcher(_offset: int, page: int) -> tuple[List[MessageDetailDto], bool]:
            page_data = self.list_messages(page=page, limit=limit, team_id=team_id, channel=channel, status=status, search=search)
            messages = page_data["messages"]
            has_more = page_data["page"] * page_data["limit"] < page_data["total"]
            return messages, has_more

        return SyncAutoPaginator(fetcher, limit)

    def get_message_details(self, message_id: str) -> Dict[str, Any]:
        """Retrieve comprehensive message details and trace spans."""
        return self._http.request("GET", f"/v1/admin/messages/{urllib.parse.quote(message_id)}")

    def list_providers(self) -> List[ProviderHealthDto]:
        """List all providers with circuit breaker and success rate metrics."""
        res = self._http.request("GET", "/v1/admin/providers")
        providers_raw = res if isinstance(res, list) else res.get("providers", [])
        return [
            ProviderHealthDto(
                id=p.get("id", ""),
                name=p.get("name", ""),
                channel=p.get("channel", ""),
                circuit_state=p.get("circuitState", "CLOSED"),
                success_rate=float(p.get("successRate", 1.0)),
                p95_latency_ms=float(p.get("p95LatencyMs", 0.0)),
                is_active=p.get("isActive", True),
            )
            for p in providers_raw
        ]

    def set_circuit_state(self, provider_id: str, action: str, ramp_percentage: int = 20) -> Dict[str, Any]:
        """Override provider circuit breaker state or trigger stepped ramp traffic."""
        payload = {"action": action, "rampPercentage": ramp_percentage}
        return self._http.request("POST", f"/v1/admin/providers/{urllib.parse.quote(provider_id)}/circuit", body=payload)

    def trigger_canary(self, provider_id: str) -> Dict[str, Any]:
        """Trigger synthetic canary probe to evaluate provider health."""
        return self._http.request("POST", f"/v1/admin/providers/{urllib.parse.quote(provider_id)}/canary")

    def get_provider_catalog(self) -> Dict[str, Any]:
        """Retrieve the turnkey catalog of communication providers."""
        return self._http.request("GET", "/v1/admin/providers/catalog")

    def list_configured_providers(self) -> List[Dict[str, Any]]:
        """List active configured provider integrations."""
        res = self._http.request("GET", "/v1/admin/providers/configured")
        return res if isinstance(res, list) else res.get("providers", [])

    def register_provider(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Dynamically register or update a provider integration."""
        return self._http.request("POST", "/v1/admin/providers/register", body=request)

    def delete_configured_provider(self, provider_id: str) -> bool:
        """Remove a configured provider integration."""
        res = self._http.request("DELETE", f"/v1/admin/providers/configured/{urllib.parse.quote(provider_id)}")
        return bool(res.get("success", True))

    def test_provider_connection(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Test credentials and connectivity for a provider."""
        return self._http.request("POST", "/v1/admin/providers/test-connection", body=request)

    def list_audit_logs(
        self,
        page: int = 1,
        limit: int = 50,
        actor: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Query tamper-evident audit log ledger."""
        query: Dict[str, Any] = {"page": page, "limit": limit}
        if actor:
            query["actor"] = actor
        if action:
            query["action"] = action
        if start_date:
            query["startDate"] = start_date
        if end_date:
            query["endDate"] = end_date

        res = self._http.request("GET", "/v1/admin/audit-logs", query=query)
        items_raw = res.get("items") or []
        items = [
            AuditLogDto(
                id=a.get("id", ""),
                actor=a.get("actor", ""),
                action=a.get("action", ""),
                target=a.get("target", ""),
                timestamp=a.get("timestamp", ""),
                ip_address=a.get("ipAddress", ""),
                hash=a.get("hash", ""),
                metadata=a.get("metadata"),
            )
            for a in items_raw
        ]
        return {
            "items": items,
            "total": res.get("total", len(items)),
            "page": res.get("page", page),
            "limit": res.get("limit", limit),
        }

    def list_audit_logs_auto_paging(
        self,
        limit: int = 50,
        actor: Optional[str] = None,
        action: Optional[str] = None,
    ) -> SyncAutoPaginator[AuditLogDto]:
        """Auto-paginating iterator for audit logs."""
        def fetcher(_offset: int, page: int) -> tuple[List[AuditLogDto], bool]:
            page_data = self.list_audit_logs(page=page, limit=limit, actor=actor, action=action)
            items = page_data["items"]
            has_more = page_data["page"] * page_data["limit"] < page_data["total"]
            return items, has_more

        return SyncAutoPaginator(fetcher, limit)

    def list_policies(self) -> List[Dict[str, Any]]:
        """List rate limit, token bucket, quiet hours, and budget policies."""
        res = self._http.request("GET", "/v1/admin/policies")
        return res if isinstance(res, list) else res.get("policies", [])


class AsyncAdminResource:
    """Asynchronous Admin resource client."""

    def __init__(self, sync_res: SyncAdminResource) -> None:
        self._sync = sync_res

    async def get_overview(self) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.get_overview)

    async def get_live_telemetry(self) -> LiveTelemetrySnapshot:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.get_live_telemetry)

    async def list_messages(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.list_messages(*args, **kwargs))

    def list_messages_auto_paging(self, *args: Any, **kwargs: Any) -> AsyncAutoPaginator[MessageDetailDto]:
        async def fetcher(_offset: int, page: int) -> tuple[List[MessageDetailDto], bool]:
            loop = asyncio.get_running_loop()
            page_data = await loop.run_in_executor(None, lambda: self._sync.list_messages(*args, page=page, **kwargs))
            items = page_data["messages"]
            has_more = page_data["page"] * page_data["limit"] < page_data["total"]
            return items, has_more

        limit = kwargs.get("limit", 50)
        return AsyncAutoPaginator(fetcher, limit)

    async def get_message_details(self, message_id: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_message_details(message_id))

    async def list_providers(self) -> List[ProviderHealthDto]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.list_providers)

    async def set_circuit_state(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.set_circuit_state(*args, **kwargs))

    async def trigger_canary(self, provider_id: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.trigger_canary(provider_id))

    async def get_provider_catalog(self) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.get_provider_catalog)

    async def list_configured_providers(self) -> List[Dict[str, Any]]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.list_configured_providers)

    async def register_provider(self, request: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.register_provider(request))

    async def delete_configured_provider(self, provider_id: str) -> bool:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.delete_configured_provider(provider_id))

    async def test_provider_connection(self, request: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.test_provider_connection(request))

    async def list_audit_logs(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.list_audit_logs(*args, **kwargs))

    def list_audit_logs_auto_paging(self, *args: Any, **kwargs: Any) -> AsyncAutoPaginator[AuditLogDto]:
        async def fetcher(_offset: int, page: int) -> tuple[List[AuditLogDto], bool]:
            loop = asyncio.get_running_loop()
            page_data = await loop.run_in_executor(None, lambda: self._sync.list_audit_logs(*args, page=page, **kwargs))
            items = page_data["items"]
            has_more = page_data["page"] * page_data["limit"] < page_data["total"]
            return items, has_more

        limit = kwargs.get("limit", 50)
        return AsyncAutoPaginator(fetcher, limit)

    async def list_policies(self) -> List[Dict[str, Any]]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.list_policies)
