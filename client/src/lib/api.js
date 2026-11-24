import { supabase } from './supabase.js';

export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details; }
}

const API_BASE = import.meta.env.VITE_API_URL || '';

/** Central API client: attaches the Supabase access token and normalises errors. */
export async function api(path, { method = 'GET', body, auth = true, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Network problem. Check your connection and try again.', 0);
  }
  if (raw) return res;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error || 'Something went wrong', res.status, json.details);
  return json;
}

export const qs = (o) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null));
  const s = p.toString(); return s ? `?${s}` : '';
};

/** Browser download of an authenticated file response (CSV exports). */
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  if (!res.ok) throw new ApiError('Export failed', res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
