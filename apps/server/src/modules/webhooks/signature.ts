import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyIngressSignature(
  request: Request,
  rawBody: string,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!secret) return false;
  const timestamp = request.headers.get('x-convey-webhook-timestamp') || '';
  const signature = request.headers.get('x-convey-webhook-signature') || '';
  if (
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
