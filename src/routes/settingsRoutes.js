const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/roleMiddleware');

router.get('/', settingsController.getSettings);
router.post('/', settingsController.saveSettings);
router.get('/backup', authMiddleware, requireAdmin, settingsController.exportBackup);
router.post('/reset', authMiddleware, requireAdmin, settingsController.resetDatabase);
router.post('/restore', authMiddleware, requireAdmin, settingsController.restoreDatabase);

module.exports = router;

