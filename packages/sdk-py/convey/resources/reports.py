"""
convey.resources.reports
Reporting & Analytics resource for metrics overviews, multi-team budgets, and campaign funnels.
"""

from __future__ import annotations

import asyncio
import urllib.parse
from typing import Any, Dict, List, Optional


class SyncReportsResource:
    """Synchronous Reports resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def get_overview(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        team_id: Optional[str] = None,
        category: Optional[str] = None,
        is_sandbox: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Retrieve aggregated delivery metrics and costs."""
        query: Dict[str, Any] = {}
        if start_date:
            query["startDate"] = start_date
        if end_date:
            query["endDate"] = end_date
        if team_id:
            query["teamId"] = team_id
        if category:
            query["category"] = category
        if is_sandbox is not None:
            query["isSandbox"] = str(is_sandbox).lower()

        return self._http.request("GET", "/v1/admin/reports/overview", query=query)

    def get_teams(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        team_id: Optional[str] = None,
        is_sandbox: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Retrieve budget utilization across tenant teams."""
        query: Dict[str, Any] = {}
        if start_date:
            query["startDate"] = start_date
        if end_date:
            query["endDate"] = end_date
        if team_id:
            query["teamId"] = team_id
        if is_sandbox is not None:
            query["isSandbox"] = str(is_sandbox).lower()

        return self._http.request("GET", "/v1/admin/reports/teams", query=query)

    def get_categories(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        team_id: Optional[str] = None,
        category: Optional[str] = None,
        is_sandbox: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Retrieve performance metrics segmented by category."""
        query: Dict[str, Any] = {}
        if start_date:
            query["startDate"] = start_date
        if end_date:
            query["endDate"] = end_date
        if team_id:
            query["teamId"] = team_id
        if category:
            query["category"] = category
        if is_sandbox is not None:
            query["isSandbox"] = str(is_sandbox).lower()

        return self._http.request("GET", "/v1/admin/reports/categories", query=query)

    def get_campaigns(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Retrieve campaign performance metrics."""
        query: Dict[str, Any] = {}
        if start_date:
            query["startDate"] = start_date
        if end_date:
            query["endDate"] = end_date
        if team_id:
            query["teamId"] = team_id

        return self._http.request("GET", "/v1/admin/reports/campaigns", query=query)

    def get_campaign_details(self, campaign_id: str) -> Dict[str, Any]:
        """Retrieve detailed funnel analysis for a campaign."""
        return self._http.request("GET", f"/v1/admin/reports/campaigns/{urllib.parse.quote(campaign_id)}")

    def export(
        self,
        report_type: str = "overview",
        format: str = "csv",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> str:
        """Export raw report data in CSV or JSON format."""
        query = {"type": report_type, "format": format}
        if start_date:
            query["startDate"] = start_date
        if end_date:
            query["endDate"] = end_date
        if team_id:
            query["teamId"] = team_id

        return self._http.request("GET", "/v1/admin/reports/export", query=query)


class AsyncReportsResource:
    """Asynchronous Reports resource client."""

    def __init__(self, sync_res: SyncReportsResource) -> None:
        self._sync = sync_res

    async def get_overview(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_overview(*args, **kwargs))

    async def get_teams(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_teams(*args, **kwargs))

    async def get_categories(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_categories(*args, **kwargs))

    async def get_campaigns(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_campaigns(*args, **kwargs))

    async def get_campaign_details(self, campaign_id: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_campaign_details(campaign_id))

    async def export(self, *args: Any, **kwargs: Any) -> str:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.export(*args, **kwargs))
