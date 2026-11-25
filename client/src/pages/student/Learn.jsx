import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, CheckCircle2, Circle, FileText, HelpCircle, ClipboardList, PlayCircle, Menu, X, Download, Award, Trash2, Timer } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Async, Avatar, Progress, RichText, Spinner, Tabs, Badge, cx } from '../../components/ui/index.jsx';
import { LessonMedia } from '../public/CourseDetail.jsx';
import { duration, timeAgo, dateTime } from '../../lib/format.js';

const icons = { video: PlayCircle, text: FileText, quiz: HelpCircle, assignment: ClipboardList };

/* ───────────── Quiz ───────────── */
function Quiz({ lesson, onPassed, reload }) {
  const toast = useToast(); const q = lesson.quiz;
  const [attempt, setAttempt] = useState(null); const [answers, setAnswers] = useState({}); const [result, setResult] = useState(null); const [busy, setBusy] = useState(false); const [left, setLeft] = useState(null);
  const submitRef = useRef(null);

  const start = async () => {
    setBusy(true); setResult(null); setAnswers({});
    try { const a = await api(`/quizzes/${lesson.id}/start`, { method: 'POST' }); setAttempt(a); } catch (e) { toast(e.message, 'error'); } setBusy(false);
  };
  const submit = useCallback(async () => {
    if (!attempt) return; setBusy(true);
    try { const r = await api(`/quizzes/${lesson.id}/submit`, { method: 'POST', body: { attempt_id: attempt.attempt_id, answers } }); setResult(r); setAttempt(null); if (r.passed) onPassed(); reload(); }
    catch (e) { toast(e.message, 'error'); } setBusy(false);
  }, [attempt, answers, lesson.id, onPassed, reload, toast]);
  submitRef.current = submit;

  useEffect(() => {
    if (!attempt?.time_limit_minutes) { setLeft(null); return undefined; }
    const end = new Date(attempt.started_at).getTime() + attempt.time_limit_minutes * 60000;
    const t = setInterval(() => { const s = Math.round((end - Date.now()) / 1000); setLeft(Math.max(0, s)); if (s <= 0) { clearInterval(t); submitRef.current?.(); } }, 1000);
    return () => clearInterval(t);
  }, [attempt]);

  const pick = (qn, id) => setAnswers((a) => {
    if (qn.type === 'multiple') { const cur = [].concat(a[qn.id] || []); return { ...a, [qn.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }; }
    return { ...a, [qn.id]: id };
  });
  const best = q.attempts.reduce((m, a) => Math.max(m, +a.score_percent || 0), 0);
  const passedBefore = q.attempts.some((a) => a.passed);

  if (!attempt) return (
    <div className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">Quiz</h3>
      <ul className="space-y-1 text-sm text-ink-600"><li>{q.questions.length} questions · pass mark {q.passing_score}%</li>{q.time_limit_minutes && <li>Time limit: {q.time_limit_minutes} minutes</li>}{q.max_attempts && <li>Attempts left: {q.attempts_left} of {q.max_attempts}</li>}{q.attempts.length > 0 && <li>Best score: {best}% {passedBefore && <Badge tone="green">Passed</Badge>}</li>}</ul>
      {result && (
        <div className={cx('rounded-lg p-4', result.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800')} role="status">
          <p className="font-semibold">{result.expired ? 'Time ran out' : result.passed ? 'You passed' : 'Not passed this time'}: {result.score_percent}%</p>
          {result.review.length > 0 && <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{q.questions.map((qn, i) => { const r = result.review.find((x) => x.id === qn.id); return <li key={qn.id}>{r?.correct ? 'Correct' : 'Incorrect'}{r?.explanation ? `: ${r.explanation}` : ''}</li>; })}</ol>}
        </div>)}
      {q.questions.length === 0 ? <p className="text-sm text-ink-500">This quiz has no questions yet.</p> :
        <button className="btn-primary" onClick={start} disabled={busy || q.attempts_left === 0}>{busy && <Spinner className="h-4 w-4 text-current" />}{q.attempts.length ? 'Try again' : 'Start quiz'}</button>}
    </div>);

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {left != null && <div className="sticky top-16 z-10 flex items-center gap-2 rounded-lg bg-night px-4 py-2 text-sm text-white" role="timer"><Timer className="h-4 w-4" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} remaining</div>}
      {q.questions.map((qn, i) => (
        <fieldset key={qn.id} className="card p-5"><legend className="sr-only">Question {i + 1}</legend>
          <p className="font-medium text-ink-900">{i + 1}. {qn.prompt}</p>{qn.type === 'multiple' && <p className="mt-1 text-xs text-ink-400">Select all that apply</p>}
          <div className="mt-3 space-y-2">{qn.options.map((o) => { const on = [].concat(answers[qn.id] || []).includes(o.id); return (
            <label key={o.id} className={cx('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm shadow-card', on && 'bg-brand-50 ring-2 ring-brand-600')}>
              <input type={qn.type === 'multiple' ? 'checkbox' : 'radio'} name={qn.id} checked={on} onChange={() => pick(qn, o.id)} className="h-4 w-4 text-brand-600" />{o.text}</label>); })}</div>
        </fieldset>))}
      <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-current" />}Submit answers</button>
    </form>);
}

/* ───────────── Assignment ───────────── */
function Assignment({ lesson, reload }) {
  const toast = useToast(); const a = lesson.assignment; const sub = lesson.submission;
  const [text, setText] = useState(sub?.text_body || ''); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false);
  const overdue = a.due_at && new Date(a.due_at) < new Date();
  const locked = sub && !a.allow_resubmission && sub.status !== 'returned';
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      let file_path = sub?.file_path || null;
      if (file) {
        if (file.size > 20 * 1024 * 1024) throw new Error('Files must be under 20 MB');
        const u = await api(`/assignments/${lesson.id}/upload-url`, { method: 'POST', body: { filename: file.name } });
        const { error } = await supabase.storage.from('assignment-submissions').uploadToSignedUrl(u.path, u.token, file); if (error) throw error;
        file_path = u.path;
      }
      await api(`/assignments/${lesson.id}/submit`, { method: 'POST', body: { text_body: text || null, file_path } }); toast('Assignment submitted'); setFile(null); reload();
    } catch (x) { toast(x.message || 'Submission failed', 'error'); } setBusy(false);
  };
  return (
    <div className="space-y-5">
      <div className="card p-5"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">Assignment</h3>{a.due_at && <Badge tone={overdue ? 'red' : 'amber'}>{overdue ? 'Closed' : 'Due'} {dateTime(a.due_at)}</Badge>}</div><RichText className="mt-3" html={a.instructions} /></div>
      {sub && <div className="card p-5"><div className="flex items-center gap-2"><h3 className="font-semibold">Your submission</h3><Badge tone={sub.status === 'graded' ? 'green' : 'amber'}>{sub.status}</Badge></div>
        {sub.status === 'graded' && <p className="mt-2 text-sm"><strong>Score: {sub.score}/{a.max_score}</strong></p>}{sub.feedback && <p className="mt-2 rounded-lg bg-brand-50 p-3 text-sm"><strong>Feedback:</strong> {sub.feedback}</p>}</div>}
      {!overdue && !locked && (
        <form onSubmit={submit} className="card space-y-4 p-5"><textarea className="input min-h-[140px]" placeholder="Write your answer here" value={text} onChange={(e) => setText(e.target.value)} aria-label="Your answer" />
          <div><label className="label" htmlFor="af">Attach a file (optional)</label><input id="af" type="file" accept=".pdf,.zip,.png,.jpg,.jpeg,.txt,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" /></div>
          <button className="btn-primary" disabled={busy || (!text.trim() && !file && !sub?.file_path)}>{busy && <Spinner className="h-4 w-4 text-current" />}{sub ? 'Resubmit' : 'Submit assignment'}</button></form>)}
    </div>);
}

