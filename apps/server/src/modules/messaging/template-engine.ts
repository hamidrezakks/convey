import type { Recipients, TemplateSpec } from './messaging.types';

export interface RenderedTemplate {
  subject?: string;
  body?: string;
  html?: string;
  text?: string;
}

/**
 * Resolves nested property path from context object (e.g. "user.profile.name").
 */
function resolveValue(path: string, context: Record<string, unknown>): unknown {
  const parts = path.trim().split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Applies formatters/filters to a value (e.g. "amount | currency: 'USD'").
 */
function applyFilters(value: unknown, filterChain: string[]): string {
  let result = value !== undefined && value !== null ? String(value) : '';

  for (const filterExpression of filterChain) {
    const trimmed = filterExpression.trim();
    const [filterName, ...argParts] = trimmed.split(':');
    const name = filterName.trim().toLowerCase();
    const rawArg = argParts
      .join(':')
      .trim()
      .replace(/^['"]|['"]$/g, '');

    switch (name) {
      case 'default':
        if (!result || result.trim().length === 0) {
          result = rawArg;
        }
        break;
      case 'uppercase':
      case 'upper':
        result = result.toUpperCase();
        break;
      case 'lowercase':
      case 'lower':
        result = result.toLowerCase();
        break;
      case 'trim':
        result = result.trim();
        break;
      case 'currency': {
        const num = Number.parseFloat(result);
        if (!Number.isNaN(num)) {
          const symbol = rawArg === 'EUR' ? '€' : rawArg === 'GBP' ? '£' : '$';
          result = `${symbol}${num.toFixed(2)}`;
        }
        break;
      }
      case 'date':
        try {
          const d = new Date(result);
          if (!Number.isNaN(d.getTime())) {
            result = d.toISOString().split('T')[0];
          }
        } catch {
          // Keep original result
        }
        break;
    }
  }

  return result;
}

const IF_REGEX = /{%\s*if\s+([^%]+)\s*%}([\s\S]*?)(?:{%\s*else\s*%}([\s\S]*?))?{%\s*endif\s*%}/g;
const VAR_REGEX = /{{\s*([^}]+)\s*}}/g;

export const TemplateEngine = {
  /**
   * Compiles template string by evaluating conditionals ({% if ... %}) and variables ({{ ... }}).
   */
  compile(templateStr: string, context: Record<string, unknown>): string {
    if (!templateStr || typeof templateStr !== 'string') {
      return '';
    }

    // Fast-path: Return immediately if template contains no dynamic tags
    if (!templateStr.includes('{%') && !templateStr.includes('{{')) {
      return templateStr;
    }

    // 1. Process conditionals: {% if condition %}...{% else %}...{% endif %}
    let processed = templateStr;
    if (processed.includes('{%')) {
      processed = processed.replace(IF_REGEX, (_match, conditionPath, ifBlock, elseBlock = '') => {
        const val = resolveValue(conditionPath, context);
        const isTruthy = val !== undefined && val !== null && val !== false && val !== 0 && val !== '';
        return isTruthy ? ifBlock : elseBlock;
      });
    }

    // 2. Process variable tags: {{ path | filter1 | filter2 }}
    if (processed.includes('{{')) {
      processed = processed.replace(VAR_REGEX, (_match, expression) => {
        const [varPath, ...filterParts] = expression.split('|');
        const rawVal = resolveValue(varPath, context);
        return applyFilters(rawVal, filterParts);
      });
    }

    return processed;
  },

  /**
   * Generates a fully responsive HTML email wrapper with automatic CSS inlining.
   */
  wrapHtmlEmail(bodyHtml: string, title?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title || 'Notification'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f8; color: #1a1a1a; }
    .email-container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .email-content { padding: 32px; font-size: 16px; line-height: 1.5; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #121212; color: #e0e0e0; }
      .email-container { background: #1e1e1e; border: 1px solid #333333; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-content">
      ${bodyHtml}
    </div>
  </div>
</body>
</html>`;
  },

  /**
   * Renders a TemplateSpec with variables and recipient information.
   */
  render(template: TemplateSpec, variables: Record<string, unknown> = {}, recipient?: Recipients): RenderedTemplate {
    const combinedContext: Record<string, unknown> = {
      ...variables,
      recipient: recipient || {},
    };

    const renderedSubject = template.subject ? TemplateEngine.compile(template.subject, combinedContext) : undefined;
    const renderedBody = template.body ? TemplateEngine.compile(template.body, combinedContext) : undefined;
    const renderedText = template.text ? TemplateEngine.compile(template.text, combinedContext) : renderedBody;

    let renderedHtml = template.html ? TemplateEngine.compile(template.html, combinedContext) : undefined;
    if (renderedHtml && !renderedHtml.includes('<!DOCTYPE html>')) {
      renderedHtml = TemplateEngine.wrapHtmlEmail(renderedHtml, renderedSubject);
    }

    return {
      subject: renderedSubject,
      body: renderedBody,
      text: renderedText,
      html: renderedHtml,
    };
  },
};
