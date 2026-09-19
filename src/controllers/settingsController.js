const settingsService = require('../services/settingsService');

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json(settings);
  } catch (err) {
    console.error('GET /api/settings failed:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// POST /api/settings
exports.saveSettings = async (req, res) => {
  try {
    const settings = await settingsService.saveSettings(req.user, req.body || {});
    res.json({ ok: true, settings });
  } catch (err) {
    console.error('POST /api/settings failed:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
};

// GET /api/settings/backup (Admin Only)
exports.exportBackup = async (req, res) => {
  try {
    const backupPayload = await settingsService.exportBackupPayload(req.user);
    const filename = `medivault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err) {
    console.error('GET /api/settings/backup failed:', err);
    res.status(500).json({ error: 'Failed to generate system backup' });
  }
};

// POST /api/settings/reset (Admin Only - Requires Admin Password)
exports.resetDatabase = async (req, res) => {
  try {
    const { password } = req.body || {};
    const result = await settingsService.resetDatabase(req.user, password);
    res.json(result);
  } catch (err) {
    console.error('POST /api/settings/reset failed:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to reset system database' });
  }
};

// POST /api/settings/restore (Admin Only)
exports.restoreDatabase = async (req, res) => {
  try {
    const result = await settingsService.restoreDatabase(req.user, req.body);
    res.json(result);
  } catch (err) {
    console.error('POST /api/settings/restore failed:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to restore database from backup file.' });
  }
};
