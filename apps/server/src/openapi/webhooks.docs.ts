import { CommonHeaders, StandardResponseExamples, StandardSecurityRequirement } from './openapi.docs';

export const WebhooksDocs = {
  hubHandshake: {
    tags: ['Webhooks'],
    summary: 'Meta / WhatsApp Webhook Challenge Handshake',
    description: 'Handles Meta WhatsApp Cloud API / Facebook Graph API hub verification handshake request.',
    parameters: [
      { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } },
      { name: 'hub.mode', in: 'query', required: true, schema: { type: 'string', example: 'subscribe' } },
      {
        name: 'hub.verify_token',
        in: 'query',
        required: true,
        schema: { type: 'string', example: 'cv_verify_token_123' },
      },
      { name: 'hub.challenge', in: 'query', required: true, schema: { type: 'string', example: '1158201444' } },
    ],
    responses: {
      '200': {
        description: 'Challenge string returned in plain text on successful verification',
        content: { 'text/plain': { schema: { type: 'string', example: '1158201444' } } },
      },
      '403': { description: 'Invalid verify token or handshake parameters' },
    },
  },

  hubStatusHandshake: {
    tags: ['Webhooks'],
    summary: 'WhatsApp Dedicated Status Webhook Handshake',
    description: 'Verification handshake for dedicated WhatsApp status callback endpoint.',
    parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } }],
  },

  hubIncomingHandshake: {
    tags: ['Webhooks'],
    summary: 'WhatsApp Dedicated Incoming Message Webhook Handshake',
    description: 'Verification handshake for dedicated WhatsApp 2-way incoming message endpoint.',
    parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } }],
  },

  hubInboundHandshake: {
    tags: ['Webhooks'],
    summary: 'WhatsApp Dedicated Inbound Webhook Handshake',
    description: 'Verification handshake for dedicated WhatsApp inbound endpoint alias.',
    parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } }],
  },

  ingestStatus: {
    tags: ['Webhooks'],
    summary: 'Ingest WhatsApp Dedicated Status Webhook',
    description: 'Ingests WhatsApp delivery and read receipts (delivered, read, failed).',
    headers: CommonHeaders,
    parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } }],
    responses: {
      '200': {
        description: 'Status update ingested successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['accepted', 'duplicate_ignored', 'unauthorized'],
                  example: 'accepted',
                },
              },
            },
          },
        },
      },
    },
  },

  ingestIncoming: {
    tags: ['Webhooks'],
    summary: 'Ingest WhatsApp Dedicated Incoming 2-Way Message',
    description:
      'Ingests customer-initiated 2-way incoming WhatsApp messages, refreshing the 24-hour service window for zero-cost session optimization.',
    headers: CommonHeaders,
    parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } }],
    responses: {
      '200': {
        description: 'Inbound message processed and 24h window refreshed',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'accepted' },
              },
            },
          },
        },
      },
    },
  },

  ingestInboundAlias: {
    tags: ['Webhooks'],
    summary: 'Ingest Inbound Message (Alias)',
    description: 'Alias for incoming message ingestion endpoint.',
    parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'whatsapp' } }],
  },

  ingestProviderWebhook: {
    tags: ['Webhooks'],
    summary: 'Unified Inbound Provider Webhook Ingestion',
    description:
      'Ingests delivery receipts, bounces, spam complaints, and incoming messages from upstream providers (Twilio, SendGrid, Resend, Cequens, Infobip, etc.).',
    headers: CommonHeaders,
    parameters: [
      {
        name: 'provider',
        in: 'path',
        required: true,
        description: 'Provider identifier slug',
        schema: { type: 'string', example: 'sendgrid' },
      },
    ],
    requestBody: {
      required: true,
      description: 'Provider-specific delivery webhook event payload',
      content: {
        'application/json': {
          examples: {
            sendgrid_delivered: {
              summary: 'SendGrid Delivery Receipt',
              value: [
                {
                  email: 'customer@example.com',
                  event: 'delivered',
                  sg_message_id: 'sg_10928312.filter',
                  timestamp: 1786500600,
                },
              ],
            },
            twilio_sms_delivered: {
              summary: 'Twilio SMS Status Callback',
              value: {
                MessageSid: 'SM1234567890abcdef',
                MessageStatus: 'delivered',
                To: '+971501234567',
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Webhook successfully parsed and enqueued',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'accepted' },
              },
            },
          },
        },
      },
      '401': {
        description: 'Invalid Webhook Cryptographic Signature',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { unauthorized: StandardResponseExamples.unauthorized },
          },
        },
      },
    },
  },

  openTrackingPixel: {
    tags: ['Webhooks'],
    summary: 'Email Open Tracking Pixel (1x1 Transparent GIF)',
    description: 'Zero-footprint 1x1 transparent GIF tracking endpoint for recording email open events.',
    parameters: [
      {
        name: 'token',
        in: 'path',
        required: true,
        description: 'Encrypted message open tracking token',
        schema: { type: 'string', example: 'tok_01J0N...' },
      },
    ],
    responses: {
      '200': {
        description: '1x1 Transparent GIF Image',
        content: {
          'image/gif': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      },
    },
  },

  clientReceipt: {
    tags: ['Webhooks'],
    summary: 'Ingest Client In-App Delivery / Read Receipts',
    description:
      'Ingests delivery, read, or interaction confirmations directly from client mobile applications or SDKs.',
    headers: CommonHeaders,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              messageId: { type: 'string', example: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3' },
              channel: { type: 'string', example: 'push' },
              event: { type: 'string', enum: ['delivered', 'read', 'clicked'], example: 'read' },
            },
            required: ['messageId'],
          },
          examples: {
            in_app_receipt: {
              summary: 'Client Read Receipt',
              value: {
                messageId: 'msg_01J0N7C0W7X2R6S8V9Q9B1E4G3',
                channel: 'push',
                event: 'read',
              },
            },
          },
        },
      },
    },
    responses: {
      '202': {
        description: 'Receipt accepted for processing',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'accepted' },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid Receipt Payload',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { validation_error: StandardResponseExamples.bad_request_validation },
          },
        },
      },
    },
  },
};

