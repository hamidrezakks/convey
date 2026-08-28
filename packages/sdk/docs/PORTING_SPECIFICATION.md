# Convey SDK Porting Specification

A language-agnostic engineering specification for building official Convey SDK clients across **Python (`convey-py`)**, **Go (`convey-go`)**, **Rust (`convey-rs`)**, **Java (`convey-java`)**, **PHP (`convey-php`)**, and **Ruby (`convey-ruby`)**.

---

## 1. Wire Protocol & Standard Headers

All Convey SDKs communicate with the Convey REST API using JSON payloads over HTTP/1.1 or HTTP/2.

### Standard Request Headers

| Header | Type | Description |
| :--- | :--- | :--- |
| `Authorization` | `string` | Standard Bearer token: `Bearer <apiKey>` |
| `x-api-key` | `string` | Direct API key header: `<apiKey>` |
| `Idempotency-Key` | `string` | Monotonic unique token (`ULID` or `UUIDv4`) for mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`). |
| `traceparent` | `string` | W3C distributed trace context: `00-<32_hex_trace_id>-<16_hex_parent_id>-<01_flags>`. |
| `x-convey-sandbox` | `string` | Optional `'true'` / `'false'` routing header. |
| `x-convey-team` | `string` | Optional team scoping header. |
| `User-Agent` | `string` | Format: `convey-<lang>/<version> (<os>; <arch>)` (e.g. `convey-python/1.0.0 (darwin; arm64)`). |

---

## 2. Deterministic Retry & Jitter Algorithm

SDK implementations MUST implement **Full-Jitter Exponential Backoff** for HTTP 429 and transient 5xx responses (500, 502, 503, 504).

### Mathematical Formula

$$\text{sleep} = \min\left(\text{maxBackoffMs},\; \text{random}(0,\; \text{baseBackoffMs} \times 2^{\text{attempt}-1})\right)$$

- Default `baseBackoffMs = 250`
- Default `maxBackoffMs = 10000`
- Default `maxRetries = 3`

### `Retry-After` Header Handling
If the HTTP response contains a `Retry-After` header:
- If the value is an integer: `sleep = max(sleep, parsedSeconds * 1000)`
- If the value is an HTTP-date: `sleep = max(sleep, targetTimestamp - nowTimestamp)`

### Fail-Fast Rules (No Retries)
The client MUST NOT retry client errors (400, 401, 403, 404, 409, 422).

---

## 3. Idempotency Protocol

- Every state-mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) MUST attach an `Idempotency-Key` header.
- If the caller does not supply an explicit key, the SDK MUST automatically generate an opaque ULID (or UUIDv4) prefixed with `sdk_`.
- If the server returns `HTTP 409 Conflict`, the SDK MUST throw a dedicated `ConveyConflictError`.

---

## 4. Webhook HMAC-SHA256 Verification

Convey webhooks sign delivery receipts using HMAC-SHA256.

### Header Format
The `x-convey-signature` header can follow two formats:
1. Scheme: `t=<unix_timestamp_seconds>,v1=<hex_signature>`
2. Direct Raw Hex: `<hex_signature>`

### Verification Procedure
1. Parse the header to extract `timestamp` and `v1` signatures.
2. If `timestamp > 0` and `toleranceSeconds > 0`, calculate clock drift:
   $$\Delta t = |\text{currentUnixTimestamp} - \text{timestamp}|$$
   If $\Delta t > \text{toleranceSeconds}$, reject with `ConveySecurityError`.
3. Construct the signed string:
   $$\text{signedContent} = \begin{cases} \text{timestamp} + "." + \text{rawBodyString} & \text{if } \text{timestamp} > 0 \\ \text{rawBodyString} & \text{otherwise} \end{cases}$$
4. Compute HMAC-SHA256 using the subscription secret:
   $$\text{expectedSignature} = \text{HMAC-SHA256}(\text{secret}, \text{signedContent})$$
5. Perform a **constant-time byte comparison** (`timingSafeEqual`) between `v1` and `expectedSignature` to prevent side-channel timing attacks.

---

## 5. Standard Error JSON Schema & Mappings

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid recipient phone number format",
    "details": [
      {
        "path": "recipient",
        "code": "invalid_string",
        "message": "Must be valid E.164 phone number"
      }
    ]
  }
}
```

### Status Code Mapping Table

| HTTP Status | Error Class | Description |
| :--- | :--- | :--- |
| `400` | `ConveyValidationError` | Payload validation failure. |
| `401` | `ConveyAuthenticationError` | Missing, invalid, or expired API key. |
| `403` | `ConveyForbiddenError` | Role/tier permission denied. |
| `404` | `ConveyNotFoundError` | Resource not found. |
| `409` | `ConveyConflictError` | Idempotency conflict / key mismatch. |
| `429` | `ConveyRateLimitError` | Rate limit exceeded (`retryAfterSeconds`). |
| `5xx` | `ConveyApiError` | Internal server or provider failure. |
| `Timeout` | `ConveyTimeoutError` | Request timed out. |
| `Network` | `ConveyNetworkError` | DNS resolution failure or socket hangup. |
| `Security` | `ConveySecurityError` | Webhook signature verification failure. |

---

## 6. Language Implementation Blueprints

### 6.1 Python (`convey-py`)

