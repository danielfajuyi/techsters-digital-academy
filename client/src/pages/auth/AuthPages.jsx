import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabase.js';
import { Field, Spinner } from '../../components/ui/index.jsx';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app');

function Card({ title, sub, children }) {
  return <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16"><h1 className="text-3xl font-semibold">{title}</h1>{sub && <p className="mt-2 text-ink-600">{sub}</p>}<div className="card mt-6 p-6">{children}</div></div>;
}

const GoogleIcon = () => (<svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" /></svg>);

function GoogleButton({ next }) {
  const API_BASE = import.meta.env.VITE_API_URL || '';
  return (
    <>
      <a
        href={`${API_BASE}/api/auth/google?next=${encodeURIComponent(next || '/app')}`}
        className="btn-outline w-full flex items-center justify-center gap-2"
      >
        <GoogleIcon /> Continue with Google
      </a>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-ink-200" />or<span className="h-px flex-1 bg-ink-200" />
      </div>
    </>
  );
}

const friendly = (m = '') => /invalid login/i.test(m) ? 'Email or password is incorrect.' : /not confirmed/i.test(m) ? 'Confirm your email first. Check your inbox for the link.' : /rate limit/i.test(m) ? 'Too many attempts. Wait a few minutes and try again.' : m;

export function AdminLogin() {
  const { signIn, user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      if (isAdmin) {
        nav('/admin', { replace: true });
      } else {
        setErr('This account does not have administrator privileges. Contact system administrator.');
      }
    }
  }, [user, isAdmin, loading, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await signIn(f.email.trim(), f.password);
    if (error) {
      setErr(friendly(error.message));
      setBusy(false);
    }
  };

  return (
    <Card title="Admin Portal" sub="Sign in with your administrative credentials.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Admin Email" htmlFor="admin-email">
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
        </Field>
        <Field label="Password" htmlFor="admin-pw" error={err}>
          <input
            id="admin-pw"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Access Administration
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-500">
        Not an admin? <Link className="font-medium text-brand-700" to="/login">Student / General sign in</Link>
      </p>
    </Card>
  );
}

export function Login() {
  const { signIn, user } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams(); const next = safeNext(sp.get('next'));
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(sp.get('error') || ''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) nav(next, { replace: true }); }, [user, next, nav]);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); const { error } = await signIn(f.email.trim(), f.password); if (error) setErr(friendly(error.message)); setBusy(false); };
  return (
    <Card title="Welcome back" sub="Sign in to continue learning.">
      <GoogleButton next={next} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="email"><input id="email" type="email" autoComplete="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" htmlFor="pw" error={err}><input id="pw" type="password" autoComplete="current-password" required className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <div className="text-right text-sm"><Link to="/forgot-password" className="text-brand-700">Forgot password?</Link></div>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Sign in</button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-500">New here? <Link className="font-medium text-brand-700" to={`/register${sp.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link></p>
    </Card>
  );
}

export function Register() {
  const { signUp, user } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams(); const next = safeNext(sp.get('next'));
  const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState(sp.get('error') || ''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  useEffect(() => { if (user) nav(next, { replace: true }); }, [user, next, nav]);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.password.length < 8) return setErr('Use at least 8 characters for your password.');
    setBusy(true); const { data, error } = await signUp(f.email.trim(), f.password, f.name.trim());
    if (error) setErr(friendly(error.message));
    else if (data.user && data.user.identities?.length === 0) setErr('An account with this email already exists. Sign in instead, or reset your password.');
    else if (!data.session) setSent(true);
    setBusy(false);
  };
  if (sent) return <Card title="Check your email"><div className="flex gap-3"><MailCheck className="h-6 w-6 shrink-0 text-brand-600" /><p className="text-ink-600">We sent a confirmation link to <strong>{f.email}</strong>. Open it to activate your account, then sign in.</p></div></Card>;
  return (
    <Card title="Create your account" sub="Free to join. Start with any course.">
      <GoogleButton next={next} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="name"><input id="name" autoComplete="name" required minLength={2} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" htmlFor="email"><input id="email" type="email" autoComplete="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" htmlFor="pw" hint="At least 8 characters" error={err}><input id="pw" type="password" autoComplete="new-password" required minLength={8} className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Create account</button>
        <p className="text-xs text-ink-400">By continuing you agree to our <Link className="underline" to="/terms">terms</Link> and <Link className="underline" to="/privacy">privacy policy</Link>.</p>
      </form>
      <p className="mt-5 text-center text-sm text-ink-500">Already have an account? <Link className="font-medium text-brand-700" to="/login">Sign in</Link></p>
    </Card>
  );
}

