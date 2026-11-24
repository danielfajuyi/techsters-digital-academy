import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, PlayCircle, FileText, HelpCircle, ClipboardList, Upload, Eye, Pencil } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Async, Badge, Confirm, EmptyState, Field, Modal, Spinner, StatusBadge, Tabs, cx } from '../../components/ui/index.jsx';
import { fromMinor, toMinor } from '../../lib/format.js';

const icons = { video: PlayCircle, text: FileText, quiz: HelpCircle, assignment: ClipboardList };
const lines = (a = []) => a.join('\n');
const uid = () => Math.random().toString(36).slice(2, 8);

/* ───────── Details tab ───────── */
function Details({ data, reload }) {
  const { isAdmin } = useAuth(); const toast = useToast(); const c = data.course; const cats = useApi('/categories', { auth: false }); const fileRef = useRef(null);
  const [f, setF] = useState({}); const [busy, setBusy] = useState(false); const [up, setUp] = useState(false);
  useEffect(() => setF({ title: c.title, subtitle: c.subtitle || '', description: c.description || '', category_id: c.category_id || '', level: c.level, language: c.language, price: fromMinor(c.price_minor), compare: c.compare_at_minor ? fromMinor(c.compare_at_minor) : '', certificate_enabled: c.certificate_enabled, is_featured: c.is_featured, access_days: c.access_days || '', thumbnail_url: c.thumbnail_url || '', requirements: lines(data.requirements), outcomes: lines(data.outcomes) }), [c, data]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const split = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean);
      await api(`/staff/courses/${c.id}`, { method: 'PATCH', body: { title: f.title, subtitle: f.subtitle || null, description: f.description, category_id: f.category_id || null, level: f.level, language: f.language, price_minor: toMinor(f.price), compare_at_minor: f.compare ? toMinor(f.compare) : null, certificate_enabled: f.certificate_enabled, access_days: f.access_days ? +f.access_days : null, thumbnail_url: f.thumbnail_url || null, ...(isAdmin ? { is_featured: f.is_featured } : {}), requirements: split(f.requirements), outcomes: split(f.outcomes) } });
      toast('Course saved'); reload();
    } catch (x) { toast(x.message, 'error'); } setBusy(false);
  };
  const upload = async (file) => {
    if (!file) return; if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) return toast('Use a JPG, PNG or WebP under 5 MB', 'error');
    setUp(true); try { const path = `${c.id}/${Date.now()}.${file.type.split('/')[1]}`; const { error } = await supabase.storage.from('course-thumbnails').upload(path, file, { contentType: file.type, upsert: true }); if (error) throw error; setF((p) => ({ ...p, thumbnail_url: supabase.storage.from('course-thumbnails').getPublicUrl(path).data.publicUrl })); toast('Thumbnail uploaded. Save to apply.'); } catch (x) { toast(x.message, 'error'); } setUp(false);
  };
  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card space-y-4 p-5">
        <Field label="Title" htmlFor="t"><input id="t" required minLength={3} className="input" value={f.title || ''} onChange={set('title')} /></Field>
        <Field label="Subtitle" htmlFor="s" hint="One line shown on course cards"><input id="s" className="input" value={f.subtitle || ''} onChange={set('subtitle')} /></Field>
        <Field label="Description" htmlFor="d" hint="Basic HTML is allowed: p, strong, em, ul, ol, li, h2, h3, a"><textarea id="d" className="input min-h-[180px] font-mono text-[13px]" value={f.description || ''} onChange={set('description')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="What students will learn" hint="One per line"><textarea className="input min-h-[120px]" value={f.outcomes || ''} onChange={set('outcomes')} /></Field><Field label="Requirements" hint="One per line"><textarea className="input min-h-[120px]" value={f.requirements || ''} onChange={set('requirements')} /></Field></div>
      </div>
      <div className="space-y-4">
        <div className="card space-y-3 p-5"><p className="label">Thumbnail</p>{f.thumbnail_url ? <img src={f.thumbnail_url} alt="" className="aspect-video w-full rounded-lg object-cover" /> : <div className="grid aspect-video place-items-center rounded-lg bg-ink-100 text-sm text-ink-400">No thumbnail</div>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} /><button type="button" className="btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={up}>{up ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}Upload image</button></div>
        <div className="card space-y-4 p-5">
          <Field label="Category" htmlFor="cat"><select id="cat" className="input" value={f.category_id || ''} onChange={set('category_id')}><option value="">None</option>{cats.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Level" htmlFor="lv"><select id="lv" className="input" value={f.level || 'beginner'} onChange={set('level')}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Price (₦)" htmlFor="p" hint="0 = free"><input id="p" type="number" min="0" step="1" className="input" value={f.price ?? 0} onChange={set('price')} /></Field><Field label="Was (₦)" htmlFor="cp" hint="Optional strike-through"><input id="cp" type="number" min="0" className="input" value={f.compare ?? ''} onChange={set('compare')} /></Field></div>
          <Field label="Access (days)" htmlFor="ad" hint="Blank = lifetime"><input id="ad" type="number" min="1" className="input" value={f.access_days ?? ''} onChange={set('access_days')} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.certificate_enabled} onChange={set('certificate_enabled')} />Issue certificates</label>
          {isAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.is_featured} onChange={set('is_featured')} />Feature on homepage</label>}
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Save changes</button>
      </div>
    </form>
  );
}

