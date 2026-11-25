import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Users, Percent, ClipboardCheck, Plus, Megaphone, ClipboardList } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Async, Avatar, EmptyState, Field, Modal, PageHeader, Progress, Spinner, Stat, StatusBadge, CourseThumb, Badge } from '../../components/ui/index.jsx';
import { date, moneyAlways, dateTime } from '../../lib/format.js';

export function Overview() {
  const s = useApi('/staff/overview');
  return (<><PageHeader title="Instructor overview" subtitle="How your courses and students are doing." action={<Link to="/instructor/courses" className="btn-primary"><Plus className="h-4 w-4" />New course</Link>} />
    <Async state={s}>{(d) => (<div className="space-y-8"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat icon={GraduationCap} label="Courses" value={d.courses} /><Stat icon={Users} label="Students" value={d.students} /><Stat icon={Percent} label="Completion rate" value={`${d.completion_rate}%`} /><Stat icon={ClipboardCheck} label="Awaiting grading" value={d.pending_submissions} /></div>
      <section><h2 className="mb-3 text-lg font-semibold">Course performance</h2>{d.per_course.length ? <div className="table-wrap"><table><thead><tr><th>Course</th><th>Status</th><th>Students</th><th>Average progress</th></tr></thead><tbody>{d.per_course.map((c) => <tr key={c.id}><td><Link className="font-medium text-brand-700" to={`/instructor/courses/${c.id}`}>{c.title}</Link></td><td><StatusBadge status={c.status} /></td><td>{c.students}</td><td className="w-48"><div className="flex items-center gap-2"><Progress className="flex-1" value={c.avg_progress} /><span className="text-xs">{c.avg_progress}%</span></div></td></tr>)}</tbody></table></div> : <EmptyState icon={GraduationCap} title="No courses yet" action={<Link to="/instructor/courses" className="btn-primary">Create your first course</Link>} />}</section></div>)}</Async></>);
}

export function Courses({ admin }) {
  const s = useApi('/staff/courses'); const toast = useToast(); const nav = useNavigate();
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false);
  const create = async (e) => { e.preventDefault(); setBusy(true); try { const c = await api('/staff/courses', { method: 'POST', body: { title } }); nav(`/instructor/courses/${c.id}`); } catch (x) { toast(x.message, 'error'); setBusy(false); } };
  return (<><PageHeader title={admin ? 'All courses' : 'My courses'} action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New course</button>} />
    <Async state={s}>{(list) => list.length ? <div className="table-wrap"><table><thead><tr><th>Course</th><th>Status</th><th>Price</th><th>Students</th><th>Updated</th></tr></thead><tbody>{list.map((c) => <tr key={c.id}><td><Link to={`/instructor/courses/${c.id}`} className="flex items-center gap-3 font-medium text-ink-900 hover:text-brand-700"><CourseThumb src={c.thumbnail_url} title="" className="h-10 w-16 shrink-0 rounded" />{c.title}</Link></td><td><StatusBadge status={c.status} />{c.is_featured && <span className="ml-1"><Badge tone="blue">Featured</Badge></span>}</td><td>{moneyAlways(c.price_minor, c.currency) === '₦0' ? 'Free' : moneyAlways(c.price_minor, c.currency)}</td><td>{c.students}</td><td>{date(c.updated_at)}</td></tr>)}</tbody></table></div>
      : <EmptyState icon={GraduationCap} title="No courses yet" action={<button className="btn-primary" onClick={() => setOpen(true)}>Create a course</button>}>Start with a title. You can add modules and lessons next.</EmptyState>}</Async>
    <Modal open={open} onClose={() => setOpen(false)} title="New course"><form onSubmit={create} className="space-y-4"><Field label="Course title" htmlFor="t"><input id="t" autoFocus required minLength={3} className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field><button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-current" />}Create course</button></form></Modal></>);
}