export function Forgot() {
  const { resetPassword } = useAuth(); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); await resetPassword(email.trim()); setSent(true); setBusy(false); }; // same message either way: don't reveal which emails exist
  return (
    <Card title="Reset your password" sub="We'll email you a link to choose a new one.">
      {sent ? <p className="text-ink-600">If an account exists for <strong>{email}</strong>, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="space-y-4"><Field label="Email" htmlFor="email"><input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Send reset link</button></form>)}
      <p className="mt-5 text-center text-sm"><Link className="text-brand-700" to="/login">Back to sign in</Link></p>
    </Card>
  );
}

export function Reset() {
  const { updatePassword, session } = useAuth(); const nav = useNavigate();
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); if (pw.length < 8) return setErr('Use at least 8 characters.');
    setBusy(true); const { error } = await updatePassword(pw); if (error) setErr(error.message); else { setDone(true); setTimeout(() => nav('/app'), 1500); } setBusy(false);
  };
  return (
    <Card title="Choose a new password">
      {done ? <p className="text-ink-600">Password updated. Taking you to your dashboard…</p> : !session ? <p className="text-ink-600">This link has expired or was already used. <Link className="text-brand-700 underline" to="/forgot-password">Request a new one</Link>.</p> : (
        <form onSubmit={submit} className="space-y-4"><Field label="New password" htmlFor="pw" error={err} hint="At least 8 characters"><input id="pw" type="password" autoComplete="new-password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Update password</button></form>)}
    </Card>
  );
}

/** OAuth + email-confirmation landing page. Handles both URL hash fragments and PKCE codes. */
export function Callback() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [authError, setAuthError] = useState('');

  const next = safeNext(sp.get('next'));
  const errDesc = sp.get('error_description') || sp.get('error');

  useEffect(() => {
    // 1. Check for tokens in the hash fragment (#access_token=...&refresh_token=...)
    if (window.location.hash && window.location.hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorMsg = hashParams.get('error_description') || hashParams.get('error');
      if (errorMsg) {
        setAuthError(errorMsg);
        return;
      }
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ data, error }) => {
          if (error) {
            setAuthError(error.message);
          } else if (data?.session) {
            nav(next, { replace: true });
          }
        });
        return;
      }
    }

    // 2. Check for PKCE authorization code (?code=...)
    const code = sp.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          setAuthError(error.message);
        } else if (data?.session) {
          nav(next, { replace: true });
        }
      });
    }
  }, [nav, next, sp]);

  useEffect(() => {
    if (user && !loading) {
      nav(next, { replace: true });
    }
  }, [user, loading, nav, next]);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(t);
  }, []);

  const displayError = authError || errDesc;
  if (displayError || timedOut) {
    return (
      <Card title="We couldn't sign you in">
        <p className="text-ink-600">{displayError || 'The sign-in link is invalid or expired.'}</p>
        <Link to="/login" className="btn-primary mt-4">Back to sign in</Link>
      </Card>
    );
  }

  return (
    <Card title="Signing you in">
      <div className="flex items-center gap-3 text-ink-600">
        <Spinner /> One moment…
      </div>
    </Card>
  );
}
