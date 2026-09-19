const authService = require('../services/authService');

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const result = await authService.login(email, password);
    return res.json({ ok: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Authentication failed' });
  }
};

// GET /api/auth/me
exports.getProfile = async (req, res) => {
  try {
    const user = await authService.getProfile(req.user.id);
    return res.json(user);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to fetch profile' });
  }
};

// GET /api/auth/users (Admin only)
exports.getUsers = async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user list' });
  }
};

// POST /api/auth/users (Admin only)
exports.createUser = async (req, res) => {
  try {
    const created = await authService.createUser(req.user, req.body || {});
    return res.status(201).json(created);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to create user account' });
  }
};

// PUT /api/auth/users/:id/status (Admin only)
exports.updateUserStatus = async (req, res) => {
  const { status, role } = req.body || {};
  const userId = req.params.id;
  try {
    const updated = await authService.updateUserStatusOrRole(req.user, userId, status, role);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
};
