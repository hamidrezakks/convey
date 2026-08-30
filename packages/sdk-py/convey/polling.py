"""
convey.polling
Lifecycle polling awaiters for tracking delivery and batch completion.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Callable, List, Optional, Union

from convey.errors import ConveyTimeoutError
from convey.types import BatchDto, BatchState, MessageDetailDto, MessageStatus


def wait_for_delivery(
    resource: Any,
    message_id: str,
    *,
    poll_interval_s: float = 0.5,
    timeout_s: float = 30.0,
    terminal_statuses: Optional[List[Union[MessageStatus, str]]] = None,
    on_poll: Optional[Callable[[MessageDetailDto], None]] = None,
) -> MessageDetailDto:
    """Synchronously poll message status until terminal state (DELIVERED, FAILED, SUPPRESSED) or timeout."""
    terminals = [
        s.value.upper() if isinstance(s, MessageStatus) else s.upper()
        for s in (terminal_statuses or [MessageStatus.DELIVERED, MessageStatus.FAILED, MessageStatus.SUPPRESSED])
    ]
    start_time = time.time()

    while True:
        if (time.time() - start_time) >= timeout_s:
            raise ConveyTimeoutError(
                f"Message '{message_id}' did not reach terminal status within {timeout_s}s",
                timeout_seconds=timeout_s,
            )

        detail = resource.get(message_id)
        if on_poll:
            on_poll(detail)

        status_upper = str(detail.status or "").upper()
        if status_upper in terminals:
            return detail

        time.sleep(poll_interval_s)


async def wait_for_delivery_async(
    resource: Any,
    message_id: str,
    *,
    poll_interval_s: float = 0.5,
    timeout_s: float = 30.0,
    terminal_statuses: Optional[List[Union[MessageStatus, str]]] = None,
    on_poll: Optional[Callable[[MessageDetailDto], None]] = None,
) -> MessageDetailDto:
    """Asynchronously poll message status until terminal state or timeout."""
    terminals = [
        s.value.upper() if isinstance(s, MessageStatus) else s.upper()
        for s in (terminal_statuses or [MessageStatus.DELIVERED, MessageStatus.FAILED, MessageStatus.SUPPRESSED])
    ]
    start_time = time.time()

    while True:
        if (time.time() - start_time) >= timeout_s:
            raise ConveyTimeoutError(
                f"Message '{message_id}' did not reach terminal status within {timeout_s}s",
                timeout_seconds=timeout_s,
            )

        detail = await resource.get(message_id)
        if on_poll:
            on_poll(detail)

        status_upper = str(detail.status or "").upper()
        if status_upper in terminals:
            return detail

        await asyncio.sleep(poll_interval_s)


def wait_for_batch_completion(
    resource: Any,
    batch_id: str,
    *,
    poll_interval_s: float = 1.0,
    timeout_s: float = 60.0,
    on_poll: Optional[Callable[[BatchDto], None]] = None,
) -> BatchDto:
    """Synchronously poll batch completion until COMPLETED or CANCELLED."""
    start_time = time.time()
    terminal_states = [BatchState.COMPLETED.value, BatchState.CANCELLED.value]

    while True:
        if (time.time() - start_time) >= timeout_s:
            raise ConveyTimeoutError(
                f"Batch '{batch_id}' did not complete within {timeout_s}s",
                timeout_seconds=timeout_s,
            )

        batch_res = resource.get(batch_id)
        if isinstance(batch_res, BatchDto):
            batch = batch_res
        elif hasattr(batch_res, "batch") and isinstance(batch_res.batch, BatchDto):
            batch = batch_res.batch
        else:
            batch = BatchDto(
                id=str(getattr(batch_res, "id", batch_id)),
                team=str(getattr(batch_res, "team", "")),
                state=str(getattr(batch_res, "state", "")),
            )

        if on_poll:
            on_poll(batch)

        state_upper = str(batch.state or "").upper()
        if state_upper in terminal_states:
            return batch

        time.sleep(poll_interval_s)


async def wait_for_batch_completion_async(
    resource: Any,
    batch_id: str,
    *,
    poll_interval_s: float = 1.0,
    timeout_s: float = 60.0,
    on_poll: Optional[Callable[[BatchDto], None]] = None,
) -> BatchDto:
    """Asynchronously poll batch completion until COMPLETED or CANCELLED."""
    start_time = time.time()
    terminal_states = [BatchState.COMPLETED.value, BatchState.CANCELLED.value]

    while True:
        if (time.time() - start_time) >= timeout_s:
            raise ConveyTimeoutError(
                f"Batch '{batch_id}' did not complete within {timeout_s}s",
                timeout_seconds=timeout_s,
            )

        batch_res = await resource.get(batch_id)
        if isinstance(batch_res, BatchDto):
            batch = batch_res
        elif hasattr(batch_res, "batch") and isinstance(batch_res.batch, BatchDto):
            batch = batch_res.batch
        else:
            batch = BatchDto(
                id=str(getattr(batch_res, "id", batch_id)),
                team=str(getattr(batch_res, "team", "")),
                state=str(getattr(batch_res, "state", "")),
            )

        if on_poll:
            on_poll(batch)

        state_upper = str(batch.state or "").upper()
        if state_upper in terminal_states:
            return batch

        await asyncio.sleep(poll_interval_s)
