const mongoose = require('mongoose');

const LGASchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'LGA name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    senatoralDistrict: {
      type: String,
      enum: ['Kogi Central', 'Kogi East', 'Kogi West'],
      required: true,
    },
    headquarters: {
      type: String,
      trim: true,
    },
    totalWards: {
      type: Number,
      default: 0,
    },
    totalPollingUnits: {
      type: Number,
      default: 0,
    },
    registeredVoters: {
      type: Number,
      default: 0,
    },
    lgaCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate slug from name
LGASchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }
  next();
});

module.exports = mongoose.model('LGA', LGASchema);
