# SpaceToRoof

AI solar intelligence platform for residential installers and homeowners.  
Live product domain: **[spacetoroof.com](https://spacetoroof.com)**

## Repository map

```text
src/                  Frontend (Vite + React)
  config/             API base URL + brand constants
  pages/
    auth/             Login, register, password flows
    homeowner/        Consumer marketing pages
    marketing/        Installer landing route wrapper
    app/              Authenticated SaaS app pages
    marketplace/      Marketplace UI
    ai-calling/       AI dialer operator UI
  components/
    layout/           App shell (sidebar, top bar, guards)
    homeowner/        Consumer site UI
    marketing/        Installer landing UI
    map|admin|…       Feature UI
  lib/ services/ context/ utils/
server/               Express API (port 5002 by default)
public/               Static assets
DEPLOY.md             Production deployment notes
```

## Prerequisites

- Node.js 20+
- MySQL 8+

## Local development

```bash
# API
cd server
cp .env.example .env   # fill secrets
npm install
npm run dev            # http://localhost:5002

# Frontend (repo root)
cp .env.example .env   # set VITE_API_URL if needed
npm install
npm run dev            # Vite default port
```

Brand / CORS domains for production are documented in `server/.env.example` (`FRONTEND_URL`, `PUBLIC_URL`).

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| Root | `npm run dev` | Vite frontend |
| Root | `npm run build` | Production frontend build → `dist/` |
| Root | `npm run lint` | Oxlint |
| `server/` | `npm run dev` | API with nodemon |
| `server/` | `npm start` | API |
| `server/` | `npm test` | Node test runner |

## Branding

Frontend: [`src/config/brand.js`](src/config/brand.js)  
Backend: [`server/config/brand.js`](server/config/brand.js)

Change product name / domain / emails there — UI wordmarks, PDFs, and transactional mail read from these modules.

## Deploy

See [`DEPLOY.md`](DEPLOY.md) and [`server/README.md`](server/README.md).
