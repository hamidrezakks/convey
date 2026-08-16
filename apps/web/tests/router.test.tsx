import './setup';
import { describe, expect, it } from 'bun:test';
import { router } from '../src/router';

describe('TanStack Router Route Tree Test Suite', () => {
  it('registers all 12 mission control routes on the route tree', () => {
    const flatRoutes = router.routesByPath;
    expect(flatRoutes['/']).toBeDefined();
    expect(flatRoutes['/overview']).toBeDefined();
    expect(flatRoutes['/messages']).toBeDefined();
    expect(flatRoutes['/providers']).toBeDefined();
    expect(flatRoutes['/providers/configure']).toBeDefined();
    expect(flatRoutes['/dlq']).toBeDefined();
    expect(flatRoutes['/deliverability']).toBeDefined();
    expect(flatRoutes['/policies']).toBeDefined();
    expect(flatRoutes['/composer']).toBeDefined();
    expect(flatRoutes['/webhooks']).toBeDefined();
    expect(flatRoutes['/architecture']).toBeDefined();
    expect(flatRoutes['/audit']).toBeDefined();
  });
});
