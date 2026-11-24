import { z } from 'zod';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { admin, must } from '../lib/supabase.js';
import { bad, forbidden, notFound, HttpError } from '../lib/http.js';
import { isEnrolled, notify, assertCourseManager } from '../lib/auth.js';
import { sendEmail } from '../lib/email.js';

const SIGN_TTL = 60 * 15;

/** Access check for a lesson. Returns { lesson, access: 'preview'|'enrolled'|'staff' } or throws. */
async function lessonAccess(user, lessonId) {
  const lesson = must(await admin().from('lessons').select('*, courses(id,slug,title,status,certificate_enabled)').eq('id', lessonId).maybeSingle());
  if (!lesson) throw notFound('Lesson not found');
  if (user) {
    if (user.roles.includes('admin')) return { lesson, access: 'staff' };
    const ci = await admin().from('course_instructors').select('user_id').eq('course_id', lesson.course_id).eq('user_id', user.id).maybeSingle();
    if (ci.data) return { lesson, access: 'staff' };
    if (lesson.courses.status === 'published' && (await isEnrolled(user.id, lesson.course_id))) return { lesson, access: 'enrolled' };
  }
  if (lesson.is_preview && lesson.courses.status === 'published') return { lesson, access: 'preview' };
  throw forbidden(user ? 'Enroll in this course to access this lesson' : 'Sign in and enroll to access this lesson');
}

const needUserEnrolled = async (user, lessonId) => {
  const a = await lessonAccess(user, lessonId);
  if (a.access === 'preview') throw forbidden('Enroll in this course to do that');
  return a;
};

const cleanFilename = (n) => n.replace(/[^\w.\-]+/g, '_').slice(0, 100);

function grade(questions, answers) {
  let earned = 0, total = 0; const review = [];
  for (const q of questions) {
    total += q.points;
    const given = [].concat(answers?.[q.id] ?? []).map(String).sort();
    const correct = q.correct.map(String).sort();
    const ok = given.length === correct.length && given.every((v, i) => v === correct[i]);
    if (ok) earned += q.points;
    review.push({ id: q.id, correct: ok, correct_answer: q.correct, explanation: q.explanation });
  }
  return { percent: total ? +((earned * 100) / total).toFixed(2) : 0, review };
}

