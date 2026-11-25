import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard, LogOut, ArrowUpRight, MapPin, Phone, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, Logo, Spinner } from '../components/ui/index.jsx';
import { api } from '../lib/api.js';
import { ThemeToggle } from '../components/ui/Theme.jsx';

export const MAIN_SITE = 'https://techsters.com.ng';
const links = [['/courses', 'Courses'], ['/instructors', 'Instructors'], ['/about', 'About'], ['/blog', 'Resources'], ['/faq', 'FAQ'], ['/contact', 'Contact']];


function Newsletter() {
  const [email, setEmail] = useState(''); const [state, setState] = useState('idle'); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setState('busy'); setErr('');
    try { await api('/newsletter', { method: 'POST', body: { email }, auth: false }); setState('done'); } catch (x) { setErr(x.message); setState('idle'); }
  };
  if (state === 'done') return <p className="text-sm text-brand-600" role="status">Thanks! You're on the list.</p>;
  return (
    <form onSubmit={submit} className="mt-5 max-w-sm">
      <label htmlFor="nl" className="mb-1.5 block text-sm font-semibold text-white">Stay up to date</label>
      <div className="flex gap-2"><input id="nl" type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border-0 bg-white/10 px-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600" />
        <button className="btn-primary" disabled={state === 'busy'}>{state === 'busy' ? <Spinner className="h-4 w-4 text-current" /> : 'Join'}</button></div>
      {err && <p className="mt-1.5 text-xs text-red-400" role="alert">{err}</p>}
    </form>
  );
}

export default function PublicLayout() {
  const { user, profile, signOut, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const lc = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'text-brand-700' : 'text-ink-600 hover:text-ink-900'}`;
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <div className="hidden bg-night text-[13px] text-slate-300 sm:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-1.5">
          <span>A programme of Techsters Digital Agency · Abuja, Nigeria · South Wales, UK</span>
          <a href={MAIN_SITE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">techsters.com.ng <ArrowUpRight className="h-3 w-3" /></a>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Techsters Academy home"><Logo /></Link>
          <nav className="hidden items-center md:flex" aria-label="Main">{links.map(([to, l]) => <NavLink key={to} to={to} className={lc}>{l}</NavLink>)}</nav>
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {user ? (
              <>
                <Link to="/app" className="btn-outline btn-sm"><LayoutDashboard className="h-4 w-4" />Dashboard</Link>
                <Link to="/app/profile" aria-label="Your profile"><Avatar src={profile?.avatar_url} name={profile?.full_name} /></Link>
              </>
            ) : (
              <><Link to="/login" className="btn-ghost btn-sm">Sign in</Link><Link to="/register" className="btn-primary btn-sm">Create account</Link></>
            )}
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button className="btn-ghost px-2" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {open && (
          <div className="border-t border-ink-100 bg-surface px-4 pb-4 md:hidden">
            <nav className="flex flex-col py-2" aria-label="Mobile">{links.map(([to, l]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={lc}>{l}</NavLink>)}
              <a href={MAIN_SITE} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600">Main site ↗</a></nav>
            <div className="flex flex-col gap-2 pt-2">
              {user ? (<><Link to="/app" onClick={() => setOpen(false)} className="btn-primary">Dashboard</Link>{isStaff && <Link to="/instructor" onClick={() => setOpen(false)} className="btn-outline">Instructor studio</Link>}
                <button className="btn-ghost" onClick={async () => { await signOut(); setOpen(false); nav('/'); }}><LogOut className="h-4 w-4" />Sign out</button></>)
                : (<><Link to="/register" onClick={() => setOpen(false)} className="btn-primary">Create account</Link><Link to="/login" onClick={() => setOpen(false)} className="btn-outline">Sign in</Link></>)}
            </div>
          </div>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="bg-night text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div><Logo onDark /><p className="mt-4 max-w-sm text-sm text-slate-400">Techsters is a digital agency in Abuja, Nigeria and South Wales, UK. The Academy is where we teach what we do: web design, branding, social media, AI automation and the tools that make teams productive.</p><Newsletter /></div>
          <div><h3 className="mb-3 text-sm font-semibold text-white">Academy</h3><ul className="space-y-2 text-sm">{[['/courses', 'All courses'], ['/instructors', 'Instructors'], ['/about', 'About'], ['/blog', 'Resources'], ['/verify', 'Verify a certificate']].map(([to, l]) => <li key={to}><Link className="hover:text-white" to={to}>{l}</Link></li>)}</ul></div>
          <div><h3 className="mb-3 text-sm font-semibold text-white">Support</h3><ul className="space-y-2 text-sm">{[['/faq', 'FAQ'], ['/contact', 'Contact'], ['/terms', 'Terms and conditions'], ['/privacy', 'Privacy policy'], ['/admin/login', 'Admin portal']].map(([to, l]) => <li key={to}><Link className="hover:text-white" to={to}>{l}</Link></li>)}</ul></div>
          <div><h3 className="mb-3 text-sm font-semibold text-white">Get in touch</h3>
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />Abuja, Nigeria | South Wales, UK</li>
              <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span><a className="hover:text-white" href="tel:+2349033148179">+234 903 314 8179</a><br /><a className="hover:text-white" href="tel:+447344059626">+44 7344 059626</a></span></li>
              <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><a className="hover:text-white" href="mailto:info@techsters.com.ng">info@techsters.com.ng</a></li>
              <li><a href={`${MAIN_SITE}/consultation/`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">Book a free consultation <ArrowUpRight className="h-3.5 w-3.5" /></a></li>
            </ul></div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-slate-400">© {new Date().getFullYear()} Techsters Digital Agency. All rights reserved. · <a className="hover:text-white" href={MAIN_SITE} target="_blank" rel="noreferrer">techsters.com.ng</a></div>
      </footer>
    </div>
  );
}
