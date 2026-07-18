const AdminLog = require('../models/AdminLog');

// Writes an entry to the admin activity log — never throws, since a
// logging failure must never block the underlying request.
async function writeAuditLog(req, { action, resource, resourceId, details }) {
  try {
    await AdminLog.create({
      user: req.user?._id,
      email: req.user?.email,
      fullName: req.user?.fullName,
      role: req.user?.role,
      action,
      resource,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
    });
  } catch (err) {
    console.warn('⚠️  AdminLog write failed:', err.message);
  }
}

module.exports = { writeAuditLog };
