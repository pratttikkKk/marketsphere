const fs = require('fs');
const path = require('path');

class ImageService {
  constructor() {
    this.provider = process.env.IMAGE_STORAGE_PROVIDER || 'LOCAL';
    this.cloudinaryConfigured = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  async uploadFile(filePath, originalName) {
    if (this.cloudinaryConfigured) {
      try {
        // Dynamic import / integration for Cloudinary when configured
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
        const result = await cloudinary.uploader.upload(filePath, {
          folder: 'marketsphere/products',
          resource_type: 'image'
        });
        return result.secure_url;
      } catch (err) {
        console.error('[IMAGE] Cloudinary upload error:', err.message);
        // Fallback to local
      }
    }

    // Local Storage URL Path
    const filename = path.basename(filePath);
    return `/uploads/${filename}`;
  }

  async deleteImage(imageUrl) {
    if (!imageUrl) return true;

    if (imageUrl.includes('cloudinary.com') && this.cloudinaryConfigured) {
      try {
        const cloudinary = require('cloudinary').v2;
        const parts = imageUrl.split('/');
        const filenameWithExt = parts[parts.length - 1];
        const publicId = `marketsphere/products/${filenameWithExt.split('.')[0]}`;
        await cloudinary.uploader.destroy(publicId);
        return true;
      } catch (err) {
        console.error('[IMAGE] Cloudinary delete error:', err.message);
        return false;
      }
    }

    // Local file cleanup
    if (imageUrl.startsWith('/uploads/')) {
      const filename = path.basename(imageUrl);
      const localPath = path.join(__dirname, '../uploads', filename);
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
          return true;
        } catch (e) {
          console.error('[IMAGE] Local delete error:', e.message);
        }
      }
    }

    return true;
  }
}

module.exports = new ImageService();