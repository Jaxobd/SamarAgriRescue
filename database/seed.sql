-- ============================================================================
-- Samar AgriRescue - Production Seed Data for Publishing
-- Default passwords:
--   admin / admin123
--   juanfarmer / demo123
--   linafisher / demo123
--   mayabuyer / demo123
--   eduardo_rice / demo123
--   rosa_organic / demo123
--   ramon_catch / demo123
--   samar_kitchen / demo123
--
-- Password Hash Format: salt:scrypt(password, salt, 32)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Insert Initial Platform Users
-- ----------------------------------------------------------------------------
INSERT INTO agri_users (id, full_name, username, email, password_hash, phone, location, user_type, bio, is_active, created_at)
VALUES
  -- 1. Administrator
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

  -- 2. Farmer - Juan Dela Cruz (Calbayog)
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

  -- 3. Fisherfolk - Lina Marasigan (Guiuan)
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

  -- 4. Buyer - Maya Santos (Catbalogan)
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

  -- 5. Farmer - Eduardo Tan (Gandara)
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

  -- 6. Fisherfolk - Ramon Velasco (Catbalogan)
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

  -- 7. Buyer - Samar Community Kitchen
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

-- Reset sequence to accommodate manually specified IDs
SELECT setval('agri_users_id_seq', (SELECT MAX(id) FROM agri_users));

-- ----------------------------------------------------------------------------
-- 2. Insert Products (Agricultural & Marine Listings)
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

SELECT setval('agri_products_id_seq', (SELECT MAX(id) FROM agri_products));

-- ----------------------------------------------------------------------------
-- 3. Insert Reservations
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

SELECT setval('agri_reservations_id_seq', (SELECT MAX(id) FROM agri_reservations));

-- ----------------------------------------------------------------------------
-- 4. Insert Messages
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

SELECT setval('agri_messages_id_seq', (SELECT MAX(id) FROM agri_messages));

-- ----------------------------------------------------------------------------
-- 5. Insert Activity History
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

SELECT setval('agri_activities_id_seq', (SELECT MAX(id) FROM agri_activities));
