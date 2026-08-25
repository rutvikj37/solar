# SpaceToRoof API

Express ESM backend for the SpaceToRoof platform.

## Layout

```text
server/
  index.js          Boot: middleware, routes, workers, WebSocket
  loadEnv.js        Loads server/.env
  db.js             MySQL pool
  schema.js         Startup schema migrations
  firebase.js       Admin SDK helpers
  config/brand.js   Product branding (emails, PDFs, logs)
  routes/           HTTP routers mounted under /api
  services/         Domain logic (crm, email, marketplace, ai-calling, drip, …)
  middleware/       Auth, asyncHandler, errorHandler
  utils/            PDFs, logging, crypto, guards
  scripts/          Ops / demo / env helpers
  tests/            node --test suites
  vendor/           Vendored Verifalia SDK
  uploads/          Runtime media (tickets, voicemail cache)
```

## Run

```bash
cp .env.example .env
npm install
npm run dev    # or: npm start
```

Default port: **5002** (`PORT`). Health: `GET /health`.

## Environment

See [`.env.example`](.env.example). Required for production:

- `JWT_SECRET`, DB_*, `FRONTEND_URL`, `PUBLIC_URL`
- Payment keys + webhook secrets
- Optional: Firebase, Twilio, CRM/email OAuth, maps keys

`FRONTEND_URL` is comma-separated and used for CORS (include `https://spacetoroof.com` and `https://www.spacetoroof.com`).

## Tests

```bash
npm test
```

## Workers

On listen, the process starts drip, AI dialer, and marketplace background workers (see `index.js`).
