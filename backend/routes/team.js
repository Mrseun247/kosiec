const express = require('express');
const router = express.Router();
const TeamMember = require('../models/TeamMember');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { cloudinary } = require('../config/cloudinary');

// @route   GET /api/team
// @desc    Get all active team members (sorted by display order)
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.category) filter.roleCategory = req.query.category;

    const members = await TeamMember.find(filter).sort('displayOrder fullName');
    res.json({ success: true, count: members.length, data: members });
  } catch (err) { next(err); }
});

// @route   GET /api/team/chairman
// @desc    Get the commission chairman specifically
// @access  Public
router.get('/chairman', async (req, res, next) => {
  try {
    const chairman = await TeamMember.findOne({ isChairman: true, isActive: true });
    if (!chairman) return res.status(404).json({ success: false, message: 'Chairman record not found.' });
    res.json({ success: true, data: chairman });
  } catch (err) { next(err); }
});

// @route   GET /api/team/:id
// @desc    Get single team member
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found.' });
    res.json({ success: true, data: member });
  } catch (err) { next(err); }
});

// @route   POST /api/team
// @desc    Add team member (with optional photo upload)
// @access  Private (super_admin, admin)
router.post(
  '/',
  protect,
  authorize('super_admin', 'admin'),
  upload.single('photo'),
  async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.file) {
        data.photo = req.file.path;        // Cloudinary secure URL
        data.photoPublicId = req.file.filename; // Cloudinary public_id, for later deletion/replacement
      }

      // Parse qualifications array if sent as JSON string
      if (data.qualifications && typeof data.qualifications === 'string') {
        data.qualifications = JSON.parse(data.qualifications);
      }

      const member = await TeamMember.create(data);
      res.status(201).json({ success: true, data: member });
    } catch (err) { next(err); }
  }
);

// @route   PUT /api/team/:id
// @desc    Update team member (supports photo replacement)
// @access  Private (super_admin, admin)
router.put(
  '/:id',
  protect,
  authorize('super_admin', 'admin'),
  upload.single('photo'),
  async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.file) {
        data.photo = req.file.path;
        data.photoPublicId = req.file.filename;
      }

      if (data.qualifications && typeof data.qualifications === 'string') {
        data.qualifications = JSON.parse(data.qualifications);
      }

      const member = await TeamMember.findByIdAndUpdate(req.params.id, data, {
        new: true,
        runValidators: true,
      });
      if (!member) return res.status(404).json({ success: false, message: 'Team member not found.' });
      res.json({ success: true, data: member });
    } catch (err) { next(err); }
  }
);

// @route   PUT /api/team/:id/photo
// @desc    Upload / replace photo only (standalone endpoint)
// @access  Private (super_admin, admin)
router.put(
  '/:id/photo',
  protect,
  authorize('super_admin', 'admin'),
  upload.single('photo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No photo file provided.' });
      }

      const existing = await TeamMember.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Team member not found.' });

      // Delete the old Cloudinary asset (if any) to avoid orphaned files
      if (existing.photoPublicId) {
        try { await cloudinary.uploader.destroy(existing.photoPublicId); }
        catch (e) { console.warn('Cloudinary cleanup warning:', e.message); }
      }

      const photoUrl = req.file.path;          // Cloudinary secure URL
      const photoPublicId = req.file.filename;  // Cloudinary public_id

      const member = await TeamMember.findByIdAndUpdate(
        req.params.id,
        { photo: photoUrl, photoPublicId },
        { new: true }
      );
      res.json({ success: true, message: 'Photo updated successfully.', photo: photoUrl, data: member });
    } catch (err) { next(err); }
  }
);

// @route   DELETE /api/team/:id
// @desc    Soft-delete (deactivate) team member
// @access  Private (super_admin)
router.delete('/:id', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const member = await TeamMember.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found.' });
    res.json({ success: true, message: 'Team member deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;
