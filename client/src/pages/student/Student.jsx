import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock, Award, Bell, Receipt, Bookmark as BookmarkIcon, LifeBuoy, PlayCircle, XCircle, Download, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { supabase } from '../../lib/supabase.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { Async, Avatar, Badge, CourseThumb, EmptyState, Field, PageHeader, Progress, Spinner, Stat, StatusBadge, Tabs } from '../../components/ui/index.jsx';
import { date, dateTime, moneyAlways, timeAgo } from '../../lib/format.js';

function CourseRow({ c }) {
  const resume = c.percent > 0 && c.percent < 100;
  return (
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <CourseThumb src={c.thumbnail_url} title="" className="h-24 w-full shrink-0 rounded-lg sm:w-40" />
      <div className="min-w-0 flex-1"><h3 className="truncate text-base font-semibold">{c.title}</h3>
        <p className="mt-0.5 text-sm text-ink-500">{c.completed_lessons} of {c.total_lessons} lessons · {Math.round(c.percent)}%</p><Progress className="mt-3" value={c.percent} /></div>
      <Link to={`/learn/${c.slug}`} className={resume || c.percent === 0 ? 'btn-primary' : 'btn-outline'}>{c.percent >= 100 ? 'Review' : resume ? 'Continue' : 'Start'}</Link>
    </div>
  );
}

export function Overview() {
  const { profile } = useAuth(); const s = useApi('/me/dashboard');
  return (
    <>
      <PageHeader title={`Welcome back${profile?.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}`} subtitle="Pick up where you left off." />
      <Async state={s}>{({ stats, courses, recent, upcoming }) => {
        const active = courses.filter((c) => c.percent < 100).sort((a, b) => new Date(b.last_accessed_at || 0) - new Date(a.last_accessed_at || 0));
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat icon={BookOpen} label="Enrolled courses" value={stats.enrolled} /><Stat icon={CheckCircle2} label="Completed courses" value={stats.completed} />
              <Stat icon={Clock} label="Time learned" value={stats.minutes_learned >= 60 ? `${Math.floor(stats.minutes_learned / 60)}h ${stats.minutes_learned % 60}m` : `${stats.minutes_learned}m`} hint={`${stats.lessons_completed} lessons done`} /><Stat icon={Award} label="Certificates" value={stats.certificates} /></div>
            <section><h2 className="mb-3 text-lg font-semibold">Continue learning</h2>
              {active.length ? <div className="space-y-3">{active.slice(0, 3).map((c) => <CourseRow key={c.id} c={c} />)}</div> : <EmptyState icon={BookOpen} title={courses.length ? "You're all caught up" : 'No courses yet'} action={<Link to="/courses" className="btn-primary">Browse courses</Link>}>{courses.length ? 'Find your next course.' : 'Enroll in a course to start tracking progress here.'}</EmptyState>}</section>
            <div className="grid gap-6 lg:grid-cols-2">
              <section><h2 className="mb-3 text-lg font-semibold">Recently viewed</h2>{recent.length ? <ul className="card divide-y divide-ink-100">{recent.map((r) => <li key={r.lesson_id}><Link to={`/learn/${r.lessons.courses.slug}?lesson=${r.lesson_id}`} className="flex items-center gap-3 p-3 hover:bg-ink-50"><PlayCircle className="h-4 w-4 text-brand-600" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink-900">{r.lessons.title}</span><span className="block truncate text-xs text-ink-500">{r.lessons.courses.title}</span></span><span className="text-xs text-ink-400">{timeAgo(r.last_accessed_at)}</span></Link></li>)}</ul> : <p className="text-sm text-ink-500">Lessons you open will show up here.</p>}</section>
              <section><h2 className="mb-3 text-lg font-semibold">Upcoming deadlines</h2>{upcoming.length ? <ul className="card divide-y divide-ink-100">{upcoming.map((u) => <li key={u.lesson_id} className="flex items-center justify-between gap-3 p-3 text-sm"><span className="truncate font-medium text-ink-900">{u.lesson?.title}</span><Badge tone="amber">Due {date(u.due_at)}</Badge></li>)}</ul> : <p className="text-sm text-ink-500">No assignment deadlines coming up.</p>}</section>
            </div>
          </div>);
      }}</Async>
    </>
  );
}

export function MyCourses() {
  const s = useApi('/me/dashboard'); const [tab, setTab] = useState('all');
  return (<><PageHeader title="My courses" action={<Link to="/courses" className="btn-outline">Find more courses</Link>} />
    <Async state={s}>{({ courses }) => { const list = courses.filter((c) => tab === 'all' || (tab === 'done' ? c.percent >= 100 : c.percent < 100));
      return (<><Tabs value={tab} onChange={setTab} tabs={[{ id: 'all', label: `All (${courses.length})` }, { id: 'active', label: 'In progress' }, { id: 'done', label: 'Completed' }]} />
        {list.length ? <div className="space-y-3">{list.map((c) => <CourseRow key={c.id} c={c} />)}</div> : <EmptyState icon={BookOpen} title="Nothing here yet" action={<Link to="/courses" className="btn-primary">Browse courses</Link>} />}</>); }}</Async></>);
}

export function Bookmarks() {
  const s = useApi('/me/bookmarks');
  return (<><PageHeader title="Bookmarks" subtitle="Lessons you saved to revisit." />
    <Async state={s}>{(list) => list.length ? <ul className="card divide-y divide-ink-100">{list.map((b) => <li key={b.lesson_id}><Link to={`/learn/${b.lessons.courses.slug}?lesson=${b.lesson_id}`} className="flex items-center gap-3 p-4 hover:bg-ink-50"><BookmarkIcon className="h-4 w-4 text-brand-600" /><span className="flex-1"><span className="block font-medium text-ink-900">{b.lessons.title}</span><span className="text-sm text-ink-500">{b.lessons.courses.title}</span></span><span className="text-xs text-ink-400">{date(b.created_at)}</span></Link></li>)}</ul>
      : <EmptyState icon={BookmarkIcon} title="No bookmarks yet">Use the bookmark button inside a lesson to save it here.</EmptyState>}</Async></>);
}

export function Certificates() {
  const s = useApi('/me/certificates'); const toast = useToast(); const [busy, setBusy] = useState('');
  const get = async (c) => { setBusy(c.id); try { const { url } = await api(`/certificates/${c.id}/download`); window.location.assign(url); } catch (e) { toast(e.message, 'error'); } setBusy(''); };
  return (<><PageHeader title="Certificates" subtitle="Earned by completing courses. Share the verification link with anyone." />
    <Async state={s}>{(list) => list.length ? <div className="grid gap-4 sm:grid-cols-2">{list.map((c) => (
      <div key={c.id} className="card p-5"><Award className="h-6 w-6 text-brand-600" /><h3 className="mt-3 text-base font-semibold">{c.course_title}</h3><p className="mt-1 text-sm text-ink-500">Issued {date(c.issued_at)} · {c.certificate_no}</p>
        <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary btn-sm" onClick={() => get(c)} disabled={busy === c.id}>{busy === c.id ? <Spinner className="h-4 w-4 text-white" /> : <Download className="h-4 w-4" />}Download PDF</button>
          <button className="btn-outline btn-sm" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/verify/${c.certificate_no}`); toast('Verification link copied'); }}><ShieldCheck className="h-4 w-4" />Copy verify link</button></div></div>))}</div>
      : <EmptyState icon={Award} title="No certificates yet" action={<Link to="/app/courses" className="btn-primary">Go to my courses</Link>}>Finish every lesson, pass required quizzes and get assignments graded to claim one.</EmptyState>}</Async></>);
}

export function Notifications() {
  const s = useApi('/notifications'); const { setUnread } = useAuth(); const nav = useNavigate();
  const sync = (rows) => setUnread(rows.filter((n) => !n.read_at).length);
  useEffect(() => { if (s.data) sync(s.data); /* eslint-disable-next-line */ }, [s.data]);
  const open = async (n) => { if (!n.read_at) { await api(`/notifications/${n.id}/read`, { method: 'POST' }); s.setData((d) => d.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))); } if (n.link) nav(n.link); };
  const all = async () => { await api('/notifications/read-all', { method: 'POST' }); s.setData((d) => d.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() }))); };
  return (<><PageHeader title="Notifications" action={<button className="btn-outline btn-sm" onClick={all}>Mark all as read</button>} />
    <Async state={s}>{(list) => list.length ? <ul className="card divide-y divide-ink-100">{list.map((n) => <li key={n.id}><button onClick={() => open(n)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-ink-50"><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-brand-600'}`} /><span className="flex-1"><span className={`block text-sm ${n.read_at ? 'text-ink-700' : 'font-semibold text-ink-900'}`}>{n.title}</span>{n.body && <span className="block text-sm text-ink-500">{n.body}</span>}</span><span className="text-xs text-ink-400">{timeAgo(n.created_at)}</span></button></li>)}</ul>
      : <EmptyState icon={Bell} title="You're all caught up">Enrolments, grades and announcements will appear here.</EmptyState>}</Async></>);
}

export function Orders() {
  const s = useApi('/me/orders');
  return (<><PageHeader title="Payments and enrolments" />
    <Async state={s}>{(list) => list.length ? <div className="table-wrap"><table><thead><tr><th>Course</th><th>Reference</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{list.map((o) => <tr key={o.id}><td className="font-medium text-ink-900">{o.courses?.title}</td><td className="text-ink-500">{o.reference}</td><td>{moneyAlways(o.amount_minor, o.currency)}</td><td><StatusBadge status={o.status} /></td><td>{date(o.created_at)}</td></tr>)}</tbody></table></div>
      : <EmptyState icon={Receipt} title="No payments yet">Paid and free enrolments will be listed here.</EmptyState>}</Async></>);
}

export function Support() {
  const s = useApi('/support'); const toast = useToast(); const [f, setF] = useState({ subject: '', message: '' }); const [busy, setBusy] = useState(false);
  const send = async (e) => { e.preventDefault(); setBusy(true); try { await api('/support', { method: 'POST', body: f }); toast('Ticket sent. We will reply here and by notification.'); setF({ subject: '', message: '' }); s.reload(); } catch (x) { toast(x.message, 'error'); } setBusy(false); };
  return (<><PageHeader title="Support" subtitle="Ask a question about a course, payment or your account." />
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={send} className="card space-y-4 p-5"><Field label="Subject" htmlFor="sub"><input id="sub" required minLength={3} className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="How can we help?" htmlFor="msg"><textarea id="msg" required minLength={10} className="input min-h-[120px]" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field><button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Send ticket</button></form>
      <div><h2 className="mb-3 text-lg font-semibold">Your tickets</h2><Async state={s}>{(list) => list.length ? <div className="space-y-3">{list.map((t) => <div key={t.id} className="card p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium text-ink-900">{t.subject}</p><StatusBadge status={t.status} /></div><p className="mt-1 text-sm text-ink-500">{t.message}</p>{t.admin_reply && <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-ink-700"><strong>Reply:</strong> {t.admin_reply}</p>}</div>)}</div> : <EmptyState icon={LifeBuoy} title="No tickets" />}</Async></div>
    </div></>);
}

export function Profile() {
  const { profile, user, refresh, isInstructor } = useAuth(); const toast = useToast(); const fileRef = useRef(null);
  const [f, setF] = useState({ full_name: '', headline: '', bio: '', phone: '' }); const [busy, setBusy] = useState(false); const [up, setUp] = useState(false);
  const [pw, setPw] = useState(''); const settings = useApi('/me'); const [app, setApp] = useState({ expertise: '', pitch: '' }); const [appBusy, setAppBusy] = useState(false);
  useEffect(() => { if (profile) setF({ full_name: profile.full_name || '', headline: profile.headline || '', bio: profile.bio || '', phone: profile.phone || '' }); }, [profile]);
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await api('/me', { method: 'PATCH', body: f }); await refresh(); toast('Profile saved'); } catch (x) { toast(x.message, 'error'); } setBusy(false); };
  const upload = async (file) => {
    if (!file) return; if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) return toast('Use a JPG, PNG or WebP under 2 MB', 'error');
    setUp(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.${file.type.split('/')[1]}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true }); if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await api('/me', { method: 'PATCH', body: { ...f, avatar_url: data.publicUrl } }); await refresh(); toast('Photo updated');
    } catch (x) { toast(x.message || 'Upload failed', 'error'); } setUp(false);
  };
  const toggle = async (k, v) => { try { await api('/me/settings', { method: 'PATCH', body: { [k]: v } }); settings.reload(); } catch (x) { toast(x.message, 'error'); } };
  const changePw = async (e) => { e.preventDefault(); if (pw.length < 8) return toast('Use at least 8 characters', 'error'); const { error } = await supabase.auth.updateUser({ password: pw }); error ? toast(error.message, 'error') : (toast('Password changed'), setPw('')); };
  const apply = async (e) => { e.preventDefault(); setAppBusy(true); try { await api('/instructor-applications', { method: 'POST', body: app }); toast('Application sent. We will notify you.'); setApp({ expertise: '', pitch: '' }); } catch (x) { toast(x.message, 'error'); } setAppBusy(false); };
  const st = settings.data?.settings;
  return (<><PageHeader title="Profile and settings" />
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form onSubmit={save} className="card space-y-4 p-5">
        <div className="flex items-center gap-4"><Avatar src={profile?.avatar_url} name={profile?.full_name} size={64} /><div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} /><button type="button" className="btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={up}>{up && <Spinner className="h-4 w-4" />}Change photo</button><p className="mt-1 text-xs text-ink-400">JPG, PNG or WebP, up to 2 MB</p></div></div>
        <Field label="Full name" htmlFor="fn"><input id="fn" required minLength={2} className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Email" hint="Your sign-in email can't be changed here."><input className="input" disabled value={profile?.email || ''} /></Field>
        <Field label="Headline" htmlFor="hl"><input id="hl" className="input" placeholder="e.g. Junior front-end developer" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} /></Field>
        <Field label="Phone" htmlFor="ph"><input id="ph" className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Bio" htmlFor="bio"><textarea id="bio" className="input min-h-[100px]" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Save changes</button>
      </form>
      <div className="space-y-6">
        <section className="card space-y-3 p-5"><h2 className="font-semibold">Email preferences</h2>
          {[['email_notifications', 'Course and account updates'], ['marketing_emails', 'News and offers']].map(([k, l]) => <label key={k} className="flex items-center justify-between gap-3 text-sm"><span>{l}</span><input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" checked={!!st?.[k]} onChange={(e) => toggle(k, e.target.checked)} /></label>)}</section>
        <form onSubmit={changePw} className="card space-y-3 p-5"><h2 className="font-semibold">Change password</h2><input type="password" autoComplete="new-password" minLength={8} className="input" placeholder="New password" aria-label="New password" value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn-outline btn-sm">Update password</button></form>
        {!isInstructor && <form onSubmit={apply} className="card space-y-3 p-5"><h2 className="font-semibold">Teach on Techsters</h2><input required className="input" placeholder="Your area of expertise" value={app.expertise} onChange={(e) => setApp({ ...app, expertise: e.target.value })} aria-label="Expertise" /><textarea required minLength={30} className="input min-h-[90px]" placeholder="What would you teach and why are you the right person?" value={app.pitch} onChange={(e) => setApp({ ...app, pitch: e.target.value })} aria-label="Pitch" /><button className="btn-outline btn-sm" disabled={appBusy}>Apply to teach</button></form>}
      </div>
    </div></>);
}

/** Paystack redirects here with ?reference=. We ask the server to verify with Paystack; we never trust the URL. */
export function CheckoutCallback() {
  const [sp] = useSearchParams(); const ref = sp.get('reference') || sp.get('trxref'); const [res, setRes] = useState(null); const [err, setErr] = useState('');
  useEffect(() => {
    if (!ref) { setErr('No payment reference found.'); return undefined; }
    let alive = true; let tries = 0;
    const run = async () => {
      try { const r = await api(`/checkout/verify?reference=${encodeURIComponent(ref)}`); if (!alive) return; if (r.status === 'pending' && tries++ < 5) setTimeout(run, 2500); else setRes(r); }
      catch (e) { if (alive) setErr(e.message); }
    };
    run(); return () => { alive = false; };
  }, [ref]);
  const ok = res?.status === 'paid';
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {!res && !err ? <><Spinner className="mx-auto h-8 w-8" /><h1 className="mt-5 text-2xl font-semibold">Confirming your payment</h1><p className="mt-2 text-ink-500">This takes a few seconds. Please don't close this page.</p></> :
        ok ? <><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h1 className="mt-5 text-2xl font-semibold">You're enrolled</h1><p className="mt-2 text-ink-600">Payment confirmed for {res.title}.</p><Link to={`/learn/${res.slug}`} className="btn-primary btn-lg mt-6">Start learning</Link></> :
          <><XCircle className="mx-auto h-12 w-12 text-red-500" /><h1 className="mt-5 text-2xl font-semibold">Payment not completed</h1><p className="mt-2 text-ink-600">{err || (res?.status === 'pending' ? 'We have not received confirmation yet. If money left your account it will be applied automatically; check your payments page in a few minutes.' : 'No money was taken, or the payment failed. You can try again.')}</p>
            <div className="mt-6 flex justify-center gap-3">{res?.slug && <Link to={`/courses/${res.slug}`} className="btn-primary">Try again</Link>}<Link to="/app/orders" className="btn-outline">Payment history</Link></div></>}
    </div>
  );
}
