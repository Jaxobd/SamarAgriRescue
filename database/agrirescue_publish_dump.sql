-- ============================================================================
-- SAMAR AGRIRESCUE - COMPLETE PUBLISHING DATABASE DUMP
-- Full schema, tables, constraints, indexes, sequences, and seed dataset.
--
-- Supported Platforms:
--   - Supabase (SQL Editor)
--   - Neon.tech (Console SQL)
--   - Railway / Render / Fly.io / ElephantSQL
--   - Local / Self-hosted PostgreSQL 14, 15, 16+
--   - Docker container (postgres:16-alpine)
--
-- How to apply:
--   psql -U <username> -d <database_name> -f database/agrirescue_publish_dump.sql
--   or copy and paste directly into any cloud database SQL editor.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Create Tables
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

-- ----------------------------------------------------------------------------
-- 2. Insert Initial Seed Accounts
-- ----------------------------------------------------------------------------
INSERT INTO agri_users (id, full_name, username, email, password_hash, phone, location, user_type, bio, is_active, created_at)
VALUES
  (
    1,
    'Samar AgriRescue Administrator',
    'admin',
    'admin@samaragrirescue.ph',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90:7c43f80888aec4f243a0260d244acb67ec6cf57fbd24d638206bd49f858714c6',
    '0917 100 0001',
    'Catbalogan City, Samar',
    'Administrator',
    'Samar AgriRescue platform operations and community moderation desk.',
    true,
    NOW() - INTERVAL '60 days'
  ),
  (
    2,
    'Juan Dela Cruz',
    'juanfarmer',
    'juan@samaragrirescue.ph',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90:4ca800b39959cb818a14a46aae9b286699519fd59dbc1ccef50da86ed2229b57',
    '0917 555 0142',
    'Calbayog City, Samar',
    'Farmer',
    'Family farmer specializing in fresh highland tomatoes, sweet saba bananas, and seasonal vegetables.',
    true,
    NOW() - INTERVAL '45 days'
  ),
  (
    3,
    'Lina Marasigan',
    'linafisher',
    'lina@samaragrirescue.ph',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90:4ca800b39959cb818a14a46aae9b286699519fd59dbc1ccef50da86ed2229b57',
    '0918 555 0188',
    'Guiuan, Eastern Samar',
    'Fisherfolk',
    'Coastal fisherfolk cooperative member bringing fresh morning catches of tuna, squid, and blue crab directly to local buyers.',
    true,
    NOW() - INTERVAL '40 days'
  ),
  (
    4,
    'Maya Santos',
    'mayabuyer',
    'maya@samaragrirescue.ph',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90:4ca800b39959cb818a14a46aae9b286699519fd59dbc1ccef50da86ed2229b57',
    '0919 555 0191',
    'Catbalogan City, Samar',
    'Buyer',
    'Owner of Maya’s Native Kitchen in downtown Catbalogan. Committed to farm-to-table sourcing and reducing local food waste.',
    true,
    NOW() - INTERVAL '35 days'
  ),
  (
    5,
    'Eduardo Tan',
    'eduardo_rice',
    'eduardo@samaragrirescue.ph',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90:4ca800b39959cb818a14a46aae9b286699519fd59dbc1ccef50da86ed2229b57',
    '0920 888 1234',
    'Gandara, Samar',
    'Farmer',
    'Gandara rice grower producing premium local whole grain and naturally milled organic rice varieties.',
    true,
    NOW() - INTERVAL '30 days'
  ),
  (
    6,
    'Ramon Velasco',
    'ramon_catch',
    'ramon@samaragrirescue.ph',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90:4ca800b39959cb818a14a46aae9b286699519fd59dbc1ccef50da86ed2229b57',
    '0921 777 4321',
    'Catbalogan City, Samar',
    'Fisherfolk',
    'Artisanal fisherfolk operating in Samar Sea waters. Fresh bangus, tilapia, and dried fish products.',
    true,
    NOW() - INTERVAL '25 days'
  ),
  (
    7,
    'Samar Community Kitchen Hub',
    'samar_kitchen',
    'kitchen@samaragrirescue.ph',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90:4ca800b39959cb818a14a46aae9b286699519fd59dbc1ccef50da86ed2229b57',
    '0922 333 5555',
    'Calbayog City, Samar',
    'Buyer',
    'Non-profit community food relief center distributing surplus produce into affordable hot meals for families.',
    true,
    NOW() - INTERVAL '20 days'
  )
