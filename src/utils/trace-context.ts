export interface TraceContextData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

export const TraceContext = {
  generateTraceId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('hex');
  },

  generateSpanId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('hex');
  },

  create(traceId?: string, parentSpanId?: string, sampled = true): TraceContextData {
    return {
      traceId: traceId || TraceContext.generateTraceId(),
      spanId: TraceContext.generateSpanId(),
      parentSpanId,
      sampled,
    };
  },

  createChild(parentCtx: TraceContextData): TraceContextData {
    return {
      traceId: parentCtx.traceId,
      spanId: TraceContext.generateSpanId(),
      parentSpanId: parentCtx.spanId,
      sampled: parentCtx.sampled,
    };
  },

  formatHeader(ctx: TraceContextData): string {
    const flags = ctx.sampled ? '01' : '00';
    return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
  },

  parseHeader(traceparentHeader?: string | null): TraceContextData | null {
    if (!traceparentHeader) return null;
    const parts = traceparentHeader.trim().split('-');
    if (parts.length < 4 || parts[0] !== '00') return null;

    const traceId = parts[1];
    const spanId = parts[2];
    const flags = parts[3];

    if (traceId.length !== 32 || spanId.length !== 16) return null;

    return {
      traceId,
      spanId,
      sampled: flags === '01',
    };
  },

  extractOrCreate(headers?: Record<string, string | string[] | undefined>): TraceContextData {
    const headerVal =
      headers?.traceparent || headers?.['w3c-traceparent'] || headers?.X_TRACEPARENT || headers?.['x-traceparent'];
    const rawStr = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    const parsed = TraceContext.parseHeader(rawStr);
    return parsed || TraceContext.create();
  },

  injectHeaders(ctx: TraceContextData, targetHeaders: Record<string, string> = {}): Record<string, string> {
    targetHeaders.traceparent = TraceContext.formatHeader(ctx);
    targetHeaders['x-trace-id'] = ctx.traceId;
    targetHeaders['x-span-id'] = ctx.spanId;
    return targetHeaders;
  },

  injectOutboxMetadata(ctx: TraceContextData, metadata: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      ...metadata,
      traceContext: {
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        parentSpanId: ctx.parentSpanId,
        sampled: ctx.sampled,
        traceparent: TraceContext.formatHeader(ctx),
      },
    };
  },
};
