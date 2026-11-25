import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PageLoader } from './components/ui/index.jsx';
import { RequireAuth } from './components/Guards.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import { configured } from './lib/supabase.js';

const L = (f) => lazy(f);
const Home = L(() => import('./pages/public/Home.jsx'));
const Courses = L(() => import('./pages/public/Courses.jsx'));
const CourseDetail = L(() => import('./pages/public/CourseDetail.jsx'));
const Instructors = L(() => import('./pages/public/Instructors.jsx'));
const InstructorProfile = L(() => import('./pages/public/InstructorProfile.jsx'));
const Static = (name) => L(() => import('./pages/public/Static.jsx').then((m) => ({ default: m[name] })));
const About = Static('About'), Faq = Static('Faq'), Contact = Static('Contact'), Terms = Static('Terms'), Privacy = Static('Privacy'), Blog = Static('Blog'), BlogPost = Static('BlogPost'), Verify = Static('Verify'), NotFound = Static('NotFound');
const Auth = (name) => L(() => import('./pages/auth/AuthPages.jsx').then((m) => ({ default: m[name] })));
const Login = Auth('Login'), AdminLogin = Auth('AdminLogin'), Register = Auth('Register'), Forgot = Auth('Forgot'), Reset = Auth('Reset'), Callback = Auth('Callback');
const Student = (name) => L(() => import('./pages/student/Student.jsx').then((m) => ({ default: m[name] })));
const SDash = Student('Overview'), SCourses = Student('MyCourses'), Bookmarks = Student('Bookmarks'), Grades = Student('Grades'), Certificates = Student('Certificates'), Notifications = Student('Notifications'), Orders = Student('Orders'), Support = Student('Support'), Profile = Student('Profile'), CheckoutCallback = Student('CheckoutCallback');
const Learn = L(() => import('./pages/student/Learn.jsx'));
const Inst = (name) => L(() => import('./pages/instructor/Instructor.jsx').then((m) => ({ default: m[name] })));
const IOverview = Inst('Overview'), ICourses = Inst('Courses'), IStudents = Inst('Students'), ISubmissions = Inst('Submissions'), IAnnouncements = Inst('Announcements');
const CourseEditor = L(() => import('./pages/instructor/CourseEditor.jsx'));
const Adm = (name) => L(() => import('./pages/admin/Admin.jsx').then((m) => ({ default: m[name] })));
const AOverview = Adm('Overview'), AUsers = Adm('Users'), AUser = Adm('UserDetail'), AEnroll = Adm('Enrollments'), APay = Adm('Payments'), AContent = Adm('Content'), AApps = Adm('Applications'), ATickets = Adm('Tickets'), ASettings = Adm('Settings'), AAudit = Adm('Audit');

function ScrollTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }

function ConfigBanner() {
  if (configured) return null;
  return <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">Supabase isn't configured. Copy <code>.env.example</code> to <code>.env</code> and set the <code>VITE_SUPABASE_*</code> values.</div>;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <ConfigBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/:slug" element={<CourseDetail />} />
            <Route path="instructors" element={<Instructors />} />
            <Route path="instructors/:id" element={<InstructorProfile />} />
            <Route path="about" element={<About />} />
            <Route path="faq" element={<Faq />} />
            <Route path="contact" element={<Contact />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="verify" element={<Verify />} />
            <Route path="verify/:no" element={<Verify />} />
            <Route path="login" element={<Login />} />
            <Route path="admin/login" element={<AdminLogin />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<Forgot />} />
            <Route path="reset-password" element={<Reset />} />
            <Route path="auth/callback" element={<Callback />} />
            <Route element={<RequireAuth />}><Route path="checkout/callback" element={<CheckoutCallback />} /></Route>
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="learn/:slug" element={<Learn />} />
            <Route path="app" element={<DashboardLayout area="student" />}>
              <Route index element={<SDash />} />
              <Route path="courses" element={<SCourses />} />
              <Route path="bookmarks" element={<Bookmarks />} />
              <Route path="grades" element={<Grades />} />
              <Route path="certificates" element={<Certificates />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="orders" element={<Orders />} />
              <Route path="support" element={<Support />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          <Route element={<RequireAuth role="staff" />}>
            <Route path="instructor" element={<DashboardLayout area="instructor" />}>
              <Route index element={<IOverview />} />
              <Route path="courses" element={<ICourses />} />
              <Route path="courses/:id" element={<CourseEditor />} />
              <Route path="students" element={<IStudents />} />
              <Route path="submissions" element={<ISubmissions />} />
              <Route path="announcements" element={<IAnnouncements />} />
            </Route>
          </Route>

          <Route element={<RequireAuth role="admin" />}>
            <Route path="admin" element={<DashboardLayout area="admin" />}>
              <Route index element={<AOverview />} />
              <Route path="users" element={<AUsers />} />
              <Route path="users/:id" element={<AUser />} />
              <Route path="courses" element={<ICourses admin />} />
              <Route path="enrollments" element={<AEnroll />} />
              <Route path="payments" element={<APay />} />
              <Route path="content" element={<AContent />} />
              <Route path="applications" element={<AApps />} />
              <Route path="tickets" element={<ATickets />} />
              <Route path="settings" element={<ASettings />} />
              <Route path="audit" element={<AAudit />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