/* ───────── Lesson editor modal ───────── */
function LessonEditor({ lesson, onClose, reload }) {
  const toast = useToast(); const l = lesson; const c = l.content || {}; const fileRef = useRef(null); const vidRef = useRef(null);
  const [f, setF] = useState({ title: l.title, duration: Math.round(l.duration_seconds / 60), is_preview: l.is_preview, video_provider: c.video_provider || 'youtube', video_url: c.video_url || '', body_html: c.body_html || '' });
  const [quiz, setQuiz] = useState(l.quiz ? { passing_score: l.quiz.passing_score, time_limit_minutes: l.quiz.time_limit_minutes || '', max_attempts: l.quiz.max_attempts || '', is_required: l.quiz.is_required, questions: l.quiz.questions.map((q) => ({ ...q })) } : null);
  const [asg, setAsg] = useState(l.assignment ? { ...l.assignment, due_at: l.assignment.due_at ? l.assignment.due_at.slice(0, 16) : '' } : null);
  const [busy, setBusy] = useState(false); const [up, setUp] = useState(false); const [res, setRes] = useState(l.resources || []);

  const upFile = async (file, kind) => {
    if (!file) return; setUp(true);
    try {
      const u = await api(`/staff/lessons/${l.id}/upload-url`, { method: 'POST', body: { filename: file.name } });
      const { error } = await supabase.storage.from('course-resources').uploadToSignedUrl(u.path, u.token, file); if (error) throw error;
      if (kind === 'video') setF((p) => ({ ...p, video_provider: 'storage', video_url: u.path }));
      else { const r = await api(`/staff/lessons/${l.id}/resources`, { method: 'POST', body: { name: file.name, path: u.path, size_bytes: file.size, mime_type: file.type || null } }); setRes((x) => [...x, r]); }
      toast('Uploaded');
    } catch (x) { toast(x.message || 'Upload failed', 'error'); } setUp(false);
  };
  const delRes = async (r) => { await api(`/staff/resources/${r.id}`, { method: 'DELETE' }); setRes((x) => x.filter((y) => y.id !== r.id)); };

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { title: f.title, duration_seconds: Math.round(+f.duration * 60) || 0, is_preview: f.is_preview };
      if (l.type === 'video' || l.type === 'text') Object.assign(body, { video_provider: f.video_url ? f.video_provider : null, video_url: f.video_url || null, body_html: f.body_html || null });
      if (l.type === 'quiz' && quiz) body.quiz = { passing_score: +quiz.passing_score, time_limit_minutes: quiz.time_limit_minutes ? +quiz.time_limit_minutes : null, max_attempts: quiz.max_attempts ? +quiz.max_attempts : null, is_required: quiz.is_required, questions: quiz.questions.map(({ id, lesson_id, position, ...q }) => ({ ...q, points: +q.points || 1 })) };
      if (l.type === 'assignment' && asg) body.assignment = { instructions: asg.instructions || '', due_at: asg.due_at ? new Date(asg.due_at).toISOString() : null, max_score: +asg.max_score || 100, allow_resubmission: asg.allow_resubmission, is_required: asg.is_required };
      await api(`/staff/lessons/${l.id}`, { method: 'PUT', body }); toast('Lesson saved'); reload(); onClose();
    } catch (x) { toast(x.details?.fieldErrors ? 'Check the highlighted fields: ' + Object.keys(x.details.fieldErrors).join(', ') : x.message, 'error'); } setBusy(false);
  };

  const addQ = (type) => setQuiz((q) => ({ ...q, questions: [...q.questions, { type, prompt: '', points: 1, explanation: '', options: type === 'true_false' ? [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }] : [{ id: 'a', text: '' }, { id: 'b', text: '' }], correct: type === 'true_false' ? ['true'] : ['a'] }] }));
  const upQ = (i, patch) => setQuiz((q) => ({ ...q, questions: q.questions.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
  const toggleCorrect = (i, id) => { const q = quiz.questions[i]; if (q.type === 'multiple') upQ(i, { correct: q.correct.includes(id) ? q.correct.filter((x) => x !== id) : [...q.correct, id] }); else upQ(i, { correct: [id] }); };

  return (
    <Modal open onClose={onClose} title={`Edit ${l.type} lesson`} wide>
      <form onSubmit={save} className="space-y-4">
        <Field label="Title" htmlFor="lt"><input id="lt" required className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Duration (minutes)" htmlFor="ld"><input id="ld" type="number" min="0" className="input" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
          <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_preview} onChange={(e) => setF({ ...f, is_preview: e.target.checked })} />Free preview</label></div>

        {l.type === 'video' && <div className="space-y-3 rounded-lg bg-ink-50 p-3"><div className="grid gap-3 sm:grid-cols-[160px_1fr]"><Field label="Video source" htmlFor="vp"><select id="vp" className="input" value={f.video_provider} onChange={(e) => setF({ ...f, video_provider: e.target.value })}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="bunny">Bunny Stream</option><option value="mux">Mux</option><option value="external">Other (https embed)</option><option value="storage">Uploaded file</option></select></Field>
          <Field label={f.video_provider === 'storage' ? 'Uploaded file' : 'Video link or ID'} htmlFor="vu" hint={f.video_provider === 'bunny' || f.video_provider === 'mux' ? 'Paste the provider’s embed URL (https://…)' : undefined}><input id="vu" className="input" value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} readOnly={f.video_provider === 'storage'} /></Field></div>
          <input ref={vidRef} type="file" accept="video/mp4" className="sr-only" onChange={(e) => upFile(e.target.files?.[0], 'video')} /><button type="button" className="btn-outline btn-sm" onClick={() => vidRef.current?.click()} disabled={up}>{up ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}Upload MP4 (small files)</button>
          <p className="text-xs text-ink-500">For long or large videos use YouTube (unlisted), Vimeo, Bunny or Mux. Uploads are limited by your Supabase plan's file size limit.</p></div>}
        {(l.type === 'video' || l.type === 'text') && <Field label={l.type === 'text' ? 'Lesson content' : 'Notes under the video (optional)'} htmlFor="lb" hint="Basic HTML allowed"><textarea id="lb" className="input min-h-[160px] font-mono text-[13px]" value={f.body_html} onChange={(e) => setF({ ...f, body_html: e.target.value })} /></Field>}

        {l.type === 'quiz' && quiz && <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3"><Field label="Pass mark (%)"><input type="number" min="1" max="100" className="input" value={quiz.passing_score} onChange={(e) => setQuiz({ ...quiz, passing_score: e.target.value })} /></Field><Field label="Time (min)" hint="Blank = none"><input type="number" min="1" className="input" value={quiz.time_limit_minutes} onChange={(e) => setQuiz({ ...quiz, time_limit_minutes: e.target.value })} /></Field><Field label="Max attempts" hint="Blank = unlimited"><input type="number" min="1" className="input" value={quiz.max_attempts} onChange={(e) => setQuiz({ ...quiz, max_attempts: e.target.value })} /></Field></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={quiz.is_required} onChange={(e) => setQuiz({ ...quiz, is_required: e.target.checked })} />Required for certificate</label>
          {quiz.questions.map((q, i) => (
            <div key={i} className="space-y-3 rounded-lg bg-ink-50 p-3"><div className="flex items-start gap-2"><span className="mt-2 text-sm font-semibold">{i + 1}.</span><input className="input flex-1" placeholder="Question" value={q.prompt} onChange={(e) => upQ(i, { prompt: e.target.value })} aria-label={`Question ${i + 1}`} /><button type="button" className="btn-ghost btn-sm px-2" onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, k) => k !== i) })} aria-label="Remove question"><Trash2 className="h-4 w-4" /></button></div>
              <Badge>{q.type === 'multiple' ? 'Multiple select' : q.type === 'true_false' ? 'True / false' : 'Single choice'}</Badge>
              {q.options.map((o, k) => (<div key={o.id} className="flex items-center gap-2"><input type={q.type === 'multiple' ? 'checkbox' : 'radio'} name={`c${i}`} checked={q.correct.includes(o.id)} onChange={() => toggleCorrect(i, o.id)} aria-label="Correct answer" />
                <input className="input" value={o.text} readOnly={q.type === 'true_false'} placeholder={`Option ${k + 1}`} onChange={(e) => upQ(i, { options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} />
                {q.type !== 'true_false' && q.options.length > 2 && <button type="button" onClick={() => upQ(i, { options: q.options.filter((x) => x.id !== o.id), correct: q.correct.filter((x) => x !== o.id) })} aria-label="Remove option"><Trash2 className="h-4 w-4 text-ink-400" /></button>}</div>))}
              {q.type !== 'true_false' && q.options.length < 8 && <button type="button" className="text-sm font-medium text-brand-700" onClick={() => upQ(i, { options: [...q.options, { id: uid(), text: '' }] })}>+ Add option</button>}
              <input className="input" placeholder="Explanation shown after submission (optional)" value={q.explanation || ''} onChange={(e) => upQ(i, { explanation: e.target.value })} /></div>))}
          <div className="flex flex-wrap gap-2"><button type="button" className="btn-outline btn-sm" onClick={() => addQ('single')}>+ Single choice</button><button type="button" className="btn-outline btn-sm" onClick={() => addQ('multiple')}>+ Multiple select</button><button type="button" className="btn-outline btn-sm" onClick={() => addQ('true_false')}>+ True / false</button></div></div>}

        {l.type === 'assignment' && asg && <div className="space-y-3"><Field label="Instructions" hint="Basic HTML allowed"><textarea className="input min-h-[140px]" value={asg.instructions} onChange={(e) => setAsg({ ...asg, instructions: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Deadline"><input type="datetime-local" className="input" value={asg.due_at} onChange={(e) => setAsg({ ...asg, due_at: e.target.value })} /></Field><Field label="Max score"><input type="number" min="1" className="input" value={asg.max_score} onChange={(e) => setAsg({ ...asg, max_score: e.target.value })} /></Field></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asg.allow_resubmission} onChange={(e) => setAsg({ ...asg, allow_resubmission: e.target.checked })} />Allow resubmission</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asg.is_required} onChange={(e) => setAsg({ ...asg, is_required: e.target.checked })} />Required for certificate</label></div>}

        <div><p className="label">Downloadable resources</p>{res.map((r) => <div key={r.id} className="mb-1 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm"><span className="truncate">{r.name}</span><button type="button" onClick={() => delRes(r)} aria-label={`Delete ${r.name}`}><Trash2 className="h-4 w-4 text-ink-400" /></button></div>)}
          <input ref={fileRef} type="file" className="sr-only" accept=".pdf,.zip,.png,.jpg,.jpeg,.txt,.docx,.pptx" onChange={(e) => upFile(e.target.files?.[0], 'resource')} /><button type="button" className="btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={up}>{up ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}Add file</button></div>
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Save lesson</button></div>
      </form>
    </Modal>
  );
}

/* ───────── Curriculum tab ───────── */
function Curriculum({ data, reload }) {
  const toast = useToast(); const cid = data.course.id; const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const [mTitle, setMTitle] = useState(''); const [addL, setAddL] = useState(null);
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); reload(); } catch (x) { toast(x.message, 'error'); } };
  const addModule = (e) => { e.preventDefault(); run(async () => { await api(`/staff/courses/${cid}/modules`, { method: 'POST', body: { title: mTitle } }); setMTitle(''); }, 'Module added'); };
  const move = (list, i, dir, kind, moduleId) => { const ids = list.map((x) => x.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; run(() => api(`/staff/courses/${cid}/reorder`, { method: 'POST', body: kind === 'module' ? { modules: ids } : { lessons: { [moduleId]: ids } } })); };
  const rename = (m) => { const t = window.prompt('Module title', m.title); if (t && t.trim()) run(() => api(`/staff/modules/${m.id}`, { method: 'PATCH', body: { title: t.trim() } })); };
  const [newL, setNewL] = useState({ title: '', type: 'video' });
  const addLesson = (e) => { e.preventDefault(); run(async () => { const l = await api(`/staff/modules/${addL}/lessons`, { method: 'POST', body: newL }); setAddL(null); setNewL({ title: '', type: 'video' }); }, 'Lesson added'); };
  return (
    <div className="space-y-4">
      {data.modules.length === 0 && <EmptyState title="Build your curriculum">Add a module, then add lessons: video, text, quiz or assignment.</EmptyState>}
      {data.modules.map((m, mi) => (
        <div key={m.id} className="card">
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3"><h3 className="flex-1 font-semibold text-ink-900">{m.title}</h3>
            <button className="btn-ghost btn-sm px-2" onClick={() => move(data.modules, mi, -1, 'module')} disabled={mi === 0} aria-label="Move module up"><ChevronUp className="h-4 w-4" /></button><button className="btn-ghost btn-sm px-2" onClick={() => move(data.modules, mi, 1, 'module')} disabled={mi === data.modules.length - 1} aria-label="Move module down"><ChevronDown className="h-4 w-4" /></button>
            <button className="btn-ghost btn-sm px-2" onClick={() => rename(m)} aria-label="Rename module"><Pencil className="h-4 w-4" /></button><button className="btn-ghost btn-sm px-2" onClick={() => setDel({ kind: 'module', id: m.id, name: m.title })} aria-label="Delete module"><Trash2 className="h-4 w-4" /></button></div>
          <ul>{m.lessons.map((l, li) => { const I = icons[l.type]; return (
            <li key={l.id} className="flex items-center gap-3 border-b border-ink-100 px-4 py-2.5 last:border-0"><I className="h-4 w-4 text-ink-400" /><button className="flex-1 text-left text-sm font-medium text-ink-800 hover:text-brand-700" onClick={() => setEdit(l)}>{l.title}</button>{l.is_preview && <Badge tone="blue">Preview</Badge>}<span className="hidden text-xs capitalize text-ink-400 sm:block">{l.type}</span>
              <button className="btn-ghost btn-sm px-2" onClick={() => move(m.lessons, li, -1, 'lesson', m.id)} disabled={li === 0} aria-label="Move lesson up"><ChevronUp className="h-4 w-4" /></button><button className="btn-ghost btn-sm px-2" onClick={() => move(m.lessons, li, 1, 'lesson', m.id)} disabled={li === m.lessons.length - 1} aria-label="Move lesson down"><ChevronDown className="h-4 w-4" /></button>
              <button className="btn-ghost btn-sm px-2" onClick={() => setDel({ kind: 'lesson', id: l.id, name: l.title })} aria-label="Delete lesson"><Trash2 className="h-4 w-4" /></button></li>); })}</ul>
          <div className="px-4 py-3"><button className="text-sm font-medium text-brand-700" onClick={() => setAddL(m.id)}>+ Add lesson</button></div>
        </div>))}
      <form onSubmit={addModule} className="flex gap-2"><input className="input max-w-sm" required placeholder="New module title" value={mTitle} onChange={(e) => setMTitle(e.target.value)} aria-label="New module title" /><button className="btn-outline"><Plus className="h-4 w-4" />Add module</button></form>
      <Modal open={!!addL} onClose={() => setAddL(null)} title="Add lesson"><form onSubmit={addLesson} className="space-y-4"><Field label="Title" htmlFor="nl"><input id="nl" autoFocus required className="input" value={newL.title} onChange={(e) => setNewL({ ...newL, title: e.target.value })} /></Field>
        <Field label="Type" htmlFor="nt"><select id="nt" className="input" value={newL.type} onChange={(e) => setNewL({ ...newL, type: e.target.value })}><option value="video">Video</option><option value="text">Text / reading</option><option value="quiz">Quiz</option><option value="assignment">Assignment</option></select></Field><button className="btn-primary w-full">Add lesson</button></form></Modal>
      {edit && <LessonEditor lesson={edit} onClose={() => setEdit(null)} reload={reload} />}
      <Confirm open={!!del} danger onClose={() => setDel(null)} title={`Delete ${del?.kind}?`} confirmLabel="Delete" onConfirm={() => run(async () => { await api(`/staff/${del.kind === 'module' ? 'modules' : 'lessons'}/${del.id}`, { method: 'DELETE' }); setDel(null); }, 'Deleted')}>“{del?.name}” {del?.kind === 'module' ? 'and all its lessons ' : ''}will be permanently removed, including student progress on it.</Confirm>
    </div>
  );
}

