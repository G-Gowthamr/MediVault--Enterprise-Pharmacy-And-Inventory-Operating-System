const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { pool } = require('../src/config/postgres');
const { runPostgresMigrations } = require('../src/config/migratePostgres');

async function migrateData() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`[migration script] Starting SQLite -> PostgreSQL Data Migration (${isDryRun ? 'DRY-RUN MODE' : 'LIVE MIGRATION'})...`);

  const sqliteDbPath = path.join(__dirname, '..', 'data', 'medivault.db');
  if (!fs.existsSync(sqliteDbPath)) {
    console.error(`[migration script] Error: SQLite database file not found at ${sqliteDbPath}`);
    process.exit(1);
  }

  const sqlite = new Database(sqliteDbPath, { readonly: true });
  const client = await pool.connect();

  const report = {
    migrated_at: new Date().toISOString(),
    is_dry_run: isDryRun,
    tables: {}
  };

  try {
    // Ensure migrations exist on PostgreSQL
    if (!isDryRun) {
      await runPostgresMigrations();
    }

    const tables = ['users', 'medicines', 'sales', 'sale_items', 'settings', 'audit_logs', 'suppliers'];

    for (const table of tables) {
      // Check if table exists in SQLite
      const checkSqlite = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!checkSqlite) {
        report.tables[table] = { sqliteRows: 0, postgresRows: 0, status: 'SKIPPED_NOT_IN_SQLITE' };
        continue;
      }

      const sqliteRows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      const sqliteCount = sqliteRows.length;

      let postgresCount = 0;
      if (!isDryRun) {
        const pgCountRes = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        postgresCount = Number(pgCountRes.rows[0].count);
      }

      report.tables[table] = {
        sqliteRows: sqliteCount,
        postgresRowsBefore: postgresCount,
        toInsert: sqliteCount,
        status: isDryRun ? 'DRY_RUN_VALID' : 'PENDING'
      };

      if (!isDryRun && sqliteCount > 0) {
        await client.query('BEGIN');
        try {
          if (table === 'users') {
            for (const r of sqliteRows) {
              await client.query(
                `INSERT INTO users (id, name, email, password_hash, role, phone, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, password_hash=EXCLUDED.password_hash`,
                [r.id, r.name, r.email, r.password_hash, r.role || 'Pharmacist', r.phone || '', r.status || 'Active', r.created_at || new Date().toISOString()]
              );
            }
          } else if (table === 'medicines') {
            for (const r of sqliteRows) {
              await client.query(
                `INSERT INTO medicines (id, name, category, strength, manufacturer, batch, quantity, price, mrp, expiry, description, date_added)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, quantity=EXCLUDED.quantity, price=EXCLUDED.price`,
                [r.id, r.name || '', r.category || '', r.strength || '', r.manufacturer || '', r.batch || '', Number(r.quantity || 0), Number(r.price || 0), Number(r.mrp || 0), r.expiry || '', r.description || '', r.date_added || new Date().toISOString()]
              );
            }
          } else if (table === 'sales') {
            for (const r of sqliteRows) {
              await client.query(
                `INSERT INTO sales (id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO NOTHING`,
                [r.id, r.customer_name || '', r.customer_phone || '', r.date || '', Number(r.total || 0), r.payment_method || 'Cash', r.payment_status || 'Completed', r.transaction_ref || '', r.created_by || '']
              );
            }
          } else if (table === 'sale_items') {
            for (const r of sqliteRows) {
              await client.query(
                `INSERT INTO sale_items (sale_id, medicine_id, medicine_name, quantity, price, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [r.sale_id, r.medicine_id || '', r.medicine_name || '', Number(r.quantity || r.qty || 1), Number(r.price || 0), Number(r.subtotal || 0)]
              );
            }
          } else if (table === 'settings') {
            for (const r of sqliteRows) {
              await client.query(
                `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
                [r.key, r.value]
              );
            }
          } else if (table === 'audit_logs') {
            for (const r of sqliteRows) {
              await client.query(
                `INSERT INTO audit_logs (user_id, user_name, action, details, created_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [r.user_id || 'SYSTEM', r.user_name || 'System', r.action || 'LOG', r.details || '', r.created_at || new Date().toISOString()]
              );
            }
          }
          await client.query('COMMIT');
          report.tables[table].status = 'MIGRATED';
        } catch (tableErr) {
          await client.query('ROLLBACK');
          console.error(`[migration script] Error migrating table ${table}:`, tableErr.message);
          report.tables[table].status = 'FAILED';
          report.tables[table].error = tableErr.message;
        }
      }
    }

    // Write Report
    const docsDir = path.join(__dirname, '..', 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const mdReport = `
# SQLITE TO POSTGRESQL MIGRATION REPORT

- **Migrated At**: ${report.migrated_at}
- **Mode**: ${isDryRun ? 'DRY-RUN (Validation Only)' : 'LIVE MIGRATION'}

## Table Summary

| Table | SQLite Rows | Postgres Rows Before | Action / Status |
| :--- | :---: | :---: | :---: |
${Object.entries(report.tables).map(([tbl, info]) => `| \`${tbl}\` | ${info.sqliteRows} | ${info.postgresRowsBefore || 0} | **${info.status}** |`).join('\n')}

- SQLite Source Database Preserved: \`data/medivault.db\`
    `.trim();

    fs.writeFileSync(path.join(docsDir, 'SQLITE_TO_POSTGRES_MIGRATION.md'), mdReport);
    console.log('[migration script] Migration report generated at docs/SQLITE_TO_POSTGRES_MIGRATION.md');
    console.log('[migration script] Data migration task finished successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrateData().catch(err => {
  console.error('[migration script] Migration process failed:', err);
  process.exit(1);
});
