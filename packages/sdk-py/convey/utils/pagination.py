"""
convey.utils.pagination
Synchronous and Asynchronous Auto-Paginators for streaming API resources.
"""

from __future__ import annotations

from typing import Any, Callable, Coroutine, Generic, List, Optional, Tuple, TypeVar

T = TypeVar("T")


class SyncAutoPaginator(Generic[T]):
    """Synchronous auto-paginator supporting memory-efficient iterator streaming."""
    def __init__(
        self,
        fetcher: Callable[[int, int], Tuple[List[T], bool]],
        limit: int = 50,
    ) -> None:
        self.fetcher = fetcher
        self.limit = limit
        self.offset = 0
        self.page = 1
        self.buffer: List[T] = []
        self.buffer_idx = 0
        self.has_more = True
        self.started = False

    def __iter__(self) -> SyncAutoPaginator[T]:
        return self

    def __next__(self) -> T:
        if self.buffer_idx < len(self.buffer):
            item = self.buffer[self.buffer_idx]
            self.buffer_idx += 1
            return item

        if not self.has_more and self.started:
            raise StopIteration

        self.started = True
        items, has_more = self.fetcher(self.offset, self.page)
        self.buffer = items
        self.buffer_idx = 0
        self.has_more = has_more
        self.offset += len(items)
        self.page += 1

        if not self.buffer:
            raise StopIteration

        item = self.buffer[self.buffer_idx]
        self.buffer_idx += 1
        return item

    def all(self) -> List[T]:
        """Fetch all remaining items into a list."""
        return list(self)

    def take(self, n: int) -> List[T]:
        """Fetch up to n items."""
        result: List[T] = []
        for item in self:
            result.append(item)
            if len(result) >= n:
                break
        return result


class AsyncAutoPaginator(Generic[T]):
    """Asynchronous auto-paginator supporting async for streaming."""
    def __init__(
        self,
        fetcher: Callable[[int, int], Coroutine[Any, Any, Tuple[List[T], bool]]],
        limit: int = 50,
    ) -> None:
        self.fetcher = fetcher
        self.limit = limit
        self.offset = 0
        self.page = 1
        self.buffer: List[T] = []
        self.buffer_idx = 0
        self.has_more = True
        self.started = False

    def __aiter__(self) -> AsyncAutoPaginator[T]:
        return self

    async def __anext__(self) -> T:
        if self.buffer_idx < len(self.buffer):
            item = self.buffer[self.buffer_idx]
            self.buffer_idx += 1
            return item

        if not self.has_more and self.started:
            raise StopAsyncIteration

        self.started = True
        items, has_more = await self.fetcher(self.offset, self.page)
        self.buffer = items
        self.buffer_idx = 0
        self.has_more = has_more
        self.offset += len(items)
        self.page += 1

        if not self.buffer:
            raise StopAsyncIteration

        item = self.buffer[self.buffer_idx]
        self.buffer_idx += 1
        return item

    async def all(self) -> List[T]:
        """Fetch all remaining items into a list."""
        result: List[T] = []
        async for item in self:
            result.append(item)
        return result

    async def take(self, n: int) -> List[T]:
        """Fetch up to n items."""
        result: List[T] = []
        async for item in self:
            result.append(item)
            if len(result) >= n:
                break
        return result
