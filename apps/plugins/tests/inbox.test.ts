import { beforeAll, describe, expect, it } from 'bun:test';
import { initializePluginTables } from '../src/db';
import { InboxService } from '../src/modules/inbox/inbox.service';

describe('Plugins App: In-App Notification Feed & Real-Time Inbox', () => {
  const testTenant = '019ff136-0000-7000-8000-000000000001';
  const testTeam = 'growth-team';
  const recipient = `subscriber_${Date.now()}`;

  beforeAll(async () => {
    await initializePluginTables();
  });

  it('creates in-app notifications and manages read/archive state with unread count', async () => {
    // 1. Create 3 notifications
    const n1 = await InboxService.createNotification({
      tenantId: testTenant,
      team: testTeam,
      recipientId: recipient,
      title: 'Welcome to Convey!',
      body: 'Your workspace is ready. Click here to get started.',
      ctaUrl: 'https://convey.dev/dashboard',
      category: 'onboarding',
    });

    const n2 = await InboxService.createNotification({
      tenantId: testTenant,
      team: testTeam,
      recipientId: recipient,
      title: 'Invoice Paid',
      body: 'Your subscription receipt #INV-001 is ready.',
      category: 'billing',
    });

    const n3 = await InboxService.createNotification({
      tenantId: testTenant,
      team: testTeam,
      recipientId: recipient,
      title: 'New Security Login',
      body: 'Login detected from Chrome macOS.',
      category: 'security',
    });

    expect(n1.id).toBeDefined();
    expect(n2.id).toBeDefined();
    expect(n3.id).toBeDefined();

    // 2. Fetch unread feed
    const feed = await InboxService.getFeed({
      tenantId: testTenant,
      recipientId: recipient,
      unreadOnly: true,
    });

    expect(feed.unreadCount).toBe(3);
    expect(feed.items.length).toBe(3);

    // 3. Mark 1 notification as read
    const readResult = await InboxService.markAsRead(testTenant, recipient, [n1.id]);
    expect(readResult.updatedCount).toBe(1);

    const feedAfterRead = await InboxService.getFeed({
      tenantId: testTenant,
      recipientId: recipient,
    });

    expect(feedAfterRead.unreadCount).toBe(2);
    expect(feedAfterRead.totalCount).toBe(3);

    // 4. Archive 1 notification
    const archiveResult = await InboxService.archiveNotifications(testTenant, recipient, [n2.id]);
    expect(archiveResult.archivedCount).toBe(1);

    const feedAfterArchive = await InboxService.getFeed({
      tenantId: testTenant,
      recipientId: recipient,
    });

    expect(feedAfterArchive.totalCount).toBe(2); // Archived items excluded from active feed

    // 5. Mark all as read
    await InboxService.markAllAsRead(testTenant, recipient);
    const feedFinal = await InboxService.getFeed({
      tenantId: testTenant,
      recipientId: recipient,
    });

    expect(feedFinal.unreadCount).toBe(0);
  });
});
