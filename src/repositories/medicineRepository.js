const { query } = require('../config/postgres');

class MedicineRepository {
  async findAll() {
    const res = await query('SELECT * FROM medicines ORDER BY date_added DESC, id ASC');
    return res.rows.map(this.normalizeMedicine);
  }

  async findById(id) {
    if (!id) return null;
    const res = await query('SELECT * FROM medicines WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] ? this.normalizeMedicine(res.rows[0]) : null;
  }

  async upsert(data) {
    const sql = `
      INSERT INTO medicines (
        id, name, category, strength, manufacturer, batch, quantity, price, mrp, expiry, description, date_added
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        strength = EXCLUDED.strength,
        manufacturer = EXCLUDED.manufacturer,
        batch = EXCLUDED.batch,
        quantity = EXCLUDED.quantity,
        price = EXCLUDED.price,
        mrp = EXCLUDED.mrp,
        expiry = EXCLUDED.expiry,
        description = EXCLUDED.description
      RETURNING *
    `;
    const params = [
      data.id,
      data.name || '',
      data.category || '',
      data.strength || '',
      data.manufacturer || '',
      data.batch || '',
      Number(data.quantity || 0),
      Number(data.price || 0),
      Number(data.mrp || 0),
      data.expiry || '',
      data.description || '',
      data.date_added || new Date().toISOString().split('T')[0]
    ];
    const res = await query(sql, params);
    return this.normalizeMedicine(res.rows[0]);
  }

  async update(id, data) {
    const sql = `
      UPDATE medicines SET
        name = $1, category = $2, strength = $3, manufacturer = $4,
        batch = $5, quantity = $6, price = $7, mrp = $8, expiry = $9, description = $10
      WHERE id = $11
      RETURNING *
    `;
    const params = [
      data.name || '',
      data.category || '',
      data.strength || '',
      data.manufacturer || '',
      data.batch || '',
      Number(data.quantity || 0),
      Number(data.price || 0),
      Number(data.mrp || 0),
      data.expiry || '',
      data.description || '',
      id
    ];
    const res = await query(sql, params);
    return res.rows[0] ? this.normalizeMedicine(res.rows[0]) : null;
  }

  async delete(id) {
    const res = await query('DELETE FROM medicines WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  /**
   * Atomic stock deduction with concurrency guard:
   * UPDATE medicines SET quantity = quantity - $1 WHERE id = $2 AND quantity >= $1
   * If rowCount === 0 -> return false (Stock Shortage)
   */
  async deductStockAtomic(id, qty, client) {
    const dbClient = client || { query: (text, params) => query(text, params) };
    const sql = `
      UPDATE medicines
      SET quantity = quantity - $1
      WHERE id = $2 AND quantity >= $1
      RETURNING id, name, quantity
    `;
    const res = await dbClient.query(sql, [qty, id]);
    if (res.rowCount === 0) {
      return { success: false, reason: 'INSUFFICIENT_STOCK' };
    }
    return { success: true, medicine: res.rows[0] };
  }

  async generateNextMedicineId() {
    const year = new Date().getFullYear();
    const fullPrefix = `MED-${year}-`;
    const res = await query("SELECT MAX(CAST(REPLACE(id, $1, '') AS INTEGER)) as max_num FROM medicines WHERE id LIKE $2", [fullPrefix, `${fullPrefix}%`]);
    const maxNum = res.rows[0] && res.rows[0].max_num ? Number(res.rows[0].max_num) : 0;
    const next = maxNum + 1;
    return `${fullPrefix}${String(next).padStart(3, '0')}`;
  }

  normalizeMedicine(m) {
    if (!m) return null;
    return {
      ...m,
      price: Number(m.price || 0),
      mrp: Number(m.mrp || 0),
      quantity: Number(m.quantity || 0)
    };
  }
}

module.exports = new MedicineRepository();
