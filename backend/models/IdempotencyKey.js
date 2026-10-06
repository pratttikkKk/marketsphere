const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  endpoint: { 
    type: String, 
    required: true 
  },
  requestHash: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['IN_FLIGHT', 'COMPLETED', 'FAILED'],
    default: 'IN_FLIGHT'
  },
  responseStatus: { 
    type: Number 
  },
  responseBody: { 
    type: mongoose.Schema.Types.Mixed 
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 86400 // Auto-expire after 24 hours
  }
});

// User-scoped unique key to prevent collisions across accounts
idempotencyKeySchema.index({ key: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);
