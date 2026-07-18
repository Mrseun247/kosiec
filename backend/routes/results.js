const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Result = require('../models/Result');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { writeAuditLog } = require('../utils/auditLog');

// Best-effort auth: attaches req.user if a valid admin/staff token is present,
// but never blocks the request — used so /:id can serve drafts to admins
// while staying public for published results.
async function attachAdminIfPresent(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer')) return next();
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) req.user = user;
  } catch { /* ignore invalid/expired token — request proceeds unauthenticated */ }
  next();
}

// @route   GET /api/results
// @desc    Get published results (public) with filters
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const filter = { status: 'published' };
    if (req.query.election) filter.election = req.query.election;
    if (req.query.lga) filter.lga = req.query.lga;
    if (req.query.position) filter.position = req.query.position;

    const results = await Result.find(filter)
      .populate('election', 'title year type electionDate')
      .populate('lga', 'name senatoralDistrict')
      .populate('voteEntries.candidate', 'fullName party photo')
      .populate('winner', 'fullName party photo')
      .sort('-publishedAt');

    res.json({ success: true, count: results.length, data: results });
  } catch (err) { next(err); }
});

// @route   GET /api/results/all
// @desc    Get ALL results including drafts (admin only)
// @access  Private (admin+)
router.get('/all', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.election) filter.election = req.query.election;
    if (req.query.status) filter.status = req.query.status;

    const results = await Result.find(filter)
      .populate('election', 'title year')
      .populate('lga', 'name')
      .sort('-createdAt');

    res.json({ success: true, count: results.length, data: results });
  } catch (err) { next(err); }
});

// @route   GET /api/results/:id
// @desc    Get single result
// @access  Public (if published) / Private (if draft)
router.get('/:id', attachAdminIfPresent, async (req, res, next) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate('election', 'title year type electionDate')
      .populate('lga', 'name')
      .populate('voteEntries.candidate', 'fullName party photo partyLogo')
      .populate('winner', 'fullName party photo');

    if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });
    const isAdmin = req.user && ['super_admin', 'admin', 'staff'].includes(req.user.role);
    if (result.status !== 'published' && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Result not yet published.' });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// @route   POST /api/results
// @desc    Create new result (collation)
// @access  Private (admin, staff)
router.post('/', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const data = { ...req.body, collatedBy: req.user._id };
    if (data.voteEntries && typeof data.voteEntries === 'string') {
      data.voteEntries = JSON.parse(data.voteEntries);
    }
    const result = await Result.create(data);
    await writeAuditLog(req, {
      action: 'create',
      resource: 'Result',
      resourceId: result._id,
      details: `Collated result for LGA ${result.lga}, position ${result.position}. Votes: ${JSON.stringify(result.voteEntries.map(v => ({ c: v.candidateName, v: v.votes })))}`,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

// @route   PUT /api/results/:id
// @desc    Update result
// @access  Private (admin+)
router.put('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.voteEntries && typeof data.voteEntries === 'string') {
      data.voteEntries = JSON.parse(data.voteEntries);
    }
    // Load + save (rather than findByIdAndUpdate) so the pre('save') hook
    // recalculates vote percentages, turnout, and the winner from the
    // updated voteEntries/validVotes/registeredVoters.
    const result = await Result.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });

    // Once a result is published (certified and public), correcting it is a
    // materially different, higher-risk action than collating a draft —
    // require super_admin specifically, and always leave an audit trail.
    if (result.status === 'published' && req.user.role !== 'super_admin') {
      await writeAuditLog(req, {
        action: 'update',
        resource: 'Result',
        resourceId: result._id,
        details: `BLOCKED: ${req.user.role} attempted to edit a published result without super_admin privilege.`,
      });
      return res.status(403).json({
        success: false,
        message: 'Published results can only be corrected by a super_admin. Contact your commission administrator.',
      });
    }

    const before = { status: result.status, voteEntries: result.voteEntries.map(v => ({ c: v.candidateName, v: v.votes })) };
    Object.assign(result, data);
    await result.save();
    const after = { voteEntries: result.voteEntries.map(v => ({ c: v.candidateName, v: v.votes })) };

    await writeAuditLog(req, {
      action: 'update',
      resource: 'Result',
      resourceId: result._id,
      details: `Edited ${before.status === 'published' ? 'PUBLISHED' : 'draft'} result. Before: ${JSON.stringify(before.voteEntries)} → After: ${JSON.stringify(after.voteEntries)}`,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// @route   PUT /api/results/:id/publish
// @desc    Publish a result (make it public)
// @access  Private (super_admin, admin)
router.put('/:id/publish', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const result = await Result.findByIdAndUpdate(
      req.params.id,
      {
        status: 'published',
        publishedAt: new Date(),
        certifiedBy: req.body.certifiedBy || req.user.fullName,
        certifiedAt: new Date(),
        returningOfficer: req.body.returningOfficer,
      },
      { new: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });
    await writeAuditLog(req, {
      action: 'publish',
      resource: 'Result',
      resourceId: result._id,
      details: `Published result for LGA ${result.lga}, position ${result.position}. Winner: ${result.winnerName} (${result.winnerParty}), ${result.winnerVotes} votes. Certified by: ${result.certifiedBy}.`,
    });
    res.json({ success: true, message: 'Result published.', data: result });
  } catch (err) { next(err); }
});

// @route   DELETE /api/results/:id
// @desc    Delete result
// @access  Private (super_admin)
router.delete('/:id', protect, authorize('super_admin'), async (req, res, next) => {
  try {
    const result = await Result.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });
    await writeAuditLog(req, {
      action: 'delete',
      resource: 'Result',
      resourceId: result._id,
      details: `Deleted ${result.status} result for LGA ${result.lga}, position ${result.position}. Vote data at time of deletion: ${JSON.stringify(result.voteEntries.map(v => ({ c: v.candidateName, v: v.votes })))}`,
    });
    res.json({ success: true, message: 'Result deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
