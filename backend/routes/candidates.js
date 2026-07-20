const express = require('express');
const router = express.Router();
const Candidate = require('../models/Candidate');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { writeAuditLog } = require('../utils/auditLog');

// @route   GET /api/candidates
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.election) filter.election = req.query.election;
    if (req.query.lga) filter.lga = req.query.lga;
    if (req.query.position) filter.position = req.query.position;
    if (req.query.party) filter.party = req.query.party.toUpperCase();

    const candidates = await Candidate.find(filter)
      .populate('election', 'title year type electionDate')
      .populate('lga', 'name')
      .sort('party fullName');

    res.json({ success: true, count: candidates.length, data: candidates });
  } catch (err) { next(err); }
});

// @route   GET /api/candidates/:id
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
      .populate('election', 'title year')
      .populate('lga', 'name');
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });
    res.json({ success: true, data: candidate });
  } catch (err) { next(err); }
});

// @route   POST /api/candidates
// @access  Private (super_admin only — election data is off-limits to the admin role)
router.post(
  '/',
  protect,
  authorize('super_admin'),
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'partyLogo', maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.files?.photo) data.photo = req.files.photo[0].path;
      if (req.files?.partyLogo) data.partyLogo = req.files.partyLogo[0].path;
      const candidate = await Candidate.create(data);
      await writeAuditLog(req, {
        action: 'create', resource: 'Candidate', resourceId: candidate._id,
        details: `Added candidate ${candidate.fullName} (${candidate.party}) for LGA ${candidate.lga}, ${candidate.position}.`,
      });
      res.status(201).json({ success: true, data: candidate });
    } catch (err) { next(err); }
  }
);

// @route   PUT /api/candidates/:id
// @access  Private (super_admin only — election data is off-limits to the admin role)
router.put(
  '/:id',
  protect,
  authorize('super_admin'),
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'partyLogo', maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.files?.photo) data.photo = req.files.photo[0].path;
      if (req.files?.partyLogo) data.partyLogo = req.files.partyLogo[0].path;
      const before = await Candidate.findById(req.params.id);
      if (!before) return res.status(404).json({ success: false, message: 'Candidate not found.' });
      const candidate = await Candidate.findByIdAndUpdate(req.params.id, data, {
        new: true, runValidators: true,
      });
      await writeAuditLog(req, {
        action: 'update', resource: 'Candidate', resourceId: candidate._id,
        details: `Edited candidate. Before: ${before.fullName} (${before.party}) → After: ${candidate.fullName} (${candidate.party}).`,
      });
      res.json({ success: true, data: candidate });
    } catch (err) { next(err); }
  }
);

// @route   PUT /api/candidates/:id/accredit
// @desc    Accredit a candidate
// @access  Private (super_admin only — election data is off-limits to the admin role)
router.put('/:id/accredit', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { isAccredited: true, accreditedBy: req.user._id, accreditedAt: new Date() },
      { new: true }
    );
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });
    res.json({ success: true, message: 'Candidate accredited.', data: candidate });
  } catch (err) { next(err); }
});

// @route   DELETE /api/candidates/:id
// @access  Private (super_admin)
router.delete('/:id', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (candidate) {
      await writeAuditLog(req, {
        action: 'delete', resource: 'Candidate', resourceId: candidate._id,
        details: `Deleted candidate ${candidate.fullName} (${candidate.party}), LGA ${candidate.lga}, ${candidate.position}.`,
      });
    }
    res.json({ success: true, message: 'Candidate deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
