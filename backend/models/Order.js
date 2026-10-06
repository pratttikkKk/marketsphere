const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  priceAtPurchase: { type: Number, required: true, min: 0 },
  status: { 
    type: String, 
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'],
    default: 'PENDING'
  },
  carrier: { type: String, default: null },
  trackingNumber: { type: String, default: null },
  shippedAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null }
});

const timelineSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: { type: String, default: '' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idempotencyKey: { type: String, sparse: true, index: true },
  orderItems: [orderItemSchema],
  shippingAddress: {
    fullName: { type: String },
    phone: { type: String },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  paymentMethod: { 
    type: String, 
    enum: ['COD', 'RAZORPAY', 'SANDBOX', 'UPI', 'CARD'], 
    required: true 
  },
  paymentStatus: { 
    type: String, 
    enum: ['PENDING', 'AUTHORIZED', 'PENDING_SELLER_CONFIRMATION', 'PAID', 'FAILED', 'REFUND_PENDING', 'REFUND_FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'], 
    default: 'PENDING' 
  },
  paymentDetails: {
    provider: { type: String, default: 'SANDBOX' },
    providerOrderId: { type: String, default: null },
    providerPaymentId: { type: String, default: null },
    providerSignature: { type: String, default: null },
    sellerUpiId: { type: String, default: null },
    sellerUpiQr: { type: String, default: null },
    utrNumber: { type: String, default: null },
    senderUpiId: { type: String, default: null },
    paidAmount: { type: Number, default: 0 },
    submittedAt: { type: Date, default: null },
    verifiedBySellerAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    refundId: { type: String, default: null },
    refundAmount: { type: Number, default: 0 },
    refundedAt: { type: Date, default: null }
  },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  couponCode: { type: String, default: null },
  tax: { type: Number, default: 0, min: 0 },
  deliveryFee: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  orderStatus: { 
    type: String, 
    enum: [
      'PENDING_PAYMENT', 
      'PAID', 
      'CONFIRMED', 
      'PROCESSING', 
      'SHIPPED', 
      'OUT_FOR_DELIVERY', 
      'DELIVERED', 
      'COMPLETED', 
      'CANCELLED',
      'RETURN_REQUESTED',
      'RETURN_APPROVED',
      'RETURNED',
      'REFUNDED'
    ],
    default: 'PENDING_PAYMENT'
  },
  carrier: { type: String, default: null },
  trackingNumber: { type: String, default: null },
  estimatedDelivery: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  cancellationReason: { type: String, default: null },
  returnReason: { type: String, default: null },
  timeline: [timelineSchema]
}, { timestamps: true });

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ 'orderItems.sellerId': 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'paymentDetails.providerOrderId': 1 });

module.exports = mongoose.model('Order', orderSchema);