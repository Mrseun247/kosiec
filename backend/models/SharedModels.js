// ===================================================
// models/Event.js — Events & Electoral Calendar
// ===================================================
const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
    },
    description: { type: String },
    category: {
      type: String,
      enum: [
        'election_day',
        'registration',
        'campaign',
        'results',
        'inauguration',
        'training',
        'civic_education',
        'meeting',
        'other',
      ],
      default: 'other',
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    endDate: { type: Date },
    time: { type: String }, // e.g. "8:00 AM - 4:00 PM"
    venue: { type: String },
    lgas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LGA' }],
    isPublic: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    relatedElection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

EventSchema.index({ eventDate: 1, status: 1 });

const Event = mongoose.model('Event', EventSchema);

// ===================================================
// models/Download.js — Downloadable Documents
// ===================================================
const DownloadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    description: { type: String },
    category: {
      type: String,
      enum: [
        'timetable',
        'form',
        'guideline',
        'result',
        'notice',
        'report',
        'policy',
        'other',
      ],
      default: 'other',
    },
    filePath: {
      type: String,
      required: [true, 'File path is required'],
    },
    filePublicId: {
      type: String, // Cloudinary public_id
    },
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'xlsx', 'image'],
      default: 'pdf',
    },
    fileSize: { type: String }, // e.g. "2.4 MB"
    downloadCount: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
    relatedElection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
    },
    publishedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const Download = mongoose.model('Download', DownloadSchema);

// ===================================================
// models/GalleryItem.js — Photo & Video Gallery
// ===================================================
const GalleryItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    mediaType: {
      type: String,
      enum: ['photo', 'video'],
      default: 'photo',
    },
    filePath: { type: String }, // Cloudinary secure URL
    filePublicId: { type: String }, // Cloudinary public_id
    videoUrl: { type: String }, // For videos: YouTube/Vimeo URL
    thumbnailPath: { type: String },
    category: {
      type: String,
      enum: [
        'election_day',
        'civic_education',
        'staff',
        'training',
        'results',
        'inauguration',
        'office',
        'other',
      ],
      default: 'other',
    },
    tags: [{ type: String }],
    isFeatured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 99 },
    relatedElection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
    },
    takenAt: { type: Date },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

GalleryItemSchema.index({ isFeatured: 1, displayOrder: 1 });

const GalleryItem = mongoose.model('GalleryItem', GalleryItemSchema);

// ===================================================
// models/Inquiry.js — Contact Form Submissions
// ===================================================
const InquirySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    lga: { type: mongoose.Schema.Types.ObjectId, ref: 'LGA' },
    subject: {
      type: String,
      enum: [
        'general',
        'voter_registration',
        'election_results',
        'electoral_procedure',
        'candidate_info',
        'observer_accreditation',
        'electoral_complaint',
        'other',
      ],
      default: 'general',
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: [2000],
    },
    status: {
      type: String,
      enum: ['new', 'read', 'replied', 'closed'],
      default: 'new',
    },
    // Mail-style archive: independent of status. Archiving just moves an
    // inquiry out of the Inbox view — it doesn't mean it's been read,
    // replied to, or closed, and it can always be moved back.
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    adminNotes: { type: String }, // Internal notes
    repliedAt: { type: Date },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

InquirySchema.index({ status: 1, createdAt: -1 });
InquirySchema.index({ isArchived: 1, createdAt: -1 });

const Inquiry = mongoose.model('Inquiry', InquirySchema);

// ===================================================
// models/Testimonial.js — Public Testimonials
// ===================================================
const TestimonialSchema = new mongoose.Schema(
  {
    authorName: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
    },
    authorTitle: { type: String, trim: true }, // e.g. "Resident, Lokoja LGA"
    authorPhoto: { type: String },
    content: {
      type: String,
      required: [true, 'Testimonial content is required'],
      maxlength: [600],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    lga: { type: mongoose.Schema.Types.ObjectId, ref: 'LGA' },
    isApproved: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 99 },
    submittedAt: { type: Date, default: Date.now },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

TestimonialSchema.index({ isApproved: 1, isFeatured: 1 });

const Testimonial = mongoose.model('Testimonial', TestimonialSchema);

// ===================================================
// models/Setting.js — Site-Wide Settings
// ===================================================
const SettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Examples: 'ticker_messages', 'next_election_date',
      //           'chairman_message', 'site_maintenance', 'contact_info'
    },
    value: {
      type: mongoose.Schema.Types.Mixed, // Can be string, array, object
      required: true,
    },
    description: { type: String },
    isPublic: { type: Boolean, default: true }, // Public settings served to frontend
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const Setting = mongoose.model('Setting', SettingSchema);

module.exports = { Event, Download, GalleryItem, Inquiry, Testimonial, Setting };
