# Production deployment

For a short go-live ops checklist (env keys, Maps referrer UI, Resend/SES setup, smoke tests), see [`GO_LIVE.md`](GO_LIVE.md).

## Prerequisites

- Node.js 20+
- MySQL 8+
- Reverse proxy (nginx/Caddy) terminating TLS
- Process manager (systemd, PM2, or similar)

## Environment

1. Copy [`server/.env.example`](server/.env.example) to `server/.env` and fill in secrets.
2. Copy [`.env.example`](.env.example) to `.env` for the Vite frontend build.
3. Set `NODE_ENV=production` in `server/.env`.
4. Do **not** set `ALLOW_DEV_CHECKOUT=1`, `ALLOW_ADMIN_BOOTSTRAP=1`, `ALLOW_BOOTSTRAP_SUPER_ADMIN=1`, `ALLOW_EMAIL_SIMULATION=1`, or `ALLOW_PURGE_MARKETPLACE_DEMOS=1` in production. Leave those keys unset. First admin is promoted via SQL/ops, not the in-app “Become First Admin” button (hidden in production builds).
5. Set `FRONTEND_URL` and `PUBLIC_URL` to your HTTPS domains.
6. Configure a real `STRIPE_WEBHOOK_SECRET` (and `STRIPE_SECRET_KEY`).
7. Configure platform email (SES preferred, or `RESEND_API_KEY` / `SENDGRID_API_KEY`) — signup/verify/reset fail closed without a provider.
8. Restrict `GOOGLE_MAPS_API_KEY` (and any `VITE_GOOGLE_MAPS_API_KEY`) by HTTP referrer to your `FRONTEND_URL` hosts.
9. Set `MARKETPLACE_REQUIRE_VERIFIED=true` (default in production) so pending installers do not see opportunities until verified.

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

Configure Amazon SES (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`) **or** `RESEND_API_KEY` / `SENDGRID_API_KEY` plus `OUTREACH_FROM_EMAIL`.

In production, missing email configuration causes signup / resend-verification / forgot-password to return an error (fail closed). Do not set `ALLOW_EMAIL_SIMULATION` in production.

In non-production only, `ALLOW_EMAIL_SIMULATION=1` permits simulated sends (no real delivery; the reset/verify link is written to server logs for local testing).

`FRONTEND_URL` may list multiple CORS origins (comma-separated). Auth email links use the first non-localhost HTTPS origin when present — put production URLs in the list (ideally first), and avoid relying on localhost-first ordering.

Frontend routes: `/verify-email`, `/forgot-password`, `/reset-password`

## Custom SMTP deliverability (installer outbound mail)

When installers connect company SMTP in Integrations, deliverability depends on DNS for **their** sending domain (not automated here):

- **SPF** — authorize the SMTP host / provider IPs for the From domain
- **DKIM** — enable signing at the mail provider and publish the DKIM TXT records
- **DMARC** — publish a DMARC policy (`p=none` → `quarantine`/`reject` as you harden)

Without SPF/DKIM, messages often land in spam or are rejected. Ask the customer’s DNS admin to follow their host’s (Google Workspace, Microsoft 365, cPanel, etc.) docs.

## Google Maps API key

- Set `GOOGLE_MAPS_API_KEY` on the server (and optionally `VITE_GOOGLE_MAPS_API_KEY` for the Vite build).
- In Google Cloud Console, restrict the **browser** key by HTTP referrer to your site origins only.
- Prefer a separate IP-restricted key for server-side Geocoding/Solar if you can split keys.
- Production `GET /api/config` only returns the key when `Origin`/`Referer` matches `FRONTEND_URL`. Never log the key.

## Marketplace verification

`MARKETPLACE_REQUIRE_VERIFIED` defaults to **on** when `NODE_ENV=production`. Set `MARKETPLACE_REQUIRE_VERIFIED=false` only if you intentionally want pending installers to browse opportunities before admin verification.

## Security checklist

- Rotate JWT secret and DB password before first deploy
- Restrict Google Maps / Firebase API keys by HTTP referrer / domain
- Enable Stripe webhook signature verification (required in production)
- Verify Twilio auth token is set (webhooks fail closed in production without it)
- Configure SES or Resend/SendGrid (auth email fail-closed without a provider)
- Smoke test: register, login, buy plan, wallet top-up, map unlock, bid

## Stripe webhooks

Point Stripe to:

`https://<PUBLIC_URL>/api/billing/webhook`

Events to enable: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.

Use the signing secret as `STRIPE_WEBHOOK_SECRET`.
