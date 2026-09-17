const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const { runMigrations } = require('../config/migrate');

// GET /api/settings
exports.getSettings = (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    for (const r of rows) {
      try {
        settingsObj[r.key] = JSON.parse(r.value);
      } catch (e) {
        settingsObj[r.key] = r.value;
      }
    }
    res.json(settingsObj);
  } catch (err) {
    console.error('GET /api/settings failed:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// POST /api/settings
exports.saveSettings = (req, res) => {
  try {
    const settings = req.body || {};
    const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    const tx = db.transaction((obj) => {
      for (const [key, val] of Object.entries(obj)) {
        upsert.run({ key, value: typeof val === 'object' ? JSON.stringify(val) : String(val) });
      }
    });
    tx(settings);
    res.json({ ok: true, settings });
  } catch (err) {
    console.error('POST /api/settings failed:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
};

// GET /api/settings/backup (Admin Only)
exports.exportBackup = (req, res) => {
  try {
    const medicines = db.prepare('SELECT * FROM medicines').all();
    const sales = db.prepare('SELECT * FROM sales').all();
    const saleItems = db.prepare('SELECT * FROM sale_items').all();
    const auditLogs = db.prepare('SELECT * FROM audit_logs').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const users = db.prepare('SELECT id, name, email, password_hash, role, phone, status, created_at FROM users').all();

    const backupPayload = {
      app: 'MediVault',
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      exported_by: req.user ? req.user.email : 'System Admin',
      data: {
        medicines,
        sales,
        saleItems,
        auditLogs,
        settings,
        users
      }
    };

    const filename = `medivault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err) {
    console.error('GET /api/settings/backup failed:', err);
    res.status(500).json({ error: 'Failed to generate system backup' });
  }
};

// POST /api/settings/reset (Admin Only - Requires Admin Password)
exports.resetDatabase = (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Admin Password is required to reset database.' });
    }

    // Verify Admin Password
    const adminUser = req.user ? db.prepare('SELECT * FROM users WHERE id = ? OR email = ?').get(req.user.id, req.user.email) : null;
    if (!adminUser || !bcrypt.compareSync(password, adminUser.password_hash)) {
      return res.status(401).json({ error: 'Incorrect Admin Password. System reset aborted.' });
    }

    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM medicines').run();
    db.prepare('DELETE FROM audit_logs').run();
    db.prepare('DELETE FROM settings').run();
    db.prepare('DELETE FROM users').run();

    // Re-run migrations to seed initial schema and default team accounts
    runMigrations();

    res.json({ ok: true, message: 'System database successfully reset to factory defaults.' });
  } catch (err) {
    console.error('POST /api/settings/reset failed:', err);
    res.status(500).json({ error: 'Failed to reset system database' });
  }
};

// POST /api/settings/restore (Admin Only)
exports.restoreDatabase = (req, res) => {
  try {
    const backupPayload = req.body;
    if (!backupPayload || !backupPayload.data) {
      return res.status(400).json({ error: 'Invalid JSON backup file structure.' });
    }

    const { medicines = [], sales = [], saleItems = [], settings = [], auditLogs = [], users = [] } = backupPayload.data;

    const restoreTx = db.transaction(() => {
      // Clear existing records
      db.prepare('DELETE FROM sale_items').run();
      db.prepare('DELETE FROM sales').run();
      db.prepare('DELETE FROM medicines').run();
      db.prepare('DELETE FROM audit_logs').run();
      db.prepare('DELETE FROM settings').run();

      // Restore Medicines
      const insertMed = db.prepare(`
        INSERT INTO medicines (id, name, category, strength, manufacturer, batch, quantity, price, mrp, expiry, description, date_added)
        VALUES (@id, @name, @category, @strength, @manufacturer, @batch, @quantity, @price, @mrp, @expiry, @description, @date_added)
      `);
      for (const m of medicines) {
        insertMed.run({
          id: m.id,
          name: m.name || '',
          category: m.category || '',
          strength: m.strength || '',
          manufacturer: m.manufacturer || '',
          batch: m.batch || '',
          quantity: m.quantity || 0,
          price: m.price || 0,
          mrp: m.mrp || 0,
          expiry: m.expiry || '',
          description: m.description || '',
          date_added: m.date_added || new Date().toISOString()
        });
      }

      // Restore Sales
      const insertSale = db.prepare(`
        INSERT INTO sales (id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by)
        VALUES (@id, @customer_name, @customer_phone, @date, @total, @payment_method, @payment_status, @transaction_ref, @created_by)
      `);
      for (const s of sales) {
        insertSale.run({
          id: s.id,
          customer_name: s.customer_name || s.customerName || '',
          customer_phone: s.customer_phone || s.customerPhone || '',
          date: s.date || new Date().toISOString(),
          total: s.total || 0,
          payment_method: s.payment_method || 'Cash',
          payment_status: s.payment_status || 'Completed',
          transaction_ref: s.transaction_ref || '',
          created_by: s.created_by || ''
        });
      }

      // Restore Sale Items
      const insertSaleItem = db.prepare(`
        INSERT INTO sale_items (sale_id, medicine_id, medicine_name, qty, price, subtotal)
        VALUES (@sale_id, @medicine_id, @medicine_name, @qty, @price, @subtotal)
      `);
      for (const item of saleItems) {
        insertSaleItem.run({
          sale_id: item.sale_id,
          medicine_id: item.medicine_id || '',
          medicine_name: item.medicine_name || '',
          qty: item.qty || 1,
          price: item.price || 0,
          subtotal: item.subtotal || 0
        });
      }

      // Restore Settings
      const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)`);
      for (const st of settings) {
        insertSetting.run({ key: st.key, value: typeof st.value === 'object' ? JSON.stringify(st.value) : String(st.value) });
      }

      // Restore Users if present
      if (users.length > 0) {
        const insertUser = db.prepare(`
          INSERT OR REPLACE INTO users (id, name, email, password_hash, role, phone, status, created_at)
          VALUES (@id, @name, @email, @password_hash, @role, @phone, @status, @created_at)
        `);
        for (const u of users) {
          if (u.password_hash) {
            insertUser.run(u);
          }
        }
      }
    });

    restoreTx();
    res.json({ ok: true, message: 'Database successfully restored from JSON backup!' });
  } catch (err) {
    console.error('POST /api/settings/restore failed:', err);
    res.status(500).json({ error: 'Failed to restore database from backup file.' });
  }
};

