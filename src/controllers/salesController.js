const { db, nextId } = require('../config/db');
const { logAuditEvent } = require('./auditController');

// GET /api/sales
exports.getAllSales = (req, res) => {
  const query = `
    SELECT 
      s.id,
      s.customer_name,
      s.customer_phone,
      s.date,
      s.total,
      s.payment_method,
      s.payment_status,
      s.transaction_ref,
      COUNT(si.id) AS number_of_medicines,
      GROUP_CONCAT(m.name, ', ') AS medicine_names
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    LEFT JOIN medicines m ON m.id = si.medicine_id
    GROUP BY s.id
    ORDER BY s.date DESC;
  `;

  try {
    const stmt = db.prepare(query);
    const rows = stmt.all();
    return res.json(rows || []);
  } catch (err) {
    console.error('GET /api/sales error:', err);
    return res.status(500).json({ error: 'Failed to fetch sales', details: err.message });
  }
};

// GET /api/sales/:id
exports.getSaleById = (req, res) => {
  const saleId = req.params.id;
  if (!saleId) return res.status(400).json({ error: 'Missing sale id' });

  const saleSql = `SELECT id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by FROM sales WHERE id = ? LIMIT 1;`;
  const itemsSql = `
    SELECT si.id as sale_item_id, si.medicine_id, COALESCE(m.name, si.medicine_name, '') as medicine_name,
           si.quantity as qty, si.price as unit_price, si.subtotal
    FROM sale_items si
    LEFT JOIN medicines m ON m.id = si.medicine_id
    WHERE si.sale_id = ?
    ORDER BY si.id ASC;
  `;

  try {
    const saleRow = db.prepare(saleSql).get(saleId);
    if (!saleRow) return res.status(404).json({ error: 'Sale not found' });
    const itemRows = db.prepare(itemsSql).all(saleId);
    saleRow.items = itemRows || [];
    return res.json(saleRow);
  } catch (ex) {
    console.error('GET /api/sales/:id error:', ex);
    return res.status(500).json({ error: 'Unexpected server error', details: ex.message });
  }
};

// POST /api/sales (POS Billing Checkout)
exports.createSale = (req, res) => {
  const data = req.body || {};
  const id = data.id || nextId('INV', 'sales');

  const insertSale = db.prepare(`
    INSERT INTO sales (id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by)
    VALUES (@id, @customer_name, @customer_phone, @date, @total, @payment_method, @payment_status, @transaction_ref, @created_by)
  `);
  const insertItem = db.prepare(`INSERT INTO sale_items (sale_id, medicine_id, medicine_name, qty, price, subtotal) VALUES (@sale_id,@medicine_id,@medicine_name,@qty,@price,@subtotal)`);
  const updateMedicineQty = db.prepare(`UPDATE medicines SET quantity = quantity - @qty WHERE id = @id`);

  const items = Array.isArray(data.items) ? data.items : [];
  const paymentMethod = data.paymentMethod || data.payment_method || 'Cash';
  const paymentStatus = data.paymentStatus || data.payment_status || 'Completed';
  const transactionRef = data.transactionRef || data.transaction_ref || '';
  const createdBy = req.user ? req.user.id : (data.created_by || 'Cashier');

  const tx = db.transaction(() => {
    insertSale.run({
      id,
      customer_name: data.customerName || data.customer_name || 'Walk-in Customer',
      customer_phone: data.customerPhone || data.customer_phone || '',
      date: data.date || new Date().toISOString().split('T')[0],
      total: Number(data.total || items.reduce((s, it) => s + (Number(it.subtotal || 0)), 0)),
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      transaction_ref: transactionRef,
      created_by: createdBy
    });

    for (const it of items) {
      const qty = Number(it.qty || it.quantity || 0);
      const price = Number(it.price || 0);
      const subtotal = Number(it.subtotal || (qty * price));

      insertItem.run({
        sale_id: id,
        medicine_id: it.id || it.medicine_id || '',
        medicine_name: it.name || it.medicine_name || '',
        qty,
        price,
        subtotal
      });

      if (it.id) {
        updateMedicineQty.run({ qty, id: it.id });
      }
    }
  });

  try {
    tx();

    logAuditEvent(req.user, 'PROCESS_SALE', `Processed sale invoice ${id} total ₹${data.total} via ${paymentMethod}`);

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    res.status(201).json(sale);
  } catch (err) {
    console.error('POST /api/sales failed:', err);
    res.status(500).json({ error: 'Sale insert failed', details: err.message });
  }
};

// GET /api/reports/sales
exports.getSalesReport = (req, res) => {
  const { from, to } = req.query;
  try {
    let rows;
    if (from && to) {
      rows = db.prepare('SELECT date, payment_method, SUM(total) as total_sales, COUNT(*) as count_sales FROM sales WHERE date BETWEEN ? AND ? GROUP BY date, payment_method ORDER BY date ASC').all(from, to);
    } else {
      rows = db.prepare('SELECT date, payment_method, SUM(total) as total_sales, COUNT(*) as count_sales FROM sales GROUP BY date, payment_method ORDER BY date DESC LIMIT 30').all();
    }
    res.json(rows);
  } catch (err) {
    console.error('GET /api/reports/sales failed:', err);
    res.status(500).json({ error: 'Report generation failed' });
  }
};

// DELETE /api/sales/clear-all (Admin only)
exports.clearAllSales = (req, res) => {
  console.log('[clear-all] Request received — deleting sale_items then sales...');
  try {
    const clearTx = db.transaction(() => {
      db.prepare("DELETE FROM sale_items").run();
      db.prepare("DELETE FROM sales").run();
    });
    clearTx();

    try {
      db.pragma("vacuum");
    } catch (vacErr) {
      console.warn('[clear-all] VACUUM warning:', vacErr);
    }

    logAuditEvent(req.user, 'CLEAR_ALL_SALES', 'Cleared all completed sales transactions history');

    console.log('[clear-all] Sales history cleared successfully.');
    return res.json({ ok: true, message: 'All sales history deleted' });
  } catch (err) {
    console.error('[clear-all] Failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to clear sales', details: err.message });
  }
};
