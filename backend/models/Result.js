const mongoose = require('mongoose');

// Sub-schema for individual candidate vote counts
const VoteEntrySchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },
    party: { type: String, required: true },
    candidateName: { type: String, required: true }, // Denormalized for speed
    votes: {
      type: Number,
      required: true,
      min: [0, 'Votes cannot be negative'],
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const ResultSchema = new mongoose.Schema(
  {
    election: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      required: [true, 'Election reference is required'],
    },
    lga: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LGA',
      required: [true, 'LGA reference is required'],
    },
    ward: {
      type: String, // Only for councillorship results
    },
    position: {
      type: String,
      enum: ['chairman', 'councillor'],
      required: true,
    },

    // Turnout data
    registeredVoters: { type: Number, default: 0 },
    accreditedVoters: { type: Number, default: 0 },
    totalVotesCast: { type: Number, default: 0 },
    rejectedVotes: { type: Number, default: 0 },
    validVotes: { type: Number, default: 0 },
    turnoutPercentage: { type: Number, default: 0 },

    // All candidate results
    voteEntries: [VoteEntrySchema],

    // Winner
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
    },
    winnerName: { type: String }, // Denormalized
    winnerParty: { type: String }, // Denormalized
    winnerVotes: { type: Number },

    // Status
    status: {
      type: String,
      enum: ['draft', 'collated', 'certified', 'published'],
      default: 'draft',
    },
    certifiedBy: {
      type: String, // Returning Officer name
    },
    certifiedAt: { type: Date },
    publishedAt: { type: Date },

    // Certificate doc
    certificateDoc: { type: String }, // PDF path

    // Returning officer
    returningOfficer: { type: String },

    collatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: one result record per election + LGA + position (+ ward for councillor)
ResultSchema.index(
  { election: 1, lga: 1, position: 1, ward: 1 },
  { unique: true, sparse: true }
);

// Auto-calculate percentages and winner before save
ResultSchema.pre('save', function (next) {
  if (this.voteEntries && this.voteEntries.length > 0 && this.validVotes > 0) {
    let maxVotes = 0;
    this.voteEntries.forEach((entry) => {
      entry.percentage = parseFloat(
        ((entry.votes / this.validVotes) * 100).toFixed(2)
      );
      if (entry.votes > maxVotes) {
        maxVotes = entry.votes;
        this.winnerName = entry.candidateName;
        this.winnerParty = entry.party;
        this.winnerVotes = entry.votes;
        this.winner = entry.candidate;
      }
    });
  }

  // Calculate turnout
  if (this.registeredVoters > 0) {
    this.turnoutPercentage = parseFloat(
      ((this.accreditedVoters / this.registeredVoters) * 100).toFixed(2)
    );
  }

  next();
});

module.exports = mongoose.model('Result', ResultSchema);
