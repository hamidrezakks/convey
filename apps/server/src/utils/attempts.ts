import { MessageState } from '../modules/messaging/messaging.types';

export function buildAttemptTimestampUpdates(status: string, timestamp: Date, now: Date = new Date()) {
  const norm = status.toLowerCase();
  return {
    state: norm,
    ...(norm === MessageState.DELIVERED ? { deliveredAt: timestamp } : {}),
    ...(norm === MessageState.OPENED ? { openedAt: timestamp } : {}),
    ...(norm === MessageState.READ ? { readAt: timestamp } : {}),
    ...(norm === MessageState.FAILED || norm === MessageState.BOUNCED ? { failedAt: timestamp } : {}),
    updatedAt: now,
  };
}
