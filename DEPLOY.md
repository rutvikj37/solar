# Production deployment

## Prerequisites

- Node.js 20+
- MySQL 8+
- Reverse proxy (nginx/Caddy) terminating TLS
- Process manager (systemd, PM2, or similar)

## Environment

1. Copy [`server/.env.example`](server/.env.example) to `server/.env` and fill in secrets.
2. Copy [`.env.example`](.env.example) to `.env` for the Vite frontend build.
3. Set `NODE_ENV=production` in `server/.env`.
4. Do **not** set `ALLOW_DEV_CHECKOUT=1` or `ALLOW_ADMIN_BOOTSTRAP=1` in production.
5. Set `FRONTEND_URL` and `PUBLIC_URL` to your HTTPS domains.
6. Configure real `RAZORPAY_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET`.

## Build and run

```bash
# Frontend
npm ci
npm run build

# API
cd server
npm ci
npm run start
```

Serve the `dist/` folder from your reverse proxy. Proxy `/api` and WebSocket `/media-stream` to the Node server.

Alternatively, set `STATIC_FRONTEND_DIR` to the built `dist/` path and let the Node process serve the SPA (see `Dockerfile`); Helmet then applies security headers including COOP to HTML and assets.

### Reverse proxy headers (required for Google sign-in)

Firebase Auth needs `Cross-Origin-Opener-Policy: same-origin-allow-popups` on **HTML** responses. Do **not** use `same-origin` alone — it triggers console errors (`Cross-Origin-Opener-Policy policy would block the window.closed call`) and breaks OAuth popups.

The frontend build copies `public/_headers` into `dist/_headers` for hosts that read it (Netlify, Cloudflare Pages). **nginx does not read `_headers`** — you must set the header in nginx (see [`deploy/nginx-spacetoroof.conf.example`](deploy/nginx-spacetoroof.conf.example)).

**nginx** (inside the `server` block that serves `dist/`):

```nginx
add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
```

If a security template already sets `Cross-Origin-Opener-Policy: same-origin`, **remove or replace** that line. After deploy, verify:

```bash
curl -sI https://spacetoroof.com/ | grep -i cross-origin-opener
# Expected: Cross-Origin-Opener-Policy: same-origin-allow-popups
```

The login page shows a red warning if it detects `same-origin` COOP.

**Apache** (requires `mod_headers`):

```apache
Header always set Cross-Origin-Opener-Policy "same-origin-allow-popups"
```

Google sign-in uses `signInWithPopup` when `authDomain` is `*.firebaseapp.com`. Full-page redirect is used when `authDomain` matches your site host (custom domain + `/__/auth` proxy).

**Firebase SDK:** Use `firebase@^12.18.0` or newer. Versions 12.17.0–12.17.1 show `Database is closing/hidden` on the login page when the Google popup backgrounds the tab (IndexedDB bug). Rebuild after `npm install`.

### Custom-domain Firebase auth (optional, for redirect sign-in)

When the app is on `spacetoroof.com` but Firebase `authDomain` is `solar-9ac1f.firebaseapp.com`, redirect sign-in loses the session on modern browsers. To use redirect on your domain:

1. **Proxy** `/__/auth/` to Firebase (nginx example in [`deploy/nginx-spacetoroof.conf.example`](deploy/nginx-spacetoroof.conf.example)), **or** set on the Node server:
   - `FIREBASE_AUTH_PROXY=1`
   - `FIREBASE_AUTH_PROXY_HOST=solar-9ac1f.firebaseapp.com` (optional; defaults from `FIREBASE_PROJECT_ID`)
2. Set **`FIREBASE_AUTH_DOMAIN=spacetoroof.com`** in `server/.env` (and `VITE_FIREBASE_AUTH_DOMAIN=spacetoroof.com` before `npm run build`).
3. In Google Cloud Console → Credentials → OAuth 2.0 Web client, add authorized redirect URI:
   `https://spacetoroof.com/__/auth/handler`
4. Rebuild frontend and restart API.

**nginx** (transparent proxy — no 302):

```nginx
location /__/auth/ {
  proxy_pass https://solar-9ac1f.firebaseapp.com/__/auth/;
  proxy_set_header Host solar-9ac1f.firebaseapp.com;
  proxy_ssl_server_name on;
  add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
}
```

### Why redirect alone fails without the proxy

`authDomain` defaults to `solar-9ac1f.firebaseapp.com` while the app is on `spacetoroof.com`. Modern Chrome/Safari/Firefox block that cross-site storage, so after Google the user returns to `/login` and `getRedirectResult()` is `null`. Popup sign-in works once COOP is `same-origin-allow-popups`; redirect needs the proxy + custom `authDomain` above.

## Health check

`GET /health` returns `{ status: "ok", db: "connected" }` when the API and database are reachable. Use this for load balancer probes.

## Database backups

Run [`server/scripts/backup-db.sh`](scripts/backup-db.sh) on a schedule (cron). Test restores regularly.

```bash
cd server
./scripts/backup-db.sh
```

## Docker (optional)

```bash
docker compose up --build
```

API health: `GET http://localhost:5002/health`

## Email verification and password reset

Configure `RESEND_API_KEY` or `SENDGRID_API_KEY` and `OUTREACH_FROM_EMAIL`.
Without email provider, verification/reset links are logged server-side in development only.

Frontend routes: `/verify-email`, `/forgot-password`, `/reset-password`

## Security checklist

- Rotate JWT secret and DB password before first deploy
- Restrict Google Maps / Firebase API keys by domain/IP
- Enable Razorpay webhook signature verification (required in production)
- Verify Twilio auth token is set (webhooks fail closed in production without it)
- Smoke test: register, login, buy plan, wallet top-up, map unlock, bid

## Razorpay webhooks

Point Razorpay to:

`https://<PUBLIC_URL>/api/billing/razorpay-webhook`

Use the same secret as `RAZORPAY_WEBHOOK_SECRET`.

## Stripe webhooks

Point Stripe to:

`https://<PUBLIC_URL>/api/billing/webhook`

Use the signing secret as `STRIPE_WEBHOOK_SECRET`.
