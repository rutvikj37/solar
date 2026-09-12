# Go-live checklist (spacetoroof.com)

Companion to [`DEPLOY.md`](DEPLOY.md). Secrets are never committed — set them only on the production host.

## A. Production `server/.env` (exact keys)

Copy from [`server/.env.example`](server/.env.example). For live:

```bash
NODE_ENV=production
PORT=5002
BIND_HOST=0.0.0.0
TRUST_PROXY=1

JWT_SECRET=<long random ≥32 chars>
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=<prod db user>
DB_PASSWORD=<prod db password>
DB_NAME=solar_saas

# CORS — production hosts only (no localhost)
FRONTEND_URL=https://spacetoroof.com,https://www.spacetoroof.com

# API / webhooks / Twilio callbacks
PUBLIC_URL=https://api.spacetoroof.com
# If API is same-origin behind nginx (proxy /api → Node), use:
# PUBLIC_URL=https://spacetoroof.com

# Forbidden in production (leave unset or comment out):
# ALLOW_EMAIL_SIMULATION
# ALLOW_DEV_CHECKOUT
# ALLOW_ADMIN_BOOTSTRAP
# ALLOW_BOOTSTRAP_SUPER_ADMIN
# ALLOW_PURGE_MARKETPLACE_DEMOS

# Ops note: first-admin bootstrap and super-admin email auto-promote stay **off** in prod.
# Promote the first operator with a one-shot SQL UPDATE (or a controlled non-prod bootstrap),
# never by leaving ALLOW_ADMIN_BOOTSTRAP / ALLOW_BOOTSTRAP_SUPER_ADMIN set on the live host.
# Leave ALLOW_EMAIL_SIMULATION unset so auth email cannot silently simulate.

# Maps (HTTP-referrer–restricted browser key; see §B)
GOOGLE_MAPS_API_KEY=<gcp browser key>
# Optional at Vite build time if you bake the key into dist:
# VITE_GOOGLE_MAPS_API_KEY=<same or separate browser key>

# Platform auth email — pick ONE path (SES preferred)
# --- SES ---
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<iam access key>
AWS_SECRET_ACCESS_KEY=<iam secret>
SES_FROM_EMAIL=noreply@spacetoroof.com
# SES_CONFIGURATION_SET=<optional>
# --- or Resend ---
# RESEND_API_KEY=re_...
# OUTREACH_FROM_EMAIL=noreply@spacetoroof.com
# --- or SendGrid ---
# SENDGRID_API_KEY=SG....
# OUTREACH_FROM_EMAIL=noreply@spacetoroof.com

MARKETPLACE_REQUIRE_VERIFIED=true
```

Also set payment / Twilio / Firebase secrets as needed (see `.env.example`). Root `.env` for build:

```bash
VITE_API_URL=https://spacetoroof.com
# or https://api.spacetoroof.com if the API is a separate host
# VITE_GOOGLE_MAPS_API_KEY=...   # only if not relying solely on GET /api/config
```

`productionGuard` **requires** `JWT_SECRET`, `DB_PASSWORD`, `FRONTEND_URL`, `PUBLIC_URL` when `NODE_ENV=production`, and **exits** if `ALLOW_EMAIL_SIMULATION=1` (or the other ALLOW_* flags above).

Auth email fail-closed: without SES or Resend/SendGrid, signup / resend-verify / forgot-password return errors.

---

## B. Google Cloud — restrict Maps key (UI steps)

You cannot do this from the app server; use GCP Console:

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Select the **Maps JavaScript / browser** API key used as `GOOGLE_MAPS_API_KEY` (and `VITE_GOOGLE_MAPS_API_KEY` if set).
3. **Application restrictions** → **HTTP referrers (web sites)**.
4. Add referrers (match `FRONTEND_URL`):
   - `https://spacetoroof.com/*`
   - `https://www.spacetoroof.com/*`
5. **API restrictions** → restrict to needed APIs (at least Maps JavaScript API; add Places / Geocoding / Solar if you use them with this key).
6. Save. Wait 1–5 minutes for propagation.
7. Prefer a **second** key for server-only Geocoding/Solar, restricted by **IP addresses** of the API host (not HTTP referrers).

---

## C. Resend or Amazon SES (UI / console steps)

### Resend (fastest)

1. [resend.com](https://resend.com) → Domains → add `spacetoroof.com` → publish DNS (SPF/DKIM) → wait until **Verified**.
2. API Keys → Create → copy `re_...`.
3. On production host set:
   - `RESEND_API_KEY=re_...`
   - `OUTREACH_FROM_EMAIL=noreply@spacetoroof.com` (must be on the verified domain)
4. Leave `ALLOW_EMAIL_SIMULATION` **unset**. Do not set AWS SES keys if using Resend only.

### Amazon SES

1. AWS Console → **SES** → verify domain `spacetoroof.com` (DKIM) → exit sandbox or request production access.
2. IAM user with `ses:SendEmail` / `ses:SendRawEmail` (or SESv2 `SendEmail`) → create access key.
3. On production host set:
   - `AWS_REGION=<region where identity is verified>`
   - `AWS_ACCESS_KEY_ID=...`
   - `AWS_SECRET_ACCESS_KEY=...`
   - `SES_FROM_EMAIL=noreply@spacetoroof.com`
4. Leave `ALLOW_EMAIL_SIMULATION` **unset**.

---

## D. Deploy on the production host

```bash
cd /path/to/saas1   # production checkout
git fetch origin && git checkout rutvik && git pull origin rutvik
# confirm: git rev-parse --short HEAD  →  f5057a6 (or later)

npm ci
npm run build

cd server && npm ci
# restart ONLY this app’s process, e.g.:
# pm2 restart spacetoroof-api
# systemctl restart spacetoroof-api
```

Do not restart unrelated PM2 apps. Confirm `GET /health` → `{ "status": "ok", "db": "connected" }`.

---

## E. Smoke test (after deploy)

| # | Check | How |
|---|--------|-----|
| 1 | Signup email | Register new user → inbox gets verify link → `/verify-email?token=...` works |
| 2 | Login | Password + Google (if enabled); no COOP popup errors |
| 3 | Reset email | Forgot password → real email → `/reset-password?token=...` |
| 4 | Map unlock credits | Open map / unlock property with credits; Maps loads (no `RefererNotAllowedMapError`) |
| 5 | SMTP / installer send | Integrations → connect mailbox or SMTP → Lead Details → send one-off email |
| 6 | Marketplace bid | Admin-verify installer → browse opportunity → place bid (`MARKETPLACE_REQUIRE_VERIFIED=true`) |
| 7 | Drip opt-out | Lead Details → **Allow outreach · Opt out** → enroll/send blocked; red “Outreach paused…” |

If signup returns 503 about email not configured → provider keys / From domain still wrong.
