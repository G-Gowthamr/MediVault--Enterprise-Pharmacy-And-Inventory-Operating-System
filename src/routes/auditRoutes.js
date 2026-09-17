const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/', authMiddleware, requireRole(['Admin']), getAuditLogs);

module.exports = router;
