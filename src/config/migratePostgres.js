const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query, getClient } = require('./postgres');

async function runPostgresMigrations() {
  const { isPgAvailable } = require('./postgres');
  const available = await isPgAvailable();
  if (!available) {
    console.log('[migration] Using zero-config SQLite local engine.');
    return;
  }
  console.log('[postgres migration] Checking database schema & migrations...');

  let client = await getClient();
  try {
    // Ensure migration table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get applied migrations
    const appliedRes = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
    const appliedVersions = new Set(appliedRes.rows.map(r => Number(r.version)));

    // Load migration files from database/migrations/
    const migrationsDir = path.join(__dirname, '..', '..', 'database', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const match = file.match(/^(\d+)_/);
        if (!match) continue;

        const version = Number(match[1]);
        if (!appliedVersions.has(version)) {
          console.log(`[postgres migration] Applying migration ${file}...`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query(
              'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW())',
              [version, file]
            );
            await client.query('COMMIT');
            console.log(`[postgres migration] Successfully applied ${file}`);
          } catch (err) {
            await client.query('ROLLBACK');
            console.error(`[postgres migration] Failed to apply ${file}:`, err.message);
            throw err;
          }
        }
      }
    }

    // Seed Default Users if empty
    const userCountRes = await client.query('SELECT COUNT(*) as count FROM users');
    const userCount = Number(userCountRes.rows[0].count);

    if (userCount === 0) {
      console.log('[postgres migration] Seeding default team user accounts...');
      const now = new Date().toISOString();
      const adminPass = bcrypt.hashSync('admin123', 10);
      const pharmPass = bcrypt.hashSync('pharm123', 10);
      const cashPass = bcrypt.hashSync('cash123', 10);

      const insertUserSql = `
        INSERT INTO users (id, name, email, password_hash, role, phone, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'Active', $7)
      `;

      await client.query(insertUserSql, ['USR-001', 'System Administrator', 'admin@medivault.com', adminPass, 'Admin', '+91 9876543210', now]);
      await client.query(insertUserSql, ['USR-002', 'Lead Pharmacist', 'pharmacist@medivault.com', pharmPass, 'Pharmacist', '+91 9876543211', now]);
      await client.query(insertUserSql, ['USR-003', 'Billing Cashier', 'cashier@medivault.com', cashPass, 'Cashier', '+91 9876543212', now]);

      console.log('[postgres migration] Seeded default user accounts: admin@medivault.com, pharmacist@medivault.com, cashier@medivault.com');
    }

    // Seed Default Owner Payment Config if empty
    const ownerConfigRes = await client.query('SELECT value FROM settings WHERE key = $1', ['owner_payment_config']);
    if (ownerConfigRes.rows.length === 0) {
      console.log('[postgres migration] Seeding default owner merchant bank & payment credentials...');
      const defaultConfig = {
        accountName: 'MediVault Pharmacy & Healthcare Ltd.',
        bankName: 'ICICI Bank Ltd.',
        accountNumber: '91802345678912',
        ifscCode: 'ICIC0001024',
        branchName: 'Health City Main Branch, MG Road',
        upiId: 'medivault.owner@icici',
        merchantPhone: '+91 9876543210',
        merchantEmail: 'owner.payments@medivault.com',
        gstin: '33AAAAA0000A1Z5'
      };
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        ['owner_payment_config', JSON.stringify(defaultConfig)]
      );
    }

    console.log('[postgres migration] All schema migrations & default seeds complete.');
  } finally {
    client.release();
  }
}

module.exports = {
  runPostgresMigrations
};
