import { z } from 'zod';
import { admin, must } from '../lib/supabase.js';
import { bad, notFound } from '../lib/http.js';

const ratingMap = async (ids) => {
  if (!ids.length) return {};
  const rows = must(await admin().from('course_reviews').select('course_id,rating').in('course_id', ids));
  const m = {};
  for (const r of rows) { (m[r.course_id] ||= []).push(r.rating); }
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { avg: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), count: v.length }]));
};

export async function decorateCourses(courses) {
  const ids = courses.map((c) => c.id);
  if (!ids.length) return [];
  const [ratings, lessons, enr, ci] = await Promise.all([
    ratingMap(ids),
    admin().from('lessons').select('course_id,duration_seconds').in('course_id', ids).then(must),
    admin().from('enrollments').select('course_id').in('course_id', ids).neq('status', 'revoked').then(must),
    admin().from('course_instructors').select('course_id, profiles(id,full_name,avatar_url)').in('course_id', ids).then(must),
  ]);
  return courses.map((c) => {
    const ls = lessons.filter((l) => l.course_id === c.id);
    return {
      ...c,
      rating: ratings[c.id] || { avg: 0, count: 0 },
      lesson_count: ls.length,
      duration_seconds: ls.reduce((a, l) => a + l.duration_seconds, 0),
      student_count: enr.filter((e) => e.course_id === c.id).length,
      instructors: ci.filter((x) => x.course_id === c.id).map((x) => x.profiles).filter(Boolean),
    };
  });
}

const LIST_COLS = 'id,slug,title,subtitle,thumbnail_url,level,price_minor,compare_at_minor,currency,is_featured,category_id,course_categories(name,slug)';

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });
const contactSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), message: z.string().trim().min(10).max(3000) });

export default [
  { method: 'GET', path: '/courses', async handler({ query }) {
    const page = Math.max(1, +query.page || 1); const size = Math.min(24, +query.pageSize || 12);
    let q = admin().from('courses').select(LIST_COLS, { count: 'exact' }).eq('status', 'published');
    if (query.search) q = q.or(`title.ilike.%${query.search.replace(/[%,()]/g, '')}%,subtitle.ilike.%${query.search.replace(/[%,()]/g, '')}%`);
    if (query.category) { const c = await admin().from('course_categories').select('id').eq('slug', query.category).maybeSingle(); q = q.eq('category_id', c.data?.id ?? '00000000-0000-0000-0000-000000000000'); }
    if (['beginner', 'intermediate', 'advanced'].includes(query.level)) q = q.eq('level', query.level);
    if (query.featured === '1') q = q.eq('is_featured', true);
    if (query.price === 'free') q = q.eq('price_minor', 0); else if (query.price === 'paid') q = q.gt('price_minor', 0);
    const sort = { newest: ['published_at', false], price_asc: ['price_minor', true], price_desc: ['price_minor', false] }[query.sort] || ['published_at', false];
    const { data, count, error } = await q.order(sort[0], { ascending: sort[1] }).range((page - 1) * size, page * size - 1);
    if (error) throw bad(error.message);
    return { items: await decorateCourses(data), total: count ?? 0, page, pageSize: size };
  } },

  { method: 'GET', path: '/courses/:slug', auth: 'optional', async handler({ params, user }) {
    const c = must(await admin().from('courses').select('*, course_categories(name,slug)').eq('slug', params.slug).maybeSingle());
    if (!c) throw notFound('Course not found');
    const canPreviewDraft = user && (user.roles.includes('admin') || (await admin().from('course_instructors').select('user_id').eq('course_id', c.id).eq('user_id', user.id).maybeSingle()).data);
    if (c.status !== 'published' && !canPreviewDraft) throw notFound('Course not found');
    const [modules, lessons, reqs, reviews, [dec]] = await Promise.all([
      admin().from('course_modules').select('id,title,position').eq('course_id', c.id).order('position').then(must),
      admin().from('lessons').select('id,module_id,title,type,duration_seconds,is_preview,position').eq('course_id', c.id).order('position').then(must),
      admin().from('course_requirements').select('id,kind,body,position').eq('course_id', c.id).order('position').then(must),
      admin().from('course_reviews').select('id,rating,comment,created_at,profiles(full_name,avatar_url)').eq('course_id', c.id).order('created_at', { ascending: false }).limit(20).then(must),
      decorateCourses([c]),
    ]);
    let enrolled = false;
    if (user) { const e = await admin().from('enrollments').select('status').eq('user_id', user.id).eq('course_id', c.id).maybeSingle(); enrolled = !!e.data && e.data.status !== 'revoked'; }
    return { course: { ...dec, description: c.description, language: c.language, certificate_enabled: c.certificate_enabled, access_days: c.access_days },
      modules: modules.map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id) })),
      requirements: reqs.filter((r) => r.kind === 'requirement'), outcomes: reqs.filter((r) => r.kind === 'outcome'), reviews, enrolled };
  } },

  { method: 'GET', path: '/categories', handler: async () => must(await admin().from('course_categories').select('*').order('position')) },
  { method: 'GET', path: '/testimonials', handler: async () => must(await admin().from('testimonials').select('*').eq('is_published', true).order('position')) },
  { method: 'GET', path: '/faqs', handler: async () => must(await admin().from('faqs').select('*').eq('is_published', true).order('position')) },
  { method: 'GET', path: '/instructors', handler: async () => must(await admin().from('public_instructors').select('*')) },
  { method: 'GET', path: '/instructors/:id', async handler({ params }) {
    const p = must(await admin().from('public_instructors').select('*').eq('id', params.id).maybeSingle());
    if (!p) throw notFound('Instructor not found');
    const ids = must(await admin().from('course_instructors').select('course_id').eq('user_id', params.id)).map((r) => r.course_id);
    const cs = ids.length ? must(await admin().from('courses').select(LIST_COLS).in('id', ids).eq('status', 'published')) : [];
    return { instructor: p, courses: await decorateCourses(cs) };
  } },
  { method: 'GET', path: '/settings/public', async handler() {
    const rows = must(await admin().from('platform_settings').select('key,value').eq('is_public', true));
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } },
  { method: 'GET', path: '/blog', handler: async () => must(await admin().from('blog_posts').select('id,slug,title,excerpt,cover_url,published_at').eq('is_published', true).order('published_at', { ascending: false })) },
  { method: 'GET', path: '/blog/:slug', async handler({ params }) {
    const p = must(await admin().from('blog_posts').select('*').eq('slug', params.slug).eq('is_published', true).maybeSingle());
    if (!p) throw notFound('Article not found'); return p;
  } },
  { method: 'GET', path: '/verify/:no', limit: 30, async handler({ params }) {
    const rows = must(await admin().rpc('verify_certificate', { p_no: params.no }));
    return rows[0] ? { valid: true, certificate: rows[0] } : { valid: false };
  } },
  { method: 'POST', path: '/newsletter', limit: 5, async handler({ body }) {
    const p = emailSchema.safeParse(body); if (!p.success) throw bad('Enter a valid email address');
    must(await admin().from('newsletter_subscribers').upsert({ email: p.data.email }, { onConflict: 'email', ignoreDuplicates: true }));
    return { ok: true };      // same response whether or not they were already subscribed
  } },
  { method: 'POST', path: '/contact', limit: 5, async handler({ body }) {
    const p = contactSchema.safeParse(body); if (!p.success) throw bad('Please check your details and try again', p.error.flatten());
    must(await admin().from('contact_messages').insert(p.data));
    return { ok: true };
  } },
];
