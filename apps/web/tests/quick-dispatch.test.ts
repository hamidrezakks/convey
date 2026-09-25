import { expect, test } from 'bun:test';
import { SendMessageRequestSchema } from '../../server/src/modules/messaging/messaging.types';
import { buildQuickDispatch, dispatchChannels } from '../src/lib/quick-dispatch';

for (const channel of dispatchChannels) {
  test(`quick dispatch ${channel} matches the API contract`, () => {
    const recipient = channel === 'email' ? 'test@example.invalid' : 'test-target';
    const payload = buildQuickDispatch('test-team', channel, recipient, 'Test title', 'Test body');
    const parsed = SendMessageRequestSchema.parse(payload);
    expect(parsed.recipients).toEqual(payload.recipients);
    expect(JSON.stringify(parsed.channels)).toBe(JSON.stringify(payload.channels));
    expect(parsed.team).toBe('test-team');
  });
}