async function buildCertificatePdf({ name, course, no, date, signatory }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const blue = rgb(0x02 / 255, 0x60 / 255, 1); const ink = rgb(0.055, 0.055, 0.055); const grey = rgb(0.42, 0.44, 0.5);
  const center = (t, y, size, font, color) => page.drawText(t, { x: (842 - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: blue, borderWidth: 3 });
  page.drawRectangle({ x: 34, y: 34, width: 774, height: 527, borderColor: rgb(0.88, 0.89, 0.92), borderWidth: 1 });
  center('TECHSTERS ACADEMY', 500, 16, bold, blue);
  center('Certificate of Completion', 440, 38, bold, ink);
  center('This certifies that', 395, 14, reg, grey);
  let size = 34; while (bold.widthOfTextAtSize(name, size) > 700 && size > 16) size -= 2;
  center(name, 340, size, bold, blue);
  center('has successfully completed the course', 300, 14, reg, grey);
  let cs = 24; while (bold.widthOfTextAtSize(course, cs) > 700 && cs > 12) cs -= 2;
  center(course, 258, cs, bold, ink);
  center(`Issued on ${date}`, 200, 13, reg, grey);
  page.drawLine({ start: { x: 321, y: 130 }, end: { x: 521, y: 130 }, thickness: 1, color: grey });
  center(signatory, 112, 11, reg, grey);
  center(`Certificate No. ${no}   |   Verify at ${process.env.APP_URL || ''}/verify/${no}`, 60, 10, reg, grey);
  return pdf.save();
}

export default [
  // ───────── Profile ─────────
  { method: 'GET', path: '/me', auth: 'user', async handler({ user }) {
    const settings = must(await admin().from('user_settings').select('*').eq('user_id', user.id).maybeSingle());
    const { count } = await admin().from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null);
    const full = must(await admin().from('profiles').select('id,email,full_name,avatar_url,headline,bio,phone,created_at').eq('id', user.id).single());
    return { profile: full, roles: user.roles, settings, unread: count ?? 0 };
  } },
  { method: 'PATCH', path: '/me', auth: 'user', async handler({ user, body }) {
    const s = z.object({ full_name: z.string().trim().min(2).max(120), headline: z.string().trim().max(160).nullish(), bio: z.string().trim().max(1500).nullish(), phone: z.string().trim().max(30).nullish(),
      avatar_url: z.string().url().max(500).nullish() }).safeParse(body);
    if (!s.success) throw bad('Check your details and try again', s.error.flatten());
    if (s.data.avatar_url && !s.data.avatar_url.includes('/storage/v1/object/public/avatars/' + user.id + '/')) throw bad('Invalid avatar location');
    must(await admin().from('profiles').update(s.data).eq('id', user.id)); return { ok: true };
  } },
  { method: 'PATCH', path: '/me/settings', auth: 'user', async handler({ user, body }) {
    const s = z.object({ email_notifications: z.boolean().optional(), marketing_emails: z.boolean().optional() }).safeParse(body);
    if (!s.success) throw bad('Invalid settings');
    must(await admin().from('user_settings').upsert({ user_id: user.id, ...s.data })); return { ok: true };
  } },

  // ───────── Dashboard ─────────
  { method: 'GET', path: '/me/dashboard', auth: 'user', async handler({ user }) {
    const enr = must(await admin().from('enrollments').select('id,status,enrolled_at,expires_at,courses(id,slug,title,thumbnail_url,level)').eq('user_id', user.id).neq('status', 'revoked').order('enrolled_at', { ascending: false }));
    const ids = enr.map((e) => e.courses.id);
    const prog = ids.length ? must(await admin().from('course_progress').select('*').eq('user_id', user.id).in('course_id', ids)) : [];
    const courses = enr.map((e) => { const p = prog.find((x) => x.course_id === e.courses.id); return { ...e.courses, enrollment_status: e.status, enrolled_at: e.enrolled_at, percent: +(p?.percent ?? 0), completed_lessons: p?.completed_lessons ?? 0, total_lessons: p?.total_lessons ?? 0, last_lesson_id: p?.last_lesson_id ?? null, last_accessed_at: p?.last_accessed_at ?? null }; });
    const done = ids.length ? must(await admin().from('lesson_progress').select('lesson_id,completed_at,last_accessed_at,lessons(id,title,course_id,duration_seconds)').eq('user_id', user.id).eq('completed', true)) : [];
    const recent = ids.length ? must(await admin().from('lesson_progress').select('lesson_id,last_accessed_at,lessons(id,title,courses(slug,title))').eq('user_id', user.id).order('last_accessed_at', { ascending: false }).limit(5)) : [];
    const lessonIds = ids.length ? must(await admin().from('lessons').select('id,title,type,course_id').in('course_id', ids).eq('type', 'assignment')).map((l) => l) : [];
    const upcoming = lessonIds.length ? must(await admin().from('assignments').select('lesson_id,due_at').in('lesson_id', lessonIds.map((l) => l.id)).gte('due_at', new Date().toISOString()).order('due_at').limit(5)) : [];
    const certs = must(await admin().from('certificates').select('id', { count: 'exact' }).eq('user_id', user.id));
    return {
      stats: { enrolled: courses.length, completed: courses.filter((c) => c.percent >= 100).length, lessons_completed: done.length,
        minutes_learned: Math.round(done.reduce((a, d) => a + (d.lessons?.duration_seconds || 0), 0) / 60), certificates: certs.length },
      courses, recent, upcoming: upcoming.map((u) => ({ ...u, lesson: lessonIds.find((l) => l.id === u.lesson_id) })),
    };
  } },
  { method: 'GET', path: '/me/orders', auth: 'user', handler: async ({ user }) => must(await admin().from('orders').select('id,reference,amount_minor,currency,status,created_at,paid_at,courses(title,slug)').eq('user_id', user.id).order('created_at', { ascending: false })) },
  { method: 'GET', path: '/me/certificates', auth: 'user', handler: async ({ user }) => must(await admin().from('certificates').select('id,certificate_no,course_title,issued_at,course_id').eq('user_id', user.id).order('issued_at', { ascending: false })) },
  { method: 'GET', path: '/me/bookmarks', auth: 'user', handler: async ({ user }) => must(await admin().from('bookmarks').select('lesson_id,created_at,lessons(id,title,courses(slug,title))').eq('user_id', user.id).order('created_at', { ascending: false })) },

  // ───────── Notifications ─────────
  { method: 'GET', path: '/notifications', auth: 'user', handler: async ({ user }) => must(await admin().from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)) },
  { method: 'POST', path: '/notifications/read-all', auth: 'user', async handler({ user }) { must(await admin().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)); return { ok: true }; } },
  { method: 'POST', path: '/notifications/:id/read', auth: 'user', async handler({ user, params }) { must(await admin().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', params.id).eq('user_id', user.id)); return { ok: true }; } },

  // ───────── Course player ─────────
  { method: 'GET', path: '/learn/:slug', auth: 'user', async handler({ user, params }) {
    const c = must(await admin().from('courses').select('id,slug,title,thumbnail_url,certificate_enabled,status').eq('slug', params.slug).maybeSingle());
    if (!c) throw notFound('Course not found');
    const staff = user.roles.includes('admin') || !!(await admin().from('course_instructors').select('user_id').eq('course_id', c.id).eq('user_id', user.id).maybeSingle()).data;
    if (!staff && !(await isEnrolled(user.id, c.id))) throw forbidden('You are not enrolled in this course');
    const [modules, lessons, progress, cp, cert] = await Promise.all([
      admin().from('course_modules').select('id,title,position').eq('course_id', c.id).order('position').then(must),
      admin().from('lessons').select('id,module_id,title,type,duration_seconds,position').eq('course_id', c.id).order('position').then(must),
      admin().from('lesson_progress').select('lesson_id,completed').eq('user_id', user.id).eq('course_id', c.id).then(must),
      admin().from('course_progress').select('*').eq('user_id', user.id).eq('course_id', c.id).maybeSingle().then(must),
      admin().from('certificates').select('id,certificate_no').eq('user_id', user.id).eq('course_id', c.id).maybeSingle().then(must),
    ]);
    const done = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
    return { course: c, modules: modules.map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id).map((l) => ({ ...l, completed: done.has(l.id) })) })),
      progress: cp || { percent: 0, completed_lessons: 0, total_lessons: lessons.length, last_lesson_id: null }, certificate: cert };
  } },

  { method: 'GET', path: '/lessons/:id', auth: 'optional', async handler({ user, params }) {
    const { lesson, access } = await lessonAccess(user, params.id);
    const content = must(await admin().from('lesson_content').select('*').eq('lesson_id', lesson.id).maybeSingle()) || {};
    let video = null;
    if (content.video_url) {
      video = { provider: content.video_provider, url: content.video_url };
      if (content.video_provider === 'storage') {
        const { data } = await admin().storage.from('course-resources').createSignedUrl(content.video_url, SIGN_TTL);
        video = { provider: 'storage', url: data?.signedUrl };
      }
    }
    const out = { id: lesson.id, title: lesson.title, type: lesson.type, course: { id: lesson.courses.id, slug: lesson.courses.slug, title: lesson.courses.title }, access, video, body_html: content.body_html || null };
    if (access === 'preview') return out;

    const res = must(await admin().from('lesson_resources').select('id,name,storage_path,size_bytes,mime_type').eq('lesson_id', lesson.id));
    out.resources = await Promise.all(res.map(async (r) => ({ id: r.id, name: r.name, size_bytes: r.size_bytes, url: (await admin().storage.from('course-resources').createSignedUrl(r.storage_path, SIGN_TTL, { download: r.name })).data?.signedUrl })));
    if (user) {
      const [prog, bm, notes] = await Promise.all([
        admin().from('lesson_progress').select('completed,last_position_seconds').eq('user_id', user.id).eq('lesson_id', lesson.id).maybeSingle().then(must),
        admin().from('bookmarks').select('lesson_id').eq('user_id', user.id).eq('lesson_id', lesson.id).maybeSingle().then(must),
        admin().from('learning_notes').select('id,body,video_second,created_at').eq('user_id', user.id).eq('lesson_id', lesson.id).order('created_at', { ascending: false }).then(must),
      ]);
      out.progress = prog || { completed: false, last_position_seconds: 0 }; out.bookmarked = !!bm; out.notes = notes;
      if (access === 'enrolled') await admin().from('lesson_progress').upsert({ user_id: user.id, lesson_id: lesson.id, course_id: lesson.course_id, completed: prog?.completed ?? false, last_position_seconds: prog?.last_position_seconds ?? 0, completed_at: prog?.completed ? undefined : null, last_accessed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: false });
    }
    if (lesson.type === 'quiz') {
      const quiz = must(await admin().from('quizzes').select('*').eq('lesson_id', lesson.id).maybeSingle());
      const qs = must(await admin().from('quiz_questions').select('id,type,prompt,options,points,position').eq('lesson_id', lesson.id).order('position'));  // NOTE: no `correct`
      const attempts = user ? must(await admin().from('quiz_attempts').select('id,score_percent,passed,submitted_at').eq('user_id', user.id).eq('lesson_id', lesson.id).not('submitted_at', 'is', null).order('submitted_at', { ascending: false })) : [];
      out.quiz = { ...quiz, questions: qs, attempts, attempts_left: quiz?.max_attempts ? Math.max(0, quiz.max_attempts - attempts.length) : null };
    }
    if (lesson.type === 'assignment') {
      const a = must(await admin().from('assignments').select('*').eq('lesson_id', lesson.id).maybeSingle());
      const sub = user ? must(await admin().from('assignment_submissions').select('id,text_body,file_path,status,score,feedback,submitted_at,graded_at').eq('lesson_id', lesson.id).eq('user_id', user.id).maybeSingle()) : null;
      out.assignment = a; out.submission = sub;
    }
    return out;
  } },

  { method: 'POST', path: '/lessons/:id/progress', auth: 'user', async handler({ user, params, body }) {
    const { lesson } = await needUserEnrolled(user, params.id);
    const s = z.object({ completed: z.boolean().optional(), position: z.number().int().min(0).max(86400).optional() }).safeParse(body);
    if (!s.success) throw bad('Invalid progress');
    // quizzes & assignments cannot be completed by click: they complete via passing / submitting
    if (s.data.completed && ['quiz', 'assignment'].includes(lesson.type)) throw bad(lesson.type === 'quiz' ? 'Pass the quiz to complete this lesson' : 'Submit the assignment to complete this lesson');
    const existing = (await admin().from('lesson_progress').select('completed,completed_at').eq('user_id', user.id).eq('lesson_id', lesson.id).maybeSingle()).data;
    const completed = s.data.completed ?? existing?.completed ?? false;
    must(await admin().from('lesson_progress').upsert({ user_id: user.id, lesson_id: lesson.id, course_id: lesson.course_id, completed,
      ...(s.data.position != null ? { last_position_seconds: s.data.position } : {}), completed_at: completed ? (existing?.completed_at ?? new Date().toISOString()) : null, last_accessed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' }));
    const cp = must(await admin().from('course_progress').select('percent,completed_lessons,total_lessons').eq('user_id', user.id).eq('course_id', lesson.course_id).maybeSingle());
    if (completed && cp && +cp.percent >= 100 && !existing?.completed) {
      await notify(user.id, 'course_completed', 'Course complete', `You finished ${lesson.courses.title}.${lesson.courses.certificate_enabled ? ' Your certificate is ready to claim.' : ''}`, `/learn/${lesson.courses.slug}`);
    }
    return { progress: cp };
  } },

  { method: 'POST', path: '/lessons/:id/bookmark', auth: 'user', async handler({ user, params }) {
    const { lesson } = await needUserEnrolled(user, params.id);
    const ex = (await admin().from('bookmarks').select('lesson_id').eq('user_id', user.id).eq('lesson_id', lesson.id).maybeSingle()).data;
    if (ex) { must(await admin().from('bookmarks').delete().eq('user_id', user.id).eq('lesson_id', lesson.id)); return { bookmarked: false }; }
    must(await admin().from('bookmarks').insert({ user_id: user.id, lesson_id: lesson.id, course_id: lesson.course_id })); return { bookmarked: true };
  } },
  { method: 'POST', path: '/lessons/:id/notes', auth: 'user', async handler({ user, params, body }) {
    const { lesson } = await needUserEnrolled(user, params.id);
    const s = z.object({ body: z.string().trim().min(1).max(3000), video_second: z.number().int().min(0).nullish() }).safeParse(body); if (!s.success) throw bad('Write a note first');
    return must(await admin().from('learning_notes').insert({ user_id: user.id, lesson_id: lesson.id, ...s.data }).select().single());
  } },
  { method: 'DELETE', path: '/notes/:id', auth: 'user', async handler({ user, params }) { must(await admin().from('learning_notes').delete().eq('id', params.id).eq('user_id', user.id)); return { ok: true }; } },

  { method: 'GET', path: '/lessons/:id/discussions', auth: 'user', async handler({ user, params }) {
    await needUserEnrolled(user, params.id);
    return must(await admin().from('discussions').select('id,parent_id,body,created_at,user_id,profiles(full_name,avatar_url)').eq('lesson_id', params.id).order('created_at'));
  } },
  { method: 'POST', path: '/lessons/:id/discussions', auth: 'user', limit: 20, async handler({ user, params, body }) {
    const { lesson } = await needUserEnrolled(user, params.id);
    const s = z.object({ body: z.string().trim().min(1).max(4000), parent_id: z.string().uuid().nullish() }).safeParse(body); if (!s.success) throw bad('Write a comment first');
    return must(await admin().from('discussions').insert({ lesson_id: lesson.id, course_id: lesson.course_id, user_id: user.id, ...s.data }).select().single());
  } },
  { method: 'DELETE', path: '/discussions/:id', auth: 'user', async handler({ user, params }) {
    const d = must(await admin().from('discussions').select('user_id,course_id').eq('id', params.id).maybeSingle()); if (!d) throw notFound();
    if (d.user_id !== user.id) await assertCourseManager(user, d.course_id);
    must(await admin().from('discussions').delete().eq('id', params.id)); return { ok: true };
  } },

  // ───────── Quizzes ─────────
  { method: 'POST', path: '/quizzes/:id/start', auth: 'user', limit: 20, async handler({ user, params }) {
    const { lesson } = await needUserEnrolled(user, params.id);
    const quiz = must(await admin().from('quizzes').select('*').eq('lesson_id', lesson.id).maybeSingle()); if (!quiz) throw notFound('Quiz not found');
    const submitted = (await admin().from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('lesson_id', lesson.id).not('submitted_at', 'is', null)).count ?? 0;
    if (quiz.max_attempts && submitted >= quiz.max_attempts) throw bad('You have used all attempts for this quiz');
    // reuse an open attempt so refreshing the page can't reset the timer
    const open = (await admin().from('quiz_attempts').select('id,started_at').eq('user_id', user.id).eq('lesson_id', lesson.id).is('submitted_at', null).order('started_at', { ascending: false }).limit(1).maybeSingle()).data;
    const attempt = open || must(await admin().from('quiz_attempts').insert({ user_id: user.id, lesson_id: lesson.id }).select('id,started_at').single());
    return { attempt_id: attempt.id, started_at: attempt.started_at, time_limit_minutes: quiz.time_limit_minutes };
  } },
  { method: 'POST', path: '/quizzes/:id/submit', auth: 'user', limit: 20, async handler({ user, params, body }) {
    const { lesson } = await needUserEnrolled(user, params.id);
    const s = z.object({ attempt_id: z.string().uuid(), answers: z.record(z.union([z.string(), z.array(z.string())])) }).safeParse(body); if (!s.success) throw bad('Invalid submission');
    const attempt = must(await admin().from('quiz_attempts').select('*').eq('id', s.data.attempt_id).eq('user_id', user.id).eq('lesson_id', lesson.id).maybeSingle());
    if (!attempt || attempt.submitted_at) throw bad('This attempt is no longer open');
    const quiz = must(await admin().from('quizzes').select('*').eq('lesson_id', lesson.id).single());
    const questions = must(await admin().from('quiz_questions').select('*').eq('lesson_id', lesson.id));
    const expired = quiz.time_limit_minutes && Date.now() > new Date(attempt.started_at).getTime() + (quiz.time_limit_minutes * 60 + 30) * 1000;
    const { percent, review } = expired ? { percent: 0, review: [] } : grade(questions, s.data.answers);
    const passed = !expired && percent >= quiz.passing_score;
    must(await admin().from('quiz_attempts').update({ answers: s.data.answers, score_percent: percent, passed, submitted_at: new Date().toISOString() }).eq('id', attempt.id));
    if (passed) {
      await admin().from('lesson_progress').upsert({ user_id: user.id, lesson_id: lesson.id, course_id: lesson.course_id, completed: true, completed_at: new Date().toISOString(), last_accessed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
    }
    await notify(user.id, 'quiz_result', passed ? 'Quiz passed' : expired ? 'Quiz time expired' : 'Quiz not passed', `${lesson.title}: ${percent}% (pass mark ${quiz.passing_score}%).`, `/learn/${lesson.courses.slug}`);
    return { score_percent: percent, passed, expired: !!expired, pass_mark: quiz.passing_score, review };
  } },

  // ───────── Assignments ─────────
  { method: 'POST', path: '/assignments/:id/upload-url', auth: 'user', limit: 20, async handler({ user, params, body }) {
    await needUserEnrolled(user, params.id);
    const s = z.object({ filename: z.string().min(1).max(150) }).safeParse(body); if (!s.success) throw bad('Filename required');
    if (!/\.(pdf|zip|png|jpe?g|txt|docx)$/i.test(s.data.filename)) throw bad('Allowed files: PDF, ZIP, PNG, JPG, TXT, DOCX');
    const path = `${user.id}/${params.id}/${crypto.randomUUID()}-${cleanFilename(s.data.filename)}`;
    const { data, error } = await admin().storage.from('assignment-submissions').createSignedUploadUrl(path);
    if (error) throw bad(error.message);
    return { path, token: data.token, signedUrl: data.signedUrl };
  } },
  { method: 'POST', path: '/assignments/:id/submit', auth: 'user', limit: 20, async handler({ user, params, body }) {
    const { lesson } = await needUserEnrolled(user, params.id);
    const a = must(await admin().from('assignments').select('*').eq('lesson_id', lesson.id).maybeSingle()); if (!a) throw notFound('Assignment not found');
    const s = z.object({ text_body: z.string().trim().max(10000).nullish(), file_path: z.string().max(400).nullish() }).safeParse(body); if (!s.success) throw bad('Invalid submission');
    if (!s.data.text_body && !s.data.file_path) throw bad('Add your answer or attach a file');
    if (s.data.file_path && !s.data.file_path.startsWith(`${user.id}/${lesson.id}/`)) throw forbidden('Invalid file');
    if (a.due_at && new Date(a.due_at) < new Date()) throw bad('The deadline for this assignment has passed');
    const prev = must(await admin().from('assignment_submissions').select('id,status').eq('lesson_id', lesson.id).eq('user_id', user.id).maybeSingle());
    if (prev && !a.allow_resubmission && prev.status !== 'returned') throw bad('Resubmission is not allowed for this assignment');
    const row = must(await admin().from('assignment_submissions').upsert({ lesson_id: lesson.id, user_id: user.id, ...s.data, status: 'submitted', score: null, feedback: null, graded_at: null, submitted_at: new Date().toISOString() }, { onConflict: 'lesson_id,user_id' }).select().single());
    await admin().from('lesson_progress').upsert({ user_id: user.id, lesson_id: lesson.id, course_id: lesson.course_id, completed: true, completed_at: new Date().toISOString(), last_accessed_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
    return row;
  } },

  // ───────── Reviews, support, applications ─────────
  { method: 'POST', path: '/courses/:id/reviews', auth: 'user', async handler({ user, params, body }) {
    if (!(await isEnrolled(user.id, params.id))) throw forbidden('Only enrolled students can review a course');
    const s = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).nullish() }).safeParse(body); if (!s.success) throw bad('Choose a rating from 1 to 5');
    must(await admin().from('course_reviews').upsert({ course_id: params.id, user_id: user.id, ...s.data }, { onConflict: 'course_id,user_id' })); return { ok: true };
  } },
  { method: 'POST', path: '/support', auth: 'user', limit: 5, async handler({ user, body }) {
    const s = z.object({ subject: z.string().trim().min(3).max(150), message: z.string().trim().min(10).max(4000) }).safeParse(body); if (!s.success) throw bad('Add a subject and a message');
    must(await admin().from('support_tickets').insert({ user_id: user.id, ...s.data })); return { ok: true };
  } },
  { method: 'GET', path: '/support', auth: 'user', handler: async ({ user }) => must(await admin().from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })) },
  { method: 'POST', path: '/instructor-applications', auth: 'user', limit: 3, async handler({ user, body }) {
    if (user.roles.includes('instructor')) throw bad('You are already an instructor');
    const s = z.object({ expertise: z.string().trim().min(3).max(300), pitch: z.string().trim().min(30).max(3000) }).safeParse(body); if (!s.success) throw bad('Tell us a little more about your expertise (at least 30 characters in your pitch)');
    must(await admin().from('instructor_applications').insert({ user_id: user.id, ...s.data })); return { ok: true };
  } },

  // ───────── Certificates ─────────
  { method: 'POST', path: '/certificates/claim', auth: 'user', limit: 10, async handler({ user, body }) {
    const courseId = z.string().uuid().safeParse(body.courseId); if (!courseId.success) throw bad('Invalid course');
    const course = must(await admin().from('courses').select('id,slug,title,certificate_enabled').eq('id', courseId.data).single());
    if (!course.certificate_enabled) throw bad('This course does not issue certificates');
    if (!(await isEnrolled(user.id, course.id))) throw forbidden('You are not enrolled in this course');
    const existing = must(await admin().from('certificates').select('id,certificate_no').eq('user_id', user.id).eq('course_id', course.id).maybeSingle());
    if (existing) return existing;

    // ── Verify real completion requirements ──
    const cp = must(await admin().from('course_progress').select('percent,completed_lessons,total_lessons').eq('user_id', user.id).eq('course_id', course.id).maybeSingle());
    if (!cp || +cp.percent < 100 || cp.total_lessons === 0) throw bad('Complete every lesson to earn your certificate', { percent: cp?.percent ?? 0 });
    const lessons = must(await admin().from('lessons').select('id,type,title').eq('course_id', course.id));
    const quizIds = lessons.filter((l) => l.type === 'quiz').map((l) => l.id);
    if (quizIds.length) {
      const req = must(await admin().from('quizzes').select('lesson_id').in('lesson_id', quizIds).eq('is_required', true)).map((q) => q.lesson_id);
      const passed = must(await admin().from('quiz_attempts').select('lesson_id').eq('user_id', user.id).eq('passed', true).in('lesson_id', req.length ? req : ['00000000-0000-0000-0000-000000000000'])).map((a) => a.lesson_id);
      const missing = req.filter((id) => !passed.includes(id)); if (missing.length) throw bad('Pass all required quizzes to earn your certificate');
    }
    const asgIds = lessons.filter((l) => l.type === 'assignment').map((l) => l.id);
    if (asgIds.length) {
      const req = must(await admin().from('assignments').select('lesson_id').in('lesson_id', asgIds).eq('is_required', true)).map((q) => q.lesson_id);
      const subs = must(await admin().from('assignment_submissions').select('lesson_id,status').eq('user_id', user.id).in('lesson_id', req.length ? req : ['00000000-0000-0000-0000-000000000000']));
      const missing = req.filter((id) => !subs.some((s) => s.lesson_id === id && s.status === 'graded')); if (missing.length) throw bad('Required assignments must be graded by your instructor before you can claim your certificate');
    }

    const seq = must(await admin().rpc('nextval_certificate'));
    const no = `TCH-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
    const name = (await admin().from('profiles').select('full_name').eq('id', user.id).single()).data.full_name || user.email;
    const settings = (await admin().from('platform_settings').select('value').eq('key', 'certificate').maybeSingle()).data?.value || {};
    const bytes = await buildCertificatePdf({ name, course: course.title, no, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), signatory: settings.signatory || 'Techsters Academy' });
    const path = `${user.id}/${no}.pdf`;
    const up = await admin().storage.from('certificates').upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new HttpError(500, up.error.message);
    const cert = must(await admin().from('certificates').insert({ certificate_no: no, user_id: user.id, course_id: course.id, recipient_name: name, course_title: course.title, pdf_path: path }).select('id,certificate_no').single());
    await notify(user.id, 'certificate', 'Certificate issued', `Your certificate for ${course.title} is ready.`, '/app/certificates');
    sendEmail({ to: user.email, subject: 'Your certificate is ready', heading: 'Congratulations!', body: `Your certificate for ${course.title} is ready to download.`, cta: { path: '/app/certificates', label: 'View certificate' } });
    return cert;
  } },
  { method: 'GET', path: '/certificates/:id/download', auth: 'user', async handler({ user, params }) {
    const c = must(await admin().from('certificates').select('pdf_path,user_id,certificate_no').eq('id', params.id).maybeSingle());
    if (!c || (c.user_id !== user.id && !user.roles.includes('admin'))) throw notFound('Certificate not found');
    const { data, error } = await admin().storage.from('certificates').createSignedUrl(c.pdf_path, 120, { download: `${c.certificate_no}.pdf` });
    if (error) throw new HttpError(500, error.message); return { url: data.signedUrl };
  } },
];
