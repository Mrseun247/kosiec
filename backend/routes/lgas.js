const express = require('express');
const router = express.Router();
const LGA = require('../models/LGA');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/lgas
// @desc    Get all LGAs
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const lgas = await LGA.find({ isActive: true }).sort('name');
    res.json({ success: true, count: lgas.length, data: lgas });
  } catch (err) { next(err); }
});

// @route   GET /api/lgas/:id
// @desc    Get single LGA
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const lga = await LGA.findById(req.params.id);
    if (!lga) return res.status(404).json({ success: false, message: 'LGA not found.' });
    res.json({ success: true, data: lga });
  } catch (err) { next(err); }
});

// @route   POST /api/lgas
// @desc    Create LGA
// @access  Private (super_admin)
router.post('/', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const lga = await LGA.create(req.body);
    res.status(201).json({ success: true, data: lga });
  } catch (err) { next(err); }
});

// @route   PUT /api/lgas/:id
// @desc    Update LGA
// @access  Private (super_admin, admin)
router.put('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const lga = await LGA.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!lga) return res.status(404).json({ success: false, message: 'LGA not found.' });
    res.json({ success: true, data: lga });
  } catch (err) { next(err); }
});

// @route   DELETE /api/lgas/:id
// @desc    Soft-delete LGA (deactivate)
// @access  Private (super_admin)
router.delete('/:id', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const lga = await LGA.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!lga) return res.status(404).json({ success: false, message: 'LGA not found.' });
    res.json({ success: true, message: 'LGA deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;
