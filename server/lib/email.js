/** Optional transactional email via Resend. No-ops (never throws) if RESEND_API_KEY is unset. */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendEmail({ to, subject, heading, body, cta }) {
  if (!process.env.RESEND_API_KEY) return false;
  const url = process.env.APP_URL || '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0E0E0E">
    <h2 style="margin:0 0 12px">${esc(heading)}</h2><p style="line-height:1.6;color:#4A4E59">${esc(body)}</p>
    ${cta ? `<p><a href="${esc(url + cta.path)}" style="background:#0260FF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${esc(cta.label)}</a></p>` : ''}
    <p style="color:#9498A6;font-size:12px">Techsters Academy</p></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html }),
    });
    return r.ok;
  } catch { return false; }
}
