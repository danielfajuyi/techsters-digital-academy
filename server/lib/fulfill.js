import { admin } from './supabase.js';
import { verifyTransaction } from './paystack.js';
import { sendEmail } from './email.js';
import { HttpError } from './http.js';

/**
 * Independently verifies a charge with Paystack, then atomically marks the order paid + enrolls the student.
 * Safe to call repeatedly / concurrently (webhook + redirect both call this).
 */
export async function settleOrder(reference) {
  const tx = await verifyTransaction(reference);
  if (tx.status !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(tx.status)) {
      await admin().from('orders').update({ status: tx.status === 'abandoned' ? 'abandoned' : 'failed' }).eq('reference', reference).eq('status', 'pending');
    }
    return { status: tx.status === 'success' ? 'paid' : tx.status };
  }
  const { data, error } = await admin().rpc('fulfill_order', {
    p_reference: reference, p_provider_ref: String(tx.id), p_amount: tx.amount, p_currency: tx.currency, p_channel: tx.channel ?? null,
    p_raw: { id: tx.id, status: tx.status, gateway_response: tx.gateway_response, paid_at: tx.paid_at, channel: tx.channel },
  });
  if (error) {
    if (/amount_mismatch/.test(error.message)) { console.error('[paystack] amount mismatch for', reference); throw new HttpError(409, 'Payment amount did not match the order. Contact support.'); }
    if (/order_not_found/.test(error.message)) throw new HttpError(404, 'Order not found');
    throw new HttpError(500, error.message);
  }
  const row = data?.[0];
  if (row && !row.already_paid) {
    const [{ data: u }, { data: c }] = await Promise.all([
      admin().from('profiles').select('email').eq('id', row.user_id).single(),
      admin().from('courses').select('title,slug').eq('id', row.course_id).single(),
    ]);
    sendEmail({ to: u.email, subject: `You're enrolled in ${c.title}`, heading: "You're in!", body: `Your payment was received and you now have access to ${c.title}.`, cta: { path: `/learn/${c.slug}`, label: 'Start learning' } });
  }
  return { status: 'paid', course_id: row?.course_id };
}
