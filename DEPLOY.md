# PrintBloom — Vercel Deployment Guide (A to Z)

This guide deploys the entire PrintBloom site (frontend + API + admin panel) as a single Vercel project. No separate server needed.

---

## What You Need (Accounts)

| Service | Purpose | Cost |
|---|---|---|
| [github.com](https://github.com) | Source code | Free |
| [neon.tech](https://neon.tech) | PostgreSQL database | Free tier |
| [cloudinary.com](https://cloudinary.com) | File & image storage | Free tier |
| [vercel.com](https://vercel.com) | Hosting (frontend + API) | Free tier |

---

## Step 1 — Neon Database

1. Go to [neon.tech](https://neon.tech) → **Sign up / Log in**
2. Click **New Project** → give it a name (e.g. `printbloom-prod`) → **Create**
3. Once created, click **Connection Details**
4. Set **Connection string** format to **Pooled** (important for serverless!)
5. Copy the full connection string — it looks like:
   ```
   postgresql://user:password@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
6. **Save it** — you'll need this as `DATABASE_URL`

> If you already have a Neon database from development, you can use the same one.
> The first deploy will automatically create any missing tables (including the sessions table).

---

## Step 2 — Cloudinary Credentials

1. Go to [cloudinary.com](https://cloudinary.com) → **Log in**
2. On the dashboard home page you'll see your credentials:
   - **Cloud Name** → e.g. `dxyz123abc`
   - **API Key** → e.g. `123456789012345`
   - **API Secret** → e.g. `AbCdEfGhIjKlMnOpQrStUvWxYz`
3. Save all three — you'll need them as env vars

---

## Step 3 — Generate a Session Secret

The admin login uses a secure session. You need a strong random secret.

**Option A — Use any online generator:**
Go to [generate-secret.vercel.app/64](https://generate-secret.vercel.app/64) and copy the result.

**Option B — Use your terminal:**
```bash
openssl rand -hex 32
```

Save the output — this will be your `SESSION_SECRET`.

---

## Step 4 — Deploy to Vercel

### 4.1 Import the GitHub Repo

1. Go to [vercel.com](https://vercel.com) → **Log in** (use GitHub to log in — easiest)
2. Click **Add New → Project**
3. Find `PrintBloom` in the repo list → click **Import**

### 4.2 Configure the Project

On the "Configure Project" screen:

- **Framework Preset:** Select **Other** (not Next.js, not Vite)
- **Root Directory:** Leave as `.` (the root — do NOT change this)
- **Build Command:** Leave blank — Vercel reads it from `vercel.json` automatically
- **Output Directory:** Leave blank — also in `vercel.json`

### 4.3 Add Environment Variables

Scroll down to **Environment Variables** and add all of these:

| Variable Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Your Neon connection string | From Step 1 |
| `NEON_DATABASE_URL` | Same Neon connection string | Needed for session store |
| `CLOUDINARY_CLOUD_NAME` | Your cloud name | From Step 2 |
| `CLOUDINARY_API_KEY` | Your API key | From Step 2 |
| `CLOUDINARY_API_SECRET` | Your API secret | From Step 2 |
| `ADMIN_USERNAME` | `Admin.PrintBloom` | Or whatever you want |
| `ADMIN_PASSWORD` | Your admin password | Keep this private! |
| `ADMIN_PIN` | Your 4-digit PIN | Keep this private! |
| `SESSION_SECRET` | Random 64-char string | From Step 3 |
| `NODE_ENV` | `production` | Exactly as written |

> **Important:** Add each variable and tick all three environment checkboxes: **Production, Preview, Development**

### 4.4 Deploy

Click **Deploy**. The first build takes about 2–3 minutes.

When it finishes you'll see a live URL like:
```
https://printbloom-xyz.vercel.app
```

---

## Step 5 — Verify It Works

1. Open your Vercel URL in a browser — you should see the PrintBloom homepage
2. Go to `https://your-url.vercel.app/admin` — you should see the admin login
3. Log in with your `ADMIN_USERNAME` and `ADMIN_PASSWORD`, then the PIN
4. Go to **Settings** and update your business name, WhatsApp number, logo, etc.

---

## Step 6 — Custom Domain (Optional)

1. In Vercel dashboard → your project → **Settings → Domains**
2. Type your domain (e.g. `printbloom.lk` or `www.printbloom.lk`) → **Add**
3. Vercel will show you DNS records to set in your domain registrar:
   - For **root domain** (`printbloom.lk`): Add an **A record** pointing to Vercel's IP
   - For **www** (`www.printbloom.lk`): Add a **CNAME** pointing to `cname.vercel-dns.com`
4. DNS changes take 10 minutes to a few hours
5. Vercel automatically handles HTTPS/SSL — nothing to configure

After your custom domain is live, go to **Admin → Settings → Website URL** and update it to your real domain so tracking links work correctly.

---

## Updating the Site Later

Every time you push code to the `main` branch on GitHub, Vercel automatically rebuilds and redeploys. Zero manual steps needed.

To push updates from Replit:
1. Make your changes in Replit
2. Ask the agent to push to GitHub
3. Vercel detects the push and deploys automatically within ~2 minutes

---

## Environment Variables Summary (Quick Copy)

```
DATABASE_URL=postgresql://...your neon string...
NEON_DATABASE_URL=postgresql://...same neon string...
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ADMIN_USERNAME=Admin.PrintBloom
ADMIN_PASSWORD=your_admin_password
ADMIN_PIN=your_pin
SESSION_SECRET=your_64_char_random_string
NODE_ENV=production
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails | Check the build log in Vercel — usually a missing env var |
| Admin login fails | Double-check `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_PIN` env vars |
| Images not uploading | Check Cloudinary env vars are correct |
| Session keeps logging out | Make sure `SESSION_SECRET` is set and `NODE_ENV=production` |
| Database errors | Make sure `DATABASE_URL` uses the **Pooled** connection string from Neon |
| CORS errors in browser | Ensure `NODE_ENV=production` is set |
