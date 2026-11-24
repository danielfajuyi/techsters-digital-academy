import { admin } from './supabase.js';
import { HttpError, forbidden } from './http.js';

/** Verifies the Supabase access token and loads roles from the DB. Roles are never read from the client. */
export async function authenticate(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in to continue');
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  const uid = data.user.id;
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    admin().from('profiles').select('id,email,full_name,is_active,avatar_url').eq('id', uid).single(),
    admin().from('user_roles').select('role').eq('user_id', uid),
  ]);
  if (!profile) throw new HttpError(401, 'Account not found');
  if (!profile.is_active) throw new HttpError(403, 'This account has been deactivated. Contact support.');
  return { id: uid, email: profile.email, name: profile.full_name, profile, roles: (roleRows || []).map((r) => r.role) };
}

export function assertRole(user, level) {
  const isAdmin = user.roles.includes('admin');
  const isStaff = isAdmin || user.roles.includes('instructor');
  if (level === 'admin' && !isAdmin) throw forbidden('Administrator access required');
  if (level === 'staff' && !isStaff) throw forbidden('Instructor access required');
}

/** Admin, or an instructor assigned to the course. */
export async function assertCourseManager(user, courseId) {
  if (user.roles.includes('admin')) return;
  const { data } = await admin().from('course_instructors').select('user_id').eq('course_id', courseId).eq('user_id', user.id).maybeSingle();
  if (!data) throw forbidden('You are not an instructor on this course');
}

export async function isEnrolled(userId, courseId) {
  const { data } = await admin().from('enrollments').select('status,expires_at').eq('user_id', userId).eq('course_id', courseId).maybeSingle();
  if (!data || data.status === 'revoked') return false;
  return !data.expires_at || new Date(data.expires_at) > new Date();
}

export async function audit(user, action, entity, entityId, metadata = {}, ip = null) {
  await admin().from('audit_logs').insert({ actor_id: user?.id ?? null, action, entity, entity_id: entityId ? String(entityId) : null, metadata, ip });
}

export async function notify(userId, type, title, body, link) {
  await admin().from('notifications').insert({ user_id: userId, type, title, body, link });
}
