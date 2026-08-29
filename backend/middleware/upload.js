const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

// Map form field name -> Cloudinary folder
const FOLDER_MAP = {
  photo: 'kosiec/team',
  teamPhoto: 'kosiec/team',
  galleryImage: 'kosiec/gallery',
  featuredImage: 'kosiec/news',
  newsMedia: 'kosiec/news-media',
  partyLogo: 'kosiec/parties',
  document: 'kosiec/documents',
  timetableDoc: 'kosiec/documents',
};

// Fields that carry an uploaded video/audio file rather than an image/document —
// Cloudinary uses resource_type 'video' for both (its API's actual convention).
const MEDIA_FIELDS = new Set(['newsMedia']);
const VIDEO_EXT = /mp4|webm|mov|m4v/;
const AUDIO_EXT = /mp3|wav|m4a|ogg|aac/;

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = FOLDER_MAP[file.fieldname] || 'kosiec/misc';
    const ext = file.originalname.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';
    const isOfficeDoc = ext === 'docx' || ext === 'xlsx';

    if (MEDIA_FIELDS.has(file.fieldname)) {
      return { folder, resource_type: 'video', allowed_formats: ['mp4', 'webm', 'mov', 'm4v', 'mp3', 'wav', 'm4a', 'ogg', 'aac'] };
    }
    if (isPdf) {
      // Cloudinary's 'image' resource type renders PDFs (page previews,
      // inline viewing with a correct application/pdf content-type) as
      // long as the delivery URL keeps the .pdf extension.
      return { folder, resource_type: 'image', format: 'pdf', allowed_formats: ['pdf'] };
    }
    if (isOfficeDoc) {
      // 'raw' for formats Cloudinary can't render — format must still be
      // set explicitly, otherwise the delivery URL has no extension and
      // Cloudinary serves it as generic application/octet-stream.
      return { folder, resource_type: 'raw', format: ext, allowed_formats: ['docx', 'xlsx'] };
    }
    return { folder, resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'] };
  },
});

const fileFilter = (req, file, cb) => {
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (MEDIA_FIELDS.has(file.fieldname)) {
    if (VIDEO_EXT.test(ext) || AUDIO_EXT.test(ext)) return cb(null, true);
    return cb(new Error('Only video (mp4, webm, mov, m4v) or audio (mp3, wav, m4a, ogg, aac) files are allowed.'));
  }
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const docTypes = /pdf|docx|xlsx/;
  if (imageTypes.test(ext) || docTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, png, webp) and documents (pdf, docx, xlsx) are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  // A single shared limit covers both branches above — video/audio files need far more
  // headroom than the old 5MB image/doc default, and letting images share that ceiling
  // is harmless since they'll never actually approach it.
  limits: { fileSize: parseInt(process.env.MAX_MEDIA_FILE_SIZE) || 100 * 1024 * 1024 },
});

// Helper for routes to tell a video upload apart from an audio one after the fact.
upload.mediaKind = (originalname) => {
  const ext = (originalname || '').split('.').pop().toLowerCase();
  if (VIDEO_EXT.test(ext)) return 'video';
  if (AUDIO_EXT.test(ext)) return 'audio';
  return 'none';
};

module.exports = upload;
