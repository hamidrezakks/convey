import { describe, expect, it } from 'bun:test';
import {
  ConveyApiError,
  ConveyAuthenticationError,
  ConveyConflictError,
  ConveyError,
  ConveyForbiddenError,
  ConveyNetworkError,
  ConveyNotFoundError,
  ConveyRateLimitError,
  ConveySecurityError,
  ConveyTimeoutError,
  ConveyValidationError,
} from '../src';

describe('Typed Error Hierarchy', () => {
  it('should maintain proper inheritance chain from ConveyError and Error', () => {
    const base = new ConveyError('Base Error');
    expect(base).toBeInstanceOf(Error);
    expect(base).toBeInstanceOf(ConveyError);
    expect(base.name).toBe('ConveyError');

    const apiErr = new ConveyApiError({
      message: 'Api error',
      statusCode: 500,
      errorCode: 'SERVER_ERROR',
      requestId: 'req_123',
      traceparent: '00-abc-def-01',
      headers: { 'x-request-id': 'req_123' },
      rawBody: '{"error":"internal"}',
    });
    expect(apiErr).toBeInstanceOf(ConveyError);
    expect(apiErr).toBeInstanceOf(ConveyApiError);
    expect(apiErr.statusCode).toBe(500);
    expect(apiErr.errorCode).toBe('SERVER_ERROR');
    expect(apiErr.requestId).toBe('req_123');
    expect(apiErr.traceparent).toBe('00-abc-def-01');
    expect(apiErr.headers?.['x-request-id']).toBe('req_123');
  });

  it('should instantiate all specialized error subclasses properly', () => {
    const valErr = new ConveyValidationError({ message: 'Validation failed', details: [{ field: 'recipient' }] });
    expect(valErr).toBeInstanceOf(ConveyApiError);
    expect(valErr).toBeInstanceOf(ConveyValidationError);
    expect(valErr.statusCode).toBe(400);
    expect(valErr.errorCode).toBe('VALIDATION_ERROR');

    const authErr = new ConveyAuthenticationError({ message: 'Missing API Key' });
    expect(authErr.statusCode).toBe(401);
    expect(authErr.errorCode).toBe('UNAUTHORIZED');

    const forbErr = new ConveyForbiddenError({ message: 'Forbidden' });
    expect(forbErr.statusCode).toBe(403);

    const notFoundErr = new ConveyNotFoundError({ message: 'Not found' });
    expect(notFoundErr.statusCode).toBe(404);

    const conflictErr = new ConveyConflictError({ message: 'Conflict' });
    expect(conflictErr.statusCode).toBe(409);

    const rateErr = new ConveyRateLimitError({ message: 'Throttled', retryAfterSeconds: 5 });
    expect(rateErr.statusCode).toBe(429);
    expect(rateErr.retryAfterSeconds).toBe(5);

    const timeoutErr = new ConveyTimeoutError('Timeout', 10000);
    expect(timeoutErr).toBeInstanceOf(ConveyError);
    expect(timeoutErr.timeoutMs).toBe(10000);

    const netErr = new ConveyNetworkError('Connection reset', new Error('ECONNRESET'));
    expect(netErr).toBeInstanceOf(ConveyError);
    expect(netErr.cause?.message).toBe('ECONNRESET');

    const secErr = new ConveySecurityError('Bad signature');
    expect(secErr).toBeInstanceOf(ConveyError);
  });
});
