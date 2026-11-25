import { useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { PlayCircle, FileText, ClipboardList, HelpCircle, Lock, Check, Award, Clock, Layers, Tag } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Async, Avatar, CourseThumb, Modal, RichText, Spinner, Badge } from '../../components/ui/index.jsx';
import { money, duration } from '../../lib/format.js';

const icons = { video: PlayCircle, text: FileText, quiz: HelpCircle, assignment: ClipboardList };

function PreviewPlayer({ lessonId, onClose }) {
  const s = useApi(`/lessons/${lessonId}`);
  return (
    <Modal open onClose={onClose} title={s.data?.title || 'Preview'} wide>
      <Async state={s}>{(l) => <LessonMedia lesson={l} />}</Async>
    </Modal>
  );
}

export function LessonMedia({ lesson, onProgress, startAt = 0 }) {
  const v = lesson.video;
  if (!v?.url) {
    if (lesson.type === 'video') return <div className="grid aspect-video place-items-center rounded-xl bg-night p-6 text-center text-slate-300"><div><PlayCircle className="mx-auto h-10 w-10 text-brand-600" /><p className="mt-3 font-medium text-white">Video coming soon</p><p className="mt-1 text-sm">This lesson's video hasn't been added yet. Read the notes below in the meantime.</p></div></div>;
    return lesson.body_html ? <RichText html={lesson.body_html} /> : null;
  }
  if (v.provider === 'youtube') {
    const id = (/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(v.url) || [, v.url])[1];
    return <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} title={lesson.title} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen /></div>;
  }
  if (v.provider === 'vimeo') {
    const id = (/(\d{6,})/.exec(v.url) || [, v.url])[1];
    return <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe className="h-full w-full" src={`https://player.vimeo.com/video/${id}`} title={lesson.title} allow="fullscreen; picture-in-picture" allowFullScreen /></div>;
  }
  if (v.provider === 'storage') {
    return <video className="aspect-video w-full rounded-xl bg-black" controls controlsList="nodownload" preload="metadata" src={v.url}
      onLoadedMetadata={(e) => { if (startAt) e.currentTarget.currentTime = startAt; }}
      onTimeUpdate={(e) => onProgress?.(Math.floor(e.currentTarget.currentTime))} onEnded={() => onProgress?.(null, true)} />;
  }
  // bunny / mux / external: expect an https embed URL
  return <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe className="h-full w-full" src={v.url} title={lesson.title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>;
}

