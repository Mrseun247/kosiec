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

// @route   POST /api/news/extract-link
// @desc    Given an external URL (news article or video), fetch it and pull
//          out a title/excerpt/thumbnail so the admin doesn't have to type
//          everything by hand. YouTube/Vimeo links resolve via their oEmbed
//          APIs; anything else is scraped for Open Graph meta tags.
// @access  Private (admin+)
router.post('/extract-link', protect, authorize('super_admin', 'admin', 'staff'), async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ success: false, message: 'A valid http(s) URL is required.' });
    }

    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/i);
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/i);

    // ── YouTube ──────────────────────────────────────────────
    if (youtubeMatch) {
      let title = '';
      try {
        const oembed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (oembed.ok) title = (await oembed.json()).title || '';
      } catch { /* fall through with empty title */ }
      return res.json({
        success: true,
        data: {
          isVideo: true,
          videoUrl: url,
          title,
          excerpt: '',
          image: `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`,
        },
      });
    }

    // ── Vimeo ────────────────────────────────────────────────
    if (vimeoMatch) {
      let title = '', image = '';
      try {
        const oembed = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
        if (oembed.ok) {
          const j = await oembed.json();
          title = j.title || '';
          image = j.thumbnail_url || '';
        }
      } catch { /* fall through with empty title/image */ }
      return res.json({
        success: true,
        data: { isVideo: true, videoUrl: url, title, excerpt: '', image },
      });
    }

    // ── Generic article — scrape Open Graph / basic meta tags ──
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KOSIECBot/1.0; +https://kosiec.gov.ng)' },
      redirect: 'follow',
    });
    if (!pageRes.ok) {
      return res.status(422).json({ success: false, message: `Could not fetch that URL (HTTP ${pageRes.status}).` });
    }
    const html = await pageRes.text();

    const getMeta = (prop) => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'),
      ];
      for (const re of patterns) {
        const m = re.exec(html);
        if (m) return m[1];
      }
      return '';
    };

    const decodeEntities = (s) => s
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    const titleTagMatch = /<title>([^<]+)<\/title>/i.exec(html);
    const title = decodeEntities(getMeta('og:title') || (titleTagMatch ? titleTagMatch[1] : '')).trim();
    const excerpt = decodeEntities(getMeta('og:description') || getMeta('description') || '').trim();
    let image = getMeta('og:image') || getMeta('twitter:image') || '';
    // Resolve protocol-relative or root-relative image URLs against the source page
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, url).href; } catch { image = ''; }
    }

    res.json({
      success: true,
      data: { isVideo: false, sourceUrl: url, title, excerpt, image },
    });
  } catch (err) {
    if (err.name === 'TypeError' && /fetch/i.test(err.message)) {
      return res.status(422).json({ success: false, message: 'Could not reach that URL.' });
    }
    next(err);
  }
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
