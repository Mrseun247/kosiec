const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

// Map form field name -> Cloudinary folder
const FOLDER_MAP = {
  photo: 'kosiec/team',
  teamPhoto: 'kosiec/team',
  galleryImage: 'kosiec/gallery',
  featuredImage: 'kosiec/news',
  partyLogo: 'kosiec/parties',
  document: 'kosiec/documents',
  timetableDoc: 'kosiec/documents',
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = FOLDER_MAP[file.fieldname] || 'kosiec/misc';
    const ext = file.originalname.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';
    const isOfficeDoc = ext === 'docx' || ext === 'xlsx';

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
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const docTypes = /pdf|docx|xlsx/;
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (imageTypes.test(ext) || docTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, png, webp) and documents (pdf, docx, xlsx) are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
});

module.exports = upload;
