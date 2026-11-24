import { z } from 'zod';
import { admin, must } from '../lib/supabase.js';
import { bad, notFound, forbidden, csvEscape, slugify } from '../lib/http.js';
import { audit, notify } from '../lib/auth.js';
import { refundTransaction } from '../lib/paystack.js';

const like = (s) => String(s).replace(/[%,()*]/g, '');
const days = (n) => new Date(Date.now() - n * 864e5).toISOString();

// Allow-listed generic CRUD for site content tables.
const CONTENT = {
  testimonials: { table: 'testimonials', fields: z.object({ name: z.string().min(1).max(120), role: z.string().max(160).nullish(), quote: z.string().min(5).max(1000), avatar_url: z.string().url().nullish(), is_published: z.boolean().optional(), position: z.number().int().optional() }), order: 'position' },
  faqs: { table: 'faqs', fields: z.object({ question: z.string().min(3).max(300), answer: z.string().min(3).max(3000), is_published: z.boolean().optional(), position: z.number().int().optional() }), order: 'position' },
  categories: { table: 'course_categories', fields: z.object({ name: z.string().min(2).max(80), slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(), description: z.string().max(400).nullish(), position: z.number().int().optional() }), order: 'position' },
  coupons: { table: 'coupons', fields: z.object({ code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/), percent_off: z.number().int().min(1).max(100).nullish(), amount_off_minor: z.number().int().min(1).nullish(), course_id: z.string().uuid().nullish(), max_redemptions: z.number().int().min(1).nullish(), valid_from: z.string().datetime().nullish(), valid_until: z.string().datetime().nullish(), is_active: z.boolean().optional() }), order: 'created_at' },
  blog: { table: 'blog_posts', fields: z.object({ title: z.string().min(3).max(200), slug: z.string().regex(/^[a-z0-9-]+$/).optional(), excerpt: z.string().max(400).nullish(), body_html: z.string().max(100000).optional(), cover_url: z.string().url().nullish(), is_published: z.boolean().optional() }), order: 'created_at' },
};
const content = (name) => CONTENT[name] || (() => { throw notFound('Unknown content type'); })();