export const WebhookSubscriptionsDocs = {
  createSubscription: {
    tags: ['Webhooks'],
    summary: 'Create Outgoing Customer Webhook Subscription',
    description:
      'Subscribes an external endpoint to real-time message delivery lifecycle events signed with HMAC-SHA256.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          examples: {
            subscription: {
              summary: 'Webhook Subscription Configuration',
              value: {
                url: 'https://api.merchant.com/webhooks/convey',
                events: ['message.delivered', 'message.failed', 'message.opened', 'message.read'],
                secret: 'whsec_981273918273918273',
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Webhook subscription created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                subscription: { $ref: '#/components/schemas/WebhookSubscription' },
              },
            },
          },
        },
      },
      '400': {
        description: 'Validation Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { validation_error: StandardResponseExamples.bad_request_validation },
          },
        },
      },
    },
  },

  listSubscriptions: {
    tags: ['Webhooks'],
    summary: 'List Outgoing Webhook Subscriptions for Team',
    description: 'Retrieves all active customer webhook endpoints configured for the authenticated tenant team.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'List of active webhook subscriptions',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                subscriptions: { type: 'array', items: { $ref: '#/components/schemas/WebhookSubscription' } },
              },
            },
          },
        },
      },
    },
  },

  deleteSubscription: {
    tags: ['Webhooks'],
    summary: 'Delete Webhook Subscription',
    description: 'Permanently removes a webhook subscription endpoint.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Subscription successfully removed',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
              },
            },
          },
        },
      },
      '404': {
        description: 'Subscription Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { not_found: StandardResponseExamples.not_found },
          },
        },
      },
    },
  },

  testSubscription: {
    tags: ['Webhooks'],
    summary: 'Send Test Ping to Webhook Subscription',
    description:
      'Dispatches a synthetic `ping.test` event payload to verify client endpoint connectivity and HMAC signature calculation.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Test ping queued for dispatch',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Test event queued for delivery' },
              },
            },
          },
        },
      },
    },
  },
};
