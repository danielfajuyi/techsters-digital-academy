# Techsters Academy: LMS

React 18 + Vite + Tailwind (client) · Node API (server, also deployed as one Vercel function) · Supabase (Postgres, Auth, Storage) · Paystack.

```
client/               React app (light + dark mode, lazy routes)
server/               API routes, Paystack, certificates, Google sign-in, cron
api/index.js          Vercel entry point → server/router.js
supabase/             master_schema.sql, migrations/, demo_courses.sql
docs/SETUP.md         Supabase · Google · Paystack · Vercel · demo content · cron
PROGRESS.md           what is done, untested, and next
```

Local: `npm install`, fill `client/.env` and `server/.env` (see the `.env.example` files), `npm run dev`.
