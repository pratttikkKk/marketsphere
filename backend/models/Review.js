const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Ref to User
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
  reported: { type: Boolean, default: false }
}, { timestamps: true });

reviewSchema.index({ productId: 1, customerId: 1 }, { unique: true }); // Prevent duplicate reviews

module.exports = mongoose.model('Review', reviewSchema);