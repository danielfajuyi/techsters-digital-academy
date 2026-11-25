import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Users as UsersIcon, GraduationCap, BookOpen, Wallet, ListChecks, Plus, Trash2, Download, ArrowLeft, Pencil } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api, download, qs } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { RichEditor } from '../../components/ui/RichEditor.jsx';
import { Async, Avatar, Badge, Confirm, EmptyState, Field, Modal, PageHeader, Pagination, Spinner, Stat, StatusBadge, Tabs } from '../../components/ui/index.jsx';
import { date, dateTime, moneyAlways, fromMinor, toMinor } from '../../lib/format.js';

/* ───────── Overview ───────── */
function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count)); const w = 100 / data.length;
  return (
    <svg viewBox="0 0 100 40" className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Enrolments per day for the last 30 days">
      {data.map((d, i) => { const h = (d.count / max) * 36; return <rect key={d.date} x={i * w + 0.4} y={38 - h} width={w - 0.8} height={Math.max(h, d.count ? 0.8 : 0.3)} rx="0.4" className={d.count ? 'fill-brand-600' : 'fill-ink-200'}><title>{`${d.date}: ${d.count}`}</title></rect>; })}
    </svg>
  );
}
export function Overview() {
  const s = useApi('/admin/overview');
  return (<><PageHeader title="Administration" subtitle="Live figures from your database." />
    <Async state={s}>{(d) => (
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5"><Stat icon={UsersIcon} label="Students" value={d.totals.students} /><Stat icon={GraduationCap} label="Instructors" value={d.totals.instructors} /><Stat icon={BookOpen} label="Published courses" value={d.totals.courses} /><Stat icon={ListChecks} label="Enrolments" value={d.totals.enrollments} />
          <div className="col-span-2 lg:col-span-1"><Stat icon={Wallet} label="Revenue" value={moneyAlways(d.totals.revenue_minor)} hint={`${moneyAlways(d.totals.revenue_30d_minor)} in 30 days`} /></div></div>
        <section className="card p-5"><h2 className="mb-3 font-semibold">Enrolments, last 30 days</h2><Bars data={d.enrollments_by_day} /></section>
        <div className="grid gap-6 lg:grid-cols-2">
          <section><h2 className="mb-3 text-lg font-semibold">Top courses</h2>{d.top_courses.length ? <ul className="card divide-y divide-ink-100">{d.top_courses.map((c) => <li key={c.title} className="flex justify-between p-3 text-sm"><span>{c.title}</span><span className="font-medium">{c.enrollments}</span></li>)}</ul> : <p className="text-sm text-ink-500">No enrolments yet.</p>}</section>
          <section><h2 className="mb-3 text-lg font-semibold">Recent registrations</h2><ul className="card divide-y divide-ink-100">{d.recent_registrations.map((u) => <li key={u.id}><Link to={`/admin/users/${u.id}`} className="flex items-center justify-between p-3 text-sm hover:bg-ink-50"><span><span className="block font-medium text-ink-900">{u.full_name}</span><span className="text-xs text-ink-500">{u.email}</span></span><span className="text-xs text-ink-400">{date(u.created_at)}</span></Link></li>)}</ul></section>
        </div>
        <section><h2 className="mb-3 text-lg font-semibold">Recent transactions</h2>{d.recent_transactions.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{d.recent_transactions.map((o) => <tr key={o.id}><td>{o.profiles?.full_name}</td><td>{o.courses?.title}</td><td>{moneyAlways(o.amount_minor, o.currency)}</td><td><StatusBadge status={o.status} /></td><td>{date(o.created_at)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-ink-500">No transactions yet.</p>}</section>
      </div>)}</Async></>);
}

/* ───────── Users ───────── */
export function Users() {
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [page, setPage] = useState(1); const s = useApi(`/admin/users${qs({ search: q, role, page })}`);
  return (<><PageHeader title="Users" />
    <div className="mb-4 flex flex-wrap gap-3"><input className="input max-w-xs" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" /><select className="input w-auto" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role"><option value="">All roles</option><option value="student">Students</option><option value="instructor">Instructors</option><option value="admin">Admins</option></select></div>
    <Async state={s}>{(d) => (<><div className="table-wrap"><table><thead><tr><th>User</th><th>Roles</th><th>Status</th><th>Joined</th></tr></thead><tbody>{d.items.map((u) => <tr key={u.id}><td><Link to={`/admin/users/${u.id}`} className="flex items-center gap-3"><Avatar src={u.avatar_url} name={u.full_name} size={32} /><span><span className="block font-medium text-ink-900">{u.full_name}</span><span className="text-xs text-ink-500">{u.email}</span></span></Link></td><td className="space-x-1">{u.roles.map((r) => <Badge key={r} tone={r === 'admin' ? 'red' : r === 'instructor' ? 'blue' : 'gray'}>{r}</Badge>)}</td><td>{u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</td><td>{date(u.created_at)}</td></tr>)}</tbody></table></div><Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} /></>)}</Async></>);
}

export function UserDetail() {
  const { id } = useParams(); const { user: me } = useAuth(); const s = useApi(`/admin/users/${id}`); const toast = useToast(); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(null);
  const patch = async (body) => { setBusy(true); try { await api(`/admin/users/${id}`, { method: 'PATCH', body }); toast('Saved'); s.reload(); } catch (x) { toast(x.message, 'error'); } setBusy(false); setConfirm(null); };
  const setRoles = async (roles) => { try { await api(`/admin/users/${id}/roles`, { method: 'PUT', body: { roles } }); toast('Roles updated'); s.reload(); } catch (x) { toast(x.message, 'error'); } };
  const revoke = async (e) => { try { await api(`/admin/enrollments/${e.id}`, { method: 'DELETE' }); toast('Enrolment revoked'); s.reload(); } catch (x) { toast(x.message, 'error'); } };
  return (<>
    <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500"><ArrowLeft className="h-4 w-4" />Users</Link>
    <Async state={s}>{({ profile: p, enrollments, orders }) => (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><Avatar src={p.avatar_url} name={p.full_name} size={64} /><div><h1 className="text-2xl font-semibold">{p.full_name}</h1><p className="text-ink-500">{p.email}</p><p className="mt-1 text-xs text-ink-400">Joined {date(p.created_at)}</p></div></div>
          {p.id !== me.id && <button className={p.is_active ? 'btn-danger btn-sm' : 'btn-primary btn-sm'} onClick={() => setConfirm(p.is_active ? 'deactivate' : 'activate')}>{p.is_active ? 'Deactivate account' : 'Reactivate account'}</button>}</div>
        <section className="card p-5"><h2 className="font-semibold">Roles</h2><div className="mt-3 flex flex-wrap gap-4">{['instructor', 'admin'].map((r) => <label key={r} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={p.roles.includes(r)} disabled={r === 'admin' && p.id === me.id} onChange={(e) => setRoles(e.target.checked ? [...p.roles, r] : p.roles.filter((x) => x !== r))} />{r}</label>)}</div><p className="mt-2 text-xs text-ink-400">Everyone is a student. Role changes are recorded in the audit log.</p></section>
        <section><h2 className="mb-3 text-lg font-semibold">Enrolments</h2>{enrollments.length ? <div className="table-wrap"><table><thead><tr><th>Course</th><th>Source</th><th>Status</th><th>Enrolled</th><th /></tr></thead><tbody>{enrollments.map((e) => <tr key={e.id}><td>{e.courses?.title}</td><td className="capitalize">{e.source}</td><td><StatusBadge status={e.status} /></td><td>{date(e.enrolled_at)}</td><td className="text-right">{e.status !== 'revoked' && <button className="btn-outline btn-sm" onClick={() => revoke(e)}>Revoke</button>}</td></tr>)}</tbody></table></div> : <p className="text-sm text-ink-500">Not enrolled in any course.</p>}</section>
        <section><h2 className="mb-3 text-lg font-semibold">Orders</h2>{orders.length ? <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Course</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.map((o) => <tr key={o.id}><td>{o.reference}</td><td>{o.courses?.title}</td><td>{moneyAlways(o.amount_minor, o.currency)}</td><td><StatusBadge status={o.status} /></td><td>{date(o.created_at)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-ink-500">No orders.</p>}</section>
        <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger={confirm === 'deactivate'} busy={busy} title={confirm === 'deactivate' ? 'Deactivate account?' : 'Reactivate account?'} confirmLabel={confirm === 'deactivate' ? 'Deactivate' : 'Reactivate'} onConfirm={() => patch({ is_active: confirm === 'activate' })}>{confirm === 'deactivate' ? 'They will be signed out and unable to use the platform until reactivated.' : 'They will regain access.'}</Confirm>
      </div>)}</Async></>);
}

/* ───────── Enrolments ───────── */
export function Enrollments() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const s = useApi(`/admin/enrollments${qs({ page, status })}`); const courses = useApi('/staff/courses'); const toast = useToast();
  const [open, setOpen] = useState(false); const [f, setF] = useState({ email: '', courseId: '' }); const [busy, setBusy] = useState(false); const [rev, setRev] = useState(null);
  const add = async (e) => { e.preventDefault(); setBusy(true); try { await api('/admin/enrollments', { method: 'POST', body: f }); toast('Student enrolled'); setOpen(false); setF({ email: '', courseId: '' }); s.reload(); } catch (x) { toast(x.message, 'error'); } setBusy(false); };
  const revoke = async () => { try { await api(`/admin/enrollments/${rev.id}`, { method: 'DELETE' }); toast('Enrolment revoked'); s.reload(); } catch (x) { toast(x.message, 'error'); } setRev(null); };
  return (<><PageHeader title="Enrolments" action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Enroll a student</button>} />
    <select className="input mb-4 w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status"><option value="">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="revoked">Revoked</option></select>
    <Async state={s}>{(d) => (<><div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Source</th><th>Status</th><th>Enrolled</th><th /></tr></thead><tbody>{d.items.map((e) => <tr key={e.id}><td><p className="font-medium text-ink-900">{e.profiles?.full_name}</p><p className="text-xs text-ink-500">{e.profiles?.email}</p></td><td>{e.courses?.title}</td><td className="capitalize">{e.source}</td><td><StatusBadge status={e.status} /></td><td>{date(e.enrolled_at)}</td><td className="text-right">{e.status !== 'revoked' && <button className="btn-outline btn-sm" onClick={() => setRev(e)}>Revoke</button>}</td></tr>)}</tbody></table></div><Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} /></>)}</Async>
    <Modal open={open} onClose={() => setOpen(false)} title="Enroll a student"><form onSubmit={add} className="space-y-4"><Field label="Student email" htmlFor="se" hint="They must already have an account"><input id="se" type="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field><Field label="Course" htmlFor="sc"><select id="sc" required className="input" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">Choose a course</option>{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field><button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-current" />}Enroll</button></form></Modal>
    <Confirm open={!!rev} danger onClose={() => setRev(null)} onConfirm={revoke} title="Revoke enrolment?" confirmLabel="Revoke">{rev?.profiles?.full_name} will lose access to {rev?.courses?.title}. Their progress is kept.</Confirm></>);
}

/* ───────── Payments ───────── */
export function Payments() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const s = useApi(`/admin/orders${qs({ page, status })}`); const toast = useToast(); const [ref, setRef] = useState(null); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const refund = async () => { setBusy(true); try { await api(`/admin/orders/${ref.id}/refund`, { method: 'POST', body: { reason } }); toast('Refund processed'); s.reload(); setRef(null); } catch (x) { toast(x.message, 'error'); } setBusy(false); };
  return (<><PageHeader title="Payments" action={<button className="btn-outline" onClick={() => download(`/admin/orders/export${qs({ status })}`, 'orders.csv').catch((x) => toast(x.message, 'error'))}><Download className="h-4 w-4" />Export CSV</button>} />
    <select className="input mb-4 w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status"><option value="">All statuses</option>{['paid', 'pending', 'failed', 'abandoned', 'refunded'].map((x) => <option key={x}>{x}</option>)}</select>
    <Async state={s}>{(d) => (<><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Student</th><th>Course</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{d.items.map((o) => <tr key={o.id}><td className="text-xs text-ink-500">{o.reference}</td><td><p className="font-medium text-ink-900">{o.profiles?.full_name}</p><p className="text-xs text-ink-500">{o.profiles?.email}</p></td><td>{o.courses?.title}</td><td>{moneyAlways(o.amount_minor, o.currency)}{o.discount_minor > 0 && <p className="text-xs text-ink-400">−{moneyAlways(o.discount_minor)} off</p>}</td><td><StatusBadge status={o.status} /></td><td>{dateTime(o.created_at)}</td><td className="text-right">{o.status === 'paid' && o.amount_minor > 0 && <button className="btn-outline btn-sm" onClick={() => setRef(o)}>Refund</button>}</td></tr>)}</tbody></table></div><Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} /></>)}</Async>
    <Confirm open={!!ref} danger busy={busy} onClose={() => setRef(null)} onConfirm={refund} title="Refund this payment?" confirmLabel="Refund in full">{ref && <><p>{moneyAlways(ref.amount_minor, ref.currency)} will be returned to {ref.profiles?.full_name} through Paystack and their access to {ref.courses?.title} will be revoked.</p><input className="input mt-3" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" /></>}</Confirm></>);
}

/* ───────── Site content (testimonials, FAQs, categories, coupons, blog) ───────── */
const SCHEMAS = {
  testimonials: { label: 'Testimonials', cols: ['name', 'role', 'is_published'], fields: [['name', 'Name', 'text', true], ['role', 'Role', 'text'], ['quote', 'Quote', 'textarea', true], ['is_published', 'Published', 'check']] },
  faqs: { label: 'FAQs', cols: ['question', 'is_published'], fields: [['question', 'Question', 'text', true], ['answer', 'Answer', 'textarea', true], ['position', 'Order', 'number'], ['is_published', 'Published', 'check']] },
  categories: { label: 'Categories', cols: ['name', 'slug'], fields: [['name', 'Name', 'text', true], ['description', 'Description', 'text'], ['position', 'Order', 'number']] },
  coupons: { label: 'Discount codes', cols: ['code', 'percent_off', 'amount_off_minor', 'redeemed_count', 'is_active'], fields: [['code', 'Code', 'text', true], ['percent_off', 'Percent off (1–100)', 'number'], ['amount_off_minor', 'OR amount off (₦)', 'money'], ['max_redemptions', 'Max uses', 'number'], ['valid_until', 'Expires', 'datetime'], ['is_active', 'Active', 'check']] },
  blog: { label: 'Articles', cols: ['title', 'is_published'], fields: [['title', 'Title', 'text', true], ['excerpt', 'Excerpt', 'text'], ['body_html', 'Body', 'rich'], ['is_published', 'Published', 'check']] },
};
function ContentManager({ name }) {
  const sc = SCHEMAS[name]; const s = useApi(`/admin/content/${name}`); const toast = useToast(); const [edit, setEdit] = useState(null); const [f, setF] = useState({}); const [busy, setBusy] = useState(false); const [del, setDel] = useState(null);
  const openNew = () => { setF({ is_published: true, is_active: true }); setEdit({}); };
  const openEdit = (r) => { setF({ ...r, amount_off_minor: r.amount_off_minor ? fromMinor(r.amount_off_minor) : '', valid_until: r.valid_until ? r.valid_until.slice(0, 16) : '' }); setEdit(r); };
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = {}; sc.fields.forEach(([k, , t]) => { let v = f[k]; if (v === '' || v === undefined) v = null; if (t === 'number' && v != null) v = +v; if (t === 'money' && v != null) v = toMinor(v); if (t === 'datetime' && v) v = new Date(v).toISOString(); if (t === 'check') v = !!f[k]; if (v !== null || edit.id) body[k] = v; });
      if (name === 'coupons') { if (body.percent_off) delete body.amount_off_minor; else if (body.amount_off_minor) delete body.percent_off; }
      edit.id ? await api(`/admin/content/${name}/${edit.id}`, { method: 'PATCH', body }) : await api(`/admin/content/${name}`, { method: 'POST', body });
      toast('Saved'); setEdit(null); s.reload();
    } catch (x) { toast(x.message, 'error'); } setBusy(false);
  };
  const remove = async () => { try { await api(`/admin/content/${name}/${del.id}`, { method: 'DELETE' }); toast('Deleted'); s.reload(); } catch (x) { toast(x.message, 'error'); } setDel(null); };
  const show = (k, v) => (typeof v === 'boolean' ? <Badge tone={v ? 'green' : 'gray'}>{v ? 'Yes' : 'No'}</Badge> : k === 'amount_off_minor' && v ? moneyAlways(v) : v ?? '–');
  return (<>
    <div className="mb-4 flex justify-end"><button className="btn-primary btn-sm" onClick={openNew}><Plus className="h-4 w-4" />Add</button></div>
    <Async state={s}>{(rows) => rows.length ? <div className="table-wrap"><table><thead><tr>{sc.cols.map((c) => <th key={c} className="capitalize">{c.replace(/_/g, ' ')}</th>)}<th /></tr></thead><tbody>{rows.map((r) => <tr key={r.id}>{sc.cols.map((c) => <td key={c} className="max-w-xs truncate">{show(c, r[c])}</td>)}<td className="space-x-1 text-right"><button className="btn-ghost btn-sm px-2" onClick={() => openEdit(r)} aria-label="Edit"><Pencil className="h-4 w-4" /></button><button className="btn-ghost btn-sm px-2" onClick={() => setDel(r)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div> : <EmptyState title={`No ${sc.label.toLowerCase()} yet`} />}</Async>
    <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.id ? 'Edit' : 'Add'} ${sc.label.toLowerCase().replace(/s$/, '')}`} wide><form onSubmit={save} className="space-y-4">{sc.fields.map(([k, label, t, req]) => t === 'rich' ? <Field key={k} label={label}><RichEditor value={f[k] ?? ''} onChange={(h) => setF((p) => ({ ...p, [k]: h }))} label={label} /></Field> : t === 'check' ? <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{label}</label> : <Field key={k} label={label} htmlFor={`f${k}`}>{t === 'textarea' ? <textarea id={`f${k}`} required={req} className="input min-h-[120px]" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <input id={`f${k}`} required={req} type={t === 'money' ? 'number' : t} className="input" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</Field>)}<button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-current" />}Save</button></form></Modal>
    <Confirm open={!!del} danger onClose={() => setDel(null)} onConfirm={remove} title="Delete this item?" confirmLabel="Delete">This can't be undone.</Confirm></>);
}
export function Content() {
  const [tab, setTab] = useState('testimonials');
  return (<><PageHeader title="Site content" subtitle="Manage what appears on the public website and checkout." /><Tabs value={tab} onChange={setTab} tabs={Object.entries(SCHEMAS).map(([id, v]) => ({ id, label: v.label }))} /><ContentManager key={tab} name={tab} /></>);
}

/* ───────── Applications, tickets, messages ───────── */
export function Applications() {
  const s = useApi('/admin/applications'); const toast = useToast();
  const decide = async (a, approve) => { try { await api(`/admin/applications/${a.id}/decision`, { method: 'POST', body: { approve } }); toast(approve ? 'Approved. They are now an instructor.' : 'Rejected'); s.reload(); } catch (x) { toast(x.message, 'error'); } };
  return (<><PageHeader title="Instructor applications" /><Async state={s}>{(list) => list.length ? <div className="space-y-3">{list.map((a) => <div key={a.id} className="card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-ink-900">{a.profiles?.full_name} <span className="font-normal text-ink-500">· {a.profiles?.email}</span></p><p className="text-sm text-ink-500">{a.expertise}</p></div><StatusBadge status={a.status} /></div><p className="mt-3 whitespace-pre-line text-sm">{a.pitch}</p>{a.status === 'pending' && <div className="mt-4 flex gap-2"><button className="btn-primary btn-sm" onClick={() => decide(a, true)}>Approve</button><button className="btn-outline btn-sm" onClick={() => decide(a, false)}>Reject</button></div>}</div>)}</div> : <EmptyState title="No applications" />}</Async></>);
}
export function Tickets() {
  const [tab, setTab] = useState('tickets'); const t = useApi('/admin/tickets'); const m = useApi('/admin/messages'); const subs = useApi(tab === 'subs' ? '/admin/subscribers' : null); const toast = useToast(); const [r, setR] = useState({});
  const reply = async (x) => { try { await api(`/admin/tickets/${x.id}`, { method: 'PATCH', body: { admin_reply: r[x.id], status: 'closed' } }); toast('Reply sent'); t.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (<><PageHeader title="Support and messages" /><Tabs value={tab} onChange={setTab} tabs={[{ id: 'tickets', label: 'Student tickets' }, { id: 'messages', label: 'Contact form' }, { id: 'subs', label: 'Newsletter' }]} />
    {tab === 'subs' ? <Async state={subs}>{(list) => <><div className="mb-3 flex items-center justify-between"><p className="text-sm text-ink-500">{list.length} subscriber{list.length === 1 ? '' : 's'}</p><button className="btn-outline btn-sm" onClick={() => { navigator.clipboard?.writeText(list.map((x) => x.email).join(', ')); toast('Emails copied'); }}>Copy all emails</button></div>{list.length ? <div className="table-wrap"><table><thead><tr><th>Email</th><th>Joined</th></tr></thead><tbody>{list.map((x) => <tr key={x.id}><td>{x.email}</td><td>{date(x.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="No subscribers yet" />}</>}</Async>
    : tab === 'tickets' ? <Async state={t}>{(list) => list.length ? <div className="space-y-3">{list.map((x) => <div key={x.id} className="card p-5"><div className="flex items-center justify-between"><p className="font-semibold text-ink-900">{x.subject} <span className="font-normal text-ink-500">· {x.profiles?.full_name}</span></p><StatusBadge status={x.status} /></div><p className="mt-2 text-sm">{x.message}</p>{x.admin_reply ? <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm"><strong>Reply:</strong> {x.admin_reply}</p> : <div className="mt-3 flex gap-2"><input className="input" placeholder="Write a reply" value={r[x.id] || ''} onChange={(e) => setR({ ...r, [x.id]: e.target.value })} aria-label="Reply" /><button className="btn-primary" disabled={!r[x.id]?.trim()} onClick={() => reply(x)}>Reply and close</button></div>}</div>)}</div> : <EmptyState title="No tickets" />}</Async>
      : <Async state={m}>{(list) => list.length ? <div className="table-wrap"><table><thead><tr><th>From</th><th>Message</th><th>Received</th></tr></thead><tbody>{list.map((x) => <tr key={x.id}><td><p className="font-medium text-ink-900">{x.name}</p><a className="text-xs text-brand-700" href={`mailto:${x.email}`}>{x.email}</a></td><td className="max-w-md whitespace-pre-line">{x.message}</td><td>{dateTime(x.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="No messages" />}</Async>}</>);
}

/* ───────── Settings & audit ───────── */
export function Settings() {
  const s = useApi('/admin/settings'); const toast = useToast();
  const save = async (key, value) => { try { await api(`/admin/settings/${key}`, { method: 'PUT', body: { value } }); toast('Setting saved'); s.reload(); } catch (x) { toast(x.message, 'error'); } };
  return (<><PageHeader title="Platform settings" /><Async state={s}>{(rows) => { const get = (k) => rows.find((r) => r.key === k)?.value; const ac = get('academy') || {}; const cert = get('certificate') || {}; const home = get('home');
    return (<div className="grid gap-6 lg:grid-cols-2">
      {home ? <form className="card space-y-4 p-5 lg:col-span-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); save('home', { hero_title: fd.get('hero_title'), hero_subtitle: fd.get('hero_subtitle'), banner: fd.get('banner') }); }}><h2 className="font-semibold">Homepage</h2>
        <Field label="Headline" htmlFor="ht"><input id="ht" name="hero_title" className="input" defaultValue={home.hero_title} maxLength={120} /></Field>
        <Field label="Sub-headline" htmlFor="hs"><textarea id="hs" name="hero_subtitle" className="input min-h-[80px]" defaultValue={home.hero_subtitle} maxLength={300} /></Field>
        <Field label="Announcement ribbon" htmlFor="hb" hint="Optional line shown above the homepage hero. Leave blank to hide."><input id="hb" name="banner" className="input" defaultValue={home.banner} maxLength={140} /></Field>
        <button className="btn-primary btn-sm">Save homepage</button></form> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 lg:col-span-2">Homepage settings aren't set up yet. Run <code>supabase/migrations/0004_site_settings.sql</code> in the Supabase SQL editor.</p>}
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); save('academy', { ...ac, name: fd.get('name'), tagline: fd.get('tagline'), email: fd.get('email') }); }}><h2 className="font-semibold">Academy</h2><Field label="Name"><input name="name" className="input" defaultValue={ac.name} /></Field><Field label="Tagline"><input name="tagline" className="input" defaultValue={ac.tagline} /></Field><Field label="Contact email"><input name="email" type="email" className="input" defaultValue={ac.email} /></Field><button className="btn-primary btn-sm">Save</button></form>
      <div className="space-y-6"><form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); save('certificate', { ...cert, signatory: new FormData(e.target).get('signatory') }); }}><h2 className="font-semibold">Certificates</h2><Field label="Signatory line" hint="Printed under the signature line"><input name="signatory" className="input" defaultValue={cert.signatory} /></Field><button className="btn-primary btn-sm">Save</button></form>
        <div className="card p-5"><h2 className="font-semibold">Instructor publishing</h2><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={get('instructors_can_publish') === true} onChange={(e) => save('instructors_can_publish', e.target.checked)} />Instructors may publish their own courses</label><p className="mt-2 text-xs text-ink-400">When off, only administrators can publish.</p></div></div></div>); }}</Async></>);
}
export function Audit() {
  const [page, setPage] = useState(1); const s = useApi(`/admin/audit${qs({ page })}`);
  return (<><PageHeader title="Audit log" subtitle="Sensitive administrative actions." /><Async state={s}>{(d) => (<><div className="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{d.items.map((a) => <tr key={a.id}><td className="whitespace-nowrap">{dateTime(a.created_at)}</td><td>{a.profiles?.full_name || 'System'}</td><td><Badge tone="blue">{a.action}</Badge></td><td className="text-xs text-ink-500">{a.entity} {a.entity_id?.slice(0, 8)}</td><td className="max-w-xs truncate text-xs text-ink-500">{JSON.stringify(a.metadata)}</td></tr>)}</tbody></table></div><Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} /></>)}</Async></>);
}
