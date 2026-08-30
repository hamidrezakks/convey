export interface LogBoxParams {
  providerId: string;
  method: string;
  url: string;
  status: number;
  latencyMs: number;
  auth?: string;
  recipient?: string;
  from?: string;
  subject?: string;
  messageId?: string;
  payloadSummary?: string;
  error?: string;
  action?: string;
}

const HTTP_STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

class MockLogger {
  private formatHeader(title: string, width = 84): string {
    const fill = '─'.repeat(Math.max(2, width - title.length - 4));
    return `┌── ${title} ${fill}┐`;
  }

  private stripAnsi(text: string): string {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Strip ANSI escape codes safely
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private formatLine(content: string, width = 84): string {
    const cleanContent = this.stripAnsi(content);
    const padding = ' '.repeat(Math.max(0, width - cleanContent.length - 4));
    return `│ ${content}${padding} │`;
  }

  private formatFooter(width = 84): string {
    return `└${'─'.repeat(width - 2)}┘`;
  }

  formatRequestBox(params: LogBoxParams, width = 84): string {
    const isSuccess = params.status >= 200 && params.status < 300;
    const badge = isSuccess ? '📥' : '❌';
    const statusText = HTTP_STATUS_TEXT[params.status] || '';
    const statusStr = statusText ? `${params.status} ${statusText}` : `${params.status}`;
    const tag = `[MOCK-${params.providerId.toUpperCase()}] ${badge} ${params.method} ${params.url} (${statusStr} - ${params.latencyMs.toFixed(1)}ms)`;

    const lines: string[] = [this.formatHeader(tag, width)];

    lines.push(this.formatLine(`Timestamp:  ${new Date().toISOString()}`, width));

    if (params.auth) {
      lines.push(this.formatLine(`Auth:       ${params.auth}`, width));
    }
    if (params.recipient) {
      lines.push(this.formatLine(`Recipient:  ${params.recipient}`, width));
    }
    if (params.from) {
      lines.push(this.formatLine(`From:       ${params.from}`, width));
    }
    if (params.subject) {
      lines.push(this.formatLine(`Subject:    ${params.subject}`, width));
    }
    if (params.messageId) {
      lines.push(this.formatLine(`MessageId:  ${params.messageId}`, width));
    }
    if (params.payloadSummary) {
      lines.push(this.formatLine(`Payload:    ${params.payloadSummary}`, width));
    }
    if (params.error) {
      lines.push(this.formatLine(`Error:      ${params.error}`, width));
    }
    if (params.action) {
      lines.push(this.formatLine(`Action:     ${params.action}`, width));
    }

    lines.push(this.formatFooter(width));
    return lines.join('\n');
  }

  logRequest(params: LogBoxParams): void {
    console.log(this.formatRequestBox(params));
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    console.log(`[MOCK-INFO] ${msg}`, meta ? JSON.stringify(meta) : '');
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    console.error(`[MOCK-ERROR] ${msg}`, meta ? JSON.stringify(meta) : '');
  }
}

export const mockLogger = new MockLogger();
