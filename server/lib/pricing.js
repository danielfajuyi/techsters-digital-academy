import { admin } from './supabase.js';
import { bad } from './http.js';

/** Server-side price calculation. The client never supplies an amount. */
export async function priceCourse(courseId, couponCode) {
  const { data: course } = await admin().from('courses').select('id,slug,title,price_minor,currency,status').eq('id', courseId).maybeSingle();
  if (!course || course.status !== 'published') throw bad('This course is not available');
  let coupon = null; let discount = 0;
  if (couponCode) {
    const { data } = await admin().from('coupons').select('*').eq('code', couponCode.trim()).maybeSingle();
    const now = new Date();
    if (!data || !data.is_active) throw bad('That discount code is not valid');
    if (data.valid_from && new Date(data.valid_from) > now) throw bad('That discount code is not active yet');
    if (data.valid_until && new Date(data.valid_until) < now) throw bad('That discount code has expired');
    if (data.max_redemptions != null && data.redeemed_count >= data.max_redemptions) throw bad('That discount code has been fully redeemed');
    if (data.course_id && data.course_id !== course.id) throw bad('That discount code does not apply to this course');
    coupon = data;
    discount = data.percent_off ? Math.floor((course.price_minor * data.percent_off) / 100) : Math.min(course.price_minor, data.amount_off_minor);
  }
  return { course, coupon, list: course.price_minor, discount, total: Math.max(0, course.price_minor - discount) };
}
