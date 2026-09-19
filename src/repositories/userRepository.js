const { query } = require('../config/postgres');

class UserRepository {
  async findByEmail(email) {
    if (!email) return null;
    const res = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email.trim()]);
    return res.rows[0] || null;
  }

  async findById(id) {
    if (!id) return null;
    const res = await query('SELECT id, name, email, role, phone, status, created_at FROM users WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  }

  async findAll() {
    const res = await query('SELECT id, name, email, role, phone, status, created_at FROM users ORDER BY created_at DESC');
    return res.rows || [];
  }

  async create(userData) {
    const { id, name, email, password_hash, role, phone, created_at } = userData;
    const sql = `
      INSERT INTO users (id, name, email, password_hash, role, phone, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'Active', $7)
      RETURNING id, name, email, role, phone, status, created_at
    `;
    const res = await query(sql, [id, name.trim(), email.trim(), password_hash, role || 'Pharmacist', phone || '', created_at || new Date().toISOString()]);
    return res.rows[0];
  }

  async updateStatusOrRole(id, status, role) {
    if (status && role) {
      await query('UPDATE users SET status = $1, role = $2 WHERE id = $3', [status, role, id]);
    } else if (status) {
      await query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    } else if (role) {
      await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    }
    return this.findById(id);
  }

  async generateNextUserId() {
    const res = await query("SELECT MAX(CAST(REPLACE(id, 'USR-', '') AS INTEGER)) as max_num FROM users WHERE id LIKE 'USR-%'");
    const maxNum = res.rows[0] && res.rows[0].max_num ? Number(res.rows[0].max_num) : 0;
    const next = maxNum + 1;
    return `USR-${String(next).padStart(3, '0')}`;
  }
}

module.exports = new UserRepository();
