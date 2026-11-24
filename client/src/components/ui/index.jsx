import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Loader2, AlertTriangle, Inbox, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { initials } from '../../lib/format.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Spinner({ className = 'h-5 w-5' }) { return <Loader2 className={cx('animate-spin text-brand-600', className)} aria-label="Loading" />; }
export function PageLoader({ label = 'Loading' }) {
  return <div className="flex min-h-[40vh] items-center justify-center gap-3 text-ink-500" role="status"><Spinner />{label}…</div>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center" role="alert">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <h2 className="text-lg font-semibold">We couldn't load this</h2>
      <p className="text-ink-500">{error?.message || 'Something went wrong.'}</p>
      {onRetry && <button className="btn-outline" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="max-w-sm text-ink-500">{children}</p>}
      {action}
    </div>
  );
}

/** Gate for useApi results: shows loader / error, otherwise renders children(data). */
export function Async({ state, children }) {
  if (state.loading && !state.data) return <PageLoader />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  return state.data ? children(state.data) : null;
}

const badgeTone = { gray: 'bg-ink-100 text-ink-600', blue: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' };
export function Badge({ tone = 'gray', children }) { return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', badgeTone[tone])}>{children}</span>; }
export const statusTone = { published: 'green', paid: 'green', active: 'green', completed: 'blue', graded: 'green', processed: 'green', approved: 'green', draft: 'gray', pending: 'amber', submitted: 'amber', open: 'amber', abandoned: 'gray', archived: 'gray', failed: 'red', revoked: 'red', refunded: 'red', rejected: 'red', returned: 'amber', closed: 'gray' };
export const StatusBadge = ({ status }) => <Badge tone={statusTone[status] || 'gray'}>{status}</Badge>;

export function Progress({ value = 0, className }) {
  const v = Math.max(0, Math.min(100, Math.round(+value)));
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-ink-100', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({ src, name, size = 36 }) {
  return src
    ? <img src={src} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} referrerPolicy="no-referrer" />
    : <span className="grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-800" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>{initials(name)}</span>;
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div>
      {label && <label htmlFor={htmlFor} className="label">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={cx('relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-2xl sm:p-6', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm -mr-2 -mt-1 px-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger, busy }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-ink-600">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-ink-500" aria-label="Pagination">
      <span>Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" />Previous</button>
        <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold sm:text-[28px]">{title}</h1>{subtitle && <p className="mt-1 text-ink-500">{subtitle}</p>}</div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-ink-500"><span className="text-[13px]">{label}</span>{Icon && <Icon className="h-4 w-4" />}</div>
      <p className="mt-2 font-display text-3xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

/** Renders rich text safely. Content is sanitised on the server AND here. */
export function RichText({ html, className }) {
  return <div className={cx('rich', className)} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] }) }} />;
}

export function Logo({ dark, className = 'h-8' }) {
  return <img src={dark ? '/logo-dark.svg' : '/logo.svg'} alt="Techsters Academy" className={className} />;
}

export function CourseThumb({ src, title, className }) {
  return src
    ? <img src={src} alt="" loading="lazy" className={cx('object-cover', className)} />
    : <div className={cx('grid place-items-center bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-center font-display text-lg font-semibold text-white', className)}>{title}</div>;
}

export function CourseCard({ c, formatPrice }) {
  return (
    <Link to={`/courses/${c.slug}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
      <CourseThumb src={c.thumbnail_url} title={c.title} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          {c.course_categories?.name && <span>{c.course_categories.name}</span>}
          <span className="capitalize">{c.level}</span>
        </div>
        <h3 className="text-[17px] font-semibold leading-snug group-hover:text-brand-700">{c.title}</h3>
        {c.subtitle && <p className="line-clamp-2 text-sm text-ink-500">{c.subtitle}</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-semibold text-ink-900">{formatPrice(c)}</span>
          {c.rating?.count > 0 && <span className="text-sm text-ink-500">★ {c.rating.avg} ({c.rating.count})</span>}
        </div>
      </div>
    </Link>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-200" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium', value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800')}>{t.label}</button>
      ))}
    </div>
  );
}
