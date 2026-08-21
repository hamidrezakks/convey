import { CommonHeaders, StandardResponseExamples, StandardSecurityRequirement } from './openapi.docs';

export const SuppressionsDocs = {
  bulkAddSuppressions: {
    tags: ['Suppressions'],
    summary: 'Bulk Add Compliance Suppressions',
    description: 'Bulk inserts recipient suppression records to block future dispatches across specified channels.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          examples: {
            bulk_suppress: {
              summary: 'Bulk Add Bounces & Unsubscribes',
              value: {
                items: [
                  {
                    identifier: 'bounced_user@example.com',
                    identifierType: 'email',
                    reason: 'HARD_BOUNCE',
                    channel: 'email',
                  },
                  { identifier: '+14155550199', identifierType: 'phone', reason: 'UNSUBSCRIBE', channel: 'sms' },
                ],
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Bulk suppression creation summary',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                count: { type: 'integer', example: 2 },
                suppressions: { type: 'array', items: { $ref: '#/components/schemas/SuppressionRecord' } },
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

  addSuppression: {
    tags: ['Suppressions'],
    summary: 'Add Single Recipient Suppression',
    description:
      'Records an individual suppression entry to protect sender reputation and enforce GDPR/CAN-SPAM compliance.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          examples: {
            single_unsubscribe: {
              summary: 'Add Unsubscribe Entry',
              value: {
                identifier: 'unsubscribed_customer@example.com',
                identifierType: 'email',
                reason: 'UNSUBSCRIBE',
                channel: 'email',
                category: 'marketing',
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Suppression record successfully created',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                suppression: { $ref: '#/components/schemas/SuppressionRecord' },
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

  listSuppressions: {
    tags: ['Suppressions'],
    summary: 'List Suppressions for Team',
    description: 'Queries active suppressions with multi-field search and pagination filters.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    parameters: [
      { name: 'channel', in: 'query', required: false, schema: { type: 'string', example: 'email' } },
      { name: 'reason', in: 'query', required: false, schema: { type: 'string', example: 'UNSUBSCRIBE' } },
      { name: 'search', in: 'query', required: false, schema: { type: 'string', example: 'user@example.com' } },
      { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
      { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } },
    ],
    responses: {
      '200': {
        description: 'List of suppression records matching filter criteria',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 1 },
                suppressions: { type: 'array', items: { $ref: '#/components/schemas/SuppressionRecord' } },
              },
            },
          },
        },
      },
    },
  },

  deleteSuppression: {
    tags: ['Suppressions'],
    summary: 'Remove Suppression Record',
    description: 'Permanently removes a recipient suppression record to allow message delivery to resume.',
    security: StandardSecurityRequirement,
    headers: CommonHeaders,
    responses: {
      '200': {
        description: 'Suppression record successfully deleted',
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
        description: 'Suppression Record Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: { not_found: StandardResponseExamples.not_found },
          },
        },
      },
    },
  },
};
