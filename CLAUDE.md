# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and all agents when working with code in this repository.

## 🚨 Mandatory Skill-First Protocol (All Agents & Subagents)

All agents and subagents working in this repository **MUST** base their analysis, design, and implementation on the project's installed skills located in `.claude/skills/<skill>/SKILL.md` (and mirrored in `.agents/skills/<skill>/SKILL.md`).

Before modifying code or answering technical questions about any area below, **read and follow the corresponding skill**:

| Domain / Module | Required Skill(s) (`.claude/skills/<skill>/SKILL.md`) | Scope & Triggers |
| :--- | :--- | :--- |
| **Hacienda CR v4.4 E-Invoicing** | `hacienda-cr-v44` | 50-digit clave, XML v4.4 builders (`FE`, `TE`, `NC`, `ND`, `FEC`, `REP`), XAdES-EPES `.p12` signing (`signer.js`), XML reception (`xmlParserService.js` with `parseTagValue: false`), AES-256 credentials (`EMAIL_ENC_KEY`), `haciendaWorker.js`. |
| **CR Taxes (REA 2026) & AI Categorization** | `rea-impuestos-cr` | IVA cuatrimestral (D-135-1), progressive Renta (D-101), annual REA reconciliation (D-150), 1% agricultural inputs (`insumos_oficiales.json`), CSV/Excel exports, AI provider cascade (Gemini -> NVIDIA NIM -> local heuristic). |
| **Multi-Tenancy, Quotas & ONVO Pay** | `multitenant-onvo-billing` | `tenantId` isolation (`req.filtrarPorTenant`, `req.aplicarTenant`), `free` vs `pro` plans (`planes.js`), `quotaGuard.js`, idempotent ONVO Pay webhooks (mounted before `express.json()`), `--dry-run` migrations. |
| **Invoice Ingestion, Inventory & Production Costs** | `ingesta-facturas-agro-inventario` | Cloudflare Email & WhatsApp webhook ingestion (`ingestaFacturaService.js`), tenant resolution cascade, multi-species inventory (`bovinos`, `aves`, `peces`, `abejas`), production cost KPIs & FCA. |
| **Cloudflare Email Worker** | `cloudflare-email-service`, `workers-best-practices` | `cloudflare-email-worker/worker.js`, catch-all email routing (`@contadorganandero.com`), raw MIME forwarding. |
| **Node.js & Express Backend** | `nodejs-backend-patterns` | `routes/ -> controllers/ -> services/ -> models/`, middleware ordering, JWT + refresh cookie auth, error handling, rate limiting. |
| **MongoDB & Mongoose** | `mongodb-query-optimizer`, `mongodb-connection` | Mongoose schemas, compound indexes, atomic `$inc` counters, connection resilience and offline fallback. |
| **Backend & JS Testing** | `javascript-testing-patterns` | Jest (`--runInBand`), Supertest, `mongodb-memory-server` unit and integration testing. |
| **React 19 & Component Architecture** | `vercel-react-best-practices`, `vercel-composition-patterns` | React 19 components, hooks, lazy-loaded routes, `AuthContext.jsx`, single-flight token refresh in `src/services/api.js`. |
| **UI/UX, Tailwind CSS 3 & shadcn/ui** | `tailwind-design-system`, `frontend-design`, `web-design-guidelines` | Hybrid Tailwind + per-page CSS convention, Radix UI / shadcn primitives (`src/components/ui/`), accessibility, responsive layout. |
| **Vite 8 & Frontend Build (Cloudflare Prod)** | `vite`, `workers-best-practices` | `frontend/vite.config.js`, `frontend/wrangler.toml`, `/api` proxy, `@/` aliases, bundle optimization, Cloudflare production SPA deployment. |

When spawning subagents, always instruct them in their task prompt to read the relevant `.claude/skills/<skill>/SKILL.md` files first.

---

## What this is

ContadorGanadero: MERN SaaS (Spanish-language, Costa Rica) for small farmers under the Régimen Especial Agropecuario (REA). Automatic invoice ingestion (email/WhatsApp), AI expense categorization, CR tax calculations (IVA cuatrimestral D-135-1, renta D-101), multi-species inventory, Hacienda v4.4 electronic invoicing, freemium subscriptions (ONVO Pay).

