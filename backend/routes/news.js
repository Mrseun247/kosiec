const express = require('express');
const router = express.Router();
const NewsArticle = require('../models/NewsArticle');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET /api/news
// @desc    Get published articles (public) with filters & pagination
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const filter = { status: 'published' };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured) filter.isFeatured = req.query.featured === 'true';
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { excerpt: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip  = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      NewsArticle.find(filter)
        .select('-content')          // omit full content on list view
        .populate('author', 'fullName')
        .sort('-publishedAt')
        .skip(skip)
        .limit(limit),
      NewsArticle.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: articles.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: articles,
    });
  } catch (err) { next(err); }
});

// @route   GET /api/news/all
// @desc    Get ALL articles including drafts (admin)
// @access  Private (admin+)
router.get('/all', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const articles = await NewsArticle.find()
      .select('-content')
      .populate('author', 'fullName')
      .sort('-createdAt');
    res.json({ success: true, count: articles.length, data: articles });
  } catch (err) { next(err); }
});

// @route   GET /api/news/id/:id
// @desc    Get single article by id, including content, regardless of status (admin edit form)
// @access  Private (admin+)
router.get('/id/:id', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const article = await NewsArticle.findById(req.params.id).populate('author', 'fullName');
    if (!article) return res.status(404).json({ success: false, message: 'Article not found.' });
    res.json({ success: true, data: article });
  } catch (err) { next(err); }
});

// @route   GET /api/news/:slug
// @desc    Get single article by slug (increments view count)
// @access  Public
router.get('/:slug', async (req, res, next) => {
  try {
    const article = await NewsArticle.findOneAndUpdate(
      { slug: req.params.slug, status: 'published' },
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('author', 'fullName').populate('relatedElection', 'title year');

    if (!article) return res.status(404).json({ success: false, message: 'Article not found.' });
    res.json({ success: true, data: article });
  } catch (err) { next(err); }
});

// @route   POST /api/news
// @desc    Create article
// @access  Private (admin+)
router.post(
  '/',
  protect,
  authorize('super_admin', 'admin', 'staff'),
  upload.single('featuredImage'),
  async (req, res, next) => {
    try {
      const data = { ...req.body, author: req.user._id, authorName: req.user.fullName };
      if (req.file) data.featuredImage = req.file.path;
      if (data.tags && typeof data.tags === 'string') {
        data.tags = data.tags.split(',').map((t) => t.trim().toLowerCase());
      }
      const article = await NewsArticle.create(data);
      res.status(201).json({ success: true, data: article });
    } catch (err) { next(err); }
  }
);

// @route   PUT /api/news/:id
// @desc    Update article
// @access  Private (admin+)
router.put(
  '/:id',
  protect,
  authorize('super_admin', 'admin', 'staff'),
  upload.single('featuredImage'),
  async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.file) data.featuredImage = req.file.path;
      if (data.tags && typeof data.tags === 'string') {
        data.tags = data.tags.split(',').map((t) => t.trim().toLowerCase());
      }
      const article = await NewsArticle.findByIdAndUpdate(req.params.id, data, {
        new: true, runValidators: true,
      });
      if (!article) return res.status(404).json({ success: false, message: 'Article not found.' });
      res.json({ success: true, data: article });
    } catch (err) { next(err); }
  }
);

// @route   PUT /api/news/:id/publish
// @desc    Publish an article
// @access  Private (admin+)
router.put('/:id/publish', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    const article = await NewsArticle.findByIdAndUpdate(
      req.params.id,
      { status: 'published', publishedAt: new Date() },
      { new: true }
    );
    if (!article) return res.status(404).json({ success: false, message: 'Article not found.' });
    res.json({ success: true, message: 'Article published.', data: article });
  } catch (err) { next(err); }
});

// @route   DELETE /api/news/:id
// @desc    Delete article
// @access  Private (super_admin, admin)
router.delete('/:id', protect, authorize('super_admin', 'admin'), async (req, res, next) => {
  try {
    await NewsArticle.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Article deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
