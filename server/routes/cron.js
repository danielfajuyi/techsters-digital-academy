import { admin, must } from '../lib/supabase.js';
import { HttpError } from '../lib/http.js';
import { sendEmail } from '../lib/email.js';

/**
 * Daily job (see vercel.json "crons"). Vercel calls it with `Authorization: Bearer $CRON_SECRET`.
 * Reminds enrolled students about assignments due within 48 hours that they haven't submitted.
 */
export default [
  { method: 'GET', path: '/cron/reminders', async handler({ req }) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) throw new HttpError(401, 'Unauthorized');

    const now = new Date(); const in48h = new Date(now.getTime() + 48 * 3600e3);
    const due = must(await admin().from('assignments').select('lesson_id,due_at').gte('due_at', now.toISOString()).lte('due_at', in48h.toISOString()));
    let sent = 0;
    for (const a of due) {
      const lesson = must(await admin().from('lessons').select('id,title,course_id,courses(slug,title,status)').eq('id', a.lesson_id).single());
      if (lesson.courses.status !== 'published') continue;
      const enrolled = must(await admin().from('enrollments').select('user_id, profiles(email)').eq('course_id', lesson.course_id).in('status', ['active', 'completed']));
      if (!enrolled.length) continue;
      const ids = enrolled.map((e) => e.user_id);
      const done = new Set(must(await admin().from('assignment_submissions').select('user_id').eq('lesson_id', a.lesson_id).in('user_id', ids)).map((x) => x.user_id));
      const link = `/learn/${lesson.courses.slug}?lesson=${lesson.id}`;
      const already = new Set(must(await admin().from('notifications').select('user_id').eq('type', 'deadline').eq('link', link).in('user_id', ids)).map((x) => x.user_id));
      const targets = enrolled.filter((e) => !done.has(e.user_id) && !already.has(e.user_id));
      if (!targets.length) continue;
      const prefs = must(await admin().from('user_settings').select('user_id,email_notifications').in('user_id', targets.map((t) => t.user_id)));
      const wantsEmail = (id) => prefs.find((p) => p.user_id === id)?.email_notifications !== false;
      const when = new Date(a.due_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const rows = targets.map((t) => ({ user_id: t.user_id, type: 'deadline', title: 'Assignment due soon', body: `${lesson.title} is due ${when}.`, link }));
      must(await admin().from('notifications').insert(rows));
      targets.filter((t) => wantsEmail(t.user_id)).slice(0, 200).forEach((t) => sendEmail({ to: t.profiles.email, subject: `Reminder: ${lesson.title} is due soon`, heading: 'Assignment due soon', body: `${lesson.title} (${lesson.courses.title}) is due ${when}.`, cta: { path: link, label: 'Open assignment' } }));
      sent += targets.length;
    }
    return { assignments: due.length, reminders: sent };
  } },
];
