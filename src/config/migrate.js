const bcrypt = require('bcryptjs');
const { db } = require('./db');

function runMigrations() {
  console.log('[migration] Checking & applying database migrations...');

  // Users Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Pharmacist',
      phone TEXT,
      status TEXT DEFAULT 'Active',
      created_at TEXT
    );
  `).run();

  // Audit Logs Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      user_name TEXT,
      action TEXT,
      details TEXT,
      created_at TEXT
    );
  `).run();

  // Suppliers Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT
    );
  `).run();

  // Medicines Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      strength TEXT,
      manufacturer TEXT,
      batch TEXT,
      quantity INTEGER,
      price REAL,
      mrp REAL,
      expiry TEXT,
      description TEXT,
      date_added TEXT
    );
  `).run();

  // Sales Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      customer_phone TEXT,
      date TEXT,
      total REAL,
      payment_method TEXT DEFAULT 'Cash',
      payment_status TEXT DEFAULT 'Completed',
      transaction_ref TEXT,
      created_by TEXT
    );
  `).run();

  // Sale Items Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT,
      medicine_id TEXT,
      medicine_name TEXT,
      qty INTEGER,
      price REAL,
      subtotal REAL,
      FOREIGN KEY(sale_id) REFERENCES sales(id)
    );
  `).run();

  // Settings Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `).run();

  // Migrations for existing sales table columns
  try { db.prepare("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'Cash'").run(); } catch(e){}
  try { db.prepare("ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'Completed'").run(); } catch(e){}
  try { db.prepare("ALTER TABLE sales ADD COLUMN transaction_ref TEXT").run(); } catch(e){}
  try { db.prepare("ALTER TABLE sales ADD COLUMN created_by TEXT").run(); } catch(e){}

  // Seed Default User Accounts if Empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('[migration] Seeding default team accounts...');
    const now = new Date().toISOString();
    
    const adminPass = bcrypt.hashSync('admin123', 10);
    const pharmPass = bcrypt.hashSync('pharm123', 10);
    const cashPass = bcrypt.hashSync('cash123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, phone, status, created_at)
      VALUES (@id, @name, @email, @password_hash, @role, @phone, @status, @created_at)
    `);

    insertUser.run({
      id: 'USR-001',
      name: 'System Administrator',
      email: 'admin@medivault.com',
      password_hash: adminPass,
      role: 'Admin',
      phone: '+91 9876543210',
      status: 'Active',
      created_at: now
    });

    insertUser.run({
      id: 'USR-002',
      name: 'Lead Pharmacist',
      email: 'pharmacist@medivault.com',
      password_hash: pharmPass,
      role: 'Pharmacist',
      phone: '+91 9876543211',
      status: 'Active',
      created_at: now
    });

    insertUser.run({
      id: 'USR-003',
      name: 'Billing Cashier',
      email: 'cashier@medivault.com',
      password_hash: cashPass,
      role: 'Cashier',
      phone: '+91 9876543212',
      status: 'Active',
      created_at: now
    });

    console.log('[migration] Seeded default accounts: admin@medivault.com, pharmacist@medivault.com, cashier@medivault.com');
  }

  // Seed Default Owner Payment Gateway Config if Empty
  const ownerConfig = db.prepare('SELECT value FROM settings WHERE key = ?').get('owner_payment_config');
  if (!ownerConfig) {
    console.log('[migration] Seeding default owner merchant bank & payment gateway credentials...');
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
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('owner_payment_config', JSON.stringify(defaultConfig));
  }

  console.log('[migration] Database migrations complete.');
}

module.exports = { runMigrations };
