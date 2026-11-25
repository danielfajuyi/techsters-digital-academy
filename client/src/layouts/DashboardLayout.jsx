import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, Home, BookOpen, Award, Bell, Receipt, User, LifeBuoy, GraduationCap, Users, ClipboardCheck, Megaphone, LayoutDashboard, UserCog, CreditCard, ListChecks, Settings, ScrollText, Layers, LogOut, Bookmark, Globe, MessageSquare, Ticket, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, Logo } from '../components/ui/index.jsx';
import { ThemeToggle } from '../components/ui/Theme.jsx';

const NAV = {
  student: [
    ['/app', 'Overview', Home, true], ['/app/courses', 'My courses', BookOpen], ['/app/grades', 'Grades', BarChart3], ['/app/bookmarks', 'Bookmarks', Bookmark], ['/app/certificates', 'Certificates', Award],
    ['/app/notifications', 'Notifications', Bell], ['/app/orders', 'Payments', Receipt], ['/app/support', 'Support', LifeBuoy], ['/app/profile', 'Profile & settings', User],
  ],
  instructor: [
    ['/instructor', 'Overview', LayoutDashboard, true], ['/instructor/courses', 'Courses', GraduationCap], ['/instructor/students', 'Students', Users],
    ['/instructor/submissions', 'Submissions', ClipboardCheck], ['/instructor/announcements', 'Announcements', Megaphone],
  ],
  admin: [
    ['/admin', 'Overview', LayoutDashboard, true], ['/admin/users', 'Users', UserCog], ['/admin/courses', 'Courses', GraduationCap], ['/admin/enrollments', 'Enrollments', ListChecks],
    ['/admin/payments', 'Payments', CreditCard], ['/admin/content', 'Site content', Layers], ['/admin/applications', 'Instructor applications', Users],
    ['/admin/tickets', 'Support & messages', Ticket], ['/instructor/announcements', 'Announcements', Megaphone], ['/admin/settings', 'Settings', Settings], ['/admin/audit', 'Audit log', ScrollText],
  ],
};
const TITLES = { student: 'Learning', instructor: 'Instructor studio', admin: 'Administration' };

export default function DashboardLayout({ area }) {
  const { profile, signOut, unread, isAdmin, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const item = ([to, label, Icon, end]) => (
    <NavLink key={to + label} to={to} end={end} onClick={() => setOpen(false)}
      className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'}`}>
      <Icon className="h-4 w-4" /><span className="flex-1">{label}</span>
      {label === 'Notifications' && unread > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-night">{unread > 99 ? '99+' : unread}</span>}
    </NavLink>
  );
  const side = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5"><Link to="/"><Logo /></Link></div>
      <p className="px-5 pb-2 pt-3 text-xs font-medium text-ink-400">{TITLES[area]}</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label={TITLES[area]}>{NAV[area].map(item)}</nav>
      <div className="space-y-0.5 border-t border-ink-100 p-3">
        {area !== 'student' && <NavLink to="/app" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100"><Home className="h-4 w-4" />Student view</NavLink>}
        {area !== 'instructor' && isStaff && <NavLink to="/instructor" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100"><GraduationCap className="h-4 w-4" />Instructor studio</NavLink>}
        {area !== 'admin' && isAdmin && <NavLink to="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100"><UserCog className="h-4 w-4" />Administration</NavLink>}
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100"><Globe className="h-4 w-4" />Public site</Link>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-ink-100 bg-surface lg:block">{side}</aside>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-night/40" onClick={() => setOpen(false)} /><aside className="relative h-full w-72 bg-surface shadow-pop">{side}</aside></div>}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-100 bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button className="btn-ghost px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <span className="hidden text-sm text-ink-500 lg:block">{TITLES[area]}</span>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link to="/app/notifications" className="btn-ghost relative px-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-600" />}</Link>
            <Avatar src={profile?.avatar_url} name={profile?.full_name} />
            <button className="btn-ghost btn-sm" onClick={async () => { await signOut(); nav('/'); }}><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"><Outlet /></div>
      </div>
    </div>
  );
}
