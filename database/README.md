# Samar AgriRescue - Database Publishing Guide

This directory contains the production-ready PostgreSQL database scripts, schema definitions, seed data, and publication utilities for **Samar AgriRescue**.

---

## 📁 Files Overview

- **`schema.sql`**: Production DDL script defining tables, foreign keys, unique constraints, check constraints, and performance indexes.
- **`seed.sql`**: Pre-populated realistic initial dataset for Samar food community (Farmers, Fisherfolk, Buyers, Admin, Listings, Reservations, Messages, Activity History).
- **`agrirescue_publish_dump.sql`**: Consolidated, self-contained single-file migration + seed script ready to run on any cloud or local database.
- **`publish.js`**: Node.js script to automatically apply the publishing dump to any PostgreSQL database via `DATABASE_URL`.

---

## 🗄️ Database Architecture

### 1. `agri_users`
Stores all platform accounts.
- `id` (SERIAL PRIMARY KEY)
- `full_name` (VARCHAR 160)
- `username` (VARCHAR 80 UNIQUE)
- `email` (VARCHAR 255 UNIQUE)
- `password_hash` (TEXT, salted scrypt format)
- `phone` (VARCHAR 40)
- `location` (VARCHAR 160)
- `user_type` (`Farmer`, `Fisherfolk`, `Buyer`, `Administrator`)
- `bio` (TEXT)
- `is_active` (BOOLEAN DEFAULT TRUE)
- `created_at` (TIMESTAMPTZ)

### 2. `agri_products`
Surplus produce & catch listings.
- `id` (SERIAL PRIMARY KEY)
- `producer_id` (INTEGER REFERENCES agri_users)
- `name` (VARCHAR 160)
- `category` (`Vegetables`, `Fruits`, `Rice & Grains`, `Fish`, `Seafood`, `Livestock`, `Other`)
- `description` (TEXT)
- `price` (NUMERIC 12,2)
- `quantity` (NUMERIC 12,2)
- `unit` (`kilogram`, `sack`, `basket`, `piece`, `bundle`, `crate`, `box`)
- `location` (VARCHAR 160)
- `image` (TEXT - supports URLs and base64 uploaded photos)
- `availability_date` (DATE)
- `status` (`Available`, `Reserved`, `Sold`)
- `is_rescue` (BOOLEAN)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3. `agri_reservations`
Buyer reservation requests and status.
- `id` (SERIAL PRIMARY KEY)
- `product_id` (INTEGER REFERENCES agri_products)
- `buyer_id` (INTEGER REFERENCES agri_users)
- `quantity` (NUMERIC 12,2)
- `status` (`Pending`, `Confirmed`, `Cancelled`, `Completed`)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 4. `agri_messages`
Direct buyer-producer communication.
- `id` (SERIAL PRIMARY KEY)
- `sender_id` (INTEGER REFERENCES agri_users)
- `receiver_id` (INTEGER REFERENCES agri_users)
- `product_id` (INTEGER REFERENCES agri_products, nullable)
- `message` (TEXT)
- `is_read` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

### 5. `agri_reports`
Community moderation reports.
- `id` (SERIAL PRIMARY KEY)
- `reporter_id` (INTEGER REFERENCES agri_users)
- `product_id` (INTEGER REFERENCES agri_products)
- `reason` (VARCHAR 160)
- `description` (TEXT)
- `status` (`Open`, `Resolved`, `Dismissed`)
- `created_at` (TIMESTAMPTZ)

### 6. `agri_activities`
Full audit & activity history timeline.
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER REFERENCES agri_users)
- `type` (VARCHAR 50)
- `action` (VARCHAR 255)
- `details` (TEXT)
- `entity_id` (INTEGER)
- `entity_type` (VARCHAR 50)
- `created_at` (TIMESTAMPTZ)

---

## 🚀 How to Publish to Cloud Providers

### Option A: Supabase (Recommended - Free Cloud Postgres)
1. Sign in to [Supabase](https://supabase.com) and create a new project.
2. Go to the **SQL Editor** tab in the sidebar.
3. Open `database/agrirescue_publish_dump.sql`, copy its entire content, paste it into the editor, and click **Run**.
4. Copy your Connection String from **Project Settings > Database > URI**.
5. Set `DATABASE_URL` in your production environment variables.

### Option B: Neon (Free Serverless Postgres)
1. Sign in to [Neon.tech](https://neon.tech) and create a project.
2. Open the **SQL Editor** in the Neon console.
3. Paste `database/agrirescue_publish_dump.sql` and run.
4. Copy the connection string and set `DATABASE_URL`.

### Option C: Railway / Render / DigitalOcean
1. Provision a PostgreSQL service.
2. Connect with your preferred SQL GUI (pgAdmin, DBeaver, TablePlus) or CLI:
   ```bash
   psql "postgres://username:password@host:port/database" -f database/agrirescue_publish_dump.sql
   ```
3. Or use the automated Node publishing script:
   ```bash
   DATABASE_URL="postgres://username:password@host:port/database" node database/publish.js
   ```

### Option D: Local / Docker Deployment
Run PostgreSQL 16 with automatic publishing:
```bash
docker compose up -d
```
The database will be automatically created and seeded on port `5432` with connection:
`postgres://samar_user:samar_secure_password@localhost:5432/samar_agrirescue`

---

## 🔑 Default Seed Accounts & Credentials

| Role | Username | Password | Location | Focus |
|---|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Catbalogan City | Platform Desk & Moderation |
| **Farmer** | `juanfarmer` | `demo123` | Calbayog City | Vegetables, Bananas, Mangoes |
| **Fisherfolk** | `linafisher` | `demo123` | Guiuan | Yellowfin Tuna, Blue Crabs |
| **Buyer** | `mayabuyer` | `demo123` | Catbalogan City | Café Owner & Local Buyer |
| **Farmer** | `eduardo_rice` | `demo123` | Gandara | Gandara Organic Rice |
| **Fisherfolk** | `ramon_catch` | `demo123` | Catbalogan City | Tilapia & Bangus |
| **Buyer** | `samar_kitchen` | `demo123` | Calbayog City | Community Kitchen Hub |
