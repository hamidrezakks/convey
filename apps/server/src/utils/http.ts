export function normalizeHeaders(
  headers?: Record<string, string | string[] | undefined> | Headers,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  if (typeof (headers as Headers).forEach === 'function') {
    (headers as Headers).forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }

  for (const [key, value] of Object.entries(headers as Record<string, string | string[] | undefined>)) {
    if (typeof value === 'string') {
      result[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      result[key.toLowerCase()] = value[0];
    }
  }

  return result;
}

export async function parseFetchResponse<T = Record<string, unknown>>(
  response: Response,
): Promise<{ statusCode: number; json: T; headers: Record<string, string>; text: string }> {
  const text = await response.text();
  let json: T = {} as T;
  if (text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      // Empty or non-JSON body
    }
  }
  const headers = normalizeHeaders(response.headers);
  return { statusCode: response.status, json, headers, text };
}
