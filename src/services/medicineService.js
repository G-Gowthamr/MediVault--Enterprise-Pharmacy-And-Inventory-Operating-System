const medicineRepository = require('../repositories/medicineRepository');
const auditRepository = require('../repositories/auditRepository');
const { getCache, setCache, delCacheByPattern } = require('../config/redis');

class MedicineService {
  roundMoney(val) {
    return Math.round((Number(val) || 0) * 100) / 100;
  }

  async getAllMedicines() {
    // 1. Check Redis Cache
    const cached = await getCache('medicines:all');
    if (cached) {
      return cached;
    }

    // 2. Query PostgreSQL Primary Source of Truth
    const medicines = await medicineRepository.findAll();

    // 3. Populate Redis Cache
    await setCache('medicines:all', medicines, 3600);

    return medicines;
  }

  async getMedicineById(id) {
    const cacheKey = `medicines:item:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const med = await medicineRepository.findById(id);
    if (!med) {
      throw { status: 404, message: 'Medicine not found' };
    }

    await setCache(cacheKey, med, 3600);
    return med;
  }

  async addMedicine(user, data) {
    const id = data.id || await medicineRepository.generateNextMedicineId();
    const payload = {
      ...data,
      id,
      quantity: Number(data.quantity || 0),
      price: this.roundMoney(data.price),
      mrp: this.roundMoney(data.mrp)
    };

    const added = await medicineRepository.upsert(payload);
    await auditRepository.create(user, 'ADD_MEDICINE', `Added medicine ${payload.name} (ID: ${id}, Qty: ${payload.quantity})`);

    // Invalidate Medicine Redis Caches
    await delCacheByPattern('medicines:*');

    return added;
  }

  async updateMedicine(user, id, data) {
    const payload = {
      ...data,
      quantity: Number(data.quantity || 0),
      price: this.roundMoney(data.price),
      mrp: this.roundMoney(data.mrp)
    };

    const updated = await medicineRepository.update(id, payload);
    if (!updated) {
      throw { status: 404, message: 'Medicine not found for update' };
    }

    await auditRepository.create(user, 'UPDATE_MEDICINE', `Updated medicine ${data.name || id}`);

    // Invalidate Medicine Redis Caches
    await delCacheByPattern('medicines:*');

    return updated;
  }

  async deleteMedicine(user, id) {
    const deleted = await medicineRepository.delete(id);
    if (!deleted) {
      throw { status: 404, message: 'Medicine not found for deletion' };
    }

    await auditRepository.create(user, 'DELETE_MEDICINE', `Deleted medicine ID ${id}`);

    // Invalidate Medicine Redis Caches
    await delCacheByPattern('medicines:*');

    return { ok: true };
  }
}

module.exports = new MedicineService();
