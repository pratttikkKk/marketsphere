const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Order = require('../models/Order');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const sellerDashboardService = require('../services/sellerDashboardService');

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

describe('Category Freedom, Refund Processing, & User OTP Model Suite', () => {
  test('Category Freedom: Creating a product with customCategory creates a new Category automatically', async () => {
    const sellerUser = await User.create({
      firstName: 'Custom',
      lastName: 'Seller',
      email: 'customseller@test.com',
      passwordHash: 'hash123',
      role: 'SELLER',
      isActive: true,
      isEmailVerified: true
    });

    const seller = await Seller.create({
      userId: sellerUser._id,
      storeName: 'Handicrafts Emporium',
      storeDescription: 'Authentic handmade items',
      contactEmail: 'customseller@test.com',
      upiId: 'handicraft@okhdfcbank',
      status: 'APPROVED'
    });

    const product = await productService.createProduct(sellerUser._id, {
      name: 'Handcrafted Clay Pot',
      description: 'Earthen pot handmade with clay',
      price: 499,
      stock: 20,
      customCategory: 'Handmade Crafts & Pottery',
      sellerUpiId: 'handicraft@okhdfcbank'
    });

    expect(product).toBeDefined();
    expect(product.category).toBeDefined();

    const createdCategory = await Category.findById(product.category);
    expect(createdCategory).toBeDefined();
    expect(createdCategory.name).toBe('Handmade Crafts & Pottery');
    expect(createdCategory.slug).toContain('handmade-crafts');
  });

  test('Refund Handling: Order cancellation records customerRefundUpi and sets REFUND_PENDING for UPI orders', async () => {
    const customer = await User.create({
      firstName: 'Amit',
      lastName: 'Kumar',
      email: 'amit@test.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      isActive: true,
      isEmailVerified: true
    });

    const sellerUser = await User.create({
      firstName: 'Pooja',
      lastName: 'Verma',
      email: 'pooja@test.com',
      passwordHash: 'hash',
      role: 'SELLER',
      isActive: true,
      isEmailVerified: true
    });

    const seller = await Seller.create({
      userId: sellerUser._id,
      storeName: 'Pooja Organic Goods',
      contactEmail: 'pooja@test.com',
      upiId: 'pooja@upi',
      status: 'APPROVED'
    });

    const category = await Category.create({ name: 'Groceries', slug: 'groceries' });

    const product = await Product.create({
      sellerId: seller._id,
      name: 'Organic Honey',
      description: 'Pure wild honey',
      sku: 'HONEY-01',
      price: 350,
      stock: 50,
      category: category._id,
      status: 'PUBLISHED'
    });

    const order = await Order.create({
      customerId: customer._id,
      orderItems: [{
        productId: product._id,
        sellerId: seller._id,
        quantity: 2,
        priceAtPurchase: 350,
        status: 'CONFIRMED'
      }],
      shippingAddress: {
        fullName: 'Amit Kumar',
        phone: '9876543210',
        street: '12 MG Road',
        city: 'Pune',
        state: 'Maharashtra',
        zipCode: '411001'
      },
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      orderStatus: 'CONFIRMED',
      paymentDetails: {
        provider: 'UPI',
        providerOrderId: 'order_upi_12345',
        providerPaymentId: 'order_upi_payment',
        paidAt: new Date()
      },
      subtotal: 700,
      tax: 35,
      deliveryFee: 0,
      totalAmount: 735
    });

    // Customer cancels order with customerRefundUpi
    const cancelledOrder = await orderService.cancelOrder(
      customer._id,
      order._id,
      'Product no longer needed',
      'amitkumar@okhdfcbank'
    );

    expect(cancelledOrder.orderStatus).toBe('CANCELLED');
    expect(cancelledOrder.paymentStatus).toBe('REFUND_PENDING');
    expect(cancelledOrder.paymentDetails.customerRefundUpi).toBe('amitkumar@okhdfcbank');

    // Stock was restored
    const updatedProd = await Product.findById(product._id);
    expect(updatedProd.stock).toBe(52);

    // Seller processes the refund via sellerDashboardService
    const refundedOrder = await sellerDashboardService.processOrderRefund(
      sellerUser._id,
      order._id,
      {
        refundUtr: '987654321012',
        refundAmount: 735,
        notes: 'Transferred via PhonePe'
      }
    );

    expect(refundedOrder.paymentStatus).toBe('REFUNDED');
    expect(refundedOrder.paymentDetails.refundUtr).toBe('987654321012');
    expect(refundedOrder.paymentDetails.refundAmount).toBe(735);
    expect(refundedOrder.paymentDetails.refundMethod).toBe('SELLER_DIRECT_UPI');
  });

  test('User Email OTP Model: User fields store OTP and verification state accurately', async () => {
    const user = await User.create({
      firstName: 'Rohan',
      lastName: 'Mehta',
      email: 'rohan@test.com',
      passwordHash: 'hashedpwd',
      role: 'CUSTOMER',
      isActive: true,
      isEmailVerified: false,
      emailOtp: '849201',
      emailOtpExpires: new Date(Date.now() + 10 * 60 * 1000)
    });

    expect(user.isEmailVerified).toBe(false);
    expect(user.emailOtp).toBe('849201');
    expect(user.emailOtpExpires.getTime()).toBeGreaterThan(Date.now());
  });
});
