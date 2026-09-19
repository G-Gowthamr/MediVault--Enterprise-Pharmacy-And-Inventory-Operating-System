const { query } = require('../config/postgres');

class AuditRepository {
  async create(user, action, details, client) {
    const userId = user ? (user.id || user.userId || 'SYSTEM') : 'SYSTEM';
    const userName = user ? (user.name || user.email || 'System') : 'System';
    const createdAt = new Date().toISOString();
    const detailStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');

    const sql = `
      INSERT INTO audit_logs (user_id, user_name, action, details, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const dbClient = client || { query: (text, params) => query(text, params) };
    const res = await dbClient.query(sql, [userId, userName, action, detailStr, createdAt]);
    return res.rows[0];
  }

  async findRecent(limit = 100) {
    const sql = 'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1';
    const res = await query(sql, [limit]);
    return res.rows || [];
  }
}

module.exports = new AuditRepository();
