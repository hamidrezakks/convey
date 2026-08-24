/**
 * @convey/sdk - W3C Trace Context Generator & Propagator
 * Implements W3C Trace Context Level 1 (traceparent: 00-<trace_id>-<parent_id>-<flags>)
 */

function generateHex(bytesLength: number): string {
  const bytes = new Uint8Array(bytesLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytesLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateTraceparent(): string {
  const version = '00';
  const traceId = generateHex(16); // 32 hex chars
  const parentId = generateHex(8);  // 16 hex chars
  const traceFlags = '01';          // sampled
  return `${version}-${traceId}-${parentId}-${traceFlags}`;
}

export function createChildTraceparent(parentTraceparent?: string): string {
  if (!parentTraceparent) {
    return generateTraceparent();
  }

  const parts = parentTraceparent.trim().split('-');
  if (parts.length === 4 && parts[0] === '00' && parts[1].length === 32) {
    const traceId = parts[1];
    const newSpanId = generateHex(8);
    const flags = parts[3] || '01';
    return `00-${traceId}-${newSpanId}-${flags}`;
  }

  return generateTraceparent();
}
