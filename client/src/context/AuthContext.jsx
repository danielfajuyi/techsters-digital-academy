import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, configured } from '../lib/supabase.js';
import { api } from '../lib/api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null); // { profile, roles, settings, unread }
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try { setMe(await api('/me')); } catch { setMe(null); }
  }, []);

  useEffect(() => {
    if (!configured) { setLoading(false); return undefined; }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) await loadMe();
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') setMe(null);
      // defer so we never call the auth client from inside its own callback
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(loadMe, 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadMe]);

  const value = useMemo(() => {
    const roles = me?.roles || [];
    return {
      loading, session, user: session?.user ?? null, profile: me?.profile ?? null, roles, unread: me?.unread ?? 0, settings: me?.settings,
      isAdmin: roles.includes('admin'), isInstructor: roles.includes('instructor'), isStaff: roles.includes('admin') || roles.includes('instructor'),
      refresh: loadMe, setUnread: (n) => setMe((m) => (m ? { ...m, unread: n } : m)),
      signUp: (email, password, fullName) => supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/callback` } }),
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      signInWithGoogle: (next = '/app') => { window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/auth/google?next=${encodeURIComponent(next)}`; },
      resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }),
      updatePassword: (password) => supabase.auth.updateUser({ password }),
      signOut: async () => { await supabase.auth.signOut(); setMe(null); },
    };
  }, [loading, session, me, loadMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
