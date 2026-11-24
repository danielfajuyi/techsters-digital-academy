import { admin } from '../lib/supabase.js';
import { HttpError } from '../lib/http.js';

export default [
  {
    method: 'GET',
    path: '/auth/google',
    auth: false,
    async handler({ req, query }) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) throw new HttpError(500, 'Google client ID is not configured on the server');

      const proto = req.headers['x-forwarded-proto'] || (req.headers.host?.includes('localhost') ? 'http' : 'https');
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
      const redirectUri = `${proto}://${host}/api/auth/google/callback`;

      const next = query.next || '/app';
      const state = Buffer.from(JSON.stringify({ next })).toString('base64url');

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
        state,
      });

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return {
        __raw: {
          status: 302,
          type: 'text/plain',
          headers: { Location: googleAuthUrl },
          body: '',
        },
      };
    },
  },

  {
    method: 'GET',
    path: '/auth/google/callback',
    auth: false,
    async handler({ req, query }) {
      const { code, state, error: googleError } = query;
      const proto = req.headers['x-forwarded-proto'] || (req.headers.host?.includes('localhost') ? 'http' : 'https');
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
      const redirectUri = `${proto}://${host}/api/auth/google/callback`;
      const appUrl = process.env.APP_URL || `${proto}://${host}`;

      let next = '/app';
      if (state) {
        try {
          const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
          if (parsed.next) next = parsed.next;
        } catch {}
      }

      if (googleError || !code) {
        return {
          __raw: {
            status: 302,
            type: 'text/plain',
            headers: { Location: `${appUrl}/login?error=${encodeURIComponent(googleError || 'Google sign-in was cancelled')}` },
            body: '',
          },
        };
      }

      // 1. Exchange authorization code with Google for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokens.access_token) {
        return {
          __raw: {
            status: 302,
            type: 'text/plain',
            headers: { Location: `${appUrl}/login?error=${encodeURIComponent(tokens.error_description || 'Failed to exchange Google code')}` },
            body: '',
          },
        };
      }

      // 2. Fetch user profile from Google
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = await userRes.json();
      if (!googleUser.email) {
        return {
          __raw: {
            status: 302,
            type: 'text/plain',
            headers: { Location: `${appUrl}/login?error=No+email+provided+by+Google` },
            body: '',
          },
        };
      }

      // 3. Ensure user exists in Supabase auth.users (auto-creates profile and role via trigger)
      try {
        await admin().auth.admin.createUser({
          email: googleUser.email,
          email_confirm: true,
          user_metadata: {
            full_name: googleUser.name || '',
            avatar_url: googleUser.picture || null,
          },
        });
      } catch (e) {
        // User already exists in auth.users
      }

      // 4. Generate authenticated session link via Supabase Service Role
      const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;
      const { data: linkData, error: linkError } = await admin().auth.admin.generateLink({
        type: 'magiclink',
        email: googleUser.email,
        options: { redirectTo },
      });

      if (linkError || !linkData?.properties?.action_link) {
        return {
          __raw: {
            status: 302,
            type: 'text/plain',
            headers: { Location: `${appUrl}/login?error=${encodeURIComponent(linkError?.message || 'Authentication link error')}` },
            body: '',
          },
        };
      }

      // 5. Redirect browser to action_link, which issues tokens and redirects to /auth/callback
      return {
        __raw: {
          status: 302,
          type: 'text/plain',
          headers: { Location: linkData.properties.action_link },
          body: '',
        },
      };
    },
  },
];
