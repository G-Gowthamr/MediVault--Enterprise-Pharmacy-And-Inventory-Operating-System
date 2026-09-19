const BASE_URL = 'http://localhost:3000';

async function testAll() {
  console.log('🧪 Starting Full System Integration Test Suite for MediVault...\n');
  let passedCount = 0;
  let totalCount = 0;

  async function assertEndpoint(name, fn) {
    totalCount++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Health check
  await assertEndpoint('GET /api/health', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    if (res.status !== 200 || !data.status) throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  });

  // 2. Admin Login
  let adminToken = null;
  await assertEndpoint('POST /api/auth/login (Admin)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@medivault.com', password: 'admin123' })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.token) throw new Error(data.message || 'Login failed');
    adminToken = data.token;
  });

  // 3. Auth Me Profile
  await assertEndpoint('GET /api/auth/me (Profile Verification)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.status !== 200 || data.email !== 'admin@medivault.com') throw new Error('Failed profile verification');
  });

  // 4. Get Medicines Catalog
  let existingMedicineId = null;
  await assertEndpoint('GET /api/medicines (Catalog Fetch)', async () => {
    const res = await fetch(`${BASE_URL}/api/medicines`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data)) throw new Error('Invalid medicines format');
    if (data.length > 0) existingMedicineId = data[0].id;
  });

  // 5. Create Medicine
  let newMedId = null;
  await assertEndpoint('POST /api/medicines (Add Drug Item)', async () => {
    const res = await fetch(`${BASE_URL}/api/medicines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Amoxicillin 500mg Test',
        category: 'Antibiotics',
        strength: '500mg',
        manufacturer: 'Pfizer Ltd.',
        batch: 'BATCH-2026-X',
        quantity: 100,
        price: 45.50,
        mrp: 50.00,
        expiry: '2027-12-31',
        description: 'Test antibiotic batch'
      })
    });
    const data = await res.json();
    if (res.status !== 201 || !data.id) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
    newMedId = data.id;
  });

  // 6. Update Medicine
  await assertEndpoint('PUT /api/medicines/:id (Update Drug Stock)', async () => {
    const res = await fetch(`${BASE_URL}/api/medicines/${newMedId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Amoxicillin 500mg Test Updated',
        category: 'Antibiotics',
        strength: '500mg',
        manufacturer: 'Pfizer Ltd.',
        batch: 'BATCH-2026-X',
        quantity: 150,
        price: 45.50,
        mrp: 50.00,
        expiry: '2027-12-31',
        description: 'Updated description'
      })
    });
    const data = await res.json();
    if (res.status !== 200 || data.quantity !== 150) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  });

  // 7. Process POS Sale
  await assertEndpoint('POST /api/sales (POS Atomic Checkout)', async () => {
    const res = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        customer_name: 'Test Customer',
        customer_phone: '+91 9999988888',
        payment_method: 'UPI',
        transaction_ref: 'TXN-UPI-998877',
        items: [
          {
            medicine_id: newMedId,
            qty: 5,
            price: 45.50
          }
        ]
      })
    });
    const data = await res.json();
    if (res.status !== 201 || !data.id) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  });

  // 8. Get Sales Transactions
  await assertEndpoint('GET /api/sales (Historical Sales List)', async () => {
    const res = await fetch(`${BASE_URL}/api/sales`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data)) throw new Error('Failed to list sales');
  });

  // 9. Get System Settings
  await assertEndpoint('GET /api/settings (System Preferences)', async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.status !== 200) throw new Error('Failed to fetch settings');
  });

  // 10. Audit Logs
  await assertEndpoint('GET /api/audit-logs (Security Audit Trail)', async () => {
    const res = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.status !== 200 || !Array.isArray(data)) throw new Error('Failed to fetch audit logs');
  });

  // Summary
  console.log(`\n==============================================`);
  console.log(`📊 Test Suite Result: ${passedCount}/${totalCount} Passed`);
  console.log(`==============================================\n`);

  if (passedCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testAll();
