import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';
import { CequensSmsAdapter } from '../src/modules/providers/sms/cequens/cequens.adapter';
import { cequensTransformer } from '../src/modules/providers/sms/cequens/cequens.transformer';

describe('Cequens SMS Provider & Transformer', () => {
  it('should transform global SendMessageOptions to CequensApiRequest', () => {
    const req = cequensTransformer.transformRequest(
      {
        recipient: { phone: '+201234567890' },
        content: { text: 'Hello from Convey test' },
        from: 'MyCompany',
        metadata: { clientRefId: 'ref_123' },
      },
      { senderName: 'DefaultSender' },
    );

    expect(req.recipient).toBe('+201234567890');
    expect(req.sender).toBe('MyCompany');
    expect(req.message).toBe('Hello from Convey test');
    expect(req.clientRefId).toBe('ref_123');
  });

  it('should transform successful CequensApiResponse to ProviderSendResult', () => {
    const res = cequensTransformer.transformResponse(
      {
        message_id: 'cq_msg_98765',
        status: 'accepted',
        replyCode: 0,
      },
      200,
    );

    expect(res.success).toBe(true);
    expect(res.providerMessageId).toBe('cq_msg_98765');
  });

  it('should transform error CequensApiResponse to ProviderSendResult', () => {
    const res = cequensTransformer.transformResponse(
      {
        replyCode: 401,
        replyMessage: 'Invalid API Key',
      },
      401,
    );

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('401');
    expect(res.error?.message).toBe('Invalid API Key');
  });

  it('should be registered in ProviderRegistry', () => {
    const adapter = ProviderRegistry.get(Channel.SMS, 'cequens');
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(CequensSmsAdapter);
    expect(adapter?.id).toBe('cequens');
    expect(adapter?.channel).toBe(Channel.SMS);
  });
});
