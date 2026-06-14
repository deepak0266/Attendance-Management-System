const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

// Configure cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a base64 image to Cloudinary
 * @param {string} base64Image - The base64 encoded image string
 * @param {string} folder - Optional folder name
 * @returns {Promise<string>} - Returns the URL of the uploaded image
 */
const uploadImage = async (base64Image, folder = 'attendance_selfies') => {
  try {
    if (!base64Image) return null;

    // Remove the data:image/jpeg;base64, prefix if it exists
    const base64Data = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/) 
      ? base64Image 
      : `data:image/jpeg;base64,${base64Image}`;

    const uploadResponse = await cloudinary.uploader.upload(base64Data, {
      folder: folder,
      resource_type: 'image',
      quality: 'auto:eco',
      fetch_format: 'auto'
    });

    return uploadResponse.secure_url;
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

module.exports = {
  uploadImage,
  cloudinary
};
