const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      // e.g. "Hon.", "Dr.", "Engr.", "Barr."
    },
    role: {
      type: String,
      required: [true, 'Role/position is required'],
      trim: true,
      // e.g. "Chairman", "Secretary", "Director of Operations"
    },
    roleCategory: {
      type: String,
      enum: ['commission', 'management', 'directorate', 'support', 'field'],
      default: 'management',
    },
    department: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      maxlength: [4000, 'Bio cannot exceed 4000 characters'],
    },
    photo: {
      type: String, // Cloudinary secure URL
      default: null,
    },
    photoPublicId: {
      type: String, // Cloudinary public_id — needed to delete/replace the asset later
      default: null,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    qualifications: [{ type: String }],
    // For sorting: Chairman = 1, Secretary = 2, etc.
    displayOrder: {
      type: Number,
      default: 99,
    },
    isChairman: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    socialLinks: {
      linkedin: String,
      twitter: String,
    },
    appointedDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one chairman at a time
TeamMemberSchema.index({ isChairman: 1 });
TeamMemberSchema.index({ displayOrder: 1, isActive: 1 });

module.exports = mongoose.model('TeamMember', TeamMemberSchema);