export function Students() {
  const s = useApi('/staff/students'); const [q, setQ] = useState('');
  return (<><PageHeader title="Students" subtitle="Everyone enrolled in your courses, with their progress." />
    <input className="input mb-4 max-w-sm" placeholder="Search by name, email or course" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
    <Async state={s}>{(list) => { const f = list.filter((r) => `${r.profiles?.full_name} ${r.profiles?.email} ${r.courses?.title}`.toLowerCase().includes(q.toLowerCase())); return f.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Progress</th><th>Last active</th><th>Enrolled</th></tr></thead><tbody>{f.map((r) => <tr key={r.id}><td><div className="flex items-center gap-3"><Avatar src={r.profiles?.avatar_url} name={r.profiles?.full_name} size={32} /><div><p className="font-medium text-ink-900">{r.profiles?.full_name}</p><p className="text-xs text-ink-500">{r.profiles?.email}</p></div></div></td><td>{r.courses?.title}</td><td className="w-40"><div className="flex items-center gap-2"><Progress className="flex-1" value={r.percent} /><span className="text-xs">{Math.round(r.percent)}%</span></div></td><td>{r.last_accessed_at ? date(r.last_accessed_at) : 'Not started'}</td><td>{date(r.enrolled_at)}</td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No students found" />; }}</Async></>);
}

export function Submissions() {
  const [status, setStatus] = useState('submitted'); const s = useApi(`/staff/submissions?status=${status}`); const toast = useToast();
  const [g, setG] = useState(null); const [f, setF] = useState({ score: '', feedback: '', ret: false }); const [busy, setBusy] = useState(false);
  const open = (r) => { setG(r); setF({ score: r.score ?? '', feedback: r.feedback ?? '', ret: false }); };
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await api(`/staff/submissions/${g.id}/grade`, { method: 'POST', body: { score: +f.score, feedback: f.feedback || null, return_for_resubmission: f.ret } }); toast('Graded'); setG(null); s.reload(); } catch (x) { toast(x.message, 'error'); } setBusy(false); };
  return (<><PageHeader title="Assignment submissions" />
    <div className="mb-4 flex gap-2">{['submitted', 'graded', 'returned'].map((x) => <button key={x} onClick={() => setStatus(x)} className={status === x ? 'btn-dark btn-sm capitalize' : 'btn-outline btn-sm capitalize'}>{x === 'submitted' ? 'To grade' : x}</button>)}</div>
    <Async state={s}>{(list) => list.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Assignment</th><th>Submitted</th><th>Status</th><th /></tr></thead><tbody>{list.map((r) => <tr key={r.id}><td><p className="font-medium text-ink-900">{r.profiles?.full_name}</p><p className="text-xs text-ink-500">{r.profiles?.email}</p></td><td>{r.lesson?.title}<p className="text-xs text-ink-500">{r.lesson?.courses?.title}</p></td><td>{dateTime(r.submitted_at)}</td><td><StatusBadge status={r.status} /></td><td className="text-right"><button className="btn-outline btn-sm" onClick={() => open(r)}>{r.status === 'submitted' ? 'Grade' : 'Review'}</button></td></tr>)}</tbody></table></div> : <EmptyState icon={ClipboardList} title="Nothing here" />}</Async>
    <Modal open={!!g} onClose={() => setG(null)} title="Grade submission" wide>{g && <form onSubmit={save} className="space-y-4">
      {g.text_body && <div><p className="label">Answer</p><p className="max-h-60 overflow-y-auto whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm">{g.text_body}</p></div>}
      {g.file_url && <a className="btn-outline btn-sm" href={g.file_url} target="_blank" rel="noreferrer">Open attached file</a>}
      <Field label="Score" htmlFor="sc"><input id="sc" type="number" min="0" required className="input" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} /></Field>
      <Field label="Feedback" htmlFor="fb"><textarea id="fb" className="input min-h-[100px]" value={f.feedback} onChange={(e) => setF({ ...f, feedback: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.ret} onChange={(e) => setF({ ...f, ret: e.target.checked })} />Return to student for resubmission</label>
      <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-current" />}Save grade</button></form>}</Modal></>);
}

export function Announcements() {
  const { isAdmin } = useAuth(); const s = useApi('/staff/announcements'); const courses = useApi('/staff/courses'); const toast = useToast();
  const [f, setF] = useState({ courseId: '', title: '', body: '' }); const [busy, setBusy] = useState(false);
  const send = async (e) => { e.preventDefault(); setBusy(true); try { const r = await api('/staff/announcements', { method: 'POST', body: { ...f, courseId: f.courseId || null } }); toast(`Sent to ${r.recipients} student${r.recipients === 1 ? '' : 's'}`); setF({ courseId: '', title: '', body: '' }); s.reload(); } catch (x) { toast(x.message, 'error'); } setBusy(false); };
  return (<><PageHeader title="Announcements" subtitle="Students get a notification (and an email if they opted in)." />
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={send} className="card h-fit space-y-4 p-5"><Field label="Audience" htmlFor="aud"><select id="aud" className="input" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })} required={!isAdmin}>{isAdmin ? <option value="">Whole academy</option> : <option value="">Choose a course</option>}{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
        <Field label="Title" htmlFor="at"><input id="at" required minLength={3} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Message" htmlFor="am"><textarea id="am" required minLength={3} className="input min-h-[120px]" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4 text-current" /> : <Megaphone className="h-4 w-4" />}Send announcement</button></form>
      <Async state={s}>{(list) => list.length ? <div className="space-y-3">{list.map((a) => <div key={a.id} className="card p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-ink-900">{a.title}</p><span className="text-xs text-ink-400">{date(a.created_at)}</span></div><p className="text-xs text-ink-500">{a.courses?.title || 'Whole academy'}</p><p className="mt-2 whitespace-pre-line text-sm">{a.body}</p></div>)}</div> : <EmptyState icon={Megaphone} title="No announcements yet" />}</Async></div></>);
}
