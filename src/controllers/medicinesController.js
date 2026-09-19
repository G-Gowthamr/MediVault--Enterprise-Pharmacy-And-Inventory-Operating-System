const path = require('path');
const fs = require('fs');
const medicineService = require('../services/medicineService');

// GET all medicines
exports.getAllMedicines = async (req, res) => {
  try {
    const rows = await medicineService.getAllMedicines();
    res.json(rows);
  } catch (err) {
    console.error('GET /api/medicines failed:', err);
    res.status(500).json({ error: 'Failed to fetch medicines' });
  }
};

// GET sample CSV template for medicines
exports.getSampleCsv = (req, res) => {
  const samplePath = path.join(__dirname, '..', '..', 'data', 'samples', 'medicines_sample.csv');
  if (fs.existsSync(samplePath)) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=medicines_sample.csv');
    res.sendFile(samplePath);
  } else {
    const csvContent = 'id,name,category,strength,manufacturer,batch,quantity,price,mrp,expiry,description\nMED-2026-001,Paracetamol,Analgesic,500mg,Cipla,B001,120,12.5,20,2026-03-15,Used for fever and pain relief\n';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=medicines_sample.csv');
    res.send(csvContent);
  }
};

// GET single medicine
exports.getMedicineById = async (req, res) => {
  try {
    const row = await medicineService.getMedicineById(req.params.id);
    res.json(row);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to fetch medicine' });
  }
};

// POST add medicine
exports.addMedicine = async (req, res) => {
  try {
    const added = await medicineService.addMedicine(req.user, req.body || {});
    res.status(201).json(added);
  } catch (err) {
    console.error('POST /api/medicines failed:', err);
    res.status(500).json({ error: err.message || 'Insert failed' });
  }
};

// PUT update medicine
exports.updateMedicine = async (req, res) => {
  try {
    const updated = await medicineService.updateMedicine(req.user, req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Update failed' });
  }
};

// DELETE medicine
exports.deleteMedicine = async (req, res) => {
  try {
    const result = await medicineService.deleteMedicine(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Delete failed' });
  }
};
