const salesRepository = require('../repositories/salesRepository');
const medicineRepository = require('../repositories/medicineRepository');
const auditRepository = require('../repositories/auditRepository');
const { getClient } = require('../config/postgres');
const { delCacheByPattern } = require('../config/redis');

class SalesService {
  roundMoney(val) {
    return Math.round((Number(val) || 0) * 100) / 100;
  }

  async getAllSales() {
    return salesRepository.findAll();
  }

  async getSaleById(id) {
    const sale = await salesRepository.findById(id);
    if (!sale) {
      throw { status: 404, message: 'Sale not found' };
    }
    return sale;
  }

  /**
   * Process POS Sale Checkout with atomic checked-out PostgreSQL pool client transaction.
   */
  async createSale(user, data) {
    const rawItems = Array.isArray(data.items) ? data.items : [];
    if (rawItems.length === 0) {
      throw { status: 400, message: 'Sale must contain at least one item' };
    }

    const id = data.id || await salesRepository.generateNextInvoiceId();
    const paymentMethod = data.paymentMethod || data.payment_method || 'Cash';
    const paymentStatus = data.paymentStatus || data.payment_status || 'Completed';
    const transactionRef = data.transactionRef || data.transaction_ref || '';
    const createdBy = user ? user.id : (data.created_by || 'Cashier');

    // Calculate line items with exact monetary precision
    const processedItems = [];
    let calculatedTotal = 0;

    for (const rawIt of rawItems) {
      const qty = Number(rawIt.qty || rawIt.quantity || 0);
      if (qty <= 0) {
        throw { status: 400, message: `Invalid quantity ${qty} for item ${rawIt.name || rawIt.id}` };
      }

      const price = this.roundMoney(rawIt.price || 0);
      const subtotal = this.roundMoney(rawIt.subtotal || (qty * price));
      calculatedTotal = this.roundMoney(calculatedTotal + subtotal);

      processedItems.push({
        medicine_id: rawIt.id || rawIt.medicine_id || '',
        medicine_name: rawIt.name || rawIt.medicine_name || '',
        quantity: qty,
        price,
        subtotal
      });
    }

    const saleHeader = {
      id,
      customer_name: data.customerName || data.customer_name || 'Walk-in Customer',
      customer_phone: data.customerPhone || data.customer_phone || '',
      date: data.date || new Date().toISOString().split('T')[0],
      total: data.total ? this.roundMoney(data.total) : calculatedTotal,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      transaction_ref: transactionRef,
      created_by: createdBy
    };

    // Checkout dedicated pool client for atomic multi-statement transaction
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1. Insert Sales Header and Sale Items
      const createdSale = await salesRepository.insertSaleHeaderAndItems(saleHeader, processedItems, client);

      // 2. Atomically deduct stock with concurrency guard per item
      for (const item of processedItems) {
        if (item.medicine_id) {
          const stockResult = await medicineRepository.deductStockAtomic(item.medicine_id, item.quantity, client);
          if (!stockResult.success) {
            throw { status: 400, message: `Stock shortage for medicine ID ${item.medicine_id} (${item.medicine_name}). Transaction aborted.` };
          }
        }
      }

      // 3. Log Audit Event inside transaction
      await auditRepository.create(
        user,
        'PROCESS_SALE',
        `Processed sale invoice ${id} total ₹${saleHeader.total} via ${paymentMethod}`,
        client
      );

      // 4. Commit atomic transaction
      await client.query('COMMIT');

      // 5. Invalidate Medicine Caches after successful commit
      await delCacheByPattern('medicines:*');

      return createdSale;

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[salesService] POS sale transaction failed, rolled back:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  async getSalesReport(from, to) {
    return salesRepository.getSalesReport(from, to);
  }

  async clearAllSales(user) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await salesRepository.clearAllSales(client);
      await auditRepository.create(user, 'CLEAR_ALL_SALES', 'Cleared all completed sales transactions history', client);
      await client.query('COMMIT');

      await delCacheByPattern('medicines:*');
      return { ok: true, message: 'All sales history deleted' };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[salesService] Clear all sales failed, rolled back:', err);
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new SalesService();
