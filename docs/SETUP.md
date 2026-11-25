# Setup guide

The project is split into a **client** (React + Vite SPA) and a **server** (standalone Node.js backend). You can run both locally with zero cloud dependencies or Vercel tooling, and host the client on Vercel or any other static host when you are ready.

## 1. Supabase

1. Create a project at supabase.com. Note **Project URL**, **anon key** and **service_role key** (Project Settings → API).
2. Open **SQL Editor** in Supabase and run the single master script: `supabase/master_schema.sql` (runs schema, RLS, functions, storage, and seed data in one go).
3. **Authentication → URL Configuration**
   - Site URL: `https://YOUR-DOMAIN`
   - Redirect URLs: `https://YOUR-DOMAIN/**`, `http://localhost:3000/**`, and your Vercel preview pattern `https://*-YOURTEAM.vercel.app/**`
4. **Authentication → Providers → Email**: keep "Confirm email" ON.
5. **Authentication → SMTP**: configure a custom SMTP (Resend, Brevo, etc.). Supabase's built-in mailer is heavily rate-limited and not for production.
6. **Make yourself the first admin** (run once after you've signed up in the app):
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from public.profiles where email = 'you@example.com'
   on conflict do nothing;
   ```
   After that, grant roles from **Admin → Users**.

> Linking accounts: Supabase links a Google sign-in to an existing email/password account when the emails match and are verified, so users don't get duplicate accounts.

## 2. Google Sign-In (Handled Exclusively by the Backend)

Google OAuth is handled entirely by your Node.js backend. You do NOT need to configure Google inside Supabase or expose Google client IDs on the frontend:
1. User clicks **Continue with Google** &rarr; redirects to `/api/auth/google`.
2. Backend redirects to Google for authentication.
3. Google returns the authorization code to `/api/auth/google/callback`.
4. Backend exchanges the code with Google, retrieves the user profile, creates/links the user in Supabase (`auth.users`), and generates a secure session link redirecting to the frontend.

### Google Cloud Console (console.cloud.google.com)
1. Select your Google Cloud project → **APIs & Services → OAuth consent screen** (External). Add app name, support email, and domain. Scopes: `email`, `profile`, `openid`.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
   - **Authorized JavaScript origins:**
     - `http://localhost:5173` (Vite dev server)
     - `http://localhost:5000` (Backend server)
     - `https://YOUR-DOMAIN`
   - **Authorized redirect URIs:**
     - `http://localhost:5000/api/auth/google/callback` (Local backend)
     - `https://api.YOUR-DOMAIN/api/auth/google/callback` (Production backend)
3. Copy **Client ID** and **Client Secret** into `server/.env`.
*(No configuration required in Supabase Authentication > Providers > Google).*

## 3. Paystack

1. Dashboard → Settings → API Keys. Use the **test** secret key first.
2. Set `PAYSTACK_SECRET_KEY` in Vercel.
3. Settings → API Keys & Webhooks → **Webhook URL:** `https://YOUR-DOMAIN/api/webhooks/paystack`
4. Test with Paystack test cards. Flow: `/api/checkout` creates an order and a Paystack transaction → user pays → redirected to `/checkout/callback` → server **re-verifies with Paystack** and checks the amount → enrols atomically. The webhook does the same independently, so a closed tab never loses an enrolment. Both paths are idempotent.
5. Switch to the live key when ready.

## 4. Email (optional)

Create a Resend account, verify your domain, set `RESEND_API_KEY` and `EMAIL_FROM`. Enrolment, certificate and announcement emails then send automatically. Without a key they're skipped.

## 5. Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env`:
   - Copy `server/.env.example` to `server/.env` and enter your Supabase & Paystack keys.
   - Copy `client/.env.example` to `client/.env` and enter your Supabase public credentials.
3. Start both client and server:
   ```bash
   npm run dev
   ```

   - Client is available at: `http://localhost:5173`
   - Server is available at: `http://localhost:5000`

## 6. Hosting on Vercel as One Single Project

The project is pre-configured with `vercel.json` and `api/index.js` to deploy both the React frontend and Serverless API backend together as **one single project** on Vercel.

### Deployment Steps:
1. Push this repository to GitHub/GitLab.
2. In Vercel, click **Add New Project** and import the repository.
3. Keep default settings:
   - **Framework Preset**: Vite / Other (detected automatically)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/dist`
4. Under **Environment Variables**, add:
   - `SUPABASE_URL`: `https://YOUR-PROJECT.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-supabase-service-role-key`
   - `VITE_SUPABASE_URL`: `https://YOUR-PROJECT.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
   - `GOOGLE_CLIENT_ID`: `your-google-client-id`
   - `GOOGLE_CLIENT_SECRET`: `your-google-client-secret`
   - `PAYSTACK_SECRET_KEY`: `sk_live_...`
   - `RESEND_API_KEY`: `re_...` (optional)
   - `EMAIL_FROM`: `Techsters Academy <noreply@yourdomain.com>`
5. Click **Deploy**.

Vercel will build the frontend into static assets and serve all `/api/*` endpoints through the serverless function handler.

```
`npm run dev:web` runs Vite alone (no API).

## 7. Video hosting

`video_provider` supports YouTube (unlisted), Vimeo, Bunny Stream, Mux, external https embeds, and small MP4s in Supabase Storage (served by signed URL). Vercel Functions must never proxy video. For a paid academy we recommend **Bunny Stream or Mux** with signed embeds; paste the embed URL into the lesson. Supabase's per-file limit depends on your plan.

## 8. Migrating from MongoDB / Clerk

The original project's data was mock data in `assets.js` plus whatever was created through its 3 endpoints. If you have real records in MongoDB:

| Mongo | Postgres |
|---|---|
| `users` (Clerk id) | `auth.users` + `profiles`: re-invite users or have them sign in with the same email (Google/email); passwords can't be migrated from Clerk |
| `courses` | `courses` (`coursePrice`×100 → `price_minor`, `discount` → `compare_at_minor`) |
| `chapterContent` / `lectureContent` | `course_modules` / `lessons` + `lesson_content` (`lectureUrl` YouTube → `video_provider='youtube'`) |
| `enrolledStudents` | `enrollments` (use `select public.enroll_user(user, course, 'manual')`) |
| `courseRating` | `course_reviews` |

Export Mongo to JSON, map by email, and insert with a one-off script using the service role key. Send us the export if you want us to write it.

## Security notes

- Roles live in `user_roles`, are loaded on the server per request, and are never read from the client.
- Browser holds only the anon key; RLS blocks direct access to gated content (`lesson_content`, resources, quiz answer keys, orders, coupons).
- API uses bearer tokens (not cookies), so CSRF doesn't apply. Security headers + CSP are in `vercel.json`.
- The in-memory rate limiter is best-effort per function instance. For hard limits add Vercel Firewall rate-limit rules on `/api/checkout`, `/api/contact` and auth.
- Terms and Privacy pages are plain-language drafts. Have a lawyer review them.
```

---

# Update: brand theme, demo content and new features

## Run the two new SQL files (Supabase → SQL Editor)
1. `supabase/migrations/0004_site_settings.sql`: homepage copy setting + extra FAQs.
2. `supabase/demo_courses.sql`: **5 editable demo courses** (35 lessons, 5 quizzes, 5 assignments, 2 resource articles). Safe to re-run; existing slugs are skipped.
   It also gives your admin account the Instructor role and lists you as instructor on the demo courses. Remove the last block of the file if you'd rather not.

Edit or delete anything afterwards in **Admin → Courses** (or Instructor studio). Video lessons are created without a video: open the lesson and paste a YouTube/Vimeo/Bunny link.

## Light and dark mode
A sun/moon button sits in every header. First visit follows the device setting; clicking pins a choice (saved in the browser). All colours are CSS variables at the top of `client/src/index.css`.
Brand cyan **#1bb0ce** is the main site's theme colour. The page backgrounds (a cool, teal-tinted white and a deep teal-navy) are our pairing, not read from your CSS. To match your main site's exact backgrounds, change `--ink-50`, `--surface` and `--ink-*` in `:root` and `.dark`.

## Logo and titles
The header/footer logo loads from `https://techsters.com.ng/wp-content/uploads/2020/12/cropped-techsters-logo.png`, with `client/public/logo.svg` as a fallback. For a permanent copy, save the logo into `client/public/` and change `MAIN_LOGO` in `client/src/components/ui/index.jsx`.

## Daily assignment reminders (Vercel Cron)
Set `CRON_SECRET` in Vercel (any long random string). `vercel.json` schedules `/api/cron/reminders` daily at 07:00 UTC; Vercel sends the secret automatically. It notifies (and emails, if the student allows it) enrolled students about assignments due within 48 hours that they haven't submitted. Test manually:
`curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/reminders`

## Google sign-in note
Your custom backend Google flow now also refuses Google accounts whose email isn't verified, because accounts are matched by email.
