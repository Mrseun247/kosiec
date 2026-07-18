const mongoose = require('mongoose');

const ElectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Election title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ['chairmanship', 'councillorship', 'bye_election'],
      required: [true, 'Election type is required'],
    },
    year: {
      type: Number,
      required: [true, 'Election year is required'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed', 'suspended', 'cancelled'],
      default: 'scheduled',
    },
    // Key dates
    nominationStart: { type: Date },
    nominationEnd: { type: Date },
    campaignStart: { type: Date },
    campaignEnd: { type: Date },
    electionDate: {
      type: Date,
      required: [true, 'Election date is required'],
    },
    resultDate: { type: Date },
    inaugurDate: { type: Date },

    // Coverage
    lgas: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LGA',
      },
    ],
    // true = all 21 LGAs
    isStatewideElection: {
      type: Boolean,
      default: true,
    },

    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },

    // Official timetable document
    timetableDoc: {
      type: String, // File path
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: results linked to this election
ElectionSchema.virtual('results', {
  ref: 'Result',
  localField: '_id',
  foreignField: 'election',
});

// Auto-generate slug
ElectionSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-') +
      '-' +
      this.year;
  }
  next();
});

module.exports = mongoose.model('Election', ElectionSchema);
