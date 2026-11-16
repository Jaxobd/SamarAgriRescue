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

- **Public Live Tunnel:** [https://males-icq-inherited-magnetic.trycloudflare.com](https://males-icq-inherited-magnetic.trycloudflare.com) (quick-tunnel URLs change after every restart/reboot)
- **Local Production URL:** `http://localhost:5000`
- **Database:** Neon PostgreSQL Cloud Database (`ep-red-darkness-zag421fk-pooler.c-2.eu-west-2.aws.neon.tech`)

To bring the public site back up after a restart:

```bash
# 1. Start the unified production server (serves SPA + API from one port)
NODE_ENV=production node artifacts/api-server/dist/index.mjs

# 2. In a second terminal, expose it publicly (URL changes on each run)
cloudflared tunnel --url http://127.0.0.1:5000
```

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
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require` |
| `PORT` | API & Frontend web server port | `5000` |
| `NODE_ENV` | Environment mode | `production` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 credentials | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Optional. Leave **unset** to derive the callback from the request host. If set, it must be a public **HTTPS** URL already registered in the console. | `https://SamarAgriRescue.com/api/auth/google/callback` |

### Google Sign-In setup

Google rejects private/LAN redirect URIs (`Invalid Redirect: must end with a public top-level domain`). The server therefore ignores non-public `GOOGLE_REDIRECT_URI` values and derives `https://<current-host>/api/auth/google/callback` instead.

Register every host you serve from under **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs**:

- `http://localhost:5000/api/auth/google/callback` (local development)
- `https://SamarAgriRescue.com/api/auth/google/callback` (production domain)
- The current tunnel URI (e.g. `https://<your-subdomain>.trycloudflare.com/api/auth/google/callback`) — quick-tunnel hostnames change on every restart, so add the new one whenever it changes, or use a named tunnel / the official domain.

Unregistered hosts show Google error `redirect_uri_mismatch`; username/password login is unaffected.

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
