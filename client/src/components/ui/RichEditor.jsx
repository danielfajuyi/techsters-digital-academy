import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link2, Eraser } from 'lucide-react';

// Keep in sync with server/lib/sanitize.js
const CLEAN = { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'a', 'hr'], ALLOWED_ATTR: ['href', 'target', 'rel'] };
const clean = (h) => DOMPurify.sanitize(h || '', CLEAN);

/** Lightweight WYSIWYG (no dependency). Output is sanitised here and again on the server. */
export function RichEditor({ value, onChange, placeholder = 'Start writing…', label = 'Rich text editor' }) {
  const ref = useRef(null);
  const last = useRef(null);

  useEffect(() => { // sync external changes (e.g. data loaded after mount) without clobbering the caret while typing
    if (ref.current && value !== last.current) { ref.current.innerHTML = clean(value); last.current = value ?? ''; }
  }, [value]);

  const emit = () => { const html = clean(ref.current.innerHTML); last.current = html; onChange(html); };
  const prep = () => { ref.current.focus(); try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch { /* ignore */ } };
  const run = (cmd, arg) => (e) => { e.preventDefault(); prep(); document.execCommand(cmd, false, arg); emit(); };
  const link = (e) => {
    e.preventDefault(); prep();
    const url = window.prompt('Link address (https://…)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return window.alert('Links must start with http:// or https://');
    document.execCommand('createLink', false, url); emit();
  };
  const tools = [[Bold, 'Bold', run('bold')], [Italic, 'Italic', run('italic')], [Heading2, 'Heading', run('formatBlock', 'h2')], [Heading3, 'Subheading', run('formatBlock', 'h3')],
    [List, 'Bulleted list', run('insertUnorderedList')], [ListOrdered, 'Numbered list', run('insertOrderedList')], [Quote, 'Quote', run('formatBlock', 'blockquote')], [Link2, 'Link', link], [Eraser, 'Clear formatting', run('removeFormat')]];

  return (
    <div>
      <div className="flex flex-wrap gap-0.5 rounded-t-lg bg-ink-100 p-1" role="toolbar" aria-label="Formatting">
        {tools.map(([Icon, name, fn]) => <button key={name} type="button" onMouseDown={fn} aria-label={name} title={name} className="rounded-md p-1.5 text-ink-600 hover:bg-surface hover:text-ink-900"><Icon className="h-4 w-4" /></button>)}
      </div>
      <div ref={ref} className="editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} data-placeholder={placeholder}
        onInput={emit} onBlur={emit}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }} />
    </div>
  );
}
