const { query } = require('../config/postgres');

class SalesRepository {
  async findAll() {
    const sql = `
      SELECT 
        s.id,
        s.customer_name,
        s.customer_phone,
        s.date,
        s.total,
        s.payment_method,
        s.payment_status,
        s.transaction_ref,
        COUNT(si.id)::INTEGER AS number_of_medicines,
        COALESCE(STRING_AGG(COALESCE(m.name, si.medicine_name, ''), ', '), '') AS medicine_names
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN medicines m ON m.id = si.medicine_id
      GROUP BY s.id, s.customer_name, s.customer_phone, s.date, s.total, s.payment_method, s.payment_status, s.transaction_ref
      ORDER BY s.date DESC;
    `;
    const res = await query(sql);
    return res.rows.map(s => ({
      ...s,
      total: Number(s.total || 0),
      number_of_medicines: Number(s.number_of_medicines || 0)
    }));
  }

  async findById(id) {
    if (!id) return null;
    const saleSql = `SELECT id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by FROM sales WHERE id = $1 LIMIT 1;`;
    const itemsSql = `
      SELECT si.id as sale_item_id, si.medicine_id, COALESCE(m.name, si.medicine_name, '') as medicine_name,
             si.quantity as qty, si.price as unit_price, si.subtotal
      FROM sale_items si
      LEFT JOIN medicines m ON m.id = si.medicine_id
      WHERE si.sale_id = $1
      ORDER BY si.id ASC;
    `;

    const saleRes = await query(saleSql, [id]);
    if (saleRes.rows.length === 0) return null;

    const sale = saleRes.rows[0];
    sale.total = Number(sale.total || 0);

    const itemsRes = await query(itemsSql, [id]);
    sale.items = itemsRes.rows.map(item => ({
      ...item,
      qty: Number(item.qty || 0),
      unit_price: Number(item.unit_price || 0),
      subtotal: Number(item.subtotal || 0)
    }));

    return sale;
  }

  /**
   * Execute atomic sale header and line item insertion using checked-out pool client.
   */
  async insertSaleHeaderAndItems(saleHeader, saleItems, client) {
    const insertSaleSql = `
      INSERT INTO sales (id, customer_name, customer_phone, date, total, payment_method, payment_status, transaction_ref, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const saleRes = await client.query(insertSaleSql, [
      saleHeader.id,
      saleHeader.customer_name,
      saleHeader.customer_phone,
      saleHeader.date,
      saleHeader.total,
      saleHeader.payment_method,
      saleHeader.payment_status,
      saleHeader.transaction_ref,
      saleHeader.created_by
    ]);

    const insertItemSql = `
      INSERT INTO sale_items (sale_id, medicine_id, medicine_name, quantity, price, subtotal)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const insertedItems = [];
    for (const item of saleItems) {
      const itemRes = await client.query(insertItemSql, [
        saleHeader.id,
        item.medicine_id,
        item.medicine_name,
        item.quantity,
        item.price,
        item.subtotal
      ]);
      insertedItems.push(itemRes.rows[0]);
    }

    const createdSale = saleRes.rows[0];
    createdSale.total = Number(createdSale.total || 0);
    createdSale.items = insertedItems;
    return createdSale;
  }

  async getSalesReport(from, to) {
    let sql, params = [];
    if (from && to) {
      sql = `
        SELECT date, payment_method, SUM(total)::NUMERIC(12,2) as total_sales, COUNT(*)::INTEGER as count_sales
        FROM sales
        WHERE date BETWEEN $1 AND $2
        GROUP BY date, payment_method
        ORDER BY date ASC
      `;
      params = [from, to];
    } else {
      sql = `
        SELECT date, payment_method, SUM(total)::NUMERIC(12,2) as total_sales, COUNT(*)::INTEGER as count_sales
        FROM sales
        GROUP BY date, payment_method
        ORDER BY date DESC
        LIMIT 30
      `;
    }
    const res = await query(sql, params);
    return res.rows.map(r => ({
      ...r,
      total_sales: Number(r.total_sales || 0),
      count_sales: Number(r.count_sales || 0)
    }));
  }

  async clearAllSales(client) {
    const dbClient = client || { query: (text, params) => query(text, params) };
    await dbClient.query('DELETE FROM sale_items');
    await dbClient.query('DELETE FROM sales');
    return true;
  }

  async generateNextInvoiceId() {
    const year = new Date().getFullYear();
    const fullPrefix = `INV-${year}-`;
    const res = await query("SELECT MAX(CAST(REPLACE(id, $1, '') AS INTEGER)) as max_num FROM sales WHERE id LIKE $2", [fullPrefix, `${fullPrefix}%`]);
    const maxNum = res.rows[0] && res.rows[0].max_num ? Number(res.rows[0].max_num) : 0;
    const next = maxNum + 1;
    return `${fullPrefix}${String(next).padStart(3, '0')}`;
  }
}

module.exports = new SalesRepository();
