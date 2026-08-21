export function hashString(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}

export function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const lenA = a.length;
  const lenB = b.length;
  let result = lenA ^ lenB;
  const maxLen = Math.max(lenA, lenB);
  for (let i = 0; i < maxLen; i++) {
    const codeA = i < lenA ? a.charCodeAt(i) : 0;
    const codeB = i < lenB ? b.charCodeAt(i) : 0;
    result |= codeA ^ codeB;
  }
  return result === 0;
}

function canonicalize(val: unknown): unknown {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return val;
    return val.map(canonicalize);
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return obj;
  if (keys.length === 1) {
    const k = keys[0];
    return { [k]: canonicalize(obj[k]) };
  }
  keys.sort();
  const res: Record<string, unknown> = {};
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    res[k] = canonicalize(obj[k]);
  }
  return res;
}

export function hashCanonicalObject(obj: unknown): string {
  const canonical = canonicalize(obj);
  return hashString(JSON.stringify(canonical));
}
