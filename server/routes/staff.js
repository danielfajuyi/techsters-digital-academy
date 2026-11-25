import { z } from 'zod';
import { admin, must } from '../lib/supabase.js';
import { bad, forbidden, notFound, slugify } from '../lib/http.js';
import { assertCourseManager, audit, notify } from '../lib/auth.js';
import { sanitizeHtml } from '../lib/sanitize.js';
import { sendEmail } from '../lib/email.js';

const isAdmin = (u) => u.roles.includes('admin');
const cleanFilename = (n) => n.replace(/[^\w.\-]+/g, '_').slice(0, 100);

async function courseOfModule(id) { const m = must(await admin().from('course_modules').select('course_id').eq('id', id).maybeSingle()); if (!m) throw notFound('Module not found'); return m.course_id; }
async function courseOfLesson(id) { const l = must(await admin().from('lessons').select('course_id,type').eq('id', id).maybeSingle()); if (!l) throw notFound('Lesson not found'); return l; }
async function canPublish(user) {
  if (isAdmin(user)) return true;
  const s = (await admin().from('platform_settings').select('value').eq('key', 'instructors_can_publish').maybeSingle()).data;
  return s?.value === true;
}

const courseSchema = z.object({
  title: z.string().trim().min(3).max(140), subtitle: z.string().trim().max(240).nullish(), description: z.string().max(20000).optional(),
  thumbnail_url: z.string().url().max(600).nullish(), category_id: z.string().uuid().nullish(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(), language: z.string().max(40).optional(),
  price_minor: z.number().int().min(0).max(1_000_000_000).optional(), compare_at_minor: z.number().int().min(0).nullish(),
  status: z.enum(['draft', 'published', 'archived']).optional(), is_featured: z.boolean().optional(),
  certificate_enabled: z.boolean().optional(), access_days: z.number().int().min(1).nullish(),
  requirements: z.array(z.string().trim().min(1).max(300)).max(20).optional(), outcomes: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
});

async function saveRequirements(courseId, d) {
  for (const [kind, arr] of [['requirement', d.requirements], ['outcome', d.outcomes]]) {
    if (!arr) continue;
    await admin().from('course_requirements').delete().eq('course_id', courseId).eq('kind', kind);
    if (arr.length) must(await admin().from('course_requirements').insert(arr.map((body, i) => ({ course_id: courseId, kind, body, position: i }))));
  }
}

const quizSchema = z.object({
  passing_score: z.number().int().min(1).max(100), time_limit_minutes: z.number().int().min(1).nullish(), max_attempts: z.number().int().min(1).nullish(), is_required: z.boolean().optional(),
  questions: z.array(z.object({ type: z.enum(['single', 'multiple', 'true_false']), prompt: z.string().trim().min(1).max(1000),
    options: z.array(z.object({ id: z.string().min(1).max(20), text: z.string().trim().min(1).max(500) })).min(2).max(8), correct: z.array(z.string()).min(1),
    explanation: z.string().max(1000).nullish(), points: z.number().int().min(1).max(100).optional() })).max(100),
});

export default [
  { method: 'GET', path: '/staff/courses', auth: 'staff', async handler({ user }) {
    let q = admin().from('courses').select('id,slug,title,thumbnail_url,status,price_minor,currency,is_featured,updated_at').order('updated_at', { ascending: false });
    if (!isAdmin(user)) { const ids = must(await admin().from('course_instructors').select('course_id').eq('user_id', user.id)).map((r) => r.course_id); if (!ids.length) return []; q = q.in('id', ids); }
    const courses = must(await q);
    const enr = courses.length ? must(await admin().from('enrollments').select('course_id').in('course_id', courses.map((c) => c.id)).neq('status', 'revoked')) : [];
    return courses.map((c) => ({ ...c, students: enr.filter((e) => e.course_id === c.id).length }));
  } },

  { method: 'POST', path: '/staff/courses', auth: 'staff', async handler({ user, body, ip }) {
    const s = courseSchema.safeParse(body); if (!s.success) throw bad('Check the course details', s.error.flatten());
    const { requirements, outcomes, status, is_featured, ...rest } = s.data;
    if (rest.description) rest.description = sanitizeHtml(rest.description);
    let slug = slugify(rest.title) || 'course';
    if ((await admin().from('courses').select('id').eq('slug', slug).maybeSingle()).data) slug += '-' + Math.random().toString(36).slice(2, 6);
    const c = must(await admin().from('courses').insert({ ...rest, slug, created_by: user.id, status: 'draft' }).select().single());
    must(await admin().from('course_instructors').insert({ course_id: c.id, user_id: user.id }));
    await saveRequirements(c.id, { requirements, outcomes }); await audit(user, 'course.create', 'course', c.id, { title: c.title }, ip);
    return c;
  } },

  { method: 'GET', path: '/staff/courses/:id', auth: 'staff', async handler({ user, params }) {
    await assertCourseManager(user, params.id);
    const c = must(await admin().from('courses').select('*').eq('id', params.id).maybeSingle()); if (!c) throw notFound('Course not found');
    const [modules, lessons, reqs, content, quizzes, qs, asg, res, ci] = await Promise.all([
      admin().from('course_modules').select('*').eq('course_id', c.id).order('position').then(must),
      admin().from('lessons').select('*').eq('course_id', c.id).order('position').then(must),
      admin().from('course_requirements').select('*').eq('course_id', c.id).order('position').then(must),
      admin().from('lesson_content').select('*, lessons!inner(course_id)').eq('lessons.course_id', c.id).then(must),
      admin().from('quizzes').select('*, lessons!inner(course_id)').eq('lessons.course_id', c.id).then(must),
      admin().from('quiz_questions').select('*, lessons!inner(course_id)').eq('lessons.course_id', c.id).order('position').then(must),
      admin().from('assignments').select('*, lessons!inner(course_id)').eq('lessons.course_id', c.id).then(must),
      admin().from('lesson_resources').select('*').eq('course_id', c.id).then(must),
      admin().from('course_instructors').select('user_id, profiles(full_name,email)').eq('course_id', c.id).then(must),
    ]);
    const strip = ({ lessons: _l, ...r }) => r;
    return { course: c, requirements: reqs.filter((r) => r.kind === 'requirement').map((r) => r.body), outcomes: reqs.filter((r) => r.kind === 'outcome').map((r) => r.body), instructors: ci,
      modules: modules.map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id).map((l) => ({ ...l, content: strip(content.find((x) => x.lesson_id === l.id) || {}),
        quiz: quizzes.find((x) => x.lesson_id === l.id) ? { ...strip(quizzes.find((x) => x.lesson_id === l.id)), questions: qs.filter((q) => q.lesson_id === l.id).map(strip) } : null,
        assignment: asg.find((x) => x.lesson_id === l.id) ? strip(asg.find((x) => x.lesson_id === l.id)) : null, resources: res.filter((r) => r.lesson_id === l.id) })) })) };
  } },

  { method: 'PATCH', path: '/staff/courses/:id', auth: 'staff', async handler({ user, params, body, ip }) {
    await assertCourseManager(user, params.id);
    const s = courseSchema.partial().safeParse(body); if (!s.success) throw bad('Check the course details', s.error.flatten());
    const { requirements, outcomes, ...rest } = s.data;
    if (rest.description != null) rest.description = sanitizeHtml(rest.description);
    if (!isAdmin(user)) delete rest.is_featured;                       // only admins feature courses
    if (rest.status === 'published') {
      if (!(await canPublish(user))) throw forbidden('An administrator must publish this course');
      const lc = (await admin().from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', params.id)).count ?? 0;
      if (lc === 0) throw bad('Add at least one lesson before publishing');
      rest.published_at = new Date().toISOString();
    }
    if (Object.keys(rest).length) must(await admin().from('courses').update(rest).eq('id', params.id));
    await saveRequirements(params.id, { requirements, outcomes });
    await audit(user, rest.status ? `course.${rest.status}` : 'course.update', 'course', params.id, { fields: Object.keys(rest) }, ip);
    return { ok: true };
  } },

  { method: 'DELETE', path: '/staff/courses/:id', auth: 'admin', async handler({ user, params, ip }) {
    const { count } = await admin().from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', params.id);
    if (count) throw bad(`This course has ${count} enrolment(s). Archive it instead of deleting so students keep access to their records.`);
    const { count: oc } = await admin().from('orders').select('id', { count: 'exact', head: true }).eq('course_id', params.id);
    if (oc) throw bad('This course has order history. Archive it instead of deleting.');
    must(await admin().from('courses').delete().eq('id', params.id)); await audit(user, 'course.delete', 'course', params.id, {}, ip); return { ok: true };
  } },

  { method: 'PUT', path: '/staff/courses/:id/instructors', auth: 'admin', async handler({ user, params, body, ip }) {
    const s = z.object({ userIds: z.array(z.string().uuid()).min(1) }).safeParse(body); if (!s.success) throw bad('Choose at least one instructor');
    const eligible = must(await admin().from('user_roles').select('user_id').in('user_id', s.data.userIds).in('role', ['instructor', 'admin'])).map((r) => r.user_id);
    const ids = s.data.userIds.filter((i) => eligible.includes(i)); if (!ids.length) throw bad('Selected users are not instructors');
    await admin().from('course_instructors').delete().eq('course_id', params.id);
    must(await admin().from('course_instructors').insert(ids.map((u) => ({ course_id: params.id, user_id: u })))); await audit(user, 'course.instructors', 'course', params.id, { ids }, ip); return { ok: true };
  } },

  // ───── modules ─────
  { method: 'POST', path: '/staff/courses/:id/modules', auth: 'staff', async handler({ user, params, body }) {
    await assertCourseManager(user, params.id);
    const s = z.object({ title: z.string().trim().min(1).max(140) }).safeParse(body); if (!s.success) throw bad('Give the module a title');
    const pos = (await admin().from('course_modules').select('id', { count: 'exact', head: true }).eq('course_id', params.id)).count ?? 0;
    return must(await admin().from('course_modules').insert({ course_id: params.id, title: s.data.title, position: pos }).select().single());
  } },
  { method: 'PATCH', path: '/staff/modules/:id', auth: 'staff', async handler({ user, params, body }) {
    await assertCourseManager(user, await courseOfModule(params.id));
    const s = z.object({ title: z.string().trim().min(1).max(140).optional(), position: z.number().int().min(0).optional() }).safeParse(body); if (!s.success) throw bad('Invalid module');
    must(await admin().from('course_modules').update(s.data).eq('id', params.id)); return { ok: true };
  } },
  { method: 'DELETE', path: '/staff/modules/:id', auth: 'staff', async handler({ user, params }) {
    await assertCourseManager(user, await courseOfModule(params.id)); must(await admin().from('course_modules').delete().eq('id', params.id)); return { ok: true };
  } },
  { method: 'POST', path: '/staff/courses/:id/reorder', auth: 'staff', async handler({ user, params, body }) {
    await assertCourseManager(user, params.id);
    const s = z.object({ modules: z.array(z.string().uuid()).optional(), lessons: z.record(z.array(z.string().uuid())).optional() }).safeParse(body); if (!s.success) throw bad('Invalid order');
    await Promise.all([...(s.data.modules || []).map((id, i) => admin().from('course_modules').update({ position: i }).eq('id', id).eq('course_id', params.id)),
      ...Object.values(s.data.lessons || {}).flatMap((ids) => ids.map((id, i) => admin().from('lessons').update({ position: i }).eq('id', id).eq('course_id', params.id)))]);
    return { ok: true };
  } },

  // ───── lessons ─────
  { method: 'POST', path: '/staff/modules/:id/lessons', auth: 'staff', async handler({ user, params, body }) {
    const courseId = await courseOfModule(params.id); await assertCourseManager(user, courseId);
    const s = z.object({ title: z.string().trim().min(1).max(160), type: z.enum(['video', 'text', 'quiz', 'assignment']) }).safeParse(body); if (!s.success) throw bad('Give the lesson a title and type');
    const pos = (await admin().from('lessons').select('id', { count: 'exact', head: true }).eq('module_id', params.id)).count ?? 0;
    const l = must(await admin().from('lessons').insert({ module_id: params.id, course_id: courseId, ...s.data, position: pos }).select().single());
    if (s.data.type === 'quiz') must(await admin().from('quizzes').insert({ lesson_id: l.id }));
    if (s.data.type === 'assignment') must(await admin().from('assignments').insert({ lesson_id: l.id }));
    // Tell enrolled students when new material lands in a live course.
    const course = must(await admin().from('courses').select('slug,title,status').eq('id', courseId).single());
    if (course.status === 'published') {
      const enrolled = must(await admin().from('enrollments').select('user_id').eq('course_id', courseId).in('status', ['active', 'completed']));
      const rows = enrolled.map((e) => ({ user_id: e.user_id, type: 'new_lesson', title: 'New lesson added', body: `${l.title} in ${course.title}`, link: `/learn/${course.slug}?lesson=${l.id}` }));
      for (let i = 0; i < rows.length; i += 500) await admin().from('notifications').insert(rows.slice(i, i + 500));
    }
    return l;
  } },
  { method: 'PUT', path: '/staff/lessons/:id', auth: 'staff', async handler({ user, params, body, ip }) {
    const l = await courseOfLesson(params.id); await assertCourseManager(user, l.course_id);
    const s = z.object({
      title: z.string().trim().min(1).max(160).optional(), duration_seconds: z.number().int().min(0).max(86400).optional(), is_preview: z.boolean().optional(),
      video_provider: z.enum(['youtube', 'vimeo', 'bunny', 'mux', 'storage', 'external']).nullish(), video_url: z.string().max(800).nullish(), body_html: z.string().max(200000).nullish(),
      quiz: quizSchema.optional(),
      assignment: z.object({ instructions: z.string().max(10000), due_at: z.string().datetime().nullish(), max_score: z.number().int().min(1).max(1000).optional(), allow_resubmission: z.boolean().optional(), is_required: z.boolean().optional() }).optional(),
    }).safeParse(body); if (!s.success) throw bad('Check the lesson details', s.error.flatten());
    const d = s.data;
    const meta = Object.fromEntries(Object.entries({ title: d.title, duration_seconds: d.duration_seconds, is_preview: d.is_preview }).filter(([, v]) => v !== undefined));
    if (Object.keys(meta).length) must(await admin().from('lessons').update(meta).eq('id', params.id));
    if (l.type === 'video' || l.type === 'text') {
      if (d.video_url && d.video_provider === 'external' && !/^https:\/\//.test(d.video_url)) throw bad('Video links must start with https://');
      must(await admin().from('lesson_content').upsert({ lesson_id: params.id, video_provider: d.video_provider ?? null, video_url: d.video_url ?? null, body_html: d.body_html != null ? sanitizeHtml(d.body_html) : null }));
    }
    if (d.quiz && l.type === 'quiz') {
      for (const q of d.quiz.questions) { const ids = new Set(q.options.map((o) => o.id)); if (!q.correct.every((c) => ids.has(c))) throw bad('Each correct answer must match one of the options'); if (q.type !== 'multiple' && q.correct.length !== 1) throw bad('Single-answer and true/false questions need exactly one correct answer'); }
      const { questions, ...settings } = d.quiz;
      must(await admin().from('quizzes').upsert({ lesson_id: params.id, ...settings }));
      await admin().from('quiz_questions').delete().eq('lesson_id', params.id);
      if (questions.length) must(await admin().from('quiz_questions').insert(questions.map((q, i) => ({ ...q, lesson_id: params.id, position: i }))));
    }
    if (d.assignment && l.type === 'assignment') must(await admin().from('assignments').upsert({ lesson_id: params.id, ...d.assignment, instructions: sanitizeHtml(d.assignment.instructions) }));
    await audit(user, 'lesson.update', 'lesson', params.id, {}, ip);
    return { ok: true };
  } },
  { method: 'DELETE', path: '/staff/lessons/:id', auth: 'staff', async handler({ user, params }) {
    const l = await courseOfLesson(params.id); await assertCourseManager(user, l.course_id); must(await admin().from('lessons').delete().eq('id', params.id)); return { ok: true };
  } },

  // ───── uploads (resources & hosted video) ─────
  { method: 'POST', path: '/staff/lessons/:id/upload-url', auth: 'staff', limit: 30, async handler({ user, params, body }) {
    const l = await courseOfLesson(params.id); await assertCourseManager(user, l.course_id);
    const s = z.object({ filename: z.string().min(1).max(150) }).safeParse(body); if (!s.success) throw bad('Filename required');
    if (!/\.(pdf|zip|png|jpe?g|txt|docx|pptx|mp4)$/i.test(s.data.filename)) throw bad('Allowed files: PDF, ZIP, PNG, JPG, TXT, DOCX, PPTX, MP4');
    const path = `${l.course_id}/${params.id}/${crypto.randomUUID()}-${cleanFilename(s.data.filename)}`;
    const { data, error } = await admin().storage.from('course-resources').createSignedUploadUrl(path); if (error) throw bad(error.message);
    return { path, token: data.token, signedUrl: data.signedUrl };
  } },
  { method: 'POST', path: '/staff/lessons/:id/resources', auth: 'staff', async handler({ user, params, body }) {
    const l = await courseOfLesson(params.id); await assertCourseManager(user, l.course_id);
    const s = z.object({ name: z.string().trim().min(1).max(160), path: z.string().max(400), size_bytes: z.number().int().nullish(), mime_type: z.string().max(100).nullish() }).safeParse(body); if (!s.success) throw bad('Invalid resource');
    if (!s.data.path.startsWith(`${l.course_id}/${params.id}/`)) throw forbidden('Invalid file path');
    return must(await admin().from('lesson_resources').insert({ lesson_id: params.id, course_id: l.course_id, name: s.data.name, storage_path: s.data.path, size_bytes: s.data.size_bytes ?? null, mime_type: s.data.mime_type ?? null }).select().single());
  } },
  { method: 'DELETE', path: '/staff/resources/:id', auth: 'staff', async handler({ user, params }) {
    const r = must(await admin().from('lesson_resources').select('course_id,storage_path').eq('id', params.id).maybeSingle()); if (!r) throw notFound();
    await assertCourseManager(user, r.course_id); await admin().storage.from('course-resources').remove([r.storage_path]); must(await admin().from('lesson_resources').delete().eq('id', params.id)); return { ok: true };
  } },

  // ───── students, progress, grading ─────
  { method: 'GET', path: '/staff/students', auth: 'staff', async handler({ user, query }) {
    let ids;
    if (query.courseId) { await assertCourseManager(user, query.courseId); ids = [query.courseId]; }
    else if (isAdmin(user)) ids = null;
    else ids = must(await admin().from('course_instructors').select('course_id').eq('user_id', user.id)).map((r) => r.course_id);
    if (ids && !ids.length) return [];
    let q = admin().from('enrollments').select('id,status,enrolled_at,course_id,user_id,profiles(full_name,email,avatar_url),courses(title)').neq('status', 'revoked').order('enrolled_at', { ascending: false }).limit(500);
    if (ids) q = q.in('course_id', ids);
    const rows = must(await q);
    const prog = rows.length ? must(await admin().from('course_progress').select('user_id,course_id,percent,last_accessed_at').in('course_id', [...new Set(rows.map((r) => r.course_id))])) : [];
    return rows.map((r) => { const p = prog.find((x) => x.user_id === r.user_id && x.course_id === r.course_id); return { ...r, percent: +(p?.percent ?? 0), last_accessed_at: p?.last_accessed_at ?? null }; });
  } },

  { method: 'GET', path: '/staff/submissions', auth: 'staff', async handler({ user, query }) {
    let ids = isAdmin(user) ? null : must(await admin().from('course_instructors').select('course_id').eq('user_id', user.id)).map((r) => r.course_id);
    if (ids && !ids.length) return [];
    let lq = admin().from('lessons').select('id,title,courses(title)').eq('type', 'assignment'); if (ids) lq = lq.in('course_id', ids);
    const lessons = must(await lq); if (!lessons.length) return [];
    let q = admin().from('assignment_submissions').select('*, profiles!assignment_submissions_user_id_fkey(full_name,email)').in('lesson_id', lessons.map((l) => l.id)).order('submitted_at', { ascending: false }).limit(200);
    if (['submitted', 'graded', 'returned'].includes(query.status)) q = q.eq('status', query.status);
    const rows = must(await q);
    return Promise.all(rows.map(async (r) => ({ ...r, lesson: lessons.find((l) => l.id === r.lesson_id), file_url: r.file_path ? (await admin().storage.from('assignment-submissions').createSignedUrl(r.file_path, 600)).data?.signedUrl : null })));
  } },
  { method: 'POST', path: '/staff/submissions/:id/grade', auth: 'staff', async handler({ user, params, body, ip }) {
    const sub = must(await admin().from('assignment_submissions').select('id,user_id,lesson_id').eq('id', params.id).maybeSingle()); if (!sub) throw notFound();
    const l = await courseOfLesson(sub.lesson_id); await assertCourseManager(user, l.course_id);
    const asg = must(await admin().from('assignments').select('max_score').eq('lesson_id', sub.lesson_id).single());
    const s = z.object({ score: z.number().int().min(0).max(asg.max_score), feedback: z.string().trim().max(4000).nullish(), return_for_resubmission: z.boolean().optional() }).safeParse(body); if (!s.success) throw bad(`Score must be between 0 and ${asg.max_score}`);
    must(await admin().from('assignment_submissions').update({ score: s.data.score, feedback: s.data.feedback ?? null, status: s.data.return_for_resubmission ? 'returned' : 'graded', graded_by: user.id, graded_at: new Date().toISOString() }).eq('id', params.id));
    const les = must(await admin().from('lessons').select('title,courses(slug)').eq('id', sub.lesson_id).single());
    await notify(sub.user_id, 'assignment_graded', 'Assignment graded', `${les.title}: ${s.data.score}/${asg.max_score}.`, `/learn/${les.courses.slug}`);
    await audit(user, 'submission.grade', 'submission', params.id, { score: s.data.score }, ip); return { ok: true };
  } },

  // ───── announcements ─────
  { method: 'GET', path: '/staff/announcements', auth: 'staff', async handler({ user }) {
    let q = admin().from('announcements').select('*, courses(title)').order('created_at', { ascending: false }).limit(100);
    if (!isAdmin(user)) { const ids = must(await admin().from('course_instructors').select('course_id').eq('user_id', user.id)).map((r) => r.course_id); if (!ids.length) return []; q = q.in('course_id', ids); }
    return must(await q);
  } },
  { method: 'POST', path: '/staff/announcements', auth: 'staff', limit: 10, async handler({ user, body, ip }) {
    const s = z.object({ courseId: z.string().uuid().nullish(), title: z.string().trim().min(3).max(160), body: z.string().trim().min(3).max(4000) }).safeParse(body); if (!s.success) throw bad('Add a title and a message');
    if (!s.data.courseId && !isAdmin(user)) throw forbidden('Only administrators can post academy-wide announcements');
    if (s.data.courseId) await assertCourseManager(user, s.data.courseId);
    const a = must(await admin().from('announcements').insert({ course_id: s.data.courseId ?? null, author_id: user.id, title: s.data.title, body: s.data.body }).select().single());
    let q = admin().from('enrollments').select('user_id, profiles(email), courses(slug)').neq('status', 'revoked');
    if (s.data.courseId) q = q.eq('course_id', s.data.courseId); else q = admin().from('profiles').select('id, email').eq('is_active', true);
    const targets = must(await q);
    const rows = targets.map((t) => ({ user_id: t.user_id ?? t.id, type: 'announcement', title: s.data.title, body: s.data.body.slice(0, 200), link: t.courses?.slug ? `/learn/${t.courses.slug}` : '/app' }));
    for (let i = 0; i < rows.length; i += 500) await admin().from('notifications').insert(rows.slice(i, i + 500));
    if (targets.length <= 200) {   // respect each student's "email me" preference; in-app notification is always sent
      const prefs = must(await admin().from('user_settings').select('user_id,email_notifications').in('user_id', targets.map((t) => t.user_id ?? t.id)));
      const off = new Set(prefs.filter((x) => x.email_notifications === false).map((x) => x.user_id));
      targets.filter((t) => !off.has(t.user_id ?? t.id)).forEach((t) => sendEmail({ to: t.profiles?.email ?? t.email, subject: s.data.title, heading: s.data.title, body: s.data.body }));
    }
    await audit(user, 'announcement.create', 'announcement', a.id, { recipients: rows.length }, ip);
    return { ...a, recipients: rows.length };
  } },

  // ───── analytics (scoped to the caller's courses) ─────
  { method: 'GET', path: '/staff/overview', auth: 'staff', async handler({ user }) {
    const ids = isAdmin(user) ? must(await admin().from('courses').select('id')).map((c) => c.id) : must(await admin().from('course_instructors').select('course_id').eq('user_id', user.id)).map((r) => r.course_id);
    if (!ids.length) return { courses: 0, students: 0, completion_rate: 0, pending_submissions: 0, per_course: [] };
    const [courses, enr, prog, asg] = await Promise.all([
      admin().from('courses').select('id,title,status').in('id', ids).then(must),
      admin().from('enrollments').select('course_id,user_id').in('course_id', ids).neq('status', 'revoked').then(must),
      admin().from('course_progress').select('course_id,percent').in('course_id', ids).then(must),
      admin().from('lessons').select('id').in('course_id', ids).eq('type', 'assignment').then(must),
    ]);
    const pending = asg.length ? (await admin().from('assignment_submissions').select('id', { count: 'exact', head: true }).in('lesson_id', asg.map((a) => a.id)).eq('status', 'submitted')).count ?? 0 : 0;
    return { courses: courses.length, students: new Set(enr.map((e) => e.user_id)).size, pending_submissions: pending,
      completion_rate: prog.length ? Math.round(prog.filter((p) => +p.percent >= 100).length * 100 / prog.length) : 0,
      per_course: courses.map((c) => { const pc = prog.filter((p) => p.course_id === c.id); return { id: c.id, title: c.title, status: c.status, students: enr.filter((e) => e.course_id === c.id).length, avg_progress: pc.length ? Math.round(pc.reduce((a, p) => a + +p.percent, 0) / pc.length) : 0 }; }) };
  } },
];
