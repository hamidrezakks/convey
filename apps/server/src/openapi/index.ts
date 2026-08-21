import { AdminDocs as _AdminDocs } from './admin.docs';
import { BatchesDocs as _BatchesDocs } from './batches.docs';
import { DlqDocs as _DlqDocs } from './dlq.docs';
import { MessagingDocs as _MessagingDocs } from './messaging.docs';
import { ObservabilityDocs as _ObservabilityDocs } from './observability.docs';
import { SandboxDocs as _SandboxDocs } from './sandbox.docs';
import { SuppressionsDocs as _SuppressionsDocs } from './suppressions.docs';
import { WebhookSubscriptionsDocs as _WebhookSubscriptionsDocs, WebhooksDocs as _WebhooksDocs } from './webhooks.docs';

// biome-ignore lint/suspicious/noExplicitAny: Elysia OpenAPI DocumentDecoration requires flexible schema dictionary
type OpenApiDoc = any;

export const AdminDocs: Record<string, OpenApiDoc> = _AdminDocs;
export const BatchesDocs: Record<string, OpenApiDoc> = _BatchesDocs;
export const DlqDocs: Record<string, OpenApiDoc> = _DlqDocs;
export const MessagingDocs: Record<string, OpenApiDoc> = _MessagingDocs;
export const ObservabilityDocs: Record<string, OpenApiDoc> = _ObservabilityDocs;
export const SandboxDocs: Record<string, OpenApiDoc> = _SandboxDocs;
export const SuppressionsDocs: Record<string, OpenApiDoc> = _SuppressionsDocs;
export const WebhooksDocs: Record<string, OpenApiDoc> = _WebhooksDocs;
export const WebhookSubscriptionsDocs: Record<string, OpenApiDoc> = _WebhookSubscriptionsDocs;

export * from './openapi.docs';
