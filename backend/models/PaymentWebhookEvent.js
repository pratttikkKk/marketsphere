const mongoose = require('mongoose');

const paymentWebhookEventSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
    enum: ['RAZORPAY', 'SANDBOX', 'STRIPE']
  },
  eventId: {
    type: String,
    required: true,
    trim: true
  },
  eventType: {
    type: String,
    required: true,
    trim: true
  },
  receivedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'],
    default: 'RECEIVED'
  },
  payloadHash: {
    type: String
  },
  processingError: {
    type: String
  }
}, { timestamps: true });

// Compound unique index prevents duplicate processing across restarts and workers
paymentWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('PaymentWebhookEvent', paymentWebhookEventSchema);
