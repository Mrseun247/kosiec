const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const { protect, authorize } = require('../middleware/auth');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Helper: sign JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// Helper: send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({ success: true, token, user });
};

// Helper: write an entry to the admin activity log (never throws — logging must not break the request)
const writeLog = async (entry) => {
  try {
    await AdminLog.create(entry);
  } catch (err) {
    console.warn('⚠️  AdminLog write failed:', err.message);
  }
};

// ============================================================
// POST /api/auth/login
// Login user (admin, staff, voter) — bcrypt-verified, fully logged
// ============================================================
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');

      // ── Unknown email ────────────────────────────────────
      if (!user) {
        await writeLog({
          email, action: 'login_failed', success: false,
          details: 'Login attempt with unknown email address.',
          ipAddress, userAgent,
        });
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      // ── Account currently locked from prior failures ─────
      if (user.isLocked()) {
        const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
        await writeLog({
          user: user._id, email: user.email, fullName: user.fullName, role: user.role,
          action: 'login_failed', success: false,
          details: `Login blocked — account locked for ${minutesLeft} more minute(s).`,
          ipAddress, userAgent,
        });
        return res.status(423).json({
          success: false,
          message: `Account temporarily locked due to repeated failed login attempts. Try again in ${minutesLeft} minute(s).`,
        });
      }

      // ── Account deactivated by admin ──────────────────────
      if (!user.isActive) {
        await writeLog({
          user: user._id, email: user.email, fullName: user.fullName, role: user.role,
          action: 'login_failed', success: false,
          details: 'Login attempt on deactivated account.',
          ipAddress, userAgent,
        });
        return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });
      }

      // ── Wrong password (bcrypt comparison) ────────────────
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

        let lockedNow = false;
        if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
          user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
          lockedNow = true;
        }
        await user.save({ validateBeforeSave: false });

        await writeLog({
          user: user._id, email: user.email, fullName: user.fullName, role: user.role,
          action: lockedNow ? 'account_locked' : 'login_failed', success: false,
          details: lockedNow
            ? `Account locked after ${MAX_FAILED_ATTEMPTS} failed login attempts.`
            : `Incorrect password. Attempt ${user.failedLoginAttempts}/${MAX_FAILED_ATTEMPTS}.`,
          ipAddress, userAgent,
        });

        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      // ── Success — reset failure counters, log, and issue token ──
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      user.lastLogin = new Date();
      user.lastLoginIp = ipAddress;
      await user.save({ validateBeforeSave: false });

      await writeLog({
        user: user._id, email: user.email, fullName: user.fullName, role: user.role,
        action: 'login_success', success: true,
        details: 'Successful login.',
        ipAddress, userAgent,
      });

      sendTokenResponse(user, 200, res);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// POST /api/auth/logout
// Logs the logout event (JWT itself is stateless/cleared client-side)
// ============================================================
router.post('/logout', protect, async (req, res, next) => {
  try {
    await writeLog({
      user: req.user._id, email: req.user.email, fullName: req.user.fullName, role: req.user.role,
      action: 'logout', success: true,
      details: 'User logged out.',
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/auth/register
// Register new admin/staff (super_admin only) — password auto-hashed via User model pre-save hook
// ============================================================
router.post(
  '/register',
  protect,
  authorize('super_admin'),
  [
    body('fullName').trim().notEmpty().withMessage('Full name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['super_admin', 'admin', 'staff']).withMessage('Invalid role'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { fullName, email, password, role, phone, staffId } = req.body;
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ success: false, message: 'Email already in use.' });

      // Password is hashed automatically by the bcryptjs pre-save hook on the User model
      const user = await User.create({ fullName, email, password, role, phone, staffId });

      await writeLog({
        user: req.user._id, email: req.user.email, fullName: req.user.fullName, role: req.user.role,
        action: 'create', resource: 'User', resourceId: user._id, success: true,
        details: `Created new ${role} account for ${fullName} (${email}).`,
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, message: 'User created successfully.', user });
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// ============================================================
// PUT /api/auth/change-password
// Bcrypt-verified current password, auto re-hashed new password
// ============================================================
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const user = await User.findById(req.user._id).select('+password');
      const isMatch = await user.comparePassword(req.body.currentPassword);

      if (!isMatch) {
        await writeLog({
          user: user._id, email: user.email, fullName: user.fullName, role: user.role,
          action: 'password_change', success: false,
          details: 'Password change failed — current password incorrect.',
          ipAddress: req.ip, userAgent: req.headers['user-agent'],
        });
        return res.status(401).json({ success: false, message: 'Current password incorrect.' });
      }

      user.password = req.body.newPassword; // re-hashed automatically by pre-save hook
      await user.save();

      await writeLog({
        user: user._id, email: user.email, fullName: user.fullName, role: user.role,
        action: 'password_change', success: true,
        details: 'Password changed successfully.',
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/auth/users
router.get('/users', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const users = await User.find().populate('lga', 'name').sort('-createdAt');
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PUT /api/auth/users/:id/toggle
// Activate / deactivate a user — logged
// ============================================================
router.put('/users/:id/toggle', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    user.isActive = !user.isActive;

    // Unlock account if reactivating
    if (user.isActive) { user.failedLoginAttempts = 0; user.lockUntil = undefined; }
    await user.save();

    await writeLog({
      user: req.user._id, email: req.user.email, fullName: req.user.fullName, role: req.user.role,
      action: user.isActive ? 'account_activated' : 'account_deactivated', success: true,
      resource: 'User', resourceId: user._id,
      details: `${user.isActive ? 'Activated' : 'Deactivated'} account for ${user.fullName} (${user.email}).`,
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, user });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PUT /api/auth/users/:id/unlock
// Manually unlock an account (super_admin) — clears lockout early
// ============================================================
router.put('/users/:id/unlock', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    await writeLog({
      user: req.user._id, email: req.user.email, fullName: req.user.fullName, role: req.user.role,
      action: 'account_activated', success: true,
      resource: 'User', resourceId: user._id,
      details: `Manually unlocked account for ${user.fullName} (${user.email}).`,
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Account unlocked.', user });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/auth/logs
// View admin activity / login logs — paginated, filterable
// ============================================================
router.get('/logs', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.user) filter.user = req.query.user;
    if (req.query.success !== undefined) filter.success = req.query.success === 'true';

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AdminLog.find(filter).sort('-createdAt').skip(skip).limit(limit),
      AdminLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: logs.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/auth/logs/summary
// Quick dashboard summary: recent failed logins, locked accounts, etc.
// ============================================================
router.get('/logs/summary', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [loginsToday, failedToday, lockedAccounts, recentActivity] = await Promise.all([
      AdminLog.countDocuments({ action: 'login_success', createdAt: { $gte: since24h } }),
      AdminLog.countDocuments({ action: 'login_failed', createdAt: { $gte: since24h } }),
      User.countDocuments({ lockUntil: { $gt: new Date() } }),
      AdminLog.find().sort('-createdAt').limit(10),
    ]);

    res.json({
      success: true,
      data: { loginsToday, failedToday, lockedAccounts, recentActivity },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
