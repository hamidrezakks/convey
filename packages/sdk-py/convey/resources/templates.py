"""
convey.resources.templates
Templates resource for template management, draft versions, rendering, and partials.
"""

from __future__ import annotations

import asyncio
import urllib.parse
from typing import Any, Dict, List, Optional

from convey.types import TemplateDto, TemplateVersionDto


class SyncTemplatesResource:
    """Synchronous Templates resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def list(self, environment: Optional[str] = None) -> List[TemplateDto]:
        """List templates with optional environment filter."""
        query = {"environment": environment} if environment else None
        res = self._http.request("GET", "/v1/templates", query=query)
        templates_raw = res.get("templates") or []
        return [
            TemplateDto(
                id=t.get("id", ""),
                slug=t.get("slug", ""),
                name=t.get("name", ""),
                category=t.get("category", ""),
                environment=t.get("environment", ""),
                created_at=t.get("createdAt", ""),
                updated_at=t.get("updatedAt", ""),
                description=t.get("description"),
                metadata=t.get("metadata"),
            )
            for t in templates_raw
        ]

    def get(self, slug: str) -> Dict[str, Any]:
        """Get template by slug with all versions."""
        return self._http.request("GET", f"/v1/templates/{urllib.parse.quote(slug)}")

    def create(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new template."""
        return self._http.request("POST", "/v1/templates", body=request)

    def create_version(self, slug: str, request: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new draft version for a template."""
        return self._http.request("POST", f"/v1/templates/{urllib.parse.quote(slug)}/versions", body=request)

    def publish_version(self, slug: str, version: str) -> Dict[str, Any]:
        """Publish a draft version as active production version."""
        return self._http.request("POST", f"/v1/templates/{urllib.parse.quote(slug)}/publish", body={"version": version})

    def render(self, slug: str, variables: Optional[Dict[str, Any]] = None, locale: Optional[str] = None) -> Dict[str, Any]:
        """Compile and render a template."""
        payload = {"slug": slug, "variables": variables or {}, "locale": locale}
        return self._http.request("POST", "/v1/templates/render", body=payload)

    def list_partials(self) -> List[Dict[str, Any]]:
        """List reusable template partials."""
        res = self._http.request("GET", "/v1/templates/partials")
        return res.get("partials", [])

    def upsert_partial(self, name: str, content: str) -> Dict[str, Any]:
        """Create or update a reusable template partial."""
        return self._http.request("POST", "/v1/templates/partials", body={"name": name, "content": content})


class AsyncTemplatesResource:
    """Asynchronous Templates resource client."""

    def __init__(self, sync_res: SyncTemplatesResource) -> None:
        self._sync = sync_res

    async def list(self, environment: Optional[str] = None) -> List[TemplateDto]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.list(environment))

    async def get(self, slug: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get(slug))

    async def create(self, request: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.create(request))

    async def create_version(self, slug: str, request: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.create_version(slug, request))

    async def publish_version(self, slug: str, version: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.publish_version(slug, version))

    async def render(self, slug: str, variables: Optional[Dict[str, Any]] = None, locale: Optional[str] = None) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.render(slug, variables, locale))

    async def list_partials(self) -> List[Dict[str, Any]]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.list_partials)

    async def upsert_partial(self, name: str, content: str) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.upsert_partial(name, content))
