const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Candidate full name is required'],
      trim: true,
    },
    party: {
      type: String,
      required: [true, 'Political party is required'],
      trim: true,
      uppercase: true,
    },
    partyLogo: {
      type: String, // File path or URL
    },
    photo: {
      type: String, // File path or URL
    },
    election: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      required: true,
    },
    lga: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LGA',
      required: true,
    },
    ward: {
      type: String, // For councillorship candidates
    },
    position: {
      type: String,
      enum: ['chairman', 'councillor'],
      required: true,
    },
    runningMate: {
      type: String, // Vice-chairman name (for chairmanship)
      trim: true,
    },
    nominationNumber: {
      type: String,
      trim: true,
    },
    isAccredited: {
      type: Boolean,
      default: false,
    },
    accreditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    accreditedAt: {
      type: Date,
    },
    notes: {
      type: String,
      maxlength: [500],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: one candidate per party per LGA per election
CandidateSchema.index(
  { election: 1, lga: 1, party: 1, position: 1 },
  { unique: true }
);

module.exports = mongoose.model('Candidate', CandidateSchema);