npm workspace at root: `backend` and `frontend`. The backend loads the **single root `.env`** (`dotenv.config({ path: ../.env })` from `backend/server.js`); Vite also reads it for `VITE_*` vars. Templates: `.env.example` and `.env.production.example`.

## Commands

```bash
# Backend (run from backend/)
npm run dev            # nodemon server.js
npm test               # jest --runInBand
npx jest __tests__/quotaGuard.test.js   # single test file
npx jest -t "name"                     # single test case
npm run test:coverage
npm run migrate:tenant  # backfill migrations (--dry-run supported): also migrate:planes, migrate:onvo

# Frontend (run from frontend/)
npm run dev            # vite (proxies /api -> http://localhost:5000)
npm run build          # wipes dist/ then vite build
npm run lint           # eslint
```

Backend tests use **mongodb-memory-server** (started in `jest.setup.js`, collections wiped afterEach) and **supertest** against minimal express apps mounting only the routes under test. They load the root `.env`.

## Architecture

### Backend (Express + Mongoose)

`server.js` middleware order matters: helmet → morgan → dynamic CORS → **ONVO webhook mounted BEFORE `express.json()`** (it parses its own body; auth via `X-Webhook-Secret`) → json/urlencoded → cookieParser → auth routes → rate limiters (webhook paths excluded) → `/api/*` routes → serves built SPA from `../frontend/dist`. A global error middleware returns **hard-coded mock data** for dashboard/inventario/facturas/impuestos when Mongo is unreachable — this is an intentional offline-demo fallback, not a bug.

Layers: `routes/` → `controllers/` → `services/` → `models/`.

- **Auth**: JWT Bearer (`middleware/authMiddleware.js` `protegerRuta`; payload `{ id, tenantId, rol }`) + httpOnly-cookie refresh token. On DB failure it falls back to a stub demo user (offline tolerance).
- **Multi-tenancy**: every data doc is scoped by `tenantId` (Tenant = one finca, members with roles dueño/contador/peón). Controllers scope via `req.filtrarPorTenant()` / `req.aplicarTenant()` from `middleware/tenantGuard.js`. Some legacy paths still filter by `usuario` with tenantId preferred — keep both when touching queries.
- **Plans/quotas**: plans are exactly `free` and `pro` — anything else (bronce/oro/corporativo/agro) is legacy. Source of truth `backend/config/planes.js` (`LIMITES_POR_PLAN`); frontend mirror in `frontend/src/data/planes.js`. Enforced by `middleware/quotaGuard.js` (conteo/chat credits, feature flags `moduloContable`/`moduloD150`/`vlmHabilitado`). Admin: `middleware/adminGuard.js` (`esSuperAdmin` via `SUPER_ADMIN_EMAILS` allowlist).
- **AI**: `services/aiProvider.js` tries providers in order — Gemini (`GEMINI_API_KEY`) → NVIDIA NIM OpenAI-compatible (`AI_API_KEY`, baseURL integrate.api.nvidia.com) → local keyword heuristic (no external calls). Despite README mentions, there is no OpenRouter in code. `services/aiService.js` builds the Spanish system prompt with REA context and appends the official insumos catalog (`insumos_oficiales.json`).
- **Invoice ingestion**: two channels converge on `services/ingestaFacturaService.js`: (1) Cloudflare Email Worker (`cloudflare-email-worker/`, deployed separately in CF dashboard, catch-all on @contadorganandero.com) POSTs raw MIME to `/api/webhooks/email` (secret header `EMAIL_WEBHOOK_SECRET`); (2) WhatsApp Meta webhook `/api/webhooks/whatsapp`. Tenant resolved by cédula from XML → user/tenant ID → tenant `emailAlias` → phone. Legacy IMAP IDLE listener (`services/emailService.js` + `worker.js` background process) still exists.
- **XML parsing**: `services/xmlParserService.js` uses fast-xml-parser with `parseTagValue: false` — this is critical (preserves 50-digit claves and leading zeros). Don't change it.
- **Taxes**: `services/impuestoService.js` (D-135-1 IVA cuatrimestral, renta), `declaracionService.js` (CSV/Excel export), `d150Service.js`. 2026 constants live in `utils/costaRicaTax.js`.
- **Hacienda e-invoicing** (`services/hacienda/` + `haciendaWorker.js`): only **FE (tipo 01)** is implemented; NC/ND/TE/FEC/REP XML builders are pending. `signer.js` hardcodes the `</FacturaElectronica>` root node and must be made dynamic when adding types. Works only in `HACIENDA_AMBIENTE=local` (mocks) — see `docs/PENDIENTES_HACIENDA.md`. Worker signs/sends/polls `FacturaEmision` docs in estado `firmada`; runs standalone (`worker.js`, deployed as Render Background Worker) or embedded (`HACIENDA_WORKER_EMBEDDED=true`).
- **Per-tenant Hacienda credentials** are AES-256-CBC encrypted (`utils/crypto.js`) with `EMAIL_ENC_KEY` — must be exactly 64 hex chars or encryption is **silently disabled**.
- **Subscriptions**: `services/onvoService.js` (ONVO Pay REST; test/live mode from key prefix). Webhooks are idempotent; no cancellation webhook exists — cancel is in-app `POST /api/onvo/cancelar`. Events to handle: `subscription.renewal.succeeded` / `.failed` (periodo_gracia).

