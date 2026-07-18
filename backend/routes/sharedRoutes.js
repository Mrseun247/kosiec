const express = require('express');
const router = express.Router();
const { Event, Download, GalleryItem, Inquiry, Testimonial, Setting } =
  require('../models/SharedModels');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const nodemailer = require('nodemailer');

// ============================================================
// EVENTS  —  /api/events
// ============================================================
const eventsRouter = express.Router();

eventsRouter.get('/', async (req, res, next) => {
  try {
    const filter = { isPublic: true };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.upcoming) filter.eventDate = { $gte: new Date() };

    const events = await Event.find(filter)
      .populate('lgas', 'name')
      .populate('relatedElection', 'title year')
      .sort('eventDate');
    res.json({ success: true, count: events.length, data: events });
  } catch (err) { next(err); }
});

eventsRouter.get('/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('lgas', 'name')
      .populate('relatedElection', 'title year');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: event });
  } catch (err) { next(err); }
});

eventsRouter.post('/', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user._id };
    if (data.lgas && typeof data.lgas === 'string') data.lgas = JSON.parse(data.lgas);
    const event = await Event.create(data);
    res.status(201).json({ success: true, data: event });
  } catch (err) { next(err); }
});

eventsRouter.put('/:id', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: event });
  } catch (err) { next(err); }
});

eventsRouter.delete('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) { next(err); }
});

// ============================================================
// DOWNLOADS  —  /api/downloads
// ============================================================
const downloadsRouter = express.Router();

downloadsRouter.get('/', async (req, res, next) => {
  try {
    const filter = { isPublic: true };
    if (req.query.category) filter.category = req.query.category;
    const docs = await Download.find(filter).sort('-publishedAt');
    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) { next(err); }
});

downloadsRouter.post(
  '/',
  protect,
  authorize('super_admin', 'admin', 'staff'),
  upload.single('document'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Document file required.' });
      const sizeKB = req.file.size / 1024;
      const fileSize = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;

      const doc = await Download.create({
        ...req.body,
        filePath: req.file.path,        // Cloudinary secure URL
        filePublicId: req.file.filename, // Cloudinary public_id
        fileSize,
        createdBy: req.user._id,
      });
      res.status(201).json({ success: true, data: doc });
    } catch (err) { next(err); }
  }
);

// Increment download count when file is fetched
downloadsRouter.get('/:id/download', async (req, res, next) => {
  try {
    const doc = await Download.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloadCount: 1 } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
    res.json({ success: true, filePath: doc.filePath, fileName: doc.title });
  } catch (err) { next(err); }
});

downloadsRouter.put('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const doc = await Download.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
});

downloadsRouter.delete('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    await Download.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Document deleted.' });
  } catch (err) { next(err); }
});

// ============================================================
// GALLERY  —  /api/gallery
// ============================================================
const galleryRouter = express.Router();

galleryRouter.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured) filter.isFeatured = true;
    const items = await GalleryItem.find(filter).sort('displayOrder -createdAt');
    res.json({ success: true, count: items.length, data: items });
  } catch (err) { next(err); }
});

galleryRouter.post(
  '/',
  protect,
  authorize('super_admin', 'admin', 'staff'),
  upload.single('galleryImage'),
  async (req, res, next) => {
    try {
      const data = { ...req.body, uploadedBy: req.user._id };
      if (req.file) {
        data.filePath = req.file.path;           // Cloudinary secure URL (full size)
        data.filePublicId = req.file.filename;     // Cloudinary public_id
        // Cloudinary on-the-fly transform for a lightweight thumbnail
        data.thumbnailPath = req.file.path.replace('/upload/', '/upload/w_400,h_400,c_fill,q_auto/');
      }
      const item = await GalleryItem.create(data);
      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  }
);

galleryRouter.put('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const item = await GalleryItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Gallery item not found.' });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

galleryRouter.delete('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    await GalleryItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Gallery item deleted.' });
  } catch (err) { next(err); }
});

// ============================================================
// INQUIRIES  —  /api/inquiries
// ============================================================
const inquiriesRouter = express.Router();

// Nodemailer transporter (reused)
const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

