import type { ProviderMockHandler } from '../../core/types';
import { otherToolHandlers } from './other-tool';
import { pagerdutyMockHandler } from './pagerduty';

export const toolHandlers: Record<string, ProviderMockHandler> = {
  pagerduty: pagerdutyMockHandler,
  ...otherToolHandlers,
};

export function findToolHandler(req: Request, url: URL): ProviderMockHandler | undefined {
  for (const handler of Object.values(toolHandlers)) {
    if (handler.matchesRequest(req, url)) {
      return handler;
    }
  }
  return undefined;
}
