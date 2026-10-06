const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  sku: { type: String, required: true, unique: true, uppercase: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  images: [{ type: String }], // Array of URLs
  stock: { type: Number, required: true, min: 0, default: 0 },
  attributes: { type: Map, of: String }, // e.g., { brand: "Nike", material: "Cotton" }
  variants: [{ // Embedded for simplicity, avoiding joins for product options
    name: String, // e.g., "Size"
    value: String // e.g., "Large"
  }],
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'ARCHIVED'],
    default: 'DRAFT'
  },
  averageRating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  sellerUpiId: { type: String, trim: true },
  sellerUpiQr: { type: String, trim: true }
}, { timestamps: true });

// Compound text index for search
productSchema.index({ name: 'text', description: 'text' });
// Indexes for filtering and sorting
productSchema.index({ category: 1, status: 1 });
productSchema.index({ sellerId: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);