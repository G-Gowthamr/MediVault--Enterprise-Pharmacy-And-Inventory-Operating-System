const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB = path.join(__dirname, '..', 'data', 'medivault.db');
console.log('Checking DB file:', DB);

let db;
try {
  if (!fs.existsSync(DB)) {
    console.error('Database file does not exist at:', DB);
  } else {
    db = new Database(DB, { readonly: true });
    const rows = db.prepare('SELECT * FROM medicines').all();
    console.log('Medicines in DB:', rows.length);
    console.log(JSON.stringify(rows, null, 2));
  }
} catch (e) {
  console.error('Error reading DB:', e.message);
} finally {
  try { if (db) db.close(); } catch (e) {}
}
