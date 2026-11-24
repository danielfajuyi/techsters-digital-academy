import { createClient } from '@supabase/supabase-js';

let client;
/** Service-role client. Server only: bypasses RLS, so every caller MUST authorise first. */
export function admin() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase server environment variables are missing');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** Throws a readable error if a PostgREST call failed. */
export function must({ data, error }) {
  if (error) {
    const e = new Error(error.message);
    e.status = error.code === '23505' ? 409 : 400;
    e.code = error.code;
    throw e;
  }
  return data;
}
