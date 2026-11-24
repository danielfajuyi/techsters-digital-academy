# Techsters Academy: LMS

A clean, modular LMS project with separate client (React + Vite) and server (Node.js) applications.

```
techsters-lms/
├── client/              # Frontend React 18 + Vite + Tailwind app
│   ├── src/             # Pages, components, layouts, contexts
│   ├── public/          # Static assets (favicons, logos)
│   ├── package.json     # Client scripts & dependencies
│   └── vite.config.js   # Dev proxy to http://localhost:5000
├── server/              # Standalone Node.js backend
│   ├── lib/             # Auth, Supabase, Paystack, PDF generator, email
│   ├── routes/          # Public, student, staff, admin, payment routes
│   ├── router.js        # Route dispatcher & rate limiting
│   ├── index.js         # HTTP server entry point (port 5000)
│   └── package.json     # Server scripts & dependencies
├── supabase/            # Database migrations & SQL schema
│   └── migrations/
└── scripts/             # Dev and utility scripts
```

## Quick Start (Local Development)

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   - Copy `server/.env.example` to `server/.env` and fill in your Supabase & Paystack keys.
   - Copy `client/.env.example` to `client/.env` and fill in your Supabase client keys.
3. **Run both Client & Server**:
   ```bash
   npm run dev
   ```
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:5000](http://localhost:5000)

## Running Independently

- **Frontend only**:
  ```bash
  npm run dev:client
  # or: cd client && npm run dev
  ```

- **Backend only**:
  ```bash
  npm run dev:server
  # or: cd server && npm run dev
  ```

- **Build client**:
  ```bash
  npm run build
  ```

## Production Hosting

Because the frontend and backend are completely decoupled:
- **Frontend (`client/`)**: Can be hosted on Vercel, Netlify, Cloudflare Pages, AWS Amplify, or any static host. Point the root build directory to `client` with command `npm run build` and output folder `dist`. In the hosting dashboard, configure `VITE_API_URL` to point to your live backend domain.
- **Backend (`server/`)**: Can be hosted on any Node.js host (Render, Railway, Fly.io, DigitalOcean, VPS, Heroku, etc.). Start command is `node index.js`.
