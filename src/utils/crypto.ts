export function hashString(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}

function canonicalize(val: unknown): unknown {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const res: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    res[k] = canonicalize(obj[k]);
  }
  return res;
}

export function hashCanonicalObject(obj: unknown): string {
  const canonical = canonicalize(obj);
  return hashString(JSON.stringify(canonical));
}
