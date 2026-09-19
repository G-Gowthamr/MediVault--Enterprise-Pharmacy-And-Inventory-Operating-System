const fs = require('fs');
const { parse } = require('csv-parse/sync');
const medicineService = require('../services/medicineService');

exports.uploadMedicinesCsv = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const tempPath = req.file.path;
  try {
    const csvContent = fs.readFileSync(tempPath, 'utf8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let count = 0;
    for (const r of records) {
      const payload = {
        id: r.id && r.id.trim() ? r.id.trim() : null,
        name: (r.name || '').toString().trim(),
        category: (r.category || '').toString().trim(),
        strength: (r.strength || '').toString().trim(),
        manufacturer: (r.manufacturer || '').toString().trim(),
        batch: (r.batch || '').toString().trim(),
        quantity: Number(r.quantity || 0),
        price: Number(r.price || 0),
        mrp: Number(r.mrp || 0),
        expiry: (r.expiry || '').toString().trim(),
        description: (r.description || '').toString().trim()
      };
      await medicineService.addMedicine(req.user, payload);
      count++;
    }

    try { fs.unlinkSync(tempPath); } catch (e) {}

    res.json({ ok: true, count });
  } catch (err) {
    console.error('CSV upload failed:', err);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
    res.status(500).json({ error: 'CSV processing failed', details: err.message });
  }
};
