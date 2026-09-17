const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'medivault.db');
const OLD_DB_FILE = path.join(DATA_DIR, 'backups', 'ramesh.db');

if (!fs.existsSync(DB_FILE) && fs.existsSync(OLD_DB_FILE)) {
  try {
    fs.copyFileSync(OLD_DB_FILE, DB_FILE);
    console.log(`Migrated database from ${OLD_DB_FILE} to ${DB_FILE}`);
  } catch (err) {
    console.error('Failed to copy legacy database file:', err);
  }
}

// Database Connection Handle
const db = new Database(DB_FILE);

/**
 * Generate dynamic next ID for a table using numeric suffix.
 * e.g. prefix='MED' -> MED-2026-001, MED-2026-002 ...
 * e.g. prefix='USR' -> USR-001 ...
 * e.g. prefix='INV' -> INV-2026-001 ...
 */
function nextId(prefix, table) {
  try {
    const year = new Date().getFullYear();
    const fullPrefix = prefix === 'MED' || prefix === 'INV' || prefix === 'SALE' ? `${prefix}-${year}-` : `${prefix}-`;
    const row = db.prepare(`SELECT MAX(CAST(REPLACE(id, ?, '') AS INTEGER)) as m FROM ${table} WHERE id LIKE ?`).get(fullPrefix, `${fullPrefix}%`);
    const maxNum = (row && row.m) ? Number(row.m) : 0;
    const next = maxNum + 1;
    return fullPrefix + String(next).padStart(3, '0');
  } catch (e) {
    const fallbackNext = Math.floor(Math.random() * 900) + 100;
    return `${prefix}-${fallbackNext}`;
  }
}

module.exports = {
  db,
  DB_FILE,
  nextId
};
