# Neon PostgreSQL — Account Setup Guide (A to Z)

Neon is the cloud database that powers HAVESTORY. This guide walks you through creating a production-ready Neon account and database from scratch.

---

## Step 1 — Create Your Neon Account

1. Go to [neon.tech](https://neon.tech)
2. Click **Sign Up**
3. Choose **Continue with GitHub** (easiest — no separate password to remember)
4. Authorize Neon to access your GitHub account
5. You'll land on the Neon dashboard

---

## Step 2 — Create a New Project

1. Click **New Project**
2. Fill in the details:
   - **Project name:** `havestory-production` (or anything you like)
   - **Postgres version:** Leave as default (latest)
   - **Region:** Choose the closest to your customers — for Sri Lanka, select **Singapore** (`aws-ap-southeast-1`) or **Mumbai** (`aws-ap-south-1`)
   - **Compute size:** Leave as default (0.25 CU — free tier)
3. Click **Create Project**
4. A dialog will appear showing your connection string — **don't close this yet**

---

## Step 3 — Copy Your Connection Strings

After creating the project, Neon shows connection details. You need **two versions** of the connection string.

### Get the Pooled Connection String (for the app)

1. In the connection details dialog, find the **Connection string** field
2. Look for a toggle or dropdown that says **Pooled connection** — make sure it is **ON/enabled**
3. The string will look like:
   ```
   postgresql://neondb_owner:AbCdEfGh@ep-something-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Note the word **`pooler`** in the hostname — that's the pooled version
4. Click **Copy** and save it somewhere safe — this is your `DATABASE_URL`

> **Why pooled?** Vercel serverless functions open many short-lived connections. The pooler handles this efficiently without hitting PostgreSQL's connection limit.

### Also Save the Direct Connection String (for migrations)

1. Toggle **Pooled connection** OFF
2. Copy this string too — it looks like:
   ```
   postgresql://neondb_owner:AbCdEfGh@ep-something.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   No `pooler` in this one
3. Save it — you'll use this if you ever need to run database migrations manually

---

## Step 4 — Verify the Database is Empty and Ready

1. In the Neon dashboard, click on your project
2. Go to the **Tables** tab in the left sidebar
3. It should show an empty database — that's correct
4. HAVESTORY automatically creates all tables on the first deploy

---

## Step 5 — Set Up in Vercel

When you deploy to Vercel, add these two environment variables using the **Pooled** connection string from Step 3:

| Variable Name | Value |
|---|---|
| `DATABASE_URL` | Your pooled connection string |
| `NEON_DATABASE_URL` | Same pooled connection string |

Both variables point to the same string. `DATABASE_URL` is used by the app for all queries. `NEON_DATABASE_URL` is used specifically by the session store.

---

## Step 6 — What Happens on First Deploy

When HAVESTORY starts for the first time on a fresh database:

- All tables are created automatically (orders, settings, products, reviews, sessions, etc.)
- Default settings are applied (business name "HAVESTORY", default theme, etc.)
- You log in to the admin panel and customise everything from there

Nothing manual is needed — the app handles its own database setup.

---

## Free Tier Limits (More Than Enough)

Neon's free plan includes:

| Resource | Free Limit |
|---|---|
| Storage | 512 MB |
| Compute hours | 191.9 hours/month |
| Databases | 1 project, 1 database |
| Branches | 10 |
| Connections | Up to 10,000 (pooled) |

A printing business site with hundreds of orders per month will comfortably fit within these limits.

---

## Important: Keep Your Credentials Safe

- **Never share** your connection string — it contains your database password
- **Do not commit** it to GitHub (HAVESTORY's code doesn't — credentials go in Vercel env vars only)
- If credentials are ever exposed, go to Neon dashboard → **Settings → Reset password** immediately

---

## Quick Reference — What You'll Have at the End

```
# Pooled (use this in Vercel)
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-NAME-pooler.REGION.aws.neon.tech/neondb?sslmode=require
NEON_DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-NAME-pooler.REGION.aws.neon.tech/neondb?sslmode=require

# Direct (keep for manual migrations if needed)
DIRECT_URL=postgresql://neondb_owner:PASSWORD@ep-NAME.REGION.aws.neon.tech/neondb?sslmode=require
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Connection refused" on deploy | Make sure you used the **Pooled** connection string, not the direct one |
| "Too many connections" error | Same — switch to the Pooled connection string |
| Forgot to copy the connection string | Go to Neon dashboard → your project → **Connection Details** to get it again |
| Want to reset everything | Neon dashboard → your project → **Settings → Delete project** → create a new one |
| App loads but admin login doesn't work | Database is fine — check your `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_PIN` env vars in Vercel |
