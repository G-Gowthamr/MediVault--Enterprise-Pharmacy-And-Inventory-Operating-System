const auditRepository = require('../repositories/auditRepository');

class AuditService {
  async logEvent(user, action, details) {
    return auditRepository.create(user, action, details);
  }

  async getRecentAuditLogs(limit = 100) {
    return auditRepository.findRecent(limit);
  }
}

module.exports = new AuditService();
