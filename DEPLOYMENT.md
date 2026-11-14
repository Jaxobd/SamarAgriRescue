# Samar AgriRescue — Production & Domain Deployment Guide

Official Domain: **https://SamarAgriRescue.com**

This document covers deploying **Samar AgriRescue** publicly, connecting your custom domain **SamarAgriRescue.com**, and configuring production hosting with Neon PostgreSQL.

---

## 🌐 Custom Domain Setup: SamarAgriRescue.com

To map your custom domain **SamarAgriRescue.com** (via Cloudflare, GoDaddy, Namecheap, Google Domains, etc.), configure the following DNS records in your domain registrar's DNS management panel:

### 1. DNS Records Table

| Type | Name / Host | Target / Value | TTL | Note |
|---|---|---|---|---|
| **A** (or ALIAS/ANAME) | `@` (or `SamarAgriRescue.com`) | `<YOUR_SERVER_PUBLIC_IP>` | Auto / 300 | Points apex domain to production server |
| **CNAME** | `www` | `SamarAgriRescue.com` | Auto / 300 | Redirects www to apex domain |
| **CNAME** (API optional) | `api` | `SamarAgriRescue.com` | Auto / 300 | If running isolated API subdomain |

### 2. Cloudflare (Recommended Free SSL & CDN)
1. In Cloudflare, add site **SamarAgriRescue.com**.
2. Under **DNS > Records**:
   - Add `A` record: Name `@` pointing to your host server IP with Proxy enabled (Orange cloud).
   - Add `CNAME` record: Name `www` pointing to `@` with Proxy enabled.
3. Under **SSL/TLS**: Set encryption mode to **Full (Strict)**.
4. Under **Rules > Page Rules** (or Redirect Rules):
   - Redirect `http://*SamarAgriRescue.com/*` to `https://SamarAgriRescue.com/$2`.

---

## ⚡ Active Public Access

The production application is configured with unified single-port serving (frontend SPA + backend Express API).

- **Public Live Tunnel:** [https://samar-agrirescue.loca.lt](https://samar-agrirescue.loca.lt)
- **Local Production URL:** `http://localhost:5000`
- **Database:** Neon PostgreSQL Cloud Database (`ep-red-darkness-zag421fk-pooler.c-2.eu-west-2.aws.neon.tech`)

---

## 🚀 Step 1: Provision the Production Database

Your database is already provisioned and published on Neon. To republish or reseed anytime:

```bash
# Run database publishing script
pnpm run db:publish
```

Credentials seeded:
- **Admin**: `admin` / `admin123`
- **Farmer**: `juanfarmer` / `demo123`
- **Fisherfolk**: `linafisher` / `demo123`
- **Buyer**: `mayabuyer` / `demo123`

---

## 🔧 Step 2: Environment Variables

| Variable | Description | Value |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://neondb_owner:...@ep-red-darkness-zag421fk-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require` |
| `PORT` | API & Frontend web server port | `5000` |
| `NODE_ENV` | Environment mode | `production` |

---

## 📦 Step 3: Build & Run in Production

```bash
# 1. Install dependencies
pnpm install

# 2. Rebuild all workspace packages (Frontend + API Server + Schemas)
pnpm run build

# 3. Start unified production server
pnpm --filter @workspace/api-server run start
```

The production server serves both:
1. REST API endpoints at `/api/*`
2. Samar AgriRescue React SPA at `/*`
