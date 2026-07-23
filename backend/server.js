require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const rateLimit  = require('express-rate-limit');

const connectDB      = require('./config/db');
const { verifyCloudinary } = require('./config/cloudinary');
const errorHandler   = require('./middleware/errorHandler');

// Route imports
const authRoutes       = require('./routes/auth');
const lgaRoutes        = require('./routes/lgas');
const electionRoutes   = require('./routes/elections');
const resultRoutes     = require('./routes/results');
const candidateRoutes  = require('./routes/candidates');
const newsRoutes       = require('./routes/news');
const teamRoutes       = require('./routes/team');
const {
  eventsRouter,
  downloadsRouter,
  galleryRouter,
  inquiriesRouter,
  testimonialsRouter,
  settingsRouter,
} = require('./routes/sharedRoutes');

// ── Connect to MongoDB Atlas ───────────────────────────────
connectDB();

// ── Verify Cloudinary credentials ──────────────────────────
verifyCloudinary();

const app = express();

// ── Security & Utility Middleware ──────────────────────────
// Helmet's default Content-Security-Policy blocks inline event handlers
// (onclick="…") and external image/font/iframe hosts. This frontend relies
// on inline onclick="" attributes throughout and loads assets from
// Cloudinary, Google Fonts, and YouTube/Vimeo/Facebook embeds, so the
// default CSP silently breaks the entire site once served from this
// Express app (every click handler and Cloudinary image gets blocked).
// This was invisible in development because the frontend was served by a
// separate static server with no CSP headers at all.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving uploads
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      // Helmet defaults this to 'none', which is a more specific directive
      // than script-src and blocks every onclick="" attribute on its own.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      // News articles link directly to images hosted by whichever external
      // outlet published the story, so this can't be a fixed domain list —
      // any HTTPS image host is allowed; only non-HTTPS/script sources are blocked.
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", 'https://res.cloudinary.com'],
      frameSrc: ["'self'", 'https://www.youtube.com', 'https://player.vimeo.com', 'https://www.facebook.com', 'https://docs.google.com'],
      connectSrc: ["'self'", 'https://res.cloudinary.com'],
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Rate Limiting ──────────────────────────────────────────
// General API limiter
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Stricter limiter for auth
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
}));

// Inquiry form limiter — only the public submission endpoint (POST).
// Scoping to app.use('/api/inquiries', ...) would also throttle the admin
// dashboard's GET listing, since Express applies path-only middleware to
// every HTTP method.
const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many submissions from this IP. Try again in an hour.' },
});
app.use('/api/inquiries', (req, res, next) => {
  if (req.method === 'POST') return inquiryLimiter(req, res, next);
  next();
});

// ── File Storage Note ───────────────────────────────────────
// All uploaded files (photos, documents) are stored on Cloudinary,
// not on local disk — so no /uploads static route is needed here.
// File URLs returned by the API are full Cloudinary secure_urls.

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'KOSIEC API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/lgas',         lgaRoutes);
app.use('/api/elections',    electionRoutes);
app.use('/api/results',      resultRoutes);
app.use('/api/candidates',   candidateRoutes);
app.use('/api/news',         newsRoutes);
app.use('/api/team',         teamRoutes);
app.use('/api/events',       eventsRouter);
app.use('/api/downloads',    downloadsRouter);
app.use('/api/gallery',      galleryRouter);
app.use('/api/inquiries',    inquiriesRouter);
app.use('/api/testimonials', testimonialsRouter);
app.use('/api/settings',     settingsRouter);

// ── 404 for unknown API routes ─────────────────────────────
// Must come before the SPA catch-all below, otherwise an invalid /api/*
// request would fall through to the wildcard and get served index.html
// (200 HTML) instead of a proper 404 JSON error.
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
});

// ── Serve Frontend in Production ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendPath));
  // SPA fallback — all non-API routes serve index.html so the client-side
  // router can resolve clean paths like /about on direct visit or refresh.
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ── Global Error Handler ───────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n🚀 KOSIEC API Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`   ➜  http://localhost:${PORT}`);
  console.log(`   ➜  Health: http://localhost:${PORT}/api/health\n`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});
