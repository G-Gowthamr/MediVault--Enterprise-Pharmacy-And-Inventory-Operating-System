const { db } = require('../config/db');

function logAuditEvent(user, action, details) {
  try {
    const userId = user ? (user.id || user.userId) : 'SYSTEM';
    const userName = user ? (user.name || user.email) : 'System';
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, userName, action, typeof details === 'object' ? JSON.stringify(details) : String(details || ''), createdAt);
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// GET /api/audit-logs (Admin only)
function getAuditLogs(req, res) {
  try {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json(rows);
  } catch (err) {
    console.error('GET /api/audit-logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}

module.exports = {
  logAuditEvent,
  getAuditLogs
};