ON CONFLICT (username) DO NOTHING;

SELECT setval('agri_users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM agri_users));

-- ----------------------------------------------------------------------------
-- 3. Insert Initial Product Listings
-- ----------------------------------------------------------------------------
INSERT INTO agri_products (id, producer_id, name, category, description, price, quantity, unit, location, image, availability_date, status, is_rescue, created_at, updated_at)
VALUES
  (
    1,
    2,
    'Fresh Highland Tomatoes',
    'Vegetables',
    'Bright, ripe, juicy tomatoes picked this morning from our family slope in Calbayog. Firm and perfect for retail or sauces.',
    85.00,
    35.00,
    'kilogram',
    'Calbayog City, Samar',
    'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    true,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    2,
    2,
    'Native Saba Bananas',
    'Fruits',
    'Naturally ripening saba bananas from Basey orchard. Delicious for banana cue, maruya, or household cooking.',
    60.00,
    20.00,
    'basket',
    'Basey, Samar',
    'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    false,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    3,
    5,
    'Premium Gandara Samar Rice',
    'Rice & Grains',
    'Freshly harvested and milled white rice from Gandara plains. Aromatic, fragrant, and clean grain quality.',
    1450.00,
    15.00,
    'sack',
    'Gandara, Samar',
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    false,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    4,
    3,
    'Pacific Yellowfin Tuna Fresh Catch',
    'Fish',
    'Landed in Guiuan pier before dawn. Chilled on ice immediately. Superior sashimi or steak quality.',
    280.00,
    25.00,
    'kilogram',
    'Guiuan, Eastern Samar',
    'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    true,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    5,
    3,
    'Blue Swimming Crabs (Alimasag)',
    'Seafood',
    'Fat, sweet blue crabs caught off San Pedro Bay. Ideal for ginataang alimasag or steamed with vinegar.',
    320.00,
    14.00,
    'kilogram',
    'Guiuan, Eastern Samar',
    'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    true,
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '6 hours'
  ),
  (
    6,
    2,
    'Fresh Crisp Pechay & Kangkong',
    'Vegetables',
    'Crisp, leafy greens harvest surplus. Zero chemical pesticides used. Excellent for sinigang or stir-fries.',
    45.00,
    28.00,
    'bundle',
    'Calbayog City, Samar',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    true,
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '12 hours'
  ),
  (
    7,
    2,
    'Purple Samar Eggplants (Talong)',
    'Vegetables',
    'Firm, slender purple eggplants harvested fresh. Great for tortang talong, pinakbet, and grilling.',
    70.00,
    30.00,
    'kilogram',
    'Calbayog City, Samar',
    'https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    false,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    8,
    6,
    'Live Pond-Raised Tilapia',
    'Fish',
    'Freshwater pond tilapia harvested on demand. Clean taste, sweet flesh, great for fried or grilled dishes.',
    190.00,
    40.00,
    'kilogram',
    'Catbalogan City, Samar',
    'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    false,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    9,
    2,
    'Sweet Carabao Mangoes',
    'Fruits',
    'Juicy Samar carabao mangoes, sweet and aromatic with thin skin and succulent golden flesh.',
    130.00,
    18.00,
    'kilogram',
    'Calbayog City, Samar',
    'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&auto=format&fit=crop&q=80',
    CURRENT_DATE,
    'Available',
    true,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  )
ON CONFLICT (id) DO NOTHING;

SELECT setval('agri_products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM agri_products));

-- ----------------------------------------------------------------------------
-- 4. Insert Initial Reservations
-- ----------------------------------------------------------------------------
INSERT INTO agri_reservations (id, product_id, buyer_id, quantity, status, created_at, updated_at)
VALUES
  (
    1,
    1,
    4,
    10.00,
    'Confirmed',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '20 hours'
  ),
  (
    2,
    4,
    4,
    5.00,
    'Pending',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '5 hours'
  ),
  (
    3,
    3,
    7,
    4.00,
    'Confirmed',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

SELECT setval('agri_reservations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM agri_reservations));

-- ----------------------------------------------------------------------------
-- 5. Insert Initial Messages
-- ----------------------------------------------------------------------------
INSERT INTO agri_messages (id, sender_id, receiver_id, product_id, message, is_read, created_at)
VALUES
  (
    1,
    4,
    2,
    1,
    'Hi Kuya Juan, I reserved 10kg of your fresh tomatoes for our café. What time can we pick them up at Calbayog market?',
    true,
    NOW() - INTERVAL '1 day'
  ),
  (
    2,
    2,
    4,
    1,
    'Magandang araw Maya! We will have them sorted and boxed by 8:00 AM near the north terminal entrance.',
    true,
    NOW() - INTERVAL '22 hours'
  ),
  (
    3,
    4,
    3,
    4,
    'Hello Lina, interested in reserving 5kg of the yellowfin tuna. Can you pack it with crushed ice for transit to Catbalogan?',
    false,
    NOW() - INTERVAL '5 hours'
  )
ON CONFLICT (id) DO NOTHING;

SELECT setval('agri_messages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM agri_messages));

-- ----------------------------------------------------------------------------
-- 6. Insert Initial Activities
-- ----------------------------------------------------------------------------
INSERT INTO agri_activities (id, user_id, type, action, details, entity_id, entity_type, created_at)
VALUES
  (
    1,
    2,
    'product_created',
    'Listed Fresh Highland Tomatoes (35 kg)',
    '₱85.00/kilogram · Calbayog City, Samar · Marked as Rescue',
    1,
    'product',
    NOW() - INTERVAL '2 days'
  ),
  (
    2,
    2,
    'product_created',
    'Listed Native Saba Bananas (20 baskets)',
    '₱60.00/basket · Basey, Samar',
    2,
    'product',
    NOW() - INTERVAL '3 days'
  ),
  (
    3,
    3,
    'product_created',
    'Listed Pacific Yellowfin Tuna Fresh Catch (25 kg)',
    '₱280.00/kilogram · Guiuan, Eastern Samar · Rescue listing',
    4,
    'product',
    NOW() - INTERVAL '1 day'
  ),
  (
    4,
    4,
    'reservation_created',
    'Reserved 10 kg of Fresh Highland Tomatoes',
    'Total: ₱850.00 · Direct pickup arranged with Juan Dela Cruz',
    1,
    'reservation',
    NOW() - INTERVAL '1 day'
  ),
  (
    5,
    2,
    'reservation_confirmed',
    'Confirmed reservation for Maya Santos',
    '10 kg Fresh Highland Tomatoes confirmed for morning pickup',
    1,
    'reservation',
    NOW() - INTERVAL '20 hours'
  ),
  (
    6,
    4,
    'message_sent',
    'Sent pickup coordination message to Juan Dela Cruz',
    'Arranging North terminal pickup details',
    1,
    'message',
    NOW() - INTERVAL '1 day'
  ),
  (
    7,
    4,
    'reservation_created',
    'Reserved 5 kg of Pacific Yellowfin Tuna Fresh Catch',
    'Status: Pending producer confirmation',
    2,
    'reservation',
    NOW() - INTERVAL '5 hours'
  )
ON CONFLICT (id) DO NOTHING;

SELECT setval('agri_activities_id_seq', (SELECT COALESCE(MAX(id), 1) FROM agri_activities));

COMMIT;

-- ----------------------------------------------------------------------------
-- Verification summary
-- ----------------------------------------------------------------------------
SELECT 'Samar AgriRescue Database Successfully Published!' AS status;
SELECT 'Users' AS entity, count(*) AS total FROM agri_users
UNION ALL
SELECT 'Products' AS entity, count(*) AS total FROM agri_products
UNION ALL
SELECT 'Reservations' AS entity, count(*) AS total FROM agri_reservations
UNION ALL
SELECT 'Messages' AS entity, count(*) AS total FROM agri_messages
UNION ALL
SELECT 'Activities' AS entity, count(*) AS total FROM agri_activities;
