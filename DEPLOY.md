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