### Frontend (React 19 + Vite + Tailwind)

- Styling: Tailwind 3 with shadcn-style UI kit (`components.json`, JSX not TSX, aliases `@/components` etc.; `src/components/ui/`). **Hybrid convention**: per-page plain CSS files (`DashboardPage.css` etc.) coexist with Tailwind — follow the existing pattern of the page you touch.
- Data fetching: single axios client `src/services/api.js` — 401 responses trigger a single-flight transparent refresh (`/auth/refresh` via `refreshPromise`), then retry. Add calls as named exports there.
- Routing: react-router-dom v7; protected `AppLayout` with `RutaProtegida`/`RutaAdmin`; all pages lazy-loaded. Super-admin pages under `src/pages/admin/`.
- Global state: only `src/context/` (singular) `AuthContext.jsx`. No react-query/redux — plain useEffect + api calls.
- **Production Infrastructure (LIVE)**:
  - **Frontend in Production → Cloudflare**: Deployed on **Cloudflare** (`frontend/wrangler.toml`, `name = "contador-ganadero"`, serving `./dist` with `not_found_handling = "single-page-application"`). Inbound invoice emails (`*@contadorganandero.com`) are also handled on Cloudflare via `cloudflare-email-worker/worker.js`.
  - **Backend in Production → Render**: Deployed on **Render** (`render.yaml`: web service `contador-ganadero-api` at `https://contador-ganadero.onrender.com` with `/api/health` check, plus background worker `contador-ganadero-imap-worker` running `node worker.js`). Render free tier spins down — an external cron hits `POST /api/cron/sync-emails` (see `CRON_SETUP.md`).
  - Always preserve cross-origin compatibility (dynamic CORS in `backend/server.js`, `withCredentials` + refresh token cookies, `VITE_API_URL`, and webhook endpoints) between the Cloudflare frontend and the Render backend.

## Known gotchas

- Consecutivo generation for e-invoices is `Date.now()`-based (collision risk); roadmap says move to atomic `$inc`.
- Duplicate Mongoose index warnings in `models/Tenant.js` — pending cleanup.
- `EMAIL_ENC_KEY` previously leaked in `CRON_SETUP.md` git history and must be rotated, not reused.
- `.gitignore` must cover `.env` and `*.p12` (per-tenant Hacienda certs) before committing.
- Monthly consumption reset is manual (admin panel) — the reset cron is not wired yet.
- `Categoria` model is a global catalog, never tenant-scoped/migrated.

## Working conventions

- UI text and user-facing strings are in Spanish (Costa Rican agricultural/tax domain language).
- Migration scripts under `backend/scripts/` support `--dry-run`; see `scripts/MIGRATE_README.md`.
- Docs in `docs/` track module status and pending Hacienda work — consult `ESTADO_PROYECTO_Y_ROADMAP.md` before planning changes to taxes/invoicing.
