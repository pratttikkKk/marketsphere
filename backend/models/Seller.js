const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, // Ref to User (omitted for brevity)
  storeName: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  contactEmail: { type: String, required: true, match: /.+@.+\..+/ },
  contactPhone: { type: String },
  businessAddress: { type: String },
  upiId: { type: String, trim: true },
  upiQr: { type: String, trim: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], 
    default: 'PENDING' 
  }
}, { timestamps: true });

// Indexes for common queries
sellerSchema.index({ status: 1 });

module.exports = mongoose.model('Seller', sellerSchema);