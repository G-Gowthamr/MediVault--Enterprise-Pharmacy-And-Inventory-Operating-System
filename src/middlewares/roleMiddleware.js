function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role || 'Cashier';
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Access Forbidden: Permission Denied',
        message: `Your role (${userRole}) does not have permission to execute this operation.`
      });
    }

    next();
  };
}

const requireAdmin = requireRole(['Admin']);
const requireStaff = requireRole(['Admin', 'Pharmacist']);

module.exports = { requireRole, requireAdmin, requireStaff };

