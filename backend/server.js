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
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving uploads
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

// ── Serve Frontend in Production ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendPath));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ── 404 for unknown API routes ─────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
});

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
