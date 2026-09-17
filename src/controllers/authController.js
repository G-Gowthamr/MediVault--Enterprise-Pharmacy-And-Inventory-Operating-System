const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, nextId } = require('../config/db');
const { JWT_SECRET } = require('../middlewares/authMiddleware');
const { logAuditEvent } = require('./auditController');

// POST /api/auth/login
exports.login = (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email credentials' });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'Account disabled. Please contact system administrator.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password credentials' });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    logAuditEvent(user, 'USER_LOGIN', `User ${user.email} logged in successfully with role ${user.role}`);

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Authentication failed', details: err.message });
  }
};

// GET /api/auth/me
exports.getProfile = (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role, phone, status, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User profile not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

// GET /api/auth/users (Admin only)
exports.getUsers = (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, role, phone, status, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user list' });
  }
};

// POST /api/auth/users (Admin only - Register staff account)
exports.createUser = (req, res) => {
  const { name, email, password, role, phone } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (existing) {
      return res.status(400).json({ error: 'A user account with this email already exists' });
    }

    const id = nextId('USR', 'users');
    const password_hash = bcrypt.hashSync(password, 10);
    const userRole = role || 'Pharmacist';
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, phone, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)
    `).run(id, name.trim(), email.trim(), password_hash, userRole, phone || '', createdAt);

    logAuditEvent(req.user, 'CREATE_USER', `Created user account ${email} (${userRole})`);

    const created = db.prepare('SELECT id, name, email, role, phone, status, created_at FROM users WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user account' });
  }
};

// PUT /api/auth/users/:id/status (Admin only)
exports.updateUserStatus = (req, res) => {
  const { status, role } = req.body || {};
  const userId = req.params.id;

  try {
    if (status) db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
    if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);

    logAuditEvent(req.user, 'UPDATE_USER', `Updated user ${userId} status: ${status}, role: ${role}`);
    const updated = db.prepare('SELECT id, name, email, role, phone, status, created_at FROM users WHERE id = ?').get(userId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
};