export default [
  { method: 'GET', path: '/admin/overview', auth: 'admin', async handler() {
    const head = (t, f) => { let q = admin().from(t).select('*', { count: 'exact', head: true }); return (f ? f(q) : q).then((r) => r.count ?? 0); };
    const [students, instructors, courses, enrollments, paid, regs, recentTx, recentEnr, topEnr] = await Promise.all([
      head('user_roles', (q) => q.eq('role', 'student')), head('user_roles', (q) => q.eq('role', 'instructor')), head('courses', (q) => q.eq('status', 'published')), head('enrollments', (q) => q.neq('status', 'revoked')),
      admin().from('orders').select('amount_minor,currency,paid_at').eq('status', 'paid').then(must),
      admin().from('profiles').select('id,full_name,email,created_at').order('created_at', { ascending: false }).limit(6).then(must),
      admin().from('orders').select('id,reference,amount_minor,currency,status,created_at,profiles(full_name),courses(title)').order('created_at', { ascending: false }).limit(6).then(must),
      admin().from('enrollments').select('enrolled_at').gte('enrolled_at', days(30)).then(must),
      admin().from('enrollments').select('course_id,courses(title)').neq('status', 'revoked').then(must),
    ]);
    const perDay = {}; for (let i = 29; i >= 0; i--) perDay[days(i).slice(0, 10)] = 0;
    recentEnr.forEach((e) => { const d = e.enrolled_at.slice(0, 10); if (d in perDay) perDay[d]++; });
    const counts = {}; topEnr.forEach((e) => { counts[e.course_id] = counts[e.course_id] || { title: e.courses?.title, enrollments: 0 }; counts[e.course_id].enrollments++; });
    return { totals: { students, instructors, courses, enrollments, revenue_minor: paid.reduce((a, o) => a + o.amount_minor, 0), revenue_30d_minor: paid.filter((o) => o.paid_at >= days(30)).reduce((a, o) => a + o.amount_minor, 0) },
      enrollments_by_day: Object.entries(perDay).map(([date, count]) => ({ date, count })), recent_registrations: regs, recent_transactions: recentTx,
      top_courses: Object.values(counts).sort((a, b) => b.enrollments - a.enrollments).slice(0, 5) };
  } },

  // ───── users ─────
  { method: 'GET', path: '/admin/users', auth: 'admin', async handler({ query }) {
    const page = Math.max(1, +query.page || 1); const size = 20;
    let q = admin().from('profiles').select('id,full_name,email,avatar_url,is_active,created_at,user_roles(role)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * size, page * size - 1);
    if (query.search) q = q.or(`full_name.ilike.%${like(query.search)}%,email.ilike.%${like(query.search)}%`);
    if (['student', 'instructor', 'admin'].includes(query.role)) q = admin().from('profiles').select('id,full_name,email,avatar_url,is_active,created_at,user_roles!inner(role)', { count: 'exact' }).eq('user_roles.role', query.role).order('created_at', { ascending: false }).range((page - 1) * size, page * size - 1);
    const { data, count, error } = await q; if (error) throw bad(error.message);
    return { items: data.map((u) => ({ ...u, roles: u.user_roles.map((r) => r.role) })), total: count ?? 0, page, pageSize: size };
  } },
  { method: 'GET', path: '/admin/users/:id', auth: 'admin', async handler({ params }) {
    const p = must(await admin().from('profiles').select('*, user_roles(role)').eq('id', params.id).maybeSingle()); if (!p) throw notFound('User not found');
    const [enr, orders] = await Promise.all([
      admin().from('enrollments').select('id,status,source,enrolled_at,courses(title,slug)').eq('user_id', params.id).order('enrolled_at', { ascending: false }).then(must),
      admin().from('orders').select('id,reference,amount_minor,currency,status,created_at,courses(title)').eq('user_id', params.id).order('created_at', { ascending: false }).then(must),
    ]);
    return { profile: { ...p, roles: p.user_roles.map((r) => r.role) }, enrollments: enr, orders };
  } },
  { method: 'PATCH', path: '/admin/users/:id', auth: 'admin', async handler({ user, params, body, ip }) {
    const s = z.object({ full_name: z.string().trim().min(2).max(120).optional(), headline: z.string().max(160).nullish(), is_active: z.boolean().optional() }).safeParse(body); if (!s.success) throw bad('Invalid user details');
    if (s.data.is_active === false && params.id === user.id) throw forbidden('You cannot deactivate your own account');
    must(await admin().from('profiles').update(s.data).eq('id', params.id));
    if (s.data.is_active === false) await admin().auth.admin.signOut(params.id).catch(() => {});
    await audit(user, s.data.is_active === false ? 'user.deactivate' : 'user.update', 'user', params.id, s.data, ip); return { ok: true };
  } },
  { method: 'PUT', path: '/admin/users/:id/roles', auth: 'admin', async handler({ user, params, body, ip }) {
    const s = z.object({ roles: z.array(z.enum(['student', 'instructor', 'admin'])).min(1) }).safeParse(body); if (!s.success) throw bad('Choose at least one role');
    const roles = [...new Set([...s.data.roles, 'student'])];
    if (params.id === user.id && !roles.includes('admin')) throw forbidden('You cannot remove your own administrator role');
    await admin().from('user_roles').delete().eq('user_id', params.id);
    must(await admin().from('user_roles').insert(roles.map((role) => ({ user_id: params.id, role, granted_by: user.id }))));
    await audit(user, 'user.roles', 'user', params.id, { roles }, ip); return { ok: true, roles };
  } },

  // ───── enrolments ─────
  { method: 'GET', path: '/admin/enrollments', auth: 'admin', async handler({ query }) {
    const page = Math.max(1, +query.page || 1); const size = 25;
    let q = admin().from('enrollments').select('id,status,source,enrolled_at,user_id,course_id,profiles(full_name,email),courses(title)', { count: 'exact' }).order('enrolled_at', { ascending: false }).range((page - 1) * size, page * size - 1);
    if (query.courseId) q = q.eq('course_id', query.courseId);
    if (['active', 'completed', 'revoked'].includes(query.status)) q = q.eq('status', query.status);
    const { data, count, error } = await q; if (error) throw bad(error.message);
    return { items: data, total: count ?? 0, page, pageSize: size };
  } },
  { method: 'POST', path: '/admin/enrollments', auth: 'admin', async handler({ user, body, ip }) {
    const s = z.object({ email: z.string().email(), courseId: z.string().uuid() }).safeParse(body); if (!s.success) throw bad('Enter a student email and choose a course');
    const p = must(await admin().from('profiles').select('id').eq('email', s.data.email).maybeSingle()); if (!p) throw notFound('No account exists with that email. Ask the student to sign up first.');
    must(await admin().rpc('enroll_user', { p_user: p.id, p_course: s.data.courseId, p_source: 'manual', p_order: null }));
    const c = must(await admin().from('courses').select('title,slug').eq('id', s.data.courseId).single());
    await notify(p.id, 'enrollment', "You're enrolled", `You've been enrolled in ${c.title}.`, `/learn/${c.slug}`); await audit(user, 'enrollment.manual', 'enrollment', p.id, { course: s.data.courseId }, ip); return { ok: true };
  } },
  { method: 'DELETE', path: '/admin/enrollments/:id', auth: 'admin', async handler({ user, params, ip }) {
    must(await admin().from('enrollments').update({ status: 'revoked' }).eq('id', params.id));   // revoke, never hard-delete: keeps progress & audit trail
    await audit(user, 'enrollment.revoke', 'enrollment', params.id, {}, ip); return { ok: true };
  } },

  // ───── payments ─────
  { method: 'GET', path: '/admin/orders', auth: 'admin', async handler({ query }) {
    const page = Math.max(1, +query.page || 1); const size = 25;
    let q = admin().from('orders').select('id,reference,amount_minor,discount_minor,currency,status,created_at,paid_at,profiles(full_name,email),courses(title)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * size, page * size - 1);
    if (['pending', 'paid', 'failed', 'refunded', 'abandoned'].includes(query.status)) q = q.eq('status', query.status);
    const { data, count, error } = await q; if (error) throw bad(error.message);
    return { items: data, total: count ?? 0, page, pageSize: size };
  } },
  { method: 'GET', path: '/admin/orders/export', auth: 'admin', async handler({ query, user, ip }) {
    let q = admin().from('orders').select('reference,amount_minor,discount_minor,currency,status,created_at,paid_at,profiles(full_name,email),courses(title)').order('created_at', { ascending: false }).limit(10000);
    if (['pending', 'paid', 'failed', 'refunded', 'abandoned'].includes(query.status)) q = q.eq('status', query.status);
    const rows = must(await q);
    const head = ['Reference', 'Student', 'Email', 'Course', 'Amount', 'Discount', 'Currency', 'Status', 'Created', 'Paid'];
    const csv = [head, ...rows.map((o) => [o.reference, o.profiles?.full_name, o.profiles?.email, o.courses?.title, o.amount_minor / 100, o.discount_minor / 100, o.currency, o.status, o.created_at, o.paid_at])].map((r) => r.map(csvEscape).join(',')).join('\n');
    await audit(user, 'orders.export', 'order', null, { rows: rows.length }, ip);
    return { __raw: { type: 'text/csv; charset=utf-8', body: '\ufeff' + csv, headers: { 'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` } } };
  } },
  { method: 'POST', path: '/admin/orders/:id/refund', auth: 'admin', async handler({ user, params, body, ip }) {
    const o = must(await admin().from('orders').select('id,status,amount_minor,user_id,course_id,payments(provider_ref)').eq('id', params.id).maybeSingle()); if (!o) throw notFound('Order not found');
    if (o.status !== 'paid') throw bad('Only paid orders can be refunded');
    const ref = o.payments?.[0]?.provider_ref; if (!ref) throw bad('No payment record found for this order');
    const reason = z.string().max(300).nullish().parse(body?.reason ?? null);
    const rf = must(await admin().from('refunds').insert({ order_id: o.id, amount_minor: o.amount_minor, reason, created_by: user.id }).select().single());
    try {
      const r = await refundTransaction(ref, o.amount_minor);
      await admin().from('refunds').update({ status: 'processed', provider_ref: String(r?.id ?? '') }).eq('id', rf.id);
      await admin().from('orders').update({ status: 'refunded' }).eq('id', o.id);
      await admin().from('enrollments').update({ status: 'revoked' }).eq('user_id', o.user_id).eq('course_id', o.course_id);
    } catch (e) { await admin().from('refunds').update({ status: 'failed' }).eq('id', rf.id); throw e; }
    await audit(user, 'order.refund', 'order', o.id, { amount: o.amount_minor }, ip); return { ok: true };
  } },

  // ───── generic content (testimonials, FAQs, categories, coupons, blog) ─────
  { method: 'GET', path: '/admin/content/:name', auth: 'admin', async handler({ params }) { const c = content(params.name); return must(await admin().from(c.table).select('*').order(c.order, { ascending: c.order === 'position' })); } },
  { method: 'POST', path: '/admin/content/:name', auth: 'admin', async handler({ user, params, body, ip }) {
    const c = content(params.name); const s = c.fields.safeParse(body); if (!s.success) throw bad('Check the details and try again', s.error.flatten());
    const row = { ...s.data };
    if (['categories', 'blog'].includes(params.name) && !row.slug) row.slug = slugify(row.name || row.title);
    if (params.name === 'blog' && row.is_published) row.published_at = new Date().toISOString();
    if (params.name === 'coupons' && !!row.percent_off === !!row.amount_off_minor) throw bad('Set either a percentage or a fixed amount');
    const out = must(await admin().from(c.table).insert(row).select().single()); await audit(user, `${params.name}.create`, c.table, out.id, {}, ip); return out;
  } },
  { method: 'PATCH', path: '/admin/content/:name/:id', auth: 'admin', async handler({ user, params, body, ip }) {
    const c = content(params.name); const s = c.fields.partial().safeParse(body); if (!s.success) throw bad('Check the details and try again', s.error.flatten());
    const row = { ...s.data }; if (params.name === 'blog' && row.is_published) row.published_at = new Date().toISOString();
    const out = must(await admin().from(c.table).update(row).eq('id', params.id).select().single()); await audit(user, `${params.name}.update`, c.table, params.id, {}, ip); return out;
  } },
  { method: 'DELETE', path: '/admin/content/:name/:id', auth: 'admin', async handler({ user, params, ip }) {
    const c = content(params.name); must(await admin().from(c.table).delete().eq('id', params.id)); await audit(user, `${params.name}.delete`, c.table, params.id, {}, ip); return { ok: true };
  } },

  // ───── settings, audit, applications, tickets, messages ─────
  { method: 'GET', path: '/admin/settings', auth: 'admin', handler: async () => must(await admin().from('platform_settings').select('*').order('key')) },
  { method: 'PUT', path: '/admin/settings/:key', auth: 'admin', async handler({ user, params, body, ip }) {
    const known = must(await admin().from('platform_settings').select('key').eq('key', params.key).maybeSingle()); if (!known) throw notFound('Unknown setting');
    must(await admin().from('platform_settings').update({ value: body.value, updated_at: new Date().toISOString() }).eq('key', params.key)); await audit(user, 'settings.update', 'setting', params.key, {}, ip); return { ok: true };
  } },
  { method: 'GET', path: '/admin/audit', auth: 'admin', async handler({ query }) {
    const page = Math.max(1, +query.page || 1); const size = 30;
    const { data, count, error } = await admin().from('audit_logs').select('*, profiles(full_name,email)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * size, page * size - 1); if (error) throw bad(error.message);
    return { items: data, total: count ?? 0, page, pageSize: size };
  } },
  { method: 'GET', path: '/admin/applications', auth: 'admin', handler: async () => must(await admin().from('instructor_applications').select('*, profiles!instructor_applications_user_id_fkey(full_name,email)').order('created_at', { ascending: false })) },
  { method: 'POST', path: '/admin/applications/:id/decision', auth: 'admin', async handler({ user, params, body, ip }) {
    const a = must(await admin().from('instructor_applications').select('*').eq('id', params.id).maybeSingle()); if (!a) throw notFound(); if (a.status !== 'pending') throw bad('This application was already reviewed');
    const approve = z.boolean().parse(!!body.approve);
    must(await admin().from('instructor_applications').update({ status: approve ? 'approved' : 'rejected', reviewed_by: user.id }).eq('id', a.id));
    if (approve) await admin().from('user_roles').upsert({ user_id: a.user_id, role: 'instructor', granted_by: user.id });
    await notify(a.user_id, 'application', approve ? 'Instructor application approved' : 'Instructor application update', approve ? 'You can now create courses from your instructor dashboard.' : 'Thanks for applying. We are not able to approve your application right now.', approve ? '/instructor' : '/app');
    await audit(user, approve ? 'application.approve' : 'application.reject', 'application', a.id, {}, ip); return { ok: true };
  } },
  { method: 'GET', path: '/admin/tickets', auth: 'admin', handler: async () => must(await admin().from('support_tickets').select('*, profiles(full_name,email)').order('created_at', { ascending: false }).limit(200)) },
  { method: 'PATCH', path: '/admin/tickets/:id', auth: 'admin', async handler({ user, params, body }) {
    const s = z.object({ status: z.enum(['open', 'pending', 'closed']).optional(), admin_reply: z.string().max(4000).nullish() }).safeParse(body); if (!s.success) throw bad('Invalid ticket update');
    const t = must(await admin().from('support_tickets').update({ ...s.data, updated_at: new Date().toISOString() }).eq('id', params.id).select('user_id,subject').single());
    if (s.data.admin_reply) await notify(t.user_id, 'support', 'Support replied', `Re: ${t.subject}`, '/app/support'); return { ok: true };
  } },
  { method: 'GET', path: '/admin/messages', auth: 'admin', handler: async () => must(await admin().from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200)) },
];