export default function CourseDetail() {
  const { slug } = useParams();
  const nav = useNavigate(); const loc = useLocation();
  const { user } = useAuth(); const toast = useToast();
  const s = useApi(`/courses/${slug}`);
  const [coupon, setCoupon] = useState(''); const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(null);

  const applyCoupon = async (c) => {
    try { setApplied(await api('/coupons/validate', { method: 'POST', body: { courseId: c.id, code: coupon } })); toast('Discount applied'); }
    catch (e) { setApplied(null); toast(e.message, 'error'); }
  };
  const enroll = async (c) => {
    if (!user) return nav(`/login?next=${encodeURIComponent(loc.pathname)}`);
    setBusy(true);
    try {
      const r = await api('/checkout', { method: 'POST', body: { courseId: c.id, couponCode: applied ? coupon : null } });
      if (r.enrolled) { toast("You're enrolled"); nav(`/learn/${r.slug}`); } else window.location.assign(r.authorization_url);
    } catch (e) { toast(e.message, 'error'); setBusy(false); }
  };

  return (
    <Async state={s}>{({ course: c, modules, requirements, outcomes, reviews, enrolled }) => {
      const total = applied ? applied.total_minor : c.price_minor;
      return (
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {c.status !== 'published' && <Badge tone="amber">Draft preview: only you can see this</Badge>}
            <p className="mt-2 text-sm text-ink-500">{c.course_categories?.name}</p>
            <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">{c.title}</h1>
            {c.subtitle && <p className="mt-3 text-lg text-ink-600">{c.subtitle}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
              {c.rating.count > 0 && <span>★ {c.rating.avg} ({c.rating.count} reviews)</span>}
              <span>{c.student_count} students</span><span className="capitalize">{c.level}</span><span>{c.language}</span>
            </div>
            {c.instructors.length > 0 && <p className="mt-3 text-sm text-ink-600">Taught by {c.instructors.map((i, k) => <span key={i.id}>{k > 0 && ', '}<Link className="font-medium text-brand-700" to={`/instructors/${i.id}`}>{i.full_name}</Link></span>)}</p>}

            {outcomes.length > 0 && <section className="card mt-8 p-6"><h2 className="text-xl font-semibold">What you'll learn</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{outcomes.map((o) => <li key={o.id} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{o.body}</li>)}</ul></section>}

            <section className="mt-10"><h2 className="text-2xl font-semibold">Curriculum</h2>
              <p className="mt-1 text-sm text-ink-500">{modules.length} modules · {c.lesson_count} lessons · {duration(c.duration_seconds)}</p>
              <div className="mt-4 space-y-3">{modules.map((m) => (
                <details key={m.id} className="card group" open={modules.length <= 3}>
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-ink-900"><span>{m.title}</span><span className="text-xs font-normal text-ink-500">{m.lessons.length} lessons</span></summary>
                  <ul className="border-t border-ink-100">{m.lessons.map((l) => { const I = icons[l.type]; return (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><I className="h-4 w-4 shrink-0 text-ink-400" /><span className="flex-1">{l.title}</span>
                      {l.is_preview && !enrolled ? <button className="font-medium text-brand-700" onClick={() => setPreview(l.id)}>Preview</button> : !enrolled && <Lock className="h-3.5 w-3.5 text-ink-300" aria-label="Locked" />}
                      {l.duration_seconds > 0 && <span className="text-xs text-ink-400">{duration(l.duration_seconds)}</span>}</li>); })}</ul>
                </details>))}</div>
            </section>

            <section className="mt-10"><h2 className="text-2xl font-semibold">About this course</h2><RichText className="mt-3" html={c.description} /></section>
            {requirements.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Requirements</h2><ul className="mt-3 list-disc space-y-1 pl-6">{requirements.map((r) => <li key={r.id}>{r.body}</li>)}</ul></section>}

            <section className="mt-10"><h2 className="text-2xl font-semibold">Reviews</h2>
              {reviews.length === 0 ? <p className="mt-2 text-ink-500">No reviews yet. Enrolled students can leave one.</p> : <div className="mt-4 space-y-4">{reviews.map((r) => (
                <div key={r.id} className="card p-4"><div className="flex items-center gap-3"><Avatar src={r.profiles?.avatar_url} name={r.profiles?.full_name} /><div><p className="text-sm font-semibold text-ink-900">{r.profiles?.full_name}</p><p className="text-xs text-ink-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p></div></div>{r.comment && <p className="mt-3 text-ink-600">{r.comment}</p>}</div>))}</div>}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card overflow-hidden">
              <CourseThumb src={c.thumbnail_url} title={c.title} className="aspect-video w-full" />
              <div className="space-y-4 p-5">
                <div className="flex items-baseline gap-3"><span className="font-display text-3xl font-semibold text-ink-900">{money(total, c.currency)}</span>
                  {(applied ? c.price_minor : c.compare_at_minor) > total && <span className="text-ink-400 line-through">{money(applied ? c.price_minor : c.compare_at_minor, c.currency)}</span>}</div>
                {enrolled ? <Link to={`/learn/${c.slug}`} className="btn-primary btn-lg w-full">Continue learning</Link> : (
                  <>
                    <button className="btn-primary btn-lg w-full" onClick={() => enroll(c)} disabled={busy}>{busy && <Spinner className="h-4 w-4 text-current" />}{c.price_minor === 0 ? 'Enroll for free' : 'Enroll now'}</button>
                    {c.price_minor > 0 && (
                      <div className="flex gap-2"><div className="relative flex-1"><Tag className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" /><input className="input pl-9" placeholder="Discount code" value={coupon} onChange={(e) => { setCoupon(e.target.value); setApplied(null); }} aria-label="Discount code" /></div>
                        <button className="btn-outline" disabled={!coupon.trim()} onClick={() => applyCoupon(c)}>Apply</button></div>)}
                  </>)}
                <ul className="space-y-2.5 border-t border-ink-100 pt-4 text-sm text-ink-600">
                  <li className="flex gap-2"><Clock className="h-4 w-4 text-ink-400" />{duration(c.duration_seconds)} of content</li>
                  <li className="flex gap-2"><Layers className="h-4 w-4 text-ink-400" />{c.lesson_count} lessons in {modules.length} modules</li>
                  {c.certificate_enabled && <li className="flex gap-2"><Award className="h-4 w-4 text-ink-400" />Verifiable certificate on completion</li>}
                  <li className="flex gap-2"><Check className="h-4 w-4 text-ink-400" />{c.access_days ? `${c.access_days} days of access` : 'Lifetime access'}</li>
                </ul>
              </div>
            </div>
          </aside>
          {preview && <PreviewPlayer lessonId={preview} onClose={() => setPreview(null)} />}
        </div>
      );
    }}</Async>
  );
}