// @route   POST /api/inquiries
// @desc    Submit contact form inquiry (public)
// @access  Public
inquiriesRouter.post('/', async (req, res, next) => {
  try {
    const { fullName, email, phone, lga, subject, message } = req.body;
    if (!fullName || !message) {
      return res.status(400).json({ success: false, message: 'Name and message are required.' });
    }

    const inquiry = await Inquiry.create({
      fullName, email, phone, lga, subject, message,
      ipAddress: req.ip,
    });

    // Send notification email to admin (non-blocking)
    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"KOSIEC Website" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `New Inquiry: ${subject || 'General'} — ${fullName}`,
        html: `
          <h3>New Website Inquiry</h3>
          <p><strong>From:</strong> ${fullName}</p>
          <p><strong>Email:</strong> ${email || 'N/A'}</p>
          <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
          <hr/>
          <p style="color:#888;font-size:12px;">Submitted via KOSIEC website at ${new Date().toLocaleString()}</p>
        `,
      });
    } catch (mailErr) {
      console.warn('⚠️  Email notification failed:', mailErr.message);
    }

    res.status(201).json({ success: true, message: 'Inquiry submitted. KOSIEC will respond within 24 hours.', id: inquiry._id });
  } catch (err) { next(err); }
});

// @route   GET /api/inquiries
// @desc    Get all inquiries
// @access  Private (admin+)
inquiriesRouter.get('/', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const inquiries = await Inquiry.find(filter)
      .populate('lga', 'name')
      .sort('-createdAt');
    res.json({ success: true, count: inquiries.length, data: inquiries });
  } catch (err) { next(err); }
});

// @route   PUT /api/inquiries/:id/status
// @desc    Update inquiry status (mark read/replied/closed)
// @access  Private (admin+)
inquiriesRouter.put('/:id/status', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const update = { status: req.body.status };
    if (req.body.adminNotes) update.adminNotes = req.body.adminNotes;
    if (req.body.status === 'replied') { update.repliedAt = new Date(); update.repliedBy = req.user._id; }
    const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    res.json({ success: true, data: inquiry });
  } catch (err) { next(err); }
});

// ============================================================
// TESTIMONIALS  —  /api/testimonials
// ============================================================
const testimonialsRouter = express.Router();

testimonialsRouter.get('/', async (req, res, next) => {
  try {
    const filter = { isApproved: true };
    if (req.query.featured) filter.isFeatured = true;
    const items = await Testimonial.find(filter)
      .populate('lga', 'name')
      .sort('displayOrder -createdAt');
    res.json({ success: true, count: items.length, data: items });
  } catch (err) { next(err); }
});

testimonialsRouter.post('/', async (req, res, next) => {
  try {
    const item = await Testimonial.create(req.body);
    res.status(201).json({ success: true, message: 'Testimonial submitted for review.', data: item });
  } catch (err) { next(err); }
});

testimonialsRouter.put('/:id/approve', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const item = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, approvedBy: req.user._id },
      { new: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Testimonial not found.' });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

testimonialsRouter.delete('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    await Testimonial.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Testimonial deleted.' });
  } catch (err) { next(err); }
});

// ============================================================
// SETTINGS  —  /api/settings
// ============================================================
const settingsRouter = express.Router();

// @route   GET /api/settings/public
// @desc    Get all public settings (for frontend to load)
// @access  Public
settingsRouter.get('/public', async (req, res, next) => {
  try {
    const settings = await Setting.find({ isPublic: true });
    // Convert to key-value map for easy frontend consumption
    const map = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    res.json({ success: true, data: map });
  } catch (err) { next(err); }
});

// @route   GET /api/settings
// @desc    Get all settings (admin)
// @access  Private (admin+)
settingsRouter.get('/', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const settings = await Setting.find().sort('key');
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

// @route   PUT /api/settings/:key
// @desc    Upsert a setting by key
// @access  Private (super_admin, admin)
settingsRouter.put('/:key', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { ...req.body, updatedBy: req.user._id },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: setting });
  } catch (err) { next(err); }
});

// @route   DELETE /api/settings/:key
// @desc    Delete a setting
// @access  Private (super_admin)
settingsRouter.delete('/:key', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    await Setting.findOneAndDelete({ key: req.params.key });
    res.json({ success: true, message: 'Setting deleted.' });
  } catch (err) { next(err); }
});

module.exports = { eventsRouter, downloadsRouter, galleryRouter, inquiriesRouter, testimonialsRouter, settingsRouter };
