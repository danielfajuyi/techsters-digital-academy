import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from './ui/index.jsx';

/** UX gate only. The API and RLS enforce real authorisation. */
export function RequireAuth({ role }) {
  const { loading, user, profile, isAdmin, isStaff } = useAuth();
  const loc = useLocation();
  if (loading || (user && !profile)) return <PageLoader />;
  if (!user) {
    const loginPath = role === 'admin' ? '/admin/login' : '/login';
    return <Navigate to={`${loginPath}?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }
  if (role === 'admin' && !isAdmin) return <Navigate to="/app" replace />;
  if (role === 'staff' && !isStaff) return <Navigate to="/app" replace />;
  return <Outlet />;
}
