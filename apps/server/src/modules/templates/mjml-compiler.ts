/**
 * Ultra-fast, zero-dependency MJML-to-HTML compilation engine.
 * Converts semantic MJML markup into bulletproof, responsive, client-safe HTML
 * with automatic CSS inlining, container centering, and media query support.
 */

export interface MjmlCompileOptions {
  title?: string;
  previewText?: string;
  defaultFontFamily?: string;
  backgroundColor?: string;
}

export const MjmlCompiler = {
  /**
   * Compiles MJML string into clean, responsive HTML.
   * If the input is standard HTML, wraps it in responsive email container.
   */
  compile(mjmlSource: string, options: MjmlCompileOptions = {}): string {
    if (!mjmlSource || typeof mjmlSource !== 'string') {
      return '';
    }

    const trimmed = mjmlSource.trim();

    // Fast-path: If already fully formed HTML document
    if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html')) {
      return trimmed;
    }

    const isMjml = trimmed.includes('<mjml>') || trimmed.includes('<mj-');
    if (!isMjml) {
      return this.wrapStandardEmail(trimmed, options);
    }

    // Parse attributes helper
    const parseAttrs = (tagStr: string): Record<string, string> => {
      const attrs: Record<string, string> = {};
      const regex = /([a-zA-Z0-9_-]+)=(?:'([^']*)'|"([^"]*)")/g;
      let match = regex.exec(tagStr);
      while (match !== null) {
        attrs[match[1]] = match[2] !== undefined ? match[2] : match[3];
        match = regex.exec(tagStr);
      }
      return attrs;
    };

    let innerHtml = trimmed;

    // Remove <mjml>, <mj-head>, <mj-body> wrapper tags, extract inner contents
    innerHtml = innerHtml
      .replace(/<mjml[^>]*>/gi, '')
      .replace(/<\/mjml>/gi, '')
      .replace(/<mj-head>[\s\S]*?<\/mj-head>/gi, '')
      .replace(/<mj-body[^>]*>/gi, '')
      .replace(/<\/mj-body>/gi, '');

    // 1. Transform <mj-button>
    innerHtml = innerHtml.replace(/<mj-button([^>]*)>([\s\S]*?)<\/mj-button>/gi, (_match, attrsStr, content) => {
      const attrs = parseAttrs(attrsStr);
      const href = attrs.href || '#';
      const bg = attrs['background-color'] || attrs.color || '#3b82f6';
      const textColor = attrs['text-color'] || '#ffffff';
      const borderRadius = attrs['border-radius'] || '6px';
      const padding = attrs.padding || '12px 24px';
      const align = attrs.align || 'center';

      return `<div style="text-align: ${align}; margin: 16px 0;">
          <a href="${href}" target="_blank" style="display: inline-block; background-color: ${bg}; color: ${textColor}; padding: ${padding}; border-radius: ${borderRadius}; text-decoration: none; font-weight: 600; font-size: 15px; mso-padding-alt: 0; text-underline-color: ${bg};">
            <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt">&nbsp;</i><![endif]-->
            <span style="mso-text-raise: 15pt;">${content.trim()}</span>
            <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%">&nbsp;</i><![endif]-->
          </a>
        </div>`;
    });

    // 2. Transform <mj-text>
    innerHtml = innerHtml.replace(/<mj-text([^>]*)>([\s\S]*?)<\/mj-text>/gi, (_match, attrsStr, content) => {
      const attrs = parseAttrs(attrsStr);
      const fontSize = attrs['font-size'] || '15px';
      const color = attrs.color || '#374151';
      const lineHeight = attrs['line-height'] || '1.6';
      const align = attrs.align || 'left';
      const padding = attrs.padding || '8px 0';

      return `<div style="font-size: ${fontSize}; color: ${color}; line-height: ${lineHeight}; text-align: ${align}; padding: ${padding};">
          ${content.trim()}
        </div>`;
    });

    // 3. Transform <mj-image>
    innerHtml = innerHtml.replace(/<mj-image([^*]*?)\/?>/gi, (_match, attrsStr) => {
      const attrs = parseAttrs(attrsStr);
      const src = attrs.src || '';
      const alt = attrs.alt || '';
      const width = attrs.width || '100%';
      const align = attrs.align || 'center';
      const href = attrs.href;

      const img = `<img src="${src}" alt="${alt}" style="display: block; max-width: 100%; width: ${width}; height: auto; border: 0; outline: none; text-decoration: none; margin: 0 auto;" />`;
      if (href) {
        return `<div style="text-align: ${align}; margin: 12px 0;"><a href="${href}" target="_blank">${img}</a></div>`;
      }
      return `<div style="text-align: ${align}; margin: 12px 0;">${img}</div>`;
    });

    // 4. Transform <mj-divider>
    innerHtml = innerHtml.replace(/<mj-divider([^*]*?)\/?>/gi, (_match, attrsStr) => {
      const attrs = parseAttrs(attrsStr);
      const borderColor = attrs['border-color'] || '#e5e7eb';
      const borderWidth = attrs['border-width'] || '1px';
      const padding = attrs.padding || '16px 0';

      return `<div style="padding: ${padding};"><hr style="border: 0; border-top: ${borderWidth} solid ${borderColor}; margin: 0;" /></div>`;
    });

    // 5. Transform <mj-column>
    innerHtml = innerHtml.replace(/<mj-column([^>]*)>([\s\S]*?)<\/mj-column>/gi, (_match, attrsStr, content) => {
      const attrs = parseAttrs(attrsStr);
      const width = attrs.width || '100%';
      return `<td class="email-column" style="width: ${width}; vertical-align: top; padding: 0 8px;">
          ${content.trim()}
        </td>`;
    });

    // 6. Transform <mj-section>
    innerHtml = innerHtml.replace(/<mj-section([^>]*)>([\s\S]*?)<\/mj-section>/gi, (_match, attrsStr, content) => {
      const attrs = parseAttrs(attrsStr);
      const bg = attrs['background-color'] || 'transparent';
      const padding = attrs.padding || '16px 0';

      return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bg};">
          <tr>
            <td align="center" style="padding: ${padding};">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                <tr>
                  ${content.trim()}
                </tr>
              </table>
            </td>
          </tr>
        </table>`;
    });

    return this.wrapStandardEmail(innerHtml, options);
  },

  /**
   * Wraps compiled content in a standards-compliant, responsive HTML email shell.
   */
  wrapStandardEmail(bodyHtml: string, options: MjmlCompileOptions = {}): string {
    const title = options.title || 'Notification';
    const preview = options.previewText
      ? `<div style="display: none; max-height: 0px; overflow: hidden;">${options.previewText}</div>`
      : '';
    const fontFamily =
      options.defaultFontFamily ||
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const bg = options.backgroundColor || '#f4f6f8';

    return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { font-family: ${fontFamily}; margin: 0; padding: 0; width: 100% !important; background-color: ${bg}; color: #1f2937; }
    .email-wrapper { width: 100%; background-color: ${bg}; padding: 24px 0; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .email-body { padding: 24px 32px; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .email-body { padding: 16px 20px !important; }
      .email-column { display: block !important; width: 100% !important; box-sizing: border-box; }
    }
    @media (prefers-color-scheme: dark) {
      body, .email-wrapper { background-color: #0f172a !important; color: #f1f5f9 !important; }
      .email-container { background-color: #1e293b !important; border: 1px solid #334155 !important; }
    }
  </style>
</head>
<body>
  ${preview}
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-body">
        ${bodyHtml}
      </div>
    </div>
  </div>
</body>
</html>`;
  },
};
