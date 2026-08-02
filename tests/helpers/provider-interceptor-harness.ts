/**
 * Provider Interceptor & Security Audit Harness.
 *
 * Provides utilities to inspect payload envelopes, verify credential redaction,
 * audit public response schemas for internal provider message ID leakage,
 * and simulate dynamic HTTP provider response faults.
 */

const SECRET_KEYS = [
  'apikey',
  'authtoken',
  'secretaccesskey',
  'password',
  'token',
  'bottoken',
  'privatekey',
  'clientsecret',
];

/**
 * Recursively redacts sensitive configuration keys from object telemetry dumps.
 */
export function redactSensitiveConfig(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SECRET_KEYS.some((secretKey) => lowerKey.includes(secretKey))) {
      redacted[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactSensitiveConfig(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Checks whether a public API response object contains internal provider message IDs.
 * Internal IDs follow provider-specific formats (e.g., SM12345, resend_msg_123, wamid.HBgL).
 */
export function containsInternalProviderMessageId(payload: unknown): boolean {
  const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // Regex matching common internal provider ID prefixes or patterns
  const internalIdPatterns = [
    /resend_msg_[a-zA-Z0-9]+/i,
    /\bSM[a-f0-9]{32}\b/i,
    /\bwamid\.HBgL[a-zA-Z0-9+/=]+\b/i,
    /provider_msg_[a-zA-Z0-9_]+/i,
  ];

  return internalIdPatterns.some((pattern) => pattern.test(jsonStr));
}
