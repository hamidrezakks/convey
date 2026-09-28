import { expect, test } from 'bun:test';
import {
  isPublicWebhookAddress,
  resolveWebhookDestination,
  validateWebhookUrl,
} from '../src/utils/webhook-destination';

test('rejects private, mapped, multicast, metadata and reserved addresses', () => {
  for (const address of [
    '127.0.0.1',
    '10.1.2.3',
    '169.254.169.254',
    '100.64.0.1',
    '192.168.1.2',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::',
    '224.0.0.1',
  ]) {
    expect(isPublicWebhookAddress(address)).toBe(false);
  }
  expect(isPublicWebhookAddress('8.8.8.8')).toBe(true);
  expect(isPublicWebhookAddress('2606:4700:4700::1111')).toBe(true);
});

test('rejects URL bypasses', () => {
  for (const url of [
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com:8443',
    'https://2130706433',
    'https://[::1]',
    'file:///etc/passwd',
  ]) {
    expect(() => validateWebhookUrl(url)).toThrow();
  }
});

test('rejects mixed DNS responses and pins the validated public address', async () => {
  const mixed = async () => [
    { address: '8.8.8.8', family: 4 },
    { address: '10.0.0.1', family: 4 },
  ];
  await expect(resolveWebhookDestination('https://example.com', mixed)).rejects.toThrow('public');
  const publicOnly = async () => [{ address: '8.8.8.8', family: 4 }];
  expect((await resolveWebhookDestination('https://example.com/path', publicOnly)).address).toBe('8.8.8.8');
});
