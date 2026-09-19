const auditService = require('../services/auditService');

function logAuditEvent(user, action, details) {
  auditService.logEvent(user, action, details).catch(err => {
    console.error('Audit log async creation failed:', err);
  });
}

// GET /api/audit-logs (Admin only)
async function getAuditLogs(req, res) {
  try {
    const rows = await auditService.getRecentAuditLogs(100);
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