/* ───────────── Notes & discussion ───────────── */
function Notes({ lesson, reload }) {
  const toast = useToast(); const [t, setT] = useState('');
  const add = async (e) => { e.preventDefault(); try { await api(`/lessons/${lesson.id}/notes`, { method: 'POST', body: { body: t } }); setT(''); reload(); } catch (x) { toast(x.message, 'error'); } };
  const del = async (id) => { await api(`/notes/${id}`, { method: 'DELETE' }); reload(); };
  return (<div className="space-y-4"><form onSubmit={add} className="flex gap-2"><input className="input" placeholder="Add a private note" value={t} onChange={(e) => setT(e.target.value)} aria-label="Note" /><button className="btn-primary" disabled={!t.trim()}>Save</button></form>
    {lesson.notes?.length ? <ul className="space-y-2">{lesson.notes.map((n) => <li key={n.id} className="card flex items-start gap-3 p-3 text-sm"><span className="flex-1 whitespace-pre-line">{n.body}<span className="mt-1 block text-xs text-ink-400">{timeAgo(n.created_at)}</span></span><button onClick={() => del(n.id)} aria-label="Delete note" className="text-ink-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></li>)}</ul> : <p className="text-sm text-ink-500">Your notes for this lesson are private to you.</p>}</div>);
}
function Discussion({ lesson }) {
  const toast = useToast(); const { user, isStaff } = useAuth(); const s = useApi(`/lessons/${lesson.id}/discussions`); const [t, setT] = useState(''); const [reply, setReply] = useState(null);
  const post = async (e, parent = null) => { e.preventDefault(); try { await api(`/lessons/${lesson.id}/discussions`, { method: 'POST', body: { body: t, parent_id: parent } }); setT(''); setReply(null); s.reload(); } catch (x) { toast(x.message, 'error'); } };
  const del = async (id) => { await api(`/discussions/${id}`, { method: 'DELETE' }); s.reload(); };
  const Item = ({ d, depth = 0 }) => (<li className={depth ? 'ml-8' : ''}><div className="flex gap-3"><Avatar src={d.profiles?.avatar_url} name={d.profiles?.full_name} size={32} /><div className="min-w-0 flex-1"><p className="text-sm"><strong className="text-ink-900">{d.profiles?.full_name}</strong> <span className="text-xs text-ink-400">{timeAgo(d.created_at)}</span></p><p className="whitespace-pre-line text-sm text-ink-700">{d.body}</p>
    <div className="mt-1 flex gap-3 text-xs text-ink-500">{!depth && <button onClick={() => setReply(reply === d.id ? null : d.id)}>Reply</button>}{(d.user_id === user.id || isStaff) && <button onClick={() => del(d.id)}>Delete</button>}</div>
    {reply === d.id && <form onSubmit={(e) => post(e, d.id)} className="mt-2 flex gap-2"><input className="input" value={t} onChange={(e) => setT(e.target.value)} placeholder="Write a reply" aria-label="Reply" /><button className="btn-primary btn-sm" disabled={!t.trim()}>Reply</button></form>}</div></div></li>);
  const roots = (s.data || []).filter((d) => !d.parent_id);
  return (<div className="space-y-4"><form onSubmit={(e) => post(e)} className="flex gap-2"><input className="input" placeholder="Ask a question or share a thought" value={reply ? '' : t} onChange={(e) => { setReply(null); setT(e.target.value); }} aria-label="New comment" /><button className="btn-primary" disabled={!t.trim() || !!reply}>Post</button></form>
    {s.loading && !s.data ? <Spinner /> : roots.length ? <ul className="space-y-4">{roots.map((d) => <div key={d.id} className="space-y-3"><Item d={d} />{(s.data || []).filter((r) => r.parent_id === d.id).map((r) => <Item key={r.id} d={r} depth={1} />)}</div>)}</ul> : <p className="text-sm text-ink-500">No comments yet. Be the first to start the conversation.</p>}</div>);
}

/* ───────────── Lesson view ───────────── */
function LessonView({ lessonId, flat, onNav, onProgress, courseSlug }) {
  const s = useApi(`/lessons/${lessonId}`); const toast = useToast(); const [tab, setTab] = useState('notes'); const lastSave = useRef(0);
  useEffect(() => { setTab('notes'); }, [lessonId]);
  const idx = flat.findIndex((l) => l.id === lessonId); const prev = flat[idx - 1]; const next = flat[idx + 1];

  const save = (sec, ended) => { if (ended) return; if (sec != null && Date.now() - lastSave.current > 15000) { lastSave.current = Date.now(); api(`/lessons/${lessonId}/progress`, { method: 'POST', body: { position: sec } }).catch(() => {}); } };
  const complete = async (val) => { try { const r = await api(`/lessons/${lessonId}/progress`, { method: 'POST', body: { completed: val } }); s.setData((d) => ({ ...d, progress: { ...d.progress, completed: val } })); onProgress(); if (val && r.progress && +r.progress.percent >= 100) toast('Course complete! Claim your certificate from the sidebar.'); } catch (e) { toast(e.message, 'error'); } };
  const bookmark = async () => { try { const r = await api(`/lessons/${lessonId}/bookmark`, { method: 'POST' }); s.setData((d) => ({ ...d, bookmarked: r.bookmarked })); toast(r.bookmarked ? 'Bookmarked' : 'Bookmark removed'); } catch (e) { toast(e.message, 'error'); } };

  return (
    <Async state={s}>{(l) => (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-semibold sm:text-3xl">{l.title}</h1>
          <div className="flex gap-2"><button className="btn-outline btn-sm" onClick={bookmark} aria-pressed={l.bookmarked}>{l.bookmarked ? <BookmarkCheck className="h-4 w-4 text-brand-600" /> : <Bookmark className="h-4 w-4" />}{l.bookmarked ? 'Saved' : 'Bookmark'}</button>
            {['video', 'text'].includes(l.type) && <button className={l.progress?.completed ? 'btn-outline btn-sm' : 'btn-primary btn-sm'} onClick={() => complete(!l.progress?.completed)}>{l.progress?.completed ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" />Completed</> : <><Check className="h-4 w-4" />Mark complete</>}</button>}</div></div>
        {['video', 'text'].includes(l.type) && <LessonMedia lesson={l} onProgress={save} startAt={l.progress?.last_position_seconds} />}
        {l.type === 'video' && l.body_html && <RichText html={l.body_html} />}
        {l.type === 'quiz' && <Quiz lesson={l} onPassed={onProgress} reload={() => { s.reload(); onProgress(); }} />}
        {l.type === 'assignment' && <Assignment lesson={l} reload={() => { s.reload(); onProgress(); }} />}
        <div className="flex justify-between gap-3 border-t border-ink-200 pt-4"><button className="btn-outline" disabled={!prev} onClick={() => onNav(prev.id)}><ChevronLeft className="h-4 w-4" />Previous</button><button className="btn-primary" disabled={!next} onClick={() => onNav(next.id)}>Next<ChevronRight className="h-4 w-4" /></button></div>
        <section><Tabs value={tab} onChange={setTab} tabs={[{ id: 'notes', label: 'My notes' }, { id: 'resources', label: `Resources${l.resources?.length ? ` (${l.resources.length})` : ''}` }, { id: 'discussion', label: 'Discussion' }]} />
          {tab === 'notes' && <Notes lesson={l} reload={s.reload} />}
          {tab === 'resources' && (l.resources?.length ? <ul className="space-y-2">{l.resources.map((r) => <li key={r.id}><a href={r.url} className="card flex items-center gap-3 p-3 text-sm hover:bg-ink-50"><Download className="h-4 w-4 text-brand-600" /><span className="flex-1">{r.name}</span>{r.size_bytes && <span className="text-xs text-ink-400">{(r.size_bytes / 1048576).toFixed(1)} MB</span>}</a></li>)}</ul> : <p className="text-sm text-ink-500">No downloads for this lesson.</p>)}
          {tab === 'discussion' && <Discussion lesson={l} />}</section>
      </div>)}</Async>
  );
}

/* ───────────── Page ───────────── */
export default function Learn() {
  const { slug } = useParams(); const [sp, setSp] = useSearchParams(); const toast = useToast();
  const s = useApi(`/learn/${slug}`); const [menu, setMenu] = useState(false); const [claiming, setClaiming] = useState(false); const [rating, setRating] = useState(0);
  const flat = useMemo(() => (s.data ? s.data.modules.flatMap((m) => m.lessons) : []), [s.data]);
  const current = sp.get('lesson') || s.data?.progress?.last_lesson_id || flat[0]?.id;
  const go = (id) => { setSp({ lesson: id }, { replace: false }); setMenu(false); window.scrollTo(0, 0); };
  const refresh = useCallback(() => { s.reload(); }, [s.reload]); // eslint-disable-line

  const claim = async () => { setClaiming(true); try { await api('/certificates/claim', { method: 'POST', body: { courseId: s.data.course.id } }); toast('Certificate issued'); s.reload(); } catch (e) { toast(e.message, 'error'); } setClaiming(false); };
  const review = async (r) => { setRating(r); try { await api(`/courses/${s.data.course.id}/reviews`, { method: 'POST', body: { rating: r } }); toast('Thanks for rating this course'); } catch (e) { toast(e.message, 'error'); } };

  const sidebar = (d) => (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-ink-100 p-4"><p className="text-sm font-semibold text-ink-900">{Math.round(+d.progress.percent)}% complete</p><Progress value={d.progress.percent} /><p className="text-xs text-ink-500">{d.progress.completed_lessons} of {d.progress.total_lessons} lessons</p></div>
      <nav className="flex-1 overflow-y-auto" aria-label="Course curriculum">{d.modules.map((m) => (
        <details key={m.id} open={m.lessons.some((l) => l.id === current) || d.modules.length <= 2} className="border-b border-ink-100"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink-900">{m.title}</summary>
          <ul>{m.lessons.map((l) => { const I = icons[l.type]; const on = l.id === current; return (
            <li key={l.id}><button onClick={() => go(l.id)} aria-current={on ? 'true' : undefined} className={cx('flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm', on ? 'bg-brand-50 text-brand-800' : 'hover:bg-ink-50')}>
              {l.completed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />}<span className="flex-1">{l.title}<span className="mt-0.5 flex items-center gap-1 text-xs text-ink-400"><I className="h-3 w-3" />{l.type}{l.duration_seconds > 0 && ` · ${duration(l.duration_seconds)}`}</span></span></button></li>); })}</ul></details>))}</nav>
      <div className="space-y-3 border-t border-ink-100 p-4">
        {d.course.certificate_enabled && (d.certificate ? <Link to="/app/certificates" className="btn-primary w-full"><Award className="h-4 w-4" />View certificate</Link> : <button className="btn-outline w-full" onClick={claim} disabled={claiming || +d.progress.percent < 100}>{claiming ? <Spinner className="h-4 w-4" /> : <Award className="h-4 w-4" />}Claim certificate</button>)}
        {d.course.certificate_enabled && !d.certificate && +d.progress.percent < 100 && <p className="text-xs text-ink-400">Finish every lesson to unlock your certificate.</p>}
        {+d.progress.percent >= 100 && <div><p className="mb-1 text-xs text-ink-500">Rate this course</p><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => review(n)} aria-label={`${n} stars`} className={cx('text-xl', n <= rating ? 'text-amber-500' : 'text-ink-300')}>★</button>)}</div></div>}
      </div>
    </div>);

  return (
    <div className="min-h-screen bg-ink-50">
      <Async state={s}>{(d) => (
        <>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-100 bg-surface px-4">
            <Link to="/app/courses" className="btn-ghost btn-sm px-2" aria-label="Back to my courses"><ArrowLeft className="h-4 w-4" /></Link>
            <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-ink-900">{d.course.title}</h2>
            <button className="btn-outline btn-sm lg:hidden" onClick={() => setMenu(true)}><Menu className="h-4 w-4" />Lessons</button>
          </header>
          <div className="lg:grid lg:grid-cols-[1fr_340px]">
            <main className="min-w-0 px-4 py-6 sm:px-8">{current ? <LessonView key={current} lessonId={current} flat={flat} onNav={go} onProgress={refresh} courseSlug={slug} /> : <p className="text-ink-500">This course has no lessons yet.</p>}</main>
            <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] border-l border-ink-100 bg-surface lg:block">{sidebar(d)}</aside>
          </div>
          {menu && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-night/40" onClick={() => setMenu(false)} /><aside className="absolute inset-y-0 right-0 w-[88%] max-w-sm bg-surface shadow-pop"><button className="btn-ghost btn-sm absolute right-2 top-2 z-10" onClick={() => setMenu(false)} aria-label="Close"><X className="h-4 w-4" /></button>{sidebar(d)}</aside></div>}
        </>)}</Async>
    </div>
  );
}
