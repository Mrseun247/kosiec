const cloudinary = require('cloudinary').v2;

// Cloudinary auto-configures from the CLOUDINARY_URL env var if present
// (format: cloudinary://<api_key>:<api_secret>@<cloud_name>)
// Otherwise fall back to explicit config vars.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config(); // reads CLOUDINARY_URL automatically
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const verifyCloudinary = async () => {
  try {
    await cloudinary.api.ping();
    console.log('✅ Cloudinary connected:', cloudinary.config().cloud_name);
  } catch (err) {
    console.error('❌ Cloudinary connection failed:', err.message);
    console.error('   Check CLOUDINARY_URL in your .env file.');
  }
};

module.exports = { cloudinary, verifyCloudinary };
