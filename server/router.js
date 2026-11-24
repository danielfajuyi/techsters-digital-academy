import { send, HttpError, readRaw, clientIp, rateLimit } from './lib/http.js';
import { authenticate, assertRole } from './lib/auth.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import paymentRoutes from './routes/payments.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';

/**
 * Route shape: { method, path, auth?: 'user'|'staff'|'admin'|'optional', raw?: boolean, handler(ctx) }
 * Handlers return JSON-serialisable data (or { __raw: {status, type, body, headers} } for files).
 */
const table = [...publicRoutes, ...authRoutes, ...studentRoutes, ...paymentRoutes, ...staffRoutes, ...adminRoutes].map((r) => {
  const keys = [];
  const re = new RegExp('^' + r.path.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
  return { ...r, re, keys };
});

export async function handle(req, res) {
  try {
    const url = new URL(req.url, 'http://local');
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const ip = clientIp(req);

    let route; let params = {};
    for (const r of table) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(path);
      if (m) { route = r; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; }
    }
    if (!route) {
      if (path === '/health') return send(res, 200, { ok: true });
      throw new HttpError(404, 'Endpoint not found');
    }

    rateLimit(`g:${ip}`, 240, 60_000);
    if (route.limit) rateLimit(`${route.method}${route.path}:${ip}`, route.limit, 60_000);

    const rawBuf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readRaw(req) : Buffer.alloc(0);
    let body = {};
    if (!route.raw && rawBuf.length) {
      try { body = JSON.parse(rawBuf.toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON body'); }
    }

    let user = null;
    if (route.auth === 'optional') { try { user = await authenticate(req); } catch { user = null; } }
    else if (route.auth) {
      user = await authenticate(req);
      if (route.auth === 'staff' || route.auth === 'admin') assertRole(user, route.auth);
    }

    const out = await route.handler({ req, res, user, params, query: Object.fromEntries(url.searchParams), body, raw: rawBuf, ip });
    if (out?.__raw) {
      res.statusCode = out.__raw.status || 200;
      res.setHeader('Content-Type', out.__raw.type);
      for (const [k, v] of Object.entries(out.__raw.headers || {})) res.setHeader(k, v);
      return res.end(out.__raw.body);
    }
    return send(res, 200, out ?? { ok: true });
  } catch (e) {
    const status = e.status && e.status < 600 ? e.status : 500;
    if (status >= 500) console.error('[api]', req.method, req.url, e);
    return send(res, status, { error: status >= 500 ? 'Something went wrong on our side. Please try again.' : e.message, details: e.details });
  }
}
