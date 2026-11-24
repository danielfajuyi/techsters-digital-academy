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

## Known gaps / next steps (be aware)
- ⏳ Rich-text editor: descriptions/lesson text are HTML textareas (sanitised). Swap in Tiptap if you want WYSIWYG.
- ⏳ Admin "website content" covers testimonials, FAQs, categories, coupons, blog. Homepage hero copy is still in code.
- ⏳ Automated tests (unit/e2e). Do the manual QA list in your original brief after first run.
- ⏳ Signed-video DRM; use Bunny/Mux signed URLs if you need it.
- ⏳ Reminder emails for assignment deadlines (needs a Vercel Cron job calling a new route).
- ⏳ Light-weight code-splitting is in place (lazy routes + vendor chunks); no further perf profiling done.
