# ADR-005: WhatsApp 24-Hour Session Window & Template-to-Text Cost Optimization

- **Status**: Approved
- **Date**: 2026-08-13
- **Authors**: Convey Engineering Team

## Context

WhatsApp Business Platform charges conversation fees based on conversation categories:
1. Business-initiated conversations started with a pre-approved template message (`type: "template"`) incur template conversation fees.
2. Customer-initiated inbound messages open a 24-hour customer service window where free-form text messages (`type: "text"`) incur zero template fees (or lower session rates).

Many applications trigger notification dispatches using template IDs even when the recipient recently messaged the WhatsApp Business account. Sending a template message inside an active 24-hour window incurs unnecessary template charges.

## Decision

We implement a provider-configurable **WhatsApp Session Optimization Subsystem** in Convey:
1. **Inbound Window Tracking**: Hook into incoming WhatsApp webhooks across Meta, Twilio, and Cequens to track active 24-hour session windows in Redis (`wa:session:<providerId>:<normalized_phone>`) using an atomic Lua script (`RECORD_INBOUND_LUA_SCRIPT`) and sub-millisecond L1 in-memory caching.
2. **Pre-Compiled AST Template Engine**: Parse template bodies into pre-compiled AST tokens (`compileTemplateToAST`) with dot-path variable resolution and sub-microsecond L1 caching.
3. **Outbound Interceptor**: Prior to sending a WhatsApp message in `provider-send.worker.ts`, check if `sessionOptimization.enabled` is `true` and the recipient has an active 24-hour session window. If so, render the template locally into plain text and strip `templateId`, causing provider transformers to deliver plain-text session messages at zero template cost.
4. **Fail-Safe Fallback**: If the 24-hour window has expired or the template body text cannot be resolved, fall back seamlessly to standard WhatsApp template delivery.

## Consequences

- **Cost Reduction**: Substantially reduces WhatsApp delivery expenditure by converting template messages inside active customer windows into free-form text messages.
- **High Throughput**: Micro L1 memory caching (0.01ms) and Redis pipeline batching prevent performance degradation under massive dispatch volumes.
- **Zero Breaking Changes**: Existing public APIs, database schemas, and message dispatch workers remain 100% backward compatible.
