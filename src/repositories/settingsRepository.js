const { query, getClient } = require('../config/postgres');

class SettingsRepository {
  async findAll() {
    const res = await query('SELECT key, value FROM settings');
    const settingsObj = {};
    for (const r of res.rows) {
      try {
        settingsObj[r.key] = JSON.parse(r.value);
      } catch (e) {
        settingsObj[r.key] = r.value;
      }
    }
    return settingsObj;
  }

  async findByKey(key) {
    const res = await query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    if (res.rows.length === 0) return null;
    try {
      return JSON.parse(res.rows[0].value);
    } catch (e) {
      return res.rows[0].value;
    }
  }

  async upsert(key, value, client) {
    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const sql = `
      INSERT INTO settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      RETURNING *
    `;
    const dbClient = client || { query: (text, params) => query(text, params) };
    const res = await dbClient.query(sql, [key, valStr]);
    return res.rows[0];
  }

  async exportBackupPayload(exportedBy) {
    const medicinesRes = await query('SELECT * FROM medicines ORDER BY id ASC');
    const salesRes = await query('SELECT * FROM sales ORDER BY id ASC');
    const saleItemsRes = await query('SELECT * FROM sale_items ORDER BY id ASC');
    const auditLogsRes = await query('SELECT * FROM audit_logs ORDER BY id ASC');
    const settingsRes = await query('SELECT * FROM settings ORDER BY key ASC');
    const usersRes = await query('SELECT id, name, email, password_hash, role, phone, status, created_at FROM users ORDER BY id ASC');

    return {
      app: 'MediVault',
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      exported_by: exportedBy || 'System Admin',
      data: {
        medicines: medicinesRes.rows.map(m => ({ ...m, price: Number(m.price || 0), mrp: Number(m.mrp || 0), quantity: Number(m.quantity || 0) })),
        sales: salesRes.rows.map(s => ({ ...s, total: Number(s.total || 0) })),
        saleItems: saleItemsRes.rows.map(si => ({ ...si, quantity: Number(si.quantity || si.qty || 0), price: Number(si.price || 0), subtotal: Number(si.subtotal || 0) })),
        auditLogs: auditLogsRes.rows,
        settings: settingsRes.rows,
        users: usersRes.rows
      }
    };
  }

  async restoreFromBackupPayload(backupPayload) {
    const { medicines = [], sales = [], saleItems = [], settings = [], users = [] } = backupPayload.data || {};
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Clear existing tables
      await client.query('DELETE FROM sale_items');
      await client.query('DELETE FROM sales');
      await client.query('DELETE FROM medicines');
      await client.query('DELETE FROM settings');

      // Restore Medicines
      const insertMedSql = `
        INSERT INTO medicines (id, name, category, strength, manufacturer, batch, quantity, price, mrp, expiry, description, date_added)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      for (const m of medicines) {
        await client.query(insertMedSql, [
          m.id,
          m.name || '',
          m.category || '',
          m.strength || '',
          m.manufacturer || '',
          m.batch || '',
          Number(m.quantity || 0),
          Number(m.price || 0),
          Number(m.mrp || 0),
          m.expiry || '',
          m.description || '',
          m.date_added || new Date().toISOString()
        ]);
      }

      // Restore Sales
      const insertSaleSql = `
        INSERT INTO sales (id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      for (const s of sales) {
        await client.query(insertSaleSql, [
          s.id,
          s.customer_name || s.customerName || '',
          s.customer_phone || s.customerPhone || '',
          s.date || new Date().toISOString(),
          Number(s.total || 0),
          s.payment_method || 'Cash',
          s.payment_status || 'Completed',
          s.transaction_ref || '',
          s.created_by || ''
        ]);
      }

      // Restore Sale Items
      const insertSaleItemSql = `
        INSERT INTO sale_items (sale_id, medicine_id, medicine_name, quantity, price, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      for (const item of saleItems) {
        await client.query(insertSaleItemSql, [
          item.sale_id,
          item.medicine_id || '',
          item.medicine_name || '',
          Number(item.quantity || item.qty || 1),
          Number(item.price || 0),
          Number(item.subtotal || 0)
        ]);
      }

      // Restore Settings
      const insertSettingSql = `
        INSERT INTO settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
      for (const st of settings) {
        await client.query(insertSettingSql, [st.key, typeof st.value === 'object' ? JSON.stringify(st.value) : String(st.value)]);
      }

      // Restore Users if present
      if (users.length > 0) {
        const insertUserSql = `
          INSERT INTO users (id, name, email, password_hash, role, phone, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            phone = EXCLUDED.phone,
            status = EXCLUDED.status
        `;
        for (const u of users) {
          if (u.password_hash) {
            await client.query(insertUserSql, [
              u.id,
              u.name,
              u.email,
              u.password_hash,
              u.role || 'Pharmacist',
              u.phone || '',
              u.status || 'Active',
              u.created_at || new Date().toISOString()
            ]);
          }
        }
      }

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[postgres restore error]', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async resetDatabase() {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM sale_items');
      await client.query('DELETE FROM sales');
      await client.query('DELETE FROM medicines');
      await client.query('DELETE FROM audit_logs');
      await client.query('DELETE FROM settings');
      await client.query('DELETE FROM users');
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[postgres reset error]', err);
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new SettingsRepository();
