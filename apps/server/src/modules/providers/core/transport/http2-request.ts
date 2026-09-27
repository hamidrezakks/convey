import { connect, type OutgoingHttpHeaders } from 'node:http2';

/** APNs requires HTTP/2. Close both stream and session on every completion path. */
export function http2Request(
  origin: string,
  path: string,
  headers: OutgoingHttpHeaders,
  body: string,
): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  return new Promise((resolve, reject) => {
    const client = connect(origin);
    const timer = setTimeout(() => finish(new Error('HTTP/2 request timed out')), 15_000);
    let settled = false;
    function finish(error?: Error, result?: { status: number; headers: Record<string, unknown>; body: string }) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.destroy();
      if (error) reject(error);
      else if (result) resolve(result);
    }
    client.on('error', (error) => finish(error));
    const request = client.request({ ...headers, ':method': 'POST', ':path': path });
    let status = 0;
    let responseHeaders: Record<string, unknown> = {};
    let responseBody = '';
    request.setEncoding('utf8');
    request.on('response', (received) => {
      status = Number(received[':status']);
      responseHeaders = received;
    });
    request.on('data', (chunk) => {
      responseBody += chunk;
      if (responseBody.length > 65536) finish(new Error('HTTP/2 response too large'));
    });
    request.on('error', (error) => finish(error));
    request.on('end', () => finish(undefined, { status, headers: responseHeaders, body: responseBody }));
    request.on('close', () => {
      if (!settled) finish(new Error('HTTP/2 stream closed before response completed'));
    });
    request.end(body);
  });
}
