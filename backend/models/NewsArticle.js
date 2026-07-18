const mongoose = require('mongoose');

const NewsArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true,
      maxlength: [250, 'Title cannot exceed 250 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    excerpt: {
      type: String,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    content: {
      type: String,
      required: [true, 'Article content is required'],
    },
    category: {
      type: String,
      enum: [
        'official_notice',
        'civic_education',
        'election_news',
        'press_release',
        'announcement',
        'registration',
        'results',
        'training',
        'partnership',
        'other',
      ],
      default: 'announcement',
    },
    tags: [{ type: String, lowercase: true }],
    featuredImage: {
      type: String, // File path or URL
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    publishedAt: {
      type: Date,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    authorName: {
      type: String, // Denormalized display name
      default: 'KOSIEC Communications',
    },
    // Related election (optional)
    relatedElection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
NewsArticleSchema.index({ status: 1, publishedAt: -1 });
NewsArticleSchema.index({ category: 1, status: 1 });
NewsArticleSchema.index({ isFeatured: 1, status: 1 });

// Auto slug
NewsArticleSchema.pre('save', function (next) {
  if (this.isModified('title') && !this.slug) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-') +
      '-' +
      Date.now();
  }
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('NewsArticle', NewsArticleSchema);
