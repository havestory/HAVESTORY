# PrintBloom Website

## Overview

PrintBloom is a premium printing & graphic design business website for Sri Lanka with a pink-purple glassmorphism visual theme. It includes a full customer-facing website and a complete admin panel.

## Recent Changes

- **Mobile fix: Manual Invoice line-item row**: The inline "Create Manual Invoice" modal in `pages/admin/Invoices.tsx` (separate from `InvoiceFormModal.tsx`) was using a single 5-column grid (`minmax(0,1fr) 90px 120px 110px 24px`) for all widths, so on ~400px mobile the description input collapsed to ~0 width and the "Rs. X" total was clipped at the modal edge. Replaced with a responsive split mirroring `InvoiceFormModal.tsx`: `block sm:hidden` stacks description on its own row (with inline trash) and a `grid-cols-[64px_minmax(0,1fr)_auto]` row for qty/price/total (`whitespace-nowrap`); `hidden sm:grid` keeps the original desktop 5-column grid byte-identical. Added `aria-label` to the mobile qty/unit-price inputs and remove-item button (the desktop column header is hidden at this breakpoint).
- **First-class Invoice Contact Columns**: Added `clientPhone` and `clientEmail` text columns to the `invoices` table so customer contact is no longer buried in the metadata JSON blob. Idempotent startup migration adds the columns and backfills legacy rows from `metadata.form.phone` / `metadata.form.email` (parsed in JS so a single malformed row can't poison the batch). `POST /api/invoices` accepts top-level `clientPhone`/`clientEmail` and lifts them out of metadata as a fallback. `PUT /api/invoices/:id` only updates the contact columns when those fields are explicitly passed (empty string clears, non-empty trims, omitted leaves as-is). Order auto-invoice writes contact directly from `customerPhone`/`customerEmail`. `lib/invoice-client-link` matcher now prefers columns and falls back to metadata for legacy rows.
- **Re-link Old Invoices to Clients (Admin)**: Added admin Settings button "Re-link old invoices" that scans all invoices with `clientId = NULL` and matches them to existing clients by name+phone or email. Backed by `POST /api/admin/backfill-invoice-client-id` (admin-auth gated). Matching logic now lives in shared `lib/invoice-client-link/` package and is consumed by both the CLI script (`pnpm --filter @workspace/scripts run backfill-invoice-client-id`) and the admin endpoint. Result card shows linked / ambiguous / no contact / no match / remaining counts.
- **Quantity Management System**: Added `minQuantity` and `quantityStep` fields to `CustomConfig` type. Admin product form now shows an "Order Quantity Settings" section for standard products. `AddToCartModal` fully overhauled to handle: standard products with min/step, custom_print fixed-quantity tier selector + custom qty, and custom_print range/per-unit with live rate table.
- **Default Category Seeding**: "Default Categories" button in admin Products header seeds 10 standard printing categories (Business Cards, Flyers & Posters, Banners & Signage, Stickers & Labels, Invitations & Cards, Brochures & Booklets, T-Shirts & Apparel, Mugs & Merchandise, Calendars & Planners, Certificates & Diplomas). Only creates categories that don't already exist.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/printbloom) — pink-purple glassmorphism theme
- **Backend**: Express 5 API server (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **File storage**: Cloudinary (persistent cloud storage for all uploaded files)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **State**: Zustand (cart), React Query (server state)
- **Animations**: Framer Motion
- **Charts**: Recharts

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── printbloom/         # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── ...
```

## Website Pages

### Public Pages
- `/` — Homepage: Hero, Stats, Features, Featured Products, Services Preview, Portfolio Preview, Reviews
- `/store` — Product store with category filters and cart
- `/services` — Service packages with pricing
- `/portfolio` — Portfolio grid with category filter
- `/track-order` — Order tracking by ID
- `/about` — Company story and counters
- `/contact` — Contact form

### Admin Panel
- `/admin/login` — Admin login (default: admin / printbloom2024)
- `/admin` — Dashboard: revenue chart, order status donut, top products, recent orders
- `/admin/orders` — All Orders: filter tabs, stat cards, manage modal, status updates
- `/admin/custom-projects` — Custom project requests from the public form
- `/admin/clients` — Client database with PB-CLT-XXXX IDs, CSV export
- `/admin/crm-projects` — CRM project tracking
- `/admin/invoices` — Invoice generation + manual invoice creation
- `/admin/reports` — Business performance reports with PDF download
- `/admin/products` — Full CRUD product management with images
- `/admin/services` — Services & pricing grouped by category
- `/admin/raw-materials` — Inventory tracking for paper, ink, supplies
- `/admin/notices` — Site announcement banner with type and templates
- `/admin/settings` — Website content, contact info, social links

**Sidebar Sections**: OVERVIEW → ORDERS → CRM → FINANCE → CATALOG → INVENTORY → WEBSITE

## Admin Credentials
- **Username**: `admin`
- **Password**: `printbloom2024`
- (Override via ADMIN_USERNAME and ADMIN_PASSWORD env vars)

## API Endpoints

### Public
- `GET /api/stats` — Live site statistics
- `GET /api/settings` — Site settings
- `GET /api/notice` — Site notice/announcement
- `GET /api/products?featured=true&categoryId=1` — Products
- `GET /api/categories` — Product categories
- `GET /api/services?featured=true` — Services
- `GET /api/portfolio?featured=true&category=Branding` — Portfolio
- `GET /api/reviews?approved=true&featured=true` — Reviews
- `POST /api/reviews` — Submit review
- `POST /api/orders` — Submit order (returns unique ID like PB-MAR-2026-A7K)
- `GET /api/orders/track/:orderId` — Track order
- `POST /api/messages` — Submit contact message

### Admin (session-protected)
- `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`
- Full CRUD for: categories, products, services, portfolio, orders, reviews, messages, clients, invoices, inventory
- `PUT /api/settings` — Update site settings (includes `taglineEnabled` boolean)
- `PUT /api/notice` — Update legacy single site notice
- `GET/POST /api/notices` — Multi-notice list (banner + popup)
- `PUT/DELETE /api/notices/:id` — Update or delete individual notice

## Database Schema

Tables: `categories`, `products`, `services`, `portfolio`, `orders`, `reviews`, `messages`, `clients`, `settings`, `notice`, `notices`, `invoices`, `inventory`, `sessions` (auto-created by connect-pg-simple)

- `settings` has `tagline_enabled` column (integer 0/1, default 1) for toggling tagline in nav
- `settings` has `payment_qr_url`, `payment_button_url`, `payment_button_label` columns for homepage payment section QR code and link button
- `settings` has `hero_slide_image1`–`hero_slide_image5` for homepage hero slideshow images
- `notices` is the new multi-notice table with `message`, `style`, `placement` ("banner"/"popup"), `enabled`, `sort_order`

## API Spec & Generated Client

`lib/api-spec/openapi.yaml` contains the OpenAPI spec. `lib/api-client-react/src/generated/` contains generated TypeScript interfaces and React Query hooks (generated by Orval). When adding new DB columns to `settings`, update BOTH:
1. `lib/api-spec/openapi.yaml` — `SiteSettings` and `UpdateSettingsBody` schemas
2. `lib/api-client-react/src/generated/api.schemas.ts` — `SiteSettings` and `UpdateSettingsBody` interfaces

Note: `customFetch` does not strip unknown fields — all fields in the request body reach the server. However, keeping the types in sync avoids `as any` casts and ensures TypeScript type safety throughout the codebase.

## Shared Invoice Components

- `artifacts/printbloom/src/lib/invoiceTypes.ts` — Shared types (LineItem, ShippingOption), helpers (num, rs, calcShipping, parseInvoiceMeta, buildInvoiceMetadata), SHIPPING_OPTIONS constant, INVOICE_EMPTY_FORM
- `artifacts/printbloom/src/components/InvoicePreview.tsx` — Full A4 invoice preview modal with PDF download and JPG ZIP download; used from Invoices page and ManageOrderModal
- `artifacts/printbloom/src/components/InvoiceFormModal.tsx` — Self-contained full invoice form modal with client autofill, line items, shipping, advance, preview; used from Invoices page and ManageOrderModal
- `artifacts/printbloom/src/components/ConfirmDialog.tsx` — Animated delete confirmation dialog (used in Invoices, Products, RawMaterials, WebsiteEditor, Clients)
- `artifacts/printbloom/src/components/ClientPicker.tsx` — Reusable searchable client picker with manual-entry mode, "Save to my Clients database" opt-in tick, and Sri Lankan phone-aware duplicate detection (matches `+94XXXXXXXXX` and `0XXXXXXXXX` as the same number); used from admin's New Order, New Custom Project, and New CRM Project forms. Exports `ClientPicker`, `ensureClientFromPicker`, `EMPTY_CLIENT_VALUE`, `ClientPickerValue`, `ClientLite`.

## Key Features

1. **Order IDs**: Generated as `PB-{MON}-{NNNN}` with a global sequential counter (e.g., PB-MAR-0001, PB-APR-0045). Number never resets between months.
2. **WhatsApp Button**: Floating button on all public pages using number from settings
3. **Admin Panel**: Full content management for all website sections
4. **Live Stats**: Real-time stats from database (clients, products, orders, reviews)
5. **Review Approval**: Reviews require admin approval before appearing publicly
6. **Cart System**: Multi-item cart with order submission
7. **Order Tracking**: Real-time status timeline
8. **Invoice System**: Full manual invoice creation with multi-item line items, shipping options, advance payment, A4 PDF preview/download, JPG ZIP export; orders can create/link/edit/view/unlink invoices
9. **WhatsApp Order Copy**: Each order row (Orders + Custom Projects) has a copy button that builds a customizable WhatsApp message using `{customerName}`, `{orderNumber}`, `{trackingLink}` placeholders from the template set in Settings → Contact Information
10. **Storage Cleanup**: Settings → Storage Cleanup section lets admin delete all Cloudinary-hosted files (attachments, payment proofs, delivery files) from orders older than 3 months, freeing cloud storage

## Development Commands

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev        # API server (port 8080)
PORT=20092 BASE_PATH=/ pnpm --filter @workspace/printbloom run dev  # Frontend (port 20092)
pnpm --filter @workspace/api-spec run codegen                # Regenerate API client
pnpm --filter @workspace/db run push                         # Push DB schema changes
```

## Replit Environment

The project runs natively on Replit using two persistent workflows:

- **Start API Server** — Express API on port 8080 (`/api/*`)
- **Start PrintBloom** — React/Vite frontend on port 20092 (`/`)

### How it works
- **Frontend** (React/Vite): runs via Vite dev server on port 20092, proxied through Replit
- **API** (Express): runs as persistent Express server on port 8080; built with esbuild on startup
- **Database**: Neon PostgreSQL (`NEON_DATABASE_URL`), with Replit built-in PostgreSQL (`DATABASE_URL`) as fallback
- **Sessions**: stored in `sessions` table via `connect-pg-simple`
- **File uploads**: stored in `artifacts/api-server/uploads/` (development) or `/tmp/uploads` (production)

### Environment Variables (managed by Replit)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Auto-set by Replit PostgreSQL (used as fallback) |
| `NEON_DATABASE_URL` | Neon PostgreSQL connection URL (preferred over DATABASE_URL) |
| `SESSION_SECRET` | Long random string for signing session cookies |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `ADMIN_PIN` | Admin 4-digit PIN for 2FA |

### Deploy steps (Replit)
1. Click **Publish** in the Replit UI
2. All environment variables are already configured
3. The production build runs `pnpm --filter @workspace/api-server run build` and serves the bundled Express app
