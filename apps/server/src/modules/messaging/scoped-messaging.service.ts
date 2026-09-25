import { assertTeamScope, type TenantScope } from '../auth/tenant-scope';
import { MessagingService } from './messaging.service';
import type { SendMessageRequest } from './messaging.types';

export const ScopedMessagingService = {
  acceptMessage(scope: TenantScope, request: SendMessageRequest) {
    assertTeamScope(scope, request.team);
    return MessagingService.acceptMessage(request, scope.isSandbox);
  },
  acceptBulkMessages(scope: TenantScope, requests: SendMessageRequest[]) {
    // Validate the entire batch before acquiring locks or writing any messages.
    for (const request of requests) assertTeamScope(scope, request.team);
    return MessagingService.acceptBulkMessages(requests, scope.isSandbox);
  },
  getMessageStatus(scope: TenantScope, id: string, timeline = false) {
    return MessagingService.getMessageStatus(id, timeline, scope);
  },
  getMessageDeliveryTrace(scope: TenantScope, id: string) {
    return MessagingService.getMessageDeliveryTrace(id, scope);
  },
};
