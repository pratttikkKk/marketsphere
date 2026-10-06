const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true }, // User or Seller
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['SYSTEM', 'ORDER', 'PROMOTION', 'ACCOUNT'], default: 'SYSTEM' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);