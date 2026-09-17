const express = require('express');
const router = express.Router();
const medicinesController = require('../controllers/medicinesController');

router.get('/', medicinesController.getAllMedicines);
router.get('/sample-csv', medicinesController.getSampleCsv);
router.get('/:id', medicinesController.getMedicineById);
router.post('/', medicinesController.addMedicine);
router.put('/:id', medicinesController.updateMedicine);
router.delete('/:id', medicinesController.deleteMedicine);

module.exports = router;
