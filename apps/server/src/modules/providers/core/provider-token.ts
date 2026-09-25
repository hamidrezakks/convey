import { createHash, sign } from 'node:crypto';

export function signProviderJwt(
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
  key: string,
  algorithm: 'ES256' | 'RS256',
): string {
  const input = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
  const signature = sign('sha256', Buffer.from(input), {
    key: key.replace(/\\n/g, '\n'),
    dsaEncoding: algorithm === 'ES256' ? 'ieee-p1363' : 'der',
  });
  return `${input}.${signature.toString('base64url')}`;
}

/** Single-entry cache: credentials never appear in cache keys or cross tenant boundaries. */
export class ProviderTokenCache {
  private entry?: { key: string; token: string; expiresAt: number };
  async get(credentials: unknown, load: () => Promise<{ token: string; expiresIn: number }>): Promise<string> {
    const key = createHash('sha256').update(JSON.stringify(credentials)).digest('hex');
    if (this.entry?.key === key && this.entry.expiresAt > Date.now() + 60_000) return this.entry.token;
    const result = await load();
    this.entry = { key, token: result.token, expiresAt: Date.now() + result.expiresIn * 1000 };
    return result.token;
  }
  clear(): void {
    this.entry = undefined;
  }
}
