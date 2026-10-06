const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const IdempotencyKey = require('../models/IdempotencyKey');
const { requireAuth, requireRole, requireApprovedSeller, getJwtSecret } = require('../middlewares/auth');
const productService = require('../services/productService');
const paymentService = require('../services/paymentService');
const orderService = require('../services/orderService');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany();
});

describe('Security & RBAC Enforcement Suite', () => {
  let customerUser, sellerUser, adminUser, suspendedUser;
  let category, approvedSeller, pendingSeller;

  beforeEach(async () => {
    category = await Category.create({ name: 'Security Cat', slug: 'security-cat' });

    customerUser = await User.create({
      firstName: 'Customer',
      lastName: 'One',
      email: 'customer@test.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      isActive: true
    });

    sellerUser = await User.create({
      firstName: 'Seller',
      lastName: 'One',
      email: 'seller@test.com',
      passwordHash: 'hash',
      role: 'SELLER',
      isActive: true
    });

    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'One',
      email: 'admin@test.com',
      passwordHash: 'hash',
      role: 'ADMIN',
      isActive: true
    });

    suspendedUser = await User.create({
      firstName: 'Suspended',
      lastName: 'User',
      email: 'suspended@test.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      isActive: false
    });

    approvedSeller = await Seller.create({
      userId: sellerUser._id,
      storeName: 'Approved Store',
      contactEmail: 'seller@test.com',
      status: 'APPROVED'
    });

    const pendingSellerUser = await User.create({
      firstName: 'Pending',
      lastName: 'Seller',
      email: 'pending@seller.com',
      passwordHash: 'hash',
      role: 'SELLER',
      isActive: true
    });

    pendingSeller = await Seller.create({
      userId: pendingSellerUser._id,
      storeName: 'Pending Store',
      contactEmail: 'pending@seller.com',
      status: 'PENDING'
    });
  });

  // Mock express res helper
  const createMockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
  };

  describe('1. Authentication & Active State Checks', () => {
    it('should reject unauthenticated request with 401', async () => {
      const req = { headers: {} };
      const res = createMockRes();
      const next = jest.fn();

      await requireAuth(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject suspended/inactive users with 403', async () => {
      const token = jwt.sign({ id: suspendedUser._id, role: suspendedUser.role }, getJwtSecret());
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      const next = jest.fn();

      await requireAuth(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/deactivated or suspended/i);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('2. RBAC Middleware Boundaries', () => {
    it('CUSTOMER attempting ADMIN access is rejected with 403', () => {
      const req = { user: customerUser };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = requireRole('ADMIN');
      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('SELLER attempting ADMIN access is rejected with 403', () => {
      const req = { user: sellerUser };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = requireRole('ADMIN');
      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('ADMIN accessing ADMIN route is allowed', () => {
      const req = { user: adminUser };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = requireRole('ADMIN');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('Unapproved (PENDING) seller cannot access seller endpoints', async () => {
      const pendingSellerUser = await User.findOne({ email: 'pending@seller.com' });
      const req = { user: pendingSellerUser };
      const res = createMockRes();
      const next = jest.fn();

      await requireApprovedSeller(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(res.body.sellerStatus).toBe('PENDING');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('3. Catalog Privacy & Non-Published Protection', () => {
    it('public users cannot view DRAFT or PENDING_MODERATION products (returns 404)', async () => {
      const draftProduct = await Product.create({
        sellerId: approvedSeller._id,
        name: 'Secret Prototype',
        description: 'Unpublished item',
        sku: 'SECRET-001',
        price: 500,
        category: category._id,
        stock: 10,
        status: 'PENDING_MODERATION'
      });

      // Public / guest request
      await expect(
        productService.getProductDetails(draftProduct._id, null)
      ).rejects.toThrow('Product not found');

      // Random customer request
      await expect(
        productService.getProductDetails(draftProduct._id, customerUser)
      ).rejects.toThrow('Product not found');
    });

    it('owning seller CAN preview their own unpublished product', async () => {
      const draftProduct = await Product.create({
        sellerId: approvedSeller._id,
        name: 'Vendor Preview Product',
        description: 'Unpublished item',
        sku: 'VENDOR-001',
        price: 500,
        category: category._id,
        stock: 10,
        status: 'PENDING_MODERATION'
      });

      const details = await productService.getProductDetails(draftProduct._id, sellerUser);
      expect(details.name).toBe('Vendor Preview Product');
    });
  });

  describe('4. Mass Assignment Protection', () => {
    it('seller cannot overwrite sellerId or force status = PUBLISHED on product update', async () => {
      const product = await Product.create({
        sellerId: approvedSeller._id,
        name: 'Honest Product',
        description: 'Orig desc',
        sku: 'HONEST-001',
        price: 100,
        category: category._id,
        stock: 5,
        status: 'PENDING_MODERATION',
        averageRating: 0
      });

      const maliciousPayload = {
        name: 'Updated Name',
        price: 120,
        sellerId: new mongoose.Types.ObjectId(), // Malicious seller spoof
        status: 'PUBLISHED',                    // Malicious moderation bypass
        averageRating: 5.0                      // Malicious fake rating injection
      };

      const updated = await productService.updateProduct(sellerUser._id, product._id, maliciousPayload);

      expect(updated.name).toBe('Updated Name');
      expect(updated.price).toBe(120);
      expect(updated.sellerId.toString()).toBe(approvedSeller._id.toString()); // Preserved
      expect(updated.status).toBe('PENDING_MODERATION');                       // Not allowed to publish
      expect(updated.averageRating).toBe(0);                                  // Cannot alter rating
    });
  });

  describe('5. Cryptographic Payment Verification', () => {
    it('should verify genuine HMAC SHA256 signature and reject tampered signature', () => {
      const orderId = 'order_test_12345';
      const paymentId = 'pay_test_67890';
      const validSignature = paymentService.generateSandboxSignature(orderId, paymentId);

      // Verify valid signature
      const isValid = paymentService.verifyPaymentSignature({
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSignature
      });
      expect(isValid).toBe(true);

      // Verify tampered signature
      const isTampered = paymentService.verifyPaymentSignature({
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        providerSignature: 'tampered_signature_99999999999999999999999999999999'
      });
      expect(isTampered).toBe(false);
    });
  });

  describe('6. Idempotency Tracking', () => {
    it('should cache and deduplicate responses with identical idempotency key', async () => {
      const key = 'idem_key_unique_123';
      const resBody = { orderId: 'ord_1', total: 500 };

      await IdempotencyKey.create({
        key,
        userId: customerUser._id,
        endpoint: '/api/v1/orders/checkout',
        responseStatus: 201,
        responseBody: resBody
      });

      const cached = await IdempotencyKey.findOne({ key, userId: customerUser._id });
      expect(cached).toBeTruthy();
      expect(cached.responseBody.orderId).toBe('ord_1');
    });
  });
});
