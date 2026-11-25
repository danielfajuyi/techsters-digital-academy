# Build status

Legend: ✅ written and syntax-checked · 🔶 written, **needs your first run** · ⏳ not built

> This environment had no network, so nothing here has been **installed, built or run against Supabase/Paystack/Google**. JSX and API files were parsed (tsc / `node --check`) and every import was cross-checked. Treat all 🔶 items as untested until you've run them.

## Foundation
- ✅ Vite + React 18 + Tailwind project, brand tokens (#0260FF / #0E0E0E), Bricolage Grotesque + Instrument Sans
- ✅ Modular Client/Server architecture: standalone Node.js server (`server/index.js`) and Vite React client (`client/`)
- ✅ `.env.example`, `docs/SETUP.md`

## Database (🔶 run the SQL)
- ✅ 0001 schema: 40+ tables, FKs, indexes, unique constraints (no duplicate enrolments / one open order per course)
- ✅ 0002 RLS: gated content split (`lesson_content`), answer keys staff-only, column-level grants
- ✅ 0003: storage buckets + policies, atomic `fulfill_order`, idempotent `enroll_user`, progress triggers, public `verify_certificate`

## Backend (🔶)
- 🔶 Auth middleware, role checks, zod validation, audit log, rate limit
- 🔶 Public catalogue, student learning, quizzes (server-graded, timed), assignments, certificates (PDF via pdf-lib)
- 🔶 Paystack initialise / verify / webhook (HMAC-SHA512), coupons, refunds
- 🔶 Staff: course/module/lesson CRUD, uploads (signed URLs), grading, announcements; Admin: users, roles, enrolments, orders, CSV export, content, settings, audit

## Frontend (🔶)
- 🔶 Public: home, courses, course detail (+preview player, checkout), instructors, about, FAQ, contact, blog, legal, certificate verification
- 🔶 Auth: email sign-up/in, Google, forgot/reset, callback, protected routes
- 🔶 Student: dashboard, my courses, player (video/text/quiz/assignment, notes, bookmarks, discussion, resume), certificates, notifications, payments, support, profile (avatar upload)
- 🔶 Instructor studio + course editor (curriculum, quiz builder, uploads); Admin dashboard

## Added in round 2
- ✅ Light + dark mode (class-based, no flash on load, follows device by default, toggle in every header)
- ✅ Brand palette re-based on the main site's cyan (#1bb0ce) with accessible dark-on-cyan buttons; Academy fonts kept
- ✅ Main-site logo, site title/meta, footer contact details, About/Contact content, "Main site" and consultation links
- ✅ Homepage rebuilt around the agency's four service lines; headline/sub-headline/ribbon editable in Admin → Settings
- 🔶 5 demo courses (SQL) + 2 resource articles + extra FAQs
- 🔶 Rich-text (WYSIWYG) editor for course descriptions, lessons, assignments and articles
- 🔶 Student Grades page (quiz history + assignment feedback)
- 🔶 Admin can assign/remove course instructors in the course editor
- 🔶 "New lesson added" notifications to enrolled students
- 🔶 Daily assignment-deadline reminders (Vercel Cron + email)
- 🔶 Video lessons without a video show a "coming soon" placeholder instead of a blank area
- ✅ Google sign-in requires a verified Google email
- 🔶 Newsletter sign-up in the footer + Admin → Support & messages → Newsletter
- 🔶 Announcement emails now respect each student's email preference

## Known gaps / next steps
- ⏳ Automated tests (unit/e2e). Do the manual QA list from your brief after the first run.
- ⏳ Exact main-site background colours (only the cyan theme colour was readable from the site).
- ⏳ Announcement emails ignore each student's "email notifications" preference (in-app notifications always send).
- ⏳ Signed/DRM video; use Bunny or Mux signed URLs if you need it.
- ⏳ Portfolio showcase from the main site (currently linked, not embedded).
