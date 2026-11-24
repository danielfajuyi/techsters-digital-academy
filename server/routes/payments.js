import crypto from 'node:crypto';
import { z } from 'zod';
import { admin, must } from '../lib/supabase.js';
import { bad, HttpError } from '../lib/http.js';
import { priceCourse } from '../lib/pricing.js';
import { initializeTransaction, validWebhookSignature } from '../lib/paystack.js';
import { settleOrder } from '../lib/fulfill.js';
import { isEnrolled, notify } from '../lib/auth.js';

export default [
  { method: 'POST', path: '/coupons/validate', auth: 'user', limit: 20, async handler({ body }) {
    const s = z.object({ courseId: z.string().uuid(), code: z.string().trim().min(1).max(40) }).safeParse(body); if (!s.success) throw bad('Enter a discount code');
    const p = await priceCourse(s.data.courseId, s.data.code);
    return { list_minor: p.list, discount_minor: p.discount, total_minor: p.total, currency: p.course.currency };
  } },

  { method: 'POST', path: '/checkout', auth: 'user', limit: 10, async handler({ user, body }) {
    const s = z.object({ courseId: z.string().uuid(), couponCode: z.string().trim().max(40).nullish() }).safeParse(body); if (!s.success) throw bad('Invalid request');
    const { course, coupon, list, discount, total } = await priceCourse(s.data.courseId, s.data.couponCode || null);
    if (await isEnrolled(user.id, course.id)) throw new HttpError(409, 'You are already enrolled in this course');

    // Free (or fully discounted) → enroll immediately, no payment provider involved.
    if (total === 0) {
      if (list > 0 && coupon) {
        const ref = `TCH-${crypto.randomBytes(8).toString('hex')}`;
        await admin().from('orders').update({ status: 'abandoned' }).eq('user_id', user.id).eq('course_id', course.id).eq('status', 'pending');
        const o = must(await admin().from('orders').insert({ reference: ref, user_id: user.id, course_id: course.id, coupon_id: coupon.id, list_price_minor: list, discount_minor: discount, amount_minor: 0, currency: course.currency, status: 'paid', paid_at: new Date().toISOString() }).select('id').single());
        await admin().from('coupons').update({ redeemed_count: coupon.redeemed_count + 1 }).eq('id', coupon.id);
        must(await admin().rpc('enroll_user', { p_user: user.id, p_course: course.id, p_source: 'purchase', p_order: o.id }));
      } else {
        must(await admin().rpc('enroll_user', { p_user: user.id, p_course: course.id, p_source: 'free', p_order: null }));
      }
      await notify(user.id, 'enrollment', "You're enrolled", `You now have access to ${course.title}.`, `/learn/${course.slug}`);
      return { enrolled: true, slug: course.slug };
    }

    // Paid: supersede any stale pending order, create a fresh one, and open a Paystack transaction.
    await admin().from('orders').update({ status: 'abandoned' }).eq('user_id', user.id).eq('course_id', course.id).eq('status', 'pending');
    const reference = `TCH-${crypto.randomBytes(10).toString('hex')}`;
    must(await admin().from('orders').insert({ reference, user_id: user.id, course_id: course.id, coupon_id: coupon?.id ?? null, list_price_minor: list, discount_minor: discount, amount_minor: total, currency: course.currency }));
    const tx = await initializeTransaction({
      email: user.email, amount: total, currency: course.currency, reference,
      callback_url: `${process.env.APP_URL}/checkout/callback`,
      metadata: { course_id: course.id, user_id: user.id, cancel_action: `${process.env.APP_URL}/courses/${course.slug}` },
    });
    return { authorization_url: tx.authorization_url, reference };
  } },

  // Called by the browser after Paystack redirects back. We never trust the redirect; we ask Paystack.
  { method: 'GET', path: '/checkout/verify', auth: 'user', limit: 30, async handler({ user, query }) {
    const reference = String(query.reference || '');
    const order = must(await admin().from('orders').select('id,user_id,status,courses(slug,title)').eq('reference', reference).maybeSingle());
    if (!order || order.user_id !== user.id) throw new HttpError(404, 'Order not found');
    if (order.status === 'paid') return { status: 'paid', slug: order.courses.slug, title: order.courses.title };
    const r = await settleOrder(reference);
    return { status: r.status, slug: order.courses.slug, title: order.courses.title };
  } },

  { method: 'POST', path: '/webhooks/paystack', raw: true, async handler({ req, raw }) {
    if (!validWebhookSignature(raw, req.headers['x-paystack-signature'])) throw new HttpError(401, 'Invalid signature');
    const event = JSON.parse(raw.toString('utf8'));
    const eventId = event?.data?.id ? `${event.event}:${event.data.id}` : null;
    const logged = await admin().from('payment_transactions').insert({ provider: 'paystack', event_id: eventId, event_type: event.event, reference: event?.data?.reference ?? null, payload: event });
    if (logged.error && logged.error.code !== '23505') console.error('[paystack] log failed', logged.error.message);
    if (event.event === 'charge.success' && event.data?.reference) {
      await settleOrder(event.data.reference);           // re-verifies with Paystack before enrolling
      await admin().from('payment_transactions').update({ processed: true }).eq('provider', 'paystack').eq('event_id', eventId);
    }
    return { received: true };    // always 200 once the signature is valid so Paystack stops retrying
  } },
];
