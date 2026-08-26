/**
 * RFC-8058 Compliant One-Click Unsubscribe and List-Unsubscribe Header Utilities.
 */
export const Rfc8058 = {
  /**
   * Generates standard email headers for RFC-8058 List-Unsubscribe compliance.
   */
  generateHeaders(baseUrl: string, token: string, unsubEmailDomain = 'unsub.convey.dev'): Record<string, string> {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const webUnsubUrl = `${cleanBase}/api/v1/plugins/preferences/unsubscribe?token=${token}`;
    const mailtoUrl = `mailto:unsub+${token}@${unsubEmailDomain}`;

    return {
      'List-Unsubscribe': `<${webUnsubUrl}>, <${mailtoUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  },

  /**
   * Generates an opaque, URL-safe unsubscribe token.
   */
  generateToken(): string {
    return `unsub_${Bun.randomUUIDv7()}`;
  },
};
