import type { ProviderMockHandler } from '../../core/types';
import { apnsMockHandler } from './apns';
import { fcmMockHandler } from './fcm';
import { otherPushHandlers } from './other-push';

export const pushHandlers: Record<string, ProviderMockHandler> = {
  fcm: fcmMockHandler,
  apns: apnsMockHandler,
  ...otherPushHandlers,
};

export function findPushHandler(req: Request, url: URL): ProviderMockHandler | undefined {
  for (const handler of Object.values(pushHandlers)) {
    if (handler.matchesRequest(req, url)) {
      return handler;
    }
  }
  return undefined;
}