```python
# convey/client.py
import time
import hmac
import hashlib
import json
from typing import Optional, Dict, Any
import requests

class ConveyError(Exception): pass
class ConveyApiError(ConveyError):
    def __init__(self, message: str, status_code: int, error_code: str = "API_ERROR"):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code

class ConveyClient:
    def __init__(self, api_key: str, base_url: str, max_retries: int = 3, timeout: float = 10.0):
        if not base_url:
            raise ConveyError("base_url is mandatory (e.g. 'https://api.convey.dev')")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self.timeout = timeout
        self.session = requests.Session()

    def send_message(self, channel: str, recipient: str, content: Dict[str, Any], priority: str = "DEFAULT") -> Dict[str, Any]:
        payload = {
            "channel": channel,
            "recipient": recipient,
            "priority": priority,
            "content": content
        }
        return self._request("POST", "/v1/messages", json_body=payload)

    def _request(self, method: str, path: str, json_body: Optional[Dict] = None) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        url = f"{self.base_url}{path}"
        
        response = self.session.request(method, url, json=json_body, headers=headers, timeout=self.timeout)
        if response.status_code >= 400:
            raise ConveyApiError(response.text, response.status_code)
        return response.json()

    @staticmethod
    def verify_webhook_signature(payload: str, signature_header: str, secret: str) -> bool:
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature_header, expected)
```

---

### 6.2 Go (`convey-go`)

```go
// convey.go
package convey

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

func NewClient(apiKey, baseURL string, opts ...Option) *Client {
	c := &Client{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
	return c
}

type SendMessageRequest struct {
	Channel   string                 `json:"channel"`
	Recipient string                 `json:"recipient"`
	Priority  string                 `json:"priority,omitempty"`
	Content   map[string]interface{} `json:"content"`
}

type MessageAcceptedResponse struct {
	Success  bool   `json:"success"`
	PublicID string `json:"publicId"`
	Status   string `json:"status"`
}

func (c *Client) SendMessage(ctx context.Context, req SendMessageRequest) (*MessageAcceptedResponse, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("convey api error: HTTP %d", resp.StatusCode)
	}

	var result MessageAcceptedResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func VerifyWebhookSignature(payload []byte, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedSig := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expectedSig))
}
```

---

### 6.3 Rust (`convey-rs`)

```rust
// src/lib.rs
use reqwest::{Client as ReqwestClient, StatusCode};
use serde::{Deserialize, Serialize};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use hex;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone)]
pub struct Convey {
    api_key: String,
    base_url: String,
    http: ReqwestClient,
}

#[derive(Serialize)]
pub struct SendMessageRequest {
    pub channel: String,
    pub recipient: String,
    pub content: serde_json::Value,
}

#[derive(Deserialize, Debug)]
pub struct MessageAcceptedResponse {
    pub success: bool,
    #[serde(rename = "publicId")]
    pub public_id: String,
    pub status: String,
}

impl Convey {
    pub fn new(api_key: impl Into<String>, base_url: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: base_url.into().trim_end_matches('/').to_string(),
            http: ReqwestClient::new(),
        }
    }

    pub async fn send_message(&self, req: &SendMessageRequest) -> Result<MessageAcceptedResponse, Box<dyn std::error::Error>> {
        let url = format!("{}/v1/messages", self.base_url);
        let res = self.http.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("x-api-key", &self.api_key)
            .json(req)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(format!("Convey API error: {}", res.status()).into());
        }

        let accepted: MessageAcceptedResponse = res.json().await?;
        Ok(accepted)
    }

    pub fn verify_webhook_signature(payload: &[u8], signature: &str, secret: &[u8]) -> bool {
        if let Ok(mut mac) = HmacSha256::new_from_slice(secret) {
            mac.update(payload);
            let expected = hex::encode(mac.finalize().into_bytes());
            expected.eq_ignore_ascii_case(signature)
        } else {
            false
        }
    }
}
```

---

### 6.4 Java (`convey-java`)

```java
package com.convey;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

public class ConveyClient {
    private final String apiKey;
    private final String baseUrl;
    private final HttpClient httpClient;

    public ConveyClient(String apiKey, String baseUrl) {
        if (baseUrl == null || baseUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("baseUrl is mandatory (e.g. https://api.convey.dev)");
        }
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.httpClient = HttpClient.newHttpClient();
    }

    public String sendMessage(String jsonPayload) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/messages"))
            .header("Authorization", "Bearer " + apiKey)
            .header("x-api-key", apiKey)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new RuntimeException("Convey API Error: " + response.body());
        }
        return response.body();
    }
}
```

---

### 6.5 PHP (`convey-php`)

```php
<?php

namespace Convey;

class ConveyClient {
    private string $apiKey;
    private string $baseUrl;

    public function __construct(string $apiKey, string $baseUrl) {
        if (empty($baseUrl)) {
            throw new \InvalidArgumentException("baseUrl is mandatory (e.g. 'https://api.convey.dev')");
        }
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    public function sendMessage(array $payload): array {
        $ch = curl_init($this->baseUrl . '/v1/messages');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $this->apiKey,
            'x-api-key: ' . $this->apiKey,
            'Content-Type: application/json'
        ]);

        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status >= 400) {
            throw new \Exception("Convey API Error: $response", $status);
        }

        return json_decode($response, true);
    }

    public static function verifyWebhook(string $payload, string $signature, string $secret): bool {
        $expected = hash_hmac('sha256', $payload, $secret);
        return hash_equals($expected, $signature);
    }
}
```
