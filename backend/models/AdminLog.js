const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // null if login attempt failed before user was matched (unknown email)
    },
    email: {
      type: String, // Denormalized — captured even on failed/unknown-user attempts
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String, // Denormalized for fast log display without populate
    },
    role: {
      type: String, // Denormalized role at time of action
    },
    action: {
      type: String,
      enum: [
        'login_success',
        'login_failed',
        'logout',
        'password_change',
        'account_locked',
        'account_deactivated',
        'account_activated',
        'create',
        'update',
        'delete',
        'publish',
      ],
      required: true,
    },
    resource: {
      type: String, // e.g. 'Result', 'NewsArticle', 'TeamMember' — for action logs
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    details: {
      type: String, // Free-text description, e.g. "Failed login: incorrect password"
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    success: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt = the log timestamp
  }
);

// Fast lookups for the admin "recent activity" dashboard
AdminLogSchema.index({ createdAt: -1 });
AdminLogSchema.index({ user: 1, createdAt: -1 });
AdminLogSchema.index({ action: 1, createdAt: -1 });

// Auto-expire logs after 1 year to keep the collection lean (optional, adjust as needed)
AdminLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

module.exports = mongoose.model('AdminLog', AdminLogSchema);
