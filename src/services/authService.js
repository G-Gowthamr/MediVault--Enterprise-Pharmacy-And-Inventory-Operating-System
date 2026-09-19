const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      throw { status: 400, message: 'Email and password are required' };
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw { status: 401, message: 'Invalid email credentials' };
    }

    if (user.status === 'Inactive') {
      throw { status: 403, message: 'Account disabled. Please contact system administrator.' };
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid password credentials' };
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    await auditRepository.create(user, 'USER_LOGIN', `User ${user.email} logged in successfully with role ${user.role}`);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    };
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw { status: 404, message: 'User profile not found' };
    }
    return user;
  }

  async getAllUsers() {
    return userRepository.findAll();
  }

  async createUser(adminUser, userData) {
    const { name, email, password, role, phone } = userData;
    if (!name || !email || !password) {
      throw { status: 400, message: 'Name, email, and password are required' };
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw { status: 400, message: 'A user account with this email already exists' };
    }

    const id = await userRepository.generateNextUserId();
    const password_hash = bcrypt.hashSync(password, 10);
    const userRole = role || 'Pharmacist';
    const createdAt = new Date().toISOString();

    const created = await userRepository.create({
      id,
      name,
      email,
      password_hash,
      role: userRole,
      phone: phone || '',
      created_at: createdAt
    });

    await auditRepository.create(adminUser, 'CREATE_USER', `Created user account ${email} (${userRole})`);

    return created;
  }

  async updateUserStatusOrRole(adminUser, userId, status, role) {
    const updated = await userRepository.updateStatusOrRole(userId, status, role);
    await auditRepository.create(adminUser, 'UPDATE_USER', `Updated user ${userId} status: ${status}, role: ${role}`);
    return updated;
  }
}

module.exports = new AuthService();
