-- ============================================================================
-- Samar AgriRescue - Production Database Schema for Publishing
-- Target DBMS: PostgreSQL 14+ (Compatible with Supabase, Neon, Railway, Render, RDS, Docker)
-- ============================================================================

-- Enable pgcrypto extension if available (optional for uuid/crypto functions)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Table: agri_users
-- Stores registered platform users: Farmers, Fisherfolk, Buyers, and Admins
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agri_users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(160) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone VARCHAR(40),
    location VARCHAR(160),
    user_type VARCHAR(30) NOT NULL CHECK (user_type IN ('Farmer', 'Fisherfolk', 'Buyer', 'Administrator')),
    profile_image TEXT,
    bio TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agri_users_username ON agri_users(username);
CREATE INDEX IF NOT EXISTS idx_agri_users_email ON agri_users(email);
CREATE INDEX IF NOT EXISTS idx_agri_users_user_type ON agri_users(user_type);

-- ----------------------------------------------------------------------------
-- Table: agri_products
-- Agricultural & fishery surplus listings from local Samar producers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agri_products (
    id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL REFERENCES agri_users(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(80) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity >= 0),
    unit VARCHAR(40) NOT NULL,
    location VARCHAR(160) NOT NULL,
    image TEXT,
    availability_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Reserved', 'Sold')),
    is_rescue BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agri_products_producer_id ON agri_products(producer_id);
CREATE INDEX IF NOT EXISTS idx_agri_products_status ON agri_products(status);
CREATE INDEX IF NOT EXISTS idx_agri_products_category ON agri_products(category);
CREATE INDEX IF NOT EXISTS idx_agri_products_is_rescue ON agri_products(is_rescue);
CREATE INDEX IF NOT EXISTS idx_agri_products_created_at ON agri_products(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: agri_reservations
-- Reservations made by buyers to hold produce before local pickup
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agri_reservations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES agri_products(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES agri_users(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Cancelled', 'Completed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agri_reservations_product_id ON agri_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_agri_reservations_buyer_id ON agri_reservations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_agri_reservations_status ON agri_reservations(status);
CREATE INDEX IF NOT EXISTS idx_agri_reservations_created_at ON agri_reservations(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: agri_messages
-- Direct peer-to-peer communication between buyers and producers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agri_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES agri_users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES agri_users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES agri_products(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agri_messages_sender_id ON agri_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_agri_messages_receiver_id ON agri_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_agri_messages_created_at ON agri_messages(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: agri_reports
-- Moderation reports submitted by users for inappropriate or inaccurate listings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agri_reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES agri_users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES agri_products(id) ON DELETE CASCADE,
    reason VARCHAR(160) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Resolved', 'Dismissed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agri_reports_status ON agri_reports(status);
CREATE INDEX IF NOT EXISTS idx_agri_reports_created_at ON agri_reports(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: agri_activities
-- Comprehensive chronological audit & activity log for users and platform events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agri_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES agri_users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    entity_id INTEGER,
    entity_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agri_activities_user_id ON agri_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_agri_activities_type ON agri_activities(type);
CREATE INDEX IF NOT EXISTS idx_agri_activities_created_at ON agri_activities(created_at DESC);
