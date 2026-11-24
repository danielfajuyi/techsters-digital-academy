import crypto from 'node:crypto';

const BASE = 'https://api.paystack.co';
const secret = () => {
  if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return process.env.PAYSTACK_SECRET_KEY;
};

async function call(path, { method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.status === false) {
    const e = new Error(json.message || 'Paystack request failed'); e.status = 502; throw e;
  }
  return json.data;
}

export const initializeTransaction = (p) => call('/transaction/initialize', { method: 'POST', body: p });
export const verifyTransaction = (reference) => call(`/transaction/verify/${encodeURIComponent(reference)}`);
export const refundTransaction = (transaction, amount) => call('/refund', { method: 'POST', body: { transaction, amount } });

/** Constant-time check of Paystack's x-paystack-signature (HMAC-SHA512 of the raw body). */
export function validWebhookSignature(rawBody, signature) {
  if (!signature) return false;
  const expected = crypto.createHmac('sha512', secret()).update(rawBody).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
