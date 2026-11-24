import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, Logo } from '../components/ui/index.jsx';

const links = [['/courses', 'Courses'], ['/instructors', 'Instructors'], ['/about', 'About'], ['/blog', 'Resources'], ['/faq', 'FAQ'], ['/contact', 'Contact']];

export default function PublicLayout() {
  const { user, profile, signOut, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const lc = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'text-brand-700' : 'text-ink-600 hover:text-ink-900'}`;
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Techsters Academy home"><Logo /></Link>
          <nav className="hidden items-center md:flex" aria-label="Main">{links.map(([to, l]) => <NavLink key={to} to={to} className={lc}>{l}</NavLink>)}</nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link to="/app" className="btn-outline btn-sm"><LayoutDashboard className="h-4 w-4" />Dashboard</Link>
                <Link to="/app/profile" aria-label="Your profile"><Avatar src={profile?.avatar_url} name={profile?.full_name} /></Link>
              </>
            ) : (
              <><Link to="/login" className="btn-ghost btn-sm">Sign in</Link><Link to="/register" className="btn-primary btn-sm">Create account</Link></>
            )}
          </div>
          <button className="btn-ghost px-2 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {open && (
          <div className="border-t border-ink-100 bg-white px-4 pb-4 md:hidden">
            <nav className="flex flex-col py-2" aria-label="Mobile">{links.map(([to, l]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={lc}>{l}</NavLink>)}</nav>
            <div className="flex flex-col gap-2 pt-2">
              {user ? (<><Link to="/app" onClick={() => setOpen(false)} className="btn-primary">Dashboard</Link>{isStaff && <Link to="/instructor" onClick={() => setOpen(false)} className="btn-outline">Instructor studio</Link>}
                <button className="btn-ghost" onClick={async () => { await signOut(); setOpen(false); nav('/'); }}><LogOut className="h-4 w-4" />Sign out</button></>)
                : (<><Link to="/register" onClick={() => setOpen(false)} className="btn-primary">Create account</Link><Link to="/login" onClick={() => setOpen(false)} className="btn-outline">Sign in</Link></>)}
            </div>
          </div>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="bg-ink-900 text-ink-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2"><Logo dark className="h-8" /><p className="mt-4 max-w-sm text-sm text-ink-400">Practical, instructor-led tech courses, with certificates anyone can verify.</p></div>
          <div><h3 className="mb-3 text-sm font-semibold text-white">Academy</h3><ul className="space-y-2 text-sm">{[['/courses', 'All courses'], ['/instructors', 'Instructors'], ['/about', 'About'], ['/blog', 'Resources'], ['/verify', 'Verify a certificate']].map(([to, l]) => <li key={to}><Link className="hover:text-white" to={to}>{l}</Link></li>)}</ul></div>
          <div><h3 className="mb-3 text-sm font-semibold text-white">Support</h3><ul className="space-y-2 text-sm">{[['/faq', 'FAQ'], ['/contact', 'Contact'], ['/terms', 'Terms and conditions'], ['/privacy', 'Privacy policy'], ['/admin/login', 'Admin portal']].map(([to, l]) => <li key={to}><Link className="hover:text-white" to={to}>{l}</Link></li>)}</ul></div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-ink-400">© {new Date().getFullYear()} Techsters Academy. All rights reserved.</div>
      </footer>
    </div>
  );
}
