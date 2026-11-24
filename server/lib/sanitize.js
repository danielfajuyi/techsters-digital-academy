/** Minimal server-side HTML sanitiser for rich-text fields (allow-list). The client also sanitises with DOMPurify on render. */
const ALLOWED = new Set(['p','br','strong','em','b','i','u','ul','ol','li','h2','h3','h4','blockquote','code','pre','a','hr']);
export function sanitizeHtml(input = '') {
  return String(input)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag, attrs) => {
      const t = tag.toLowerCase();
      if (!ALLOWED.has(t)) return '';
      if (m.startsWith('</')) return `</${t}>`;
      if (t === 'a') {
        const href = /href\s*=\s*"(https?:\/\/[^"]*)"/i.exec(attrs)?.[1];
        return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">` : '<a>';
      }
      return `<${t}>`;
    });
}
