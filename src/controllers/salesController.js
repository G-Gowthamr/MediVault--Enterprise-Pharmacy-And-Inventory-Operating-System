const salesService = require('../services/salesService');

// GET /api/sales
exports.getAllSales = async (req, res) => {
  try {
    const rows = await salesService.getAllSales();
    return res.json(rows || []);
  } catch (err) {
    console.error('GET /api/sales error:', err);
    return res.status(500).json({ error: 'Failed to fetch sales', details: err.message });
  }
};

// GET /api/sales/:id
exports.getSaleById = async (req, res) => {
  const saleId = req.params.id;
  if (!saleId) return res.status(400).json({ error: 'Missing sale id' });

  try {
    const sale = await salesService.getSaleById(saleId);
    return res.json(sale);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to fetch sale' });
  }
};

// POST /api/sales (POS Billing Checkout)
exports.createSale = async (req, res) => {
  try {
    const sale = await salesService.createSale(req.user, req.body || {});
    return res.status(201).json(sale);
  } catch (err) {
    console.error('POST /api/sales failed:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Sale insert failed' });
  }
};

// GET /api/reports/sales
exports.getSalesReport = async (req, res) => {
  const { from, to } = req.query;
  try {
    const report = await salesService.getSalesReport(from, to);
    return res.json(report);
  } catch (err) {
    console.error('GET /api/reports/sales failed:', err);
    return res.status(500).json({ error: 'Report generation failed' });
  }
};

// DELETE /api/sales/clear-all (Admin only)
exports.clearAllSales = async (req, res) => {
  try {
    const result = await salesService.clearAllSales(req.user);
    return res.json(result);
  } catch (err) {
    console.error('[clear-all] Failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to clear sales', details: err.message });
  }
};
