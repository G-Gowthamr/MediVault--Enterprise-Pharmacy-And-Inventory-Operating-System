const path = require('path');
const fs = require('fs');
const { db, nextId } = require('../config/db');
const { logAuditEvent } = require('./auditController');

// GET all medicines
exports.getAllMedicines = (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM medicines ORDER BY date_added DESC, id ASC').all();
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
exports.getMedicineById = (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('GET /api/medicines/:id failed:', err);
    res.status(500).json({ error: 'Failed to fetch medicine' });
  }
};

// POST add medicine
exports.addMedicine = (req, res) => {
  const data = req.body || {};
  const id = data.id || nextId('MED', 'medicines');

  const stmt = db.prepare(`INSERT OR REPLACE INTO medicines (
    id, name, category, strength, manufacturer, batch, quantity, price, mrp, expiry, description, date_added
  ) VALUES (@id,@name,@category,@strength,@manufacturer,@batch,@quantity,@price,@mrp,@expiry,@description,@date_added)`);

  try {
    stmt.run({
      id,
      name: data.name || '',
      category: data.category || '',
      strength: data.strength || '',
      manufacturer: data.manufacturer || '',
      batch: data.batch || '',
      quantity: Number(data.quantity || 0),
      price: Number(data.price || 0),
      mrp: Number(data.mrp || 0),
      expiry: data.expiry || '',
      description: data.description || '',
      date_added: data.date_added || new Date().toISOString().split('T')[0]
    });

    logAuditEvent(req.user, 'ADD_MEDICINE', `Added medicine ${data.name} (ID: ${id}, Qty: ${data.quantity})`);

    const added = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
    res.status(201).json(added);
  } catch (err) {
    console.error('POST /api/medicines failed:', err);
    res.status(500).json({ error: 'Insert failed' });
  }
};

// PUT update medicine
exports.updateMedicine = (req, res) => {
  const id = req.params.id;
  const data = req.body || {};
  const stmt = db.prepare(`UPDATE medicines SET
    name=@name, category=@category, strength=@strength, manufacturer=@manufacturer,
    batch=@batch, quantity=@quantity, price=@price, mrp=@mrp, expiry=@expiry, description=@description
    WHERE id=@id`);
  try {
    stmt.run({
      id,
      name: data.name || '',
      category: data.category || '',
      strength: data.strength || '',
      manufacturer: data.manufacturer || '',
      batch: data.batch || '',
      quantity: Number(data.quantity || 0),
      price: Number(data.price || 0),
      mrp: Number(data.mrp || 0),
      expiry: data.expiry || '',
      description: data.description || ''
    });

    logAuditEvent(req.user, 'UPDATE_MEDICINE', `Updated medicine ${data.name || id}`);

    const updated = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/medicines/:id failed:', err);
    res.status(500).json({ error: 'Update failed' });
  }
};

// DELETE medicine
exports.deleteMedicine = (req, res) => {
  const id = req.params.id;
  try {
    db.prepare('DELETE FROM medicines WHERE id = ?').run(id);

    logAuditEvent(req.user, 'DELETE_MEDICINE', `Deleted medicine ID ${id}`);

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/medicines/:id failed:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};
