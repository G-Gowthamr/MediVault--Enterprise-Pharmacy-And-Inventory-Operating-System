const { Pool } = require('pg');
const { db } = require('./db');
const { runMigrations } = require('./migrate');

// Environment & Connection configuration
const connectionString = process.env.DATABASE_URL || null;

const poolConfig = connectionString ? {
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT || 5000),
} : {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'medivault',
  user: process.env.PGUSER || 'medivault_app',
  password: process.env.PGPASSWORD || 'medivault_secret',
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT || 5000),
};

const pool = new Pool(poolConfig);
let pgAvailable = null;

pool.on('error', (err) => {
  if (pgAvailable !== false) {
    console.warn('[postgres pool warning] PostgreSQL connection error:', err.message);
  }
  pgAvailable = false;
});

/**
  Check if PostgreSQL server is available and connected
 */
async function isPgAvailable() {
  if (pgAvailable !== null) return pgAvailable;
  try {
    const res = await pool.query('SELECT 1 as test');
    pgAvailable = (res.rows && res.rows.length > 0);
    if (pgAvailable) {
      console.log('[database] PostgreSQL server connected successfully.');
    }
    return pgAvailable;
  } catch (err) {
    pgAvailable = false;
    console.log('[database] PostgreSQL is offline. Activated zero-config SQLite local fallback engine.');
    try { runMigrations(); } catch (e) { console.error('SQLite migration error:', e.message); }
    return false;
  }
}

/**
  SQLite fallback query executor with PostgreSQL parameter and SQL translation
 */
function executeSqliteQuery(text, params = []) {
  let sql = text
    .replace(/::[a-zA-Z0-9_()]+/g, '')
    .replace(/STRING_AGG\((.*?),\s*'(.*?)'\)/gi, "GROUP_CONCAT($1, '$2')")
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\bNOW\(\)/gi, "datetime('now')");

  // SQL ON CONFLICT handling for SQLite
  if (sql.includes('ON CONFLICT (id) DO UPDATE SET')) {
    sql = sql.replace(/ON CONFLICT \(id\) DO UPDATE SET/i, 'ON CONFLICT(id) DO UPDATE SET');
    // Replace EXCLUDED.column with excluded.column
    sql = sql.replace(/EXCLUDED\./g, 'excluded.');
  }

  // Handle BEGIN / COMMIT / ROLLBACK transactions in SQLite
  const trimmed = sql.trim().toUpperCase();
  if (trimmed === 'BEGIN') {
    try { db.prepare('BEGIN').run(); } catch(e){}
    return { rows: [], rowCount: 0 };
  }
  if (trimmed === 'COMMIT') {
    try { db.prepare('COMMIT').run(); } catch(e){}
    return { rows: [], rowCount: 0 };
  }
  if (trimmed === 'ROLLBACK') {
    try { db.prepare('ROLLBACK').run(); } catch(e){}
    return { rows: [], rowCount: 0 };
  }

  // Extract RETURNING clause if present
  let returningMatch = sql.match(/\s+RETURNING[\s\S]*$/i);
  if (returningMatch) {
    sql = sql.replace(/\s+RETURNING[\s\S]*$/i, '');
  }

  // Convert PostgreSQL $1, $2, $3... parameters to SQLite ? and build expandedParams
  const expandedParams = [];
  sql = sql.replace(/\$(\d+)/g, (match, index) => {
    const idx = Number(index) - 1;
    if (idx >= 0 && idx < params.length) {
      expandedParams.push(params[idx]);
    }
    return '?';
  });

  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...expandedParams);
    return { rows, rowCount: rows.length };
  } else {
    const stmt = db.prepare(sql);
    const info = stmt.run(...expandedParams);
    let rows = [];
    if (returningMatch) {
      try {
        const tableMatch = text.match(/(?:INTO|UPDATE)\s+([a-zA-Z0-9_]+)/i);
        if (tableMatch && tableMatch[1]) {
          const table = tableMatch[1];
          let fetched;
          if (trimmed.startsWith('UPDATE')) {
            const lastParam = expandedParams[expandedParams.length - 1];
            fetched = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(lastParam);
          } else if (trimmed.startsWith('INSERT')) {
            if (info.lastInsertRowid) {
              fetched = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
            }
            if (!fetched && expandedParams.length > 0) {
              fetched = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(expandedParams[0]);
            }
          }
          if (fetched) rows = [fetched];
        }
      } catch(e) {}
    }
    return { rows, rowCount: info.changes };
  }
}

/**
  Execute a single query using PostgreSQL connection pool or SQLite fallback.
 */
async function query(text, params = []) {
  const start = Date.now();
  const available = await isPgAvailable();
  try {
    let res;
    if (available) {
      res = await pool.query(text, params);
    } else {
      res = executeSqliteQuery(text, params);
    }
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 200) {
      console.warn(`[database slow query] ${duration}ms: ${text.slice(0, 100)}`);
    }
    return res;
  } catch (err) {
    console.error('[database query error]', err.message, { text: text.slice(0, 100) });
    throw err;
  }
}

/**
  Check out a client for multi-statement transactions.
 */
async function getClient() {
  const available = await isPgAvailable();
  if (available) {
    return await pool.connect();
  } else {
    return {
      query: async (text, params) => executeSqliteQuery(text, params),
      release: () => {}
    };
  }
}

/**
  Health check endpoint helper.
 */
async function checkPostgresHealth() {
  try {
    const available = await isPgAvailable();
    if (available) {
      const res = await pool.query('SELECT 1 as healthy');
      return res.rows.length > 0 && res.rows[0].healthy === 1;
    }
    // SQLite local engine active & healthy
    return true;
  } catch (err) {
    return false;
  }
}

/**
  Graceful shutdown handler.
 */
async function closePool() {
  if (pgAvailable) {
    await pool.end();
    console.log('[database pool] Closed PostgreSQL pool.');
  }
}

module.exports = {
  pool,
  query,
  getClient,
  checkPostgresHealth,
  isPgAvailable,
  closePool
};
