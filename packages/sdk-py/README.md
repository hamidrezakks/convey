# Convey Python SDK (`convey-sdk`)

Official zero-dependency, high-performance Python client for the [Convey](https://github.com/hamidrezakks/convey) omnichannel communication platform.

## Features

- 🚀 **Zero External Dependencies**: Pure Python 3.10+ standard library implementation with persistent socket keep-alive.
- ⚡ **Dual Sync & Async Support**: First-class synchronous (`Convey`) and asynchronous (`AsyncConvey`) interfaces.
- 🔄 **Resilient Full-Jitter Exponential Backoff**: Automatic retry handling for HTTP 429 and transient 5xx errors with `Retry-After` header parsing.
- 🔒 **Zero Provider Exposure**: Public ULIDs (`msg_<ULID>`) hide provider message IDs.
- 🆔 **Automatic Idempotency Keying**: Monotonic ULID injection for mutating requests.
- 🌐 **W3C Distributed Tracing**: Native `traceparent` context generation and child span propagation.
- 🛡️ **Cryptographic Webhook Verification**: Constant-time HMAC-SHA256 verification and generic typed event deserialization.
- 📄 **Auto-Pagination Iterators**: Memory-efficient synchronous and asynchronous streaming over large datasets.

---

## Installation

```bash
pip install convey-sdk
```

---

## Synchronous Quickstart

```python
import os
from convey import Convey, Channel, MessagePriority

# Initialize Convey client
client = Convey(
    api_key=os.environ["CONVEY_API_KEY"],
    base_url="http://localhost:3000",
    timeout=10.0,
    max_retries=3,
)

# Send an omnichannel message
response = client.messages.send(
    channel=Channel.EMAIL,
    recipient="alex@example.com",
    priority=MessagePriority.HIGH,
    content={
        "subject": "Your Monthly Statement",
        "body": "<p>Your monthly statement is now available.</p>",
    },
)

print(f"Accepted message ID: {response.public_id} (Status: {response.status})")
```

---

## Asynchronous Quickstart

```python
import asyncio
import os
from convey import AsyncConvey, Channel, MessagePriority

async def main():
    client = AsyncConvey(api_key=os.environ["CONVEY_API_KEY"])

    response = await client.messages.send(
        channel=Channel.SMS,
        recipient="+14155552671",
        priority=MessagePriority.CRITICAL,
        content={"body": "Your Convey verification code is: 489-201."},
    )

    print(f"Accepted SMS: {response.public_id}")

asyncio.run(main())
```

---

## Webhook Signature Verification (FastAPI / Flask / Django)

```python
from fastapi import FastAPI, Header, HTTPException, Request
from convey import verify_webhook_signature, construct_webhook_event

app = FastAPI()
WEBHOOK_SECRET = os.environ["CONVEY_WEBHOOK_SECRET"]

@app.post("/webhooks/convey")
async def handle_webhook(request: Request, x_convey_signature: str = Header(...)):
    raw_body = await request.body()

    try:
        event = construct_webhook_event(raw_body, x_convey_signature, WEBHOOK_SECRET)
        print(f"Verified event {event.id}: {event.type}")
        return {"received": True}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid signature")
```

---

## Auto-Pagination

```python
# Synchronous streaming
for suppression in client.suppressions.list_auto_paging(limit=100):
    print(f"Suppressed: {suppression.recipient} ({suppression.reason})")

# Asynchronous streaming
async for suppression in async_client.suppressions.list_auto_paging(limit=100):
    print(f"Suppressed: {suppression.recipient}")
```

---

## License

MIT © [Convey](https://github.com/hamidrezakks/convey)