/* ───────── Page ───────── */
export default function CourseEditor() {
  const { id } = useParams(); const s = useApi(`/staff/courses/${id}`); const toast = useToast(); const { isAdmin } = useAuth(); const [tab, setTab] = useState('details'); const [busy, setBusy] = useState(false); const [delOpen, setDelOpen] = useState(false);
  const setStatus = async (status) => { setBusy(true); try { await api(`/staff/courses/${id}`, { method: 'PATCH', body: { status } }); toast(status === 'published' ? 'Published' : status === 'draft' ? 'Unpublished' : 'Archived'); s.reload(); } catch (x) { toast(x.message, 'error'); } setBusy(false); };
  const remove = async () => { try { await api(`/staff/courses/${id}`, { method: 'DELETE' }); window.location.assign('/instructor/courses'); } catch (x) { toast(x.message, 'error'); setDelOpen(false); } };
  return (
    <Async state={s}>{(d) => (
      <>
        <Link to={isAdmin ? '/admin/courses' : '/instructor/courses'} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" />Courses</Link>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><h1 className="text-2xl font-semibold">{d.course.title}</h1><StatusBadge status={d.course.status} /></div>
          <div className="flex flex-wrap gap-2"><Link to={`/courses/${d.course.slug}`} className="btn-outline btn-sm"><Eye className="h-4 w-4" />Preview</Link>
            {d.course.status !== 'published' ? <button className="btn-primary btn-sm" onClick={() => setStatus('published')} disabled={busy}>Publish</button> : <button className="btn-outline btn-sm" onClick={() => setStatus('draft')} disabled={busy}>Unpublish</button>}
            {d.course.status !== 'archived' && <button className="btn-outline btn-sm" onClick={() => setStatus('archived')} disabled={busy}>Archive</button>}{isAdmin && <button className="btn-danger btn-sm" onClick={() => setDelOpen(true)}>Delete</button>}</div></div>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'details', label: 'Details & pricing' }, { id: 'curriculum', label: `Curriculum (${d.modules.reduce((a, m) => a + m.lessons.length, 0)} lessons)` }]} />
        {tab === 'details' ? <Details data={d} reload={s.reload} /> : <Curriculum data={d} reload={s.reload} />}
        <Confirm open={delOpen} danger onClose={() => setDelOpen(false)} onConfirm={remove} title="Delete this course?" confirmLabel="Delete course">This cannot be undone. Courses with enrolments or orders can't be deleted; archive them instead.</Confirm>
      </>)}</Async>
  );
}
