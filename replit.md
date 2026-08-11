# HAVESTORY

Premium photo frame & story gallery business platform for Sri Lanka — full customer-facing website and admin CMS.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/printbloom run dev` — run the frontend (port 20092)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter routing, framer-motion, zustand (cart), TanStack React Query, Tailwind CSS v4, shadcn/ui
- Backend: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec in lib/api-spec/openapi.yaml)
- Build: esbuild (CJS bundle)
- File storage: Cloudinary (persistent cloud storage for uploads)
- Charts: Recharts (admin dashboard)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/` — Drizzle DB schema for all tables
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/printbloom/src/pages/` — React pages (public + admin)
- `artifacts/printbloom/src/components/layout/` — PublicLayout, AdminLayout, AuthGuard
- `lib/api-client-react/src/generated/` — Orval-generated React Query hooks

## Public Pages

- `/` — Home: hero, featured products/services, stats, reviews, about teaser
- `/store` — Product catalog by category with cart & order submission
- `/services` — Services listing with pricing and highlights
- `/portfolio` — Portfolio gallery with category filter
- `/track-order` — Real-time order status tracking
- `/about` — Business story, mission, vision, team stats
- `/contact` — Contact form + WhatsApp + social links

## Admin Pages (all at /admin/*)

- `/admin/login` — Admin authentication (session-based)
- `/admin` — Dashboard: stats, recent orders, messages, reviews
- `/admin/orders` — Standard orders (status updates, WhatsApp copy, delete)
- `/admin/custom-projects` — Custom project orders
- `/admin/clients` — Client CRM with invoice history
- `/admin/invoices` — Invoice management (create, edit, delete)
- `/admin/products` — Product catalog management
- `/admin/services` — Service management
- `/admin/portfolio` — Portfolio item management
- `/admin/raw-materials` — Inventory with low-stock alerts
- `/admin/reviews` — Review moderation (approve/feature)
- `/admin/messages` — Contact inbox (mark read, delete)
- `/admin/notices` — Site banner/notice management
- `/admin/settings` — Full site settings (Business, Hero, About, Contact, Payment, SEO)

## Required Environment Secrets

| Secret | Description |
|---|---|
| `DATABASE_URL` | Auto-set by Replit PostgreSQL |
| `SESSION_SECRET` | Long random string for session cookies |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `ADMIN_PIN` | 4-digit admin PIN (2FA) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (for file uploads) |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

## Architecture decisions

- API-first: all data flows through OpenAPI → codegen → typed hooks — no ad-hoc fetches
- Zod v4 via `zod/v4` import (workspace uses zod@^3.25 which ships the v4 compat layer)
- Orval codegen post-process: sed fixes `from 'zod'` → `from 'zod/v4'` in generated api-zod output
- Sessions stored in PostgreSQL via connect-pg-simple (no JWT)
- File uploads: Cloudinary for persistent storage; local /uploads for dev fallback
- Cart state: local React useState on /store (no persistence needed)

## User preferences

- Business name: HAVESTORY (never "PrintBloom")
- Language: English
- GitHub repo: https://github.com/havestory/HAVESTORY.git
- Deployment target: Vercel

## Gotchas

- After any OpenAPI spec change, run codegen and the sed fix runs automatically via the package.json script
- `ADMIN_PASSWORD` and `ADMIN_PIN` warnings in server logs are expected until secrets are set — login still works (wide open) without them in dev
- The artifact slug is `printbloom` (URL path `/`), business name displayed is HAVESTORY (from DB settings)
- Orval generates `zod.int()` (v4 API) — the codegen script patches the import automatically
