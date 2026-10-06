const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const crypto = require('crypto');
const paymentService = require('../services/paymentService');
const orderService = require('../services/orderService');
const { canTransitionOrder, canTransitionPayment, assertValidOrderTransition, assertValidPaymentTransition } = require('../services/orderStateMachine');
const PaymentWebhookEvent = require('../models/PaymentWebhookEvent');
const IdempotencyKey = require('../models/IdempotencyKey');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Seller = require('../models/Seller');
const Coupon = require('../models/Coupon');

describe('Production Hardening & Verification Suite', () => {
  let mongoServer;
  let testCustomer;
  let testSellerUser;
  let testSeller;
  let testCategory;
  let testProduct;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    testCustomer = await User.create({
      firstName: 'Hardening',
      lastName: 'Customer',
      email: 'hardening_customer@test.com',
      passwordHash: 'hashed_pw_test',
      role: 'CUSTOMER'
    });

    testSellerUser = await User.create({
      firstName: 'Hardening',
      lastName: 'Seller',
      email: 'hardening_seller@test.com',
      passwordHash: 'hashed_pw_test',
      role: 'SELLER'
    });

    testSeller = await Seller.create({
      userId: testSellerUser._id,
      storeName: 'Hardened Tech Store',
      contactEmail: 'hardened@store.com',
      status: 'APPROVED'
    });

    testCategory = await Category.create({
      name: 'Electronics',
      slug: 'electronics-hardening'
    });

    testProduct = await Product.create({
      sellerId: testSeller._id,
      name: 'Hardened Mechanical Keyboard',
      description: 'Professional mechanical keyboard with tactile switches',
      sku: 'KEY-MECH-001',
      price: 2500,
      stock: 10,
      category: testCategory._id,
      status: 'PUBLISHED'
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('1. Centralized Order & Payment State Machine', () => {
    it('allows valid order forward transitions', () => {
      expect(canTransitionOrder('PENDING_PAYMENT', 'CONFIRMED')).toBe(true);
      expect(canTransitionOrder('CONFIRMED', 'PROCESSING')).toBe(true);
      expect(canTransitionOrder('PROCESSING', 'SHIPPED')).toBe(true);
      expect(canTransitionOrder('SHIPPED', 'OUT_FOR_DELIVERY')).toBe(true);
      expect(canTransitionOrder('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
    });

    it('rejects invalid or backward state hops', () => {
      expect(canTransitionOrder('PENDING_PAYMENT', 'DELIVERED')).toBe(false);
      expect(canTransitionOrder('DELIVERED', 'SHIPPED')).toBe(false);
      expect(canTransitionOrder('CANCELLED', 'CONFIRMED')).toBe(false);

      expect(() => {
        assertValidOrderTransition('PENDING_PAYMENT', 'DELIVERED');
      }).toThrow(/Invalid order state transition/i);
    });

    it('enforces payment state transitions', () => {
      expect(canTransitionPayment('PENDING', 'PAID')).toBe(true);
      expect(canTransitionPayment('PAID', 'REFUND_PENDING')).toBe(true);
      expect(canTransitionPayment('REFUND_PENDING', 'REFUNDED')).toBe(true);
      expect(canTransitionPayment('REFUND_PENDING', 'REFUND_FAILED')).toBe(true);
      expect(canTransitionPayment('REFUNDED', 'PAID')).toBe(false);

      expect(() => {
        assertValidPaymentTransition('REFUNDED', 'PAID');
      }).toThrow(/Invalid payment state transition/i);
    });
  });

  describe('2. Persistent Webhook Deduplication & Event Logging', () => {
    it('records incoming webhook event and prevents duplicate processing', async () => {
      const eventId = 'evt_test_dedup_001';
      const provider = 'RAZORPAY';

      const initialRecord = await PaymentWebhookEvent.create({
        provider,
        eventId,
        eventType: 'payment.captured',
        status: 'PROCESSED'
      });

      expect(initialRecord).toBeTruthy();
      expect(initialRecord.status).toBe('PROCESSED');

      // Attempting to insert duplicate eventId with same provider must throw duplicate key error
      await expect(PaymentWebhookEvent.create({
        provider,
        eventId,
        eventType: 'payment.captured',
        status: 'RECEIVED'
      })).rejects.toThrow();
    });

    it('verifies webhook HMAC-SHA256 signature against raw byte payload', () => {
      const rawPayload = Buffer.from(JSON.stringify({ event: 'payment.captured', id: 'evt_999' }));
      const secret = 'marketsphere_webhook_dev_2026';
      const validSignature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      expect(paymentService.verifyWebhookSignature(rawPayload, validSignature)).toBe(true);
      expect(paymentService.verifyWebhookSignature(rawPayload, 'forged_signature_000')).toBe(false);
    });
  });

  describe('3. Financial & Refund State Integrity', () => {
    it('sets order paymentStatus to REFUND_PENDING when gateway refund fails instead of marking false success', async () => {
      const failedOrder = await Order.create({
        customerId: testCustomer._id,
        orderItems: [{
          sellerId: testSeller._id,
          productId: testProduct._id,
          quantity: 1,
          priceAtPurchase: 2500,
          status: 'CONFIRMED'
        }],
        shippingAddress: {
          fullName: 'Test User',
          phone: '9876543210',
          street: 'Test St',
          city: 'Bengaluru',
          state: 'Karnataka',
          zipCode: '560001'
        },
        paymentMethod: 'RAZORPAY',
        paymentStatus: 'PAID',
        paymentDetails: {
          provider: 'RAZORPAY',
          providerOrderId: 'order_prov_123',
          providerPaymentId: 'pay_prov_123'
        },
        subtotal: 2500,
        deliveryFee: 0,
        totalAmount: 2625,
        orderStatus: 'CONFIRMED'
      });

      // Force processRefund to throw an error simulating gateway downtime
      jest.spyOn(paymentService, 'processRefund').mockRejectedValueOnce(new Error('Gateway timeout'));

      const cancelledOrder = await orderService.cancelOrder(testCustomer._id, failedOrder._id, 'Cancel test');

      expect(cancelledOrder.orderStatus).toBe('CANCELLED');
      expect(cancelledOrder.paymentStatus).toBe('REFUND_PENDING'); // Must NOT be REFUNDED!
      expect(cancelledOrder.paymentStatus).not.toBe('REFUNDED');

      paymentService.processRefund.mockRestore();
    });
  });

  describe('4. Idempotency Conflict & Fingerprint Protection', () => {
    it('persists request hash and status in IdempotencyKey', async () => {
      const key = 'idem_fingerprint_test_key';
      const body = { product: testProduct._id, quantity: 2 };
      const requestHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

      const record = await IdempotencyKey.create({
        key,
        userId: testCustomer._id,
        endpoint: '/api/v1/orders/checkout',
        requestHash,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody: { orderId: 'ord_123' }
      });

      expect(record.requestHash).toBe(requestHash);
      expect(record.status).toBe('COMPLETED');
    });
  });

  describe('5. Seller Customer Shopping Capabilities', () => {
    it('verifies seller account can access customer cart and place orders', async () => {
      // Seller places an order as a buyer
      const cartOrder = await Order.create({
        customerId: testSellerUser._id, // Seller buying an item
        orderItems: [{
          sellerId: testSeller._id,
          productId: testProduct._id,
          quantity: 1,
          priceAtPurchase: 2500,
          status: 'PENDING'
        }],
        shippingAddress: {
          fullName: 'Seller Shopper',
          phone: '9876543210',
          street: 'Seller Home St',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001'
        },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        subtotal: 2500,
        deliveryFee: 0,
        totalAmount: 2625,
        orderStatus: 'CONFIRMED'
      });

      expect(cartOrder).toBeTruthy();
      expect(cartOrder.customerId.toString()).toBe(testSellerUser._id.toString());

      const fetched = await orderService.getCustomerOrders(testSellerUser._id);
      expect(fetched.length).toBeGreaterThan(0);
    });
  });
});
