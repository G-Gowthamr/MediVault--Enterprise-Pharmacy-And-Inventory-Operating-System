const bcrypt = require('bcryptjs');
const settingsRepository = require('../repositories/settingsRepository');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const { runPostgresMigrations } = require('../config/migratePostgres');
const { getCache, setCache, delCacheByPattern } = require('../config/redis');

class SettingsService {
  async getSettings() {
    const cached = await getCache('settings:all');
    if (cached) {
      return cached;
    }

    const settings = await settingsRepository.findAll();
    await setCache('settings:all', settings, 3600);
    return settings;
  }

  async saveSettings(user, settingsObj) {
    const payload = settingsObj || {};
    for (const [key, val] of Object.entries(payload)) {
      await settingsRepository.upsert(key, val);
      if (key === 'owner_payment_config') {
        await auditRepository.create(
          user,
          'UPDATE_MERCHANT_BANK_CONFIG',
          'Updated owner bank account credentials & UPI payment gateway configuration'
        );
      }
    }

    // Invalidate Settings Cache
    await delCacheByPattern('settings:*');

    return payload;
  }

  async exportBackupPayload(user) {
    const exportedBy = user ? user.email : 'System Admin';
    return settingsRepository.exportBackupPayload(exportedBy);
  }

  async restoreDatabase(user, backupPayload) {
    if (!backupPayload || !backupPayload.data) {
      throw { status: 400, message: 'Invalid JSON backup file structure.' };
    }

    await settingsRepository.restoreFromBackupPayload(backupPayload);
    await auditRepository.create(user, 'RESTORE_DATABASE', 'Restored system database state from JSON backup snapshot');

    // Invalidate All Caches
    await delCacheByPattern('*');

    return { ok: true, message: 'Database successfully restored from JSON backup!' };
  }

  async resetDatabase(user, password) {
    if (!password) {
      throw { status: 400, message: 'Admin Password is required to reset database.' };
    }

    const adminUser = user ? await userRepository.findByEmail(user.email) : null;
    if (!adminUser || !bcrypt.compareSync(password, adminUser.password_hash)) {
      throw { status: 401, message: 'Incorrect Admin Password. System reset aborted.' };
    }

    await settingsRepository.resetDatabase();
    await runPostgresMigrations();

    // Invalidate All Caches
    await delCacheByPattern('*');

    return { ok: true, message: 'System database successfully reset to factory defaults.' };
  }
}

module.exports = new SettingsService();
