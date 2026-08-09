# HAVESTORY — Neon, Cloudinary and Vercel Deployment (A to Z)

This repository deploys the customer website, admin panel and Express API as one Vercel project.

> Isolation rule: create brand-new HAVESTORY services. Never reuse a PrintBloom database, Cloudinary product environment, Vercel project, session secret or admin password.

## 1. Before deployment

1. Review and merge the active HAVESTORY foundation pull request into `main`.
2. Confirm the GitHub repository is `kleraandria35-coder/HAVESTORY`.
3. Keep all credentials outside GitHub. Add them only as Vercel environment variables.

## 2. Create the HAVESTORY Neon database

1. Sign in at https://console.neon.tech.
2. Choose **New Project**.
3. Project name: `havestory-production`.
4. Region: choose Singapore or the closest available region to Sri Lanka.
5. Create the project.
6. Open the project and click **Connect**.
7. Select the main database and owner role.
8. Enable **Pooled connection**. The hostname normally contains `-pooler`.
9. Copy the complete connection string.
10. Save it privately. Use the same pooled value for:
   - `DATABASE_URL`
   - `NEON_DATABASE_URL`

Do not manually copy PrintBloom tables or data. HAVESTORY starts against its own empty database and creates the required structure during startup.

Official reference: https://neon.com/docs/connect/choose-connection

## 3. Create the HAVESTORY Cloudinary account/environment

1. Sign in or create a separate account at https://console.cloudinary.com.
2. Use a HAVESTORY-owned email address where possible.
3. On the Dashboard, note the **Cloud name**.
4. Open **Settings → API Keys**.
5. Generate or select a key pair dedicated to HAVESTORY production.
6. Record:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
7. Never place the API secret in frontend code, screenshots, chat messages or GitHub.
8. HAVESTORY uploads are stored under `havestory/...` folders by the application.

Official reference: https://cloudinary.com/documentation/finding_your_credentials_tutorial

## 4. Create private login secrets

Create:

- `SESSION_SECRET`: a random value of at least 64 characters
- `ADMIN_USERNAME`: for example `Admin.HAVESTORY`
- `ADMIN_PASSWORD`: a new unique strong password
- `ADMIN_PIN`: a new four-digit PIN that is not reused elsewhere

A local terminal can generate the session secret with:

```bash
openssl rand -hex 32
```

Do not use PrintBloom login values.

## 5. Import HAVESTORY into Vercel

1. Sign in at https://vercel.com using the GitHub account that can access the private repository.
2. Select **Add New → Project**.
3. Import `kleraandria35-coder/HAVESTORY`.
4. Set project name to `havestory` or another HAVESTORY-only name.
5. **Framework Preset:** Other.
6. **Root Directory:** `.` (repository root).
7. Do not override the build or install commands. The repository's `vercel.json` uses:
   - install: `pnpm install --frozen-lockfile`
   - build: `pnpm run build:vercel`
8. Do not connect the existing PrintBloom Vercel project.

Official reference: https://vercel.com/docs/git/vercel-for-github

## 6. Add Vercel environment variables

Before the first deployment, add these under **Project → Settings → Environment Variables**:

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | HAVESTORY pooled Neon URL | Yes |
| `NEON_DATABASE_URL` | Same HAVESTORY pooled Neon URL | Yes |
| `CLOUDINARY_CLOUD_NAME` | HAVESTORY cloud name | Yes |
| `CLOUDINARY_API_KEY` | HAVESTORY API key | Yes |
| `CLOUDINARY_API_SECRET` | HAVESTORY API secret | Yes |
| `SESSION_SECRET` | New random 64+ character secret | Yes |
| `ADMIN_USERNAME` | `Admin.HAVESTORY` or your choice | Yes |
| `ADMIN_PASSWORD` | New strong password | Yes |
| `ADMIN_PIN` | New four-digit PIN | Yes |
| `GMAIL_USER` | Notification Gmail address | Optional |
| `GMAIL_APP_PASSWORD` | Gmail App Password | Optional |

Apply required variables to **Production**. Use separate values for Preview/Development if you enable those environments. Do not put production secrets into Preview unless you intentionally want preview builds to access production services.

Vercel sets `NODE_ENV=production`; do not add it manually.

Official reference: https://vercel.com/docs/environment-variables

## 7. First deployment

1. Click **Deploy**.
2. Wait for both the frontend build and API function build to finish.
3. Copy the final production URL, for example `https://havestory-xxxx.vercel.app`.
4. Add `FRONTEND_ORIGIN` in Vercel with that exact origin and no trailing slash.
5. Redeploy from **Deployments → latest deployment → Redeploy** so the API receives the origin value.

## 8. Verify everything

1. Open the home page.
2. Open `/admin/login`.
3. Log in with `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_PIN`.
4. Add one test product and image.
5. Confirm the image appears inside the HAVESTORY Cloudinary environment.
6. Create a test coupon and validate it in the storefront.
7. Create a test customer/order and confirm it appears in the admin panel.
8. Check the Neon Tables view and confirm the data exists only in `havestory-production`.
9. Test logout/login again to confirm the secure session works.
10. Delete test records if they are no longer needed.

## 9. Add a custom domain later

1. Open **Vercel Project → Settings → Domains**.
2. Add the HAVESTORY domain.
3. Follow the exact DNS records Vercel displays.
4. After the domain verifies, change `FRONTEND_ORIGIN` to the final HTTPS domain.
5. Redeploy.
6. Update the website URL and shipping/verification links in the HAVESTORY admin settings.

Official reference: https://vercel.com/docs/projects/domains

## 10. Future updates

After the Vercel project is linked, pushes merged into `main` create production deployments automatically. Pull request branches create preview deployments when Git integration is enabled. Keep Preview connected only to non-production test services if it needs database or upload access.
