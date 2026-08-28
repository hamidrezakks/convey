"""
convey.utils.trace
W3C distributed traceparent generator and child span derivation.
"""

import secrets


def generate_traceparent() -> str:
    """Generate a W3C traceparent header string.
    
    Format: version-traceId-parentId-traceFlags (e.g. 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
    """
    trace_id = secrets.token_hex(16)
    parent_id = secrets.token_hex(8)
    return f"00-{trace_id}-{parent_id}-01"


def create_child_traceparent(parent: str) -> str:
    """Derive a child traceparent preserving the root trace ID."""
    parts = parent.split("-")
    if len(parts) != 4 or parts[0] != "00":
        return generate_traceparent()

    trace_id = parts[1]
    flags = parts[3]
    span_id = secrets.token_hex(8)
    return f"00-{trace_id}-{span_id}-{flags}"
