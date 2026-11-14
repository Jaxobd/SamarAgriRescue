import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}`;

console.log('🚀 Starting API server on port', PORT);
const server = spawn('node', ['artifacts/api-server/dist/index.mjs'], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/healthz`);
      if (res.ok) return true;
    } catch {
      await wait(500);
    }
  }
  throw new Error('Server did not start in time');
}

async function runTests() {
  try {
    await waitForServer();
    console.log('\n✅ Server is live! Beginning test suite...\n');

    let adminCookie = '';
    let userCookie = '';

    // ─── Test 1: Health & Stats ───────────────────────────────────────────────
    console.log('▶ Test 1: Public Health & Stats');
    const healthRes = await fetch(`${BASE_URL}/api/healthz`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'ok');

    const statsRes = await fetch(`${BASE_URL}/api/stats`);
    assert.equal(statsRes.status, 200);
    const statsJson = await statsRes.json();
    console.log('  Live Stats:', statsJson);
    assert.ok(statsJson.totalUsers >= 4, 'Must have at least 4 seeded users');
    assert.ok(statsJson.totalProducts >= 4, 'Must have at least 4 seeded products');
    assert.ok(typeof statsJson.availableProducts === 'number');
    console.log('  ✔ Health and Stats verified successfully.');

    // ─── Test 2: Google OAuth Config ──────────────────────────────────────────
    console.log('\n▶ Test 2: Google OAuth Config endpoint');
    const googleRes = await fetch(`${BASE_URL}/api/auth/google/config`);
    assert.equal(googleRes.status, 200);
    const googleJson = await googleRes.json();
    console.log('  Google Config:', googleJson);
    assert.ok('enabled' in googleJson, 'Response must have "enabled" field');
    assert.equal(typeof googleJson.enabled, 'boolean');
    console.log(`  ✔ Google OAuth config endpoint verified (enabled: ${googleJson.enabled}).`);

    // ─── Test 3: Admin & User Login ───────────────────────────────────────────
    console.log('\n▶ Test 3: Authentication (Login)');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(adminLoginRes.status, 200, 'Admin login must succeed');
    const adminLoginJson = await adminLoginRes.json();
    assert.equal(adminLoginJson.user.userType, 'Administrator', 'Admin must have Administrator userType');
    const rawAdminCookie = adminLoginRes.headers.get('set-cookie');
    assert.ok(rawAdminCookie, 'Admin session cookie must be set');
    adminCookie = rawAdminCookie.split(';')[0];
    console.log('  ✔ Admin login successful, cookie acquired.');

    const userLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'mayabuyer', password: 'demo123' })
    });
    assert.equal(userLoginRes.status, 200, 'Buyer login must succeed');
    const userLoginJson = await userLoginRes.json();
    assert.equal(userLoginJson.user.userType, 'Buyer', 'User must have Buyer userType');
    const rawUserCookie = userLoginRes.headers.get('set-cookie');
    assert.ok(rawUserCookie, 'User session cookie must be set');
    userCookie = rawUserCookie.split(';')[0];
    console.log('  ✔ Buyer user login successful, cookie acquired.');

    // Test wrong password
    const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpass' })
    });
    assert.equal(badLoginRes.status, 401, 'Wrong password must return 401');
    console.log('  ✔ Invalid credentials rejected with 401.');

    // ─── Test 4: Forgot / Reset Password ─────────────────────────────────────
    console.log('\n▶ Test 4: Password Reset Workflow');
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'linafisher' })
    });
    assert.equal(forgotRes.status, 200, 'Forgot password must return 200');
    const forgotJson = await forgotRes.json();
    console.log('  Forgot response:', forgotJson.message, '| Username:', forgotJson.username);
    assert.equal(forgotJson.success, true, 'Must return success: true');
    assert.equal(forgotJson.username, 'linafisher', 'Must return matched username');

    // Reset password using identifier
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'linafisher',
        newPassword: 'newpassword123'
      })
    });
    assert.equal(resetRes.status, 200, 'Password reset must succeed');
    const resetJson = await resetRes.json();
    assert.ok(resetJson.message || resetJson.success, 'Must return a success response');

    // Verify new password works
    const linaLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'linafisher', password: 'newpassword123' })
    });
    assert.equal(linaLoginRes.status, 200, 'Login with new password must succeed');
    console.log('  ✔ Password reset flow verified successfully.');

    // ─── Test 5: Image Upload ─────────────────────────────────────────────────
    console.log('\n▶ Test 5: Image Upload & Validation');
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({ image: tinyPng })
    });
    assert.equal(uploadRes.status, 201, 'Image upload must return 201');
    const uploadJson = await uploadRes.json();
    console.log('  Uploaded URL:', uploadJson.url);
    assert.ok(uploadJson.url.startsWith('/api/uploads/'), 'URL must start with /api/uploads/');

    // Verify file is actually served
    const fileRes = await fetch(`${BASE_URL}${uploadJson.url}`);
    assert.equal(fileRes.status, 200, 'Uploaded image must be retrievable');
    assert.equal(fileRes.headers.get('content-type'), 'image/png', 'Content-type must be image/png');
    console.log('  ✔ Image uploaded and served correctly with correct MIME type.');

    // Reject non-image file type
    const invalidUpload = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ image: 'data:text/plain;base64,SGVsbG8gV29ybGQ=' })
    });
    assert.equal(invalidUpload.status, 400, 'Invalid MIME type must be rejected with 400');
    console.log('  ✔ Invalid MIME type (text/plain) rejected with 400 Bad Request.');

    // ─── Test 6: RBAC Protection ──────────────────────────────────────────────
    console.log('\n▶ Test 6: Role-Based Access Control (RBAC)');

    // Unauthenticated request → 401
    const unauthorizedUsers = await fetch(`${BASE_URL}/api/admin/users`);
    assert.equal(unauthorizedUsers.status, 401, 'Unauthenticated must get 401');
    console.log('  ✔ Unauthenticated request blocked with 401 Unauthorized.');

    // Normal user → 403
    const forbiddenUsers = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { 'Cookie': userCookie }
    });
    assert.equal(forbiddenUsers.status, 403, 'Non-admin must get 403 Forbidden');
    console.log('  ✔ Non-admin blocked from /api/admin/users with 403 Forbidden.');

    // Normal user → 403 on DB viewer
    const forbiddenDb = await fetch(`${BASE_URL}/api/admin/database/agri_users`, {
      headers: { 'Cookie': userCookie }
    });
    assert.equal(forbiddenDb.status, 403, 'Non-admin must get 403 on DB viewer');
    console.log('  ✔ Non-admin blocked from /api/admin/database with 403 Forbidden.');

    // ─── Test 7: Admin User Management ───────────────────────────────────────
    console.log('\n▶ Test 7: Admin User Management');

    // List users
    const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.equal(adminUsersRes.status, 200);
    const adminUsersJson = await adminUsersRes.json();
    assert.ok(Array.isArray(adminUsersJson), 'GET /admin/users must return a plain array');
    console.log(`  Admin retrieved ${adminUsersJson.length} users.`);

    // Create new user
    const testUsername = 'test_officer_' + Date.now();
    const newUserRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        username: testUsername,
        fullName: 'Test Agri Officer',
        email: `${testUsername}@samar.gov.ph`,
        phone: '09170001122',
        userType: 'Farmer',
        location: 'Catbalogan City',
        password: 'Password123!'
      })
    });
    assert.equal(newUserRes.status, 201, 'Admin user creation must return 201');
    const newUserJson = await newUserRes.json();
    const newUserId = newUserJson.id;
    assert.ok(newUserId, 'Must return created user with id');
    console.log('  Created new user ID:', newUserId, '| userType:', newUserJson.userType);

    // Update user (deactivate)
    const updateUserRes = await fetch(`${BASE_URL}/api/admin/users/${newUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ isActive: false })
    });
    assert.equal(updateUserRes.status, 200, 'User update must return 200');
    const updatedUserJson = await updateUserRes.json();
    assert.equal(updatedUserJson.isActive, false, 'User must now be inactive');
    console.log('  Updated user: isActive =', updatedUserJson.isActive);

    // Admin self-disable protection
    const selfDisableRes = await fetch(`${BASE_URL}/api/admin/users/${adminLoginJson.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ isActive: false })
    });
    assert.equal(selfDisableRes.status, 400, 'Self-disable must be blocked with 400');
    console.log('  ✔ Admin self-disable prevented with 400 Bad Request.');

    // ─── Test 8: Admin Product Management with Image ──────────────────────────
    console.log('\n▶ Test 8: Admin Product Management');
    const addProductRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        producerId: adminLoginJson.user.id,
        name: 'Fresh Samar Calamansi',
        description: 'Organically grown fresh calamansi from Catbalogan orchard.',
        category: 'Fruits',
        quantity: '120',
        unit: 'kilogram',
        price: '45.00',
        location: 'Catbalogan City, Samar',
        image: uploadJson.url
      })
    });
    assert.equal(addProductRes.status, 201, 'Product creation must return 201');
    const addProductJson = await addProductRes.json();
    const newProductId = addProductJson.id;
    assert.ok(newProductId, 'Must return created product with id');
    console.log('  Created product ID:', newProductId);

    // Edit product price
    const editProductRes = await fetch(`${BASE_URL}/api/admin/products/${newProductId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ price: '48.00' })
    });
    assert.equal(editProductRes.status, 200, 'Product edit must return 200');
    console.log('  ✔ Product created and edited successfully with image reference.');

    // ─── Test 9: Database Viewer (Admin-only, password redacted) ─────────────
    console.log('\n▶ Test 9: Direct Database Viewer (Admin only, password hash redacted)');

    const dbTablesRes = await fetch(`${BASE_URL}/api/admin/database/tables`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.equal(dbTablesRes.status, 200);
    const dbTablesJson = await dbTablesRes.json();
    assert.ok(Array.isArray(dbTablesJson), 'GET /admin/database/tables must return a plain array');
    console.log('  Available DB Tables:', dbTablesJson.map(t => t.name).join(', '));
    assert.ok(dbTablesJson.some(t => t.name === 'agri_users' || t.id === 'agri_users'), 'Must expose agri_users table');
    assert.ok(dbTablesJson.some(t => t.name === 'agri_products' || t.id === 'agri_products'), 'Must expose agri_products table');

    // Inspect agri_users
    const dbUsersRes = await fetch(`${BASE_URL}/api/admin/database/agri_users?page=1&limit=10`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.equal(dbUsersRes.status, 200);
    const dbUsersJson = await dbUsersRes.json();
    const userRecords = dbUsersJson.rows ?? dbUsersJson.records ?? [];
    assert.ok(Array.isArray(userRecords), 'Must return rows/records array');
    assert.ok(userRecords.length > 0, 'Must have at least 1 record');
    console.log(`  Viewer retrieved ${userRecords.length} records from agri_users (total: ${dbUsersJson.total}).`);

    // Verify password hash is strictly redacted
    for (const record of userRecords) {
      if ('passwordHash' in record) {
        assert.equal(
          record.passwordHash,
          '[REDACTED_PASSWORD_HASH]',
          `🔐 SECURITY VIOLATION: raw passwordHash leaked for user ${record.id}!`
        );
      }
      if ('password_hash' in record) {
        assert.equal(
          record.password_hash,
          '[REDACTED_PASSWORD_HASH]',
          `🔐 SECURITY VIOLATION: raw password_hash leaked!`
        );
      }
    }
    console.log('  ✔ SECURITY verified: passwordHash strictly redacted as [REDACTED_PASSWORD_HASH].');

    // Inspect agri_activities
    const dbActivitiesRes = await fetch(`${BASE_URL}/api/admin/database/agri_activities?page=1&limit=5`, {
      headers: { 'Cookie': adminCookie }
    });
    assert.equal(dbActivitiesRes.status, 200);
    const dbActivitiesJson = await dbActivitiesRes.json();
    const activityRecords = dbActivitiesJson.rows ?? dbActivitiesJson.records ?? [];
    console.log(`  Viewer retrieved ${activityRecords.length} activity records (total: ${dbActivitiesJson.total}).`);

    // ─── Test 10: Cleanup ─────────────────────────────────────────────────────
    console.log('\n▶ Test 10: Cleanup (delete test product)');
    const deleteProductRes = await fetch(`${BASE_URL}/api/admin/products/${newProductId}`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie }
    });
    assert.ok([200, 204].includes(deleteProductRes.status), `Product deletion must return 200 or 204, got ${deleteProductRes.status}`);
    console.log('  ✔ Test product deleted successfully.');

    console.log('\n=========================================');
    console.log('🎉 ALL 10 TEST SUITES PASSED FLAWLESSLY!');
    console.log('=========================================\n');
  } finally {
    server.kill();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err.message);
  server.kill();
  process.exit(1);
});
