/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

const CODE_PATTERN = /^(\d{6})$/m;

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractCode(body: string): string | null {
	const match = CODE_PATTERN.exec(body);
	return match ? match[1] : null;
}

function renderBodyHtml(body: string, code: string | null): string {
	if (!code) {
		return body
			.split('\n\n')
			.map((paragraph) => {
				const escaped = escapeHtml(paragraph.trim());
				const withBreaks = escaped.replace(/\n/g, '<br>');
				return `<p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">${withBreaks}</p>`;
			})
			.filter((p) => p !== '<p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;"></p>')
			.join('\n              ');
	}

	const parts = body.split(code);
	const before = parts[0].trim();
	const after = parts.slice(1).join(code).trim();

	const beforeHtml = before
		.split('\n\n')
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => {
			const escaped = escapeHtml(p);
			const withBreaks = escaped.replace(/\n/g, '<br>');
			return `<p style="margin:0 0 6px;font-size:14px;color:#71717a;text-align:center;">${withBreaks}</p>`;
		})
		.join('\n              ');

	const codeHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto;">
                <tr>
                  <td style="background-color:#f4f4f5;border:2px solid #e4e4e7;border-radius:12px;padding:20px 36px;">
                    <span style="font-size:36px;font-weight:700;letter-spacing:10px;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;color:#18181b;">${code}</span>
                  </td>
                </tr>
              </table>`;

	const afterHtml = after
		.split('\n\n')
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => {
			const escaped = escapeHtml(p);
			const withBreaks = escaped.replace(/\n/g, '<br>');
			return `<p style="margin:0 0 12px;font-size:13px;color:#a1a1aa;text-align:center;">${withBreaks}</p>`;
		})
		.join('\n              ');

	return [beforeHtml, codeHtml, afterHtml].filter(Boolean).join('\n              ');
}

export function renderEmailHtml(subject: string, body: string): string {
	const code = extractCode(body);
	const preheader = code ? `Введите код в приложении` : subject;
	const bodyHtml = renderBodyHtml(body, code);

	return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;">
          <tr>
            <td style="background-color:#140F16;padding:28px 40px;text-align:center;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;">Флудилка</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">floodilka.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
