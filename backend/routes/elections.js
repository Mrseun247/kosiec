const express = require('express');
const router = express.Router();
const Election = require('../models/Election');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET /api/elections
// @desc    Get all elections (with filters)
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.year) filter.year = parseInt(req.query.year);
    if (req.query.type) filter.type = req.query.type;

    const elections = await Election.find(filter)
      .populate('lgas', 'name')
      .populate('createdBy', 'fullName')
      .sort('-electionDate');

    res.json({ success: true, count: elections.length, data: elections });
  } catch (err) { next(err); }
});

// @route   GET /api/elections/upcoming
// @desc    Get next upcoming election
// @access  Public
router.get('/upcoming', async (req, res, next) => {
  try {
    const election = await Election.findOne({
      status: { $in: ['scheduled', 'ongoing'] },
      electionDate: { $gte: new Date() },
    })
      .sort('electionDate')
      .populate('lgas', 'name');

    res.json({ success: true, data: election || null });
  } catch (err) { next(err); }
});

// @route   GET /api/elections/:id
// @desc    Get single election
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const election = await Election.findById(req.params.id)
      .populate('lgas', 'name senatoralDistrict')
      .populate('createdBy', 'fullName');
    if (!election) return res.status(404).json({ success: false, message: 'Election not found.' });
    res.json({ success: true, data: election });
  } catch (err) { next(err); }
});

// @route   POST /api/elections
// @desc    Create election
// @access  Private (super_admin only — election data is off-limits to the admin role)
router.post(
  '/',
  protect,
  authorize('super_admin'),
  upload.single('timetableDoc'),
  async (req, res, next) => {
    try {
      const data = { ...req.body, createdBy: req.user._id };
      if (req.file) data.timetableDoc = req.file.path;
      // lgas can come as JSON string from form
      if (data.lgas && typeof data.lgas === 'string') {
        data.lgas = JSON.parse(data.lgas);
      }
      const election = await Election.create(data);
      res.status(201).json({ success: true, data: election });
    } catch (err) { next(err); }
  }
);

// @route   PUT /api/elections/:id
// @desc    Update election
// @access  Private (super_admin only — election data is off-limits to the admin role)
router.put(
  '/:id',
  protect,
  authorize('super_admin'),
  upload.single('timetableDoc'),
  async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.file) data.timetableDoc = req.file.path;
      if (data.lgas && typeof data.lgas === 'string') data.lgas = JSON.parse(data.lgas);

      const election = await Election.findByIdAndUpdate(req.params.id, data, {
        new: true, runValidators: true,
      });
      if (!election) return res.status(404).json({ success: false, message: 'Election not found.' });
      res.json({ success: true, data: election });
    } catch (err) { next(err); }
  }
);

// @route   PUT /api/elections/:id/status
// @desc    Update election status only
// @access  Private (super_admin only — election data is off-limits to the admin role)
router.put('/:id/status', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['scheduled', 'ongoing', 'completed', 'suspended', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }
    const election = await Election.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    );
    if (!election) return res.status(404).json({ success: false, message: 'Election not found.' });
    res.json({ success: true, data: election });
  } catch (err) { next(err); }
});

// @route   DELETE /api/elections/:id
// @desc    Delete election
// @access  Private (super_admin)
router.delete('/:id', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const election = await Election.findByIdAndDelete(req.params.id);
    if (!election) return res.status(404).json({ success: false, message: 'Election not found.' });
    res.json({ success: true, message: 'Election deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
