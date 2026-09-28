# Registered API access inventory

Generated from Elysia route registration. Boundary labels are expected policy, not proof of every authorized combination. The strict-auth suite checks every registered API-key route for anonymous rejection; webhook signatures and tracking tokens require their separate tests. Role, cross-team and sandbox cases are exercised by access-policy and hardening/security tests.

| Method | Route | Expected boundary |
| --- | --- | --- |
| DELETE | /v1/admin/providers/configured/:id | Platform role; writes require admin |
| DELETE | /v1/admin/suppressions/:id | Platform role; writes require admin |
| DELETE | /v1/sandbox/messages | API credential; tenant/team/environment scope |
| DELETE | /v1/suppressions/:id | API credential; tenant/team/environment scope |
| DELETE | /v1/webhook-subscriptions/:id | API credential; tenant/team/environment scope |
| GET | /v1/admin/audit-logs | Platform role; writes require admin |
| GET | /v1/admin/budgets/:team | Platform role; writes require admin |
| GET | /v1/admin/budgets/:team/holds | Platform role; writes require admin |
| GET | /v1/admin/carrier-rates | Platform role; writes require admin |
| GET | /v1/admin/currencies | Platform role; writes require admin |
| GET | /v1/admin/messages | Platform role; writes require admin |
| GET | /v1/admin/messages/:id | Platform role; writes require admin |
| GET | /v1/admin/overview | Platform role; writes require admin |
| GET | /v1/admin/policies | Platform role; writes require admin |
| GET | /v1/admin/providers | Platform role; writes require admin |
| GET | /v1/admin/providers/catalog | Platform role; writes require admin |
| GET | /v1/admin/providers/configured | Platform role; writes require admin |
| GET | /v1/admin/providers/env-export | Platform role; writes require admin |
| GET | /v1/admin/quota | Platform role; writes require admin |
| GET | /v1/admin/reports/campaigns | Platform role; writes require admin |
| GET | /v1/admin/reports/campaigns/:campaignId | Platform role; writes require admin |
| GET | /v1/admin/reports/categories | Platform role; writes require admin |
| GET | /v1/admin/reports/export | Platform role; writes require admin |
| GET | /v1/admin/reports/overview | Platform role; writes require admin |
| GET | /v1/admin/reports/teams | Platform role; writes require admin |
| GET | /v1/admin/stream | Platform role; writes require admin |
| GET | /v1/admin/suppressions | Platform role; writes require admin |
| GET | /v1/admin/telemetry/live | Platform role; writes require admin |
| GET | /v1/auth/session | API credential; tenant/team/environment scope |
| GET | /v1/batches/ | API credential; tenant/team/environment scope |
| GET | /v1/batches/:batchId | API credential; tenant/team/environment scope |
| GET | /v1/dlq/ | API credential; tenant/team/environment scope |
| GET | /v1/messages/:messageId | API credential; tenant/team/environment scope |
| GET | /v1/messages/:messageId/timeline | API credential; tenant/team/environment scope |
| GET | /v1/messages/:messageId/trace | API credential; tenant/team/environment scope |
| GET | /v1/sandbox/messages | API credential; tenant/team/environment scope |
| GET | /v1/suppressions/ | API credential; tenant/team/environment scope |
| GET | /v1/t/:token | Tracking token |
| GET | /v1/templates/ | API credential; tenant/team/environment scope |
| GET | /v1/templates/:slug | API credential; tenant/team/environment scope |
| GET | /v1/templates/partials | API credential; tenant/team/environment scope |
| GET | /v1/webhook-subscriptions/ | API credential; tenant/team/environment scope |
| GET | /v1/webhooks/:provider | Provider-specific signature or verification token |
| GET | /v1/webhooks/:provider/inbound | Provider-specific signature or verification token |
| GET | /v1/webhooks/:provider/incoming | Provider-specific signature or verification token |
| GET | /v1/webhooks/:provider/status | Provider-specific signature or verification token |
| POST | /v1/admin/budgets/:team/holds/:id/reconcile | Platform role; writes require admin |
| POST | /v1/admin/composer/send-test | Platform role; writes require admin |
| POST | /v1/admin/dlq/replay | Platform role; writes require admin |
| POST | /v1/admin/providers/:providerId/canary | Platform role; writes require admin |
| POST | /v1/admin/providers/:providerId/circuit | Platform role; writes require admin |
| POST | /v1/admin/providers/register | Platform role; writes require admin |
| POST | /v1/admin/providers/seed-all | Platform role; writes require admin |
| POST | /v1/admin/providers/test-connection | Platform role; writes require admin |
| POST | /v1/admin/providers/test-proxy | Platform role; writes require admin |
| POST | /v1/admin/reports/doctor | Platform role; writes require admin |
| POST | /v1/admin/reports/reconcile | Platform role; writes require admin |
| POST | /v1/admin/suppressions | Platform role; writes require admin |
| POST | /v1/batches/ | API credential; tenant/team/environment scope |
| POST | /v1/batches/:batchId/cancel | API credential; tenant/team/environment scope |
| POST | /v1/batches/:batchId/pause | API credential; tenant/team/environment scope |
| POST | /v1/batches/:batchId/resume | API credential; tenant/team/environment scope |
| POST | /v1/dlq/replay | API credential; tenant/team/environment scope |
| POST | /v1/dlq/replay-mutated | API credential; tenant/team/environment scope |
| POST | /v1/messages/ | API credential; tenant/team/environment scope |
| POST | /v1/messages/bulk | API credential; tenant/team/environment scope |
| POST | /v1/messages/templates/preview | API credential; tenant/team/environment scope |
| POST | /v1/receipts | API credential; tenant/team/environment scope |
| POST | /v1/suppressions/ | API credential; tenant/team/environment scope |
| POST | /v1/suppressions/bulk | API credential; tenant/team/environment scope |
| POST | /v1/templates/ | API credential; tenant/team/environment scope |
| POST | /v1/templates/:slug/publish | API credential; tenant/team/environment scope |
| POST | /v1/templates/:slug/versions | API credential; tenant/team/environment scope |
| POST | /v1/templates/partials | API credential; tenant/team/environment scope |
| POST | /v1/templates/render | API credential; tenant/team/environment scope |
| POST | /v1/webhook-subscriptions/ | API credential; tenant/team/environment scope |
| POST | /v1/webhook-subscriptions/:id/test | API credential; tenant/team/environment scope |
| POST | /v1/webhooks/:provider | Provider-specific signature or verification token |
| POST | /v1/webhooks/:provider/inbound | Provider-specific signature or verification token |
| POST | /v1/webhooks/:provider/incoming | Provider-specific signature or verification token |
| POST | /v1/webhooks/:provider/status | Provider-specific signature or verification token |
| PUT | /v1/admin/budgets/:team | Platform role; writes require admin |
