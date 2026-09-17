const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.getProfile);
router.get('/users', authMiddleware, requireRole(['Admin']), authController.getUsers);
router.post('/users', authMiddleware, requireRole(['Admin']), authController.createUser);
router.put('/users/:id/status', authMiddleware, requireRole(['Admin']), authController.updateUserStatus);

module.exports = router;
