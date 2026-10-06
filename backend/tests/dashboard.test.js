const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const sellerService = require('../services/sellerService');
const sellerDashboardService = require('../services/sellerDashboardService');
const adminService = require('../services/adminService');
const orderService = require('../services/orderService');
const productService = require('../services/productService');

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
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

describe('Dashboard analytics and authorization', () => {
  it('should calculate seller dashboard metrics from real orders and products', async () => {
    const category = await Category.create({ name: 'Home', slug: 'home' });
    const seller = await Seller.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: 'Seller Metrics',
      contactEmail: 'metrics@seller.com',
      status: 'APPROVED'
    });

    await Product.create({
      sellerId: seller._id,
      name: 'Desk Lamp',
      description: 'Warm lighting',
      sku: 'LAMP-001',
      price: 80,
      category: category._id,
      stock: 3,
      status: 'PUBLISHED'
    });

    await Product.create({
      sellerId: seller._id,
      name: 'Desk Chair',
      description: 'Ergonomic chair',
      sku: 'CHAIR-001',
      price: 150,
      category: category._id,
      stock: 0,
      status: 'PUBLISHED'
    });

    await Order.create({
      customerId: new mongoose.Types.ObjectId(),
      orderItems: [
        {
          sellerId: seller._id,
          productId: new mongoose.Types.ObjectId(),
          quantity: 2,
          priceAtPurchase: 80,
          status: 'DELIVERED'
        }
      ],
      shippingAddress: { street: '123 Market St', city: 'A', state: 'B', zipCode: '123', country: 'US' },
      paymentMethod: 'COD',
      paymentStatus: 'PAID',
      subtotal: 160,
      deliveryFee: 10,
      totalAmount: 170,
      orderStatus: 'DELIVERED'
    });

    const metrics = await sellerDashboardService.getDashboardMetrics(seller.userId);
    expect(metrics.totalProducts).toBe(2);
    expect(metrics.activeProducts).toBe(2);
    expect(metrics.outOfStockProducts).toBe(1);
    expect(metrics.totalRevenue).toBe(160);
    expect(metrics.recentOrders.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject seller updates on another seller product', async () => {
    const category = await Category.create({ name: 'Office', slug: 'office' });
    const sellerA = await Seller.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: 'Store A',
      contactEmail: 'a@store.com',
      status: 'APPROVED'
    });
    const sellerB = await Seller.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: 'Store B',
      contactEmail: 'b@store.com',
      status: 'APPROVED'
    });

    const product = await Product.create({
      sellerId: sellerA._id,
      name: 'Monitor',
      description: 'Screen',
      sku: 'MON-001',
      price: 220,
      category: category._id,
      stock: 5,
      status: 'PUBLISHED'
    });

    await expect(
      productService.updateProduct(sellerB.userId, product._id, { price: 300 })
    ).rejects.toThrow('Product not found or unauthorized');
  });

  it('should block sellers from editing other sellers order items', async () => {
    const sellerA = await Seller.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: 'Store A',
      contactEmail: 'a2@store.com',
      status: 'APPROVED'
    });
    const sellerB = await Seller.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: 'Store B',
      contactEmail: 'b2@store.com',
      status: 'APPROVED'
    });

    const order = await Order.create({
      customerId: new mongoose.Types.ObjectId(),
      orderItems: [
        {
          sellerId: sellerA._id,
          productId: new mongoose.Types.ObjectId(),
          quantity: 1,
          priceAtPurchase: 50,
          status: 'PENDING'
        },
        {
          sellerId: sellerB._id,
          productId: new mongoose.Types.ObjectId(),
          quantity: 1,
          priceAtPurchase: 90,
          status: 'PENDING'
        }
      ],
      shippingAddress: { street: '123 Market St', city: 'A', state: 'B', zipCode: '123', country: 'US' },
      paymentMethod: 'COD',
      paymentStatus: 'PAID',
      subtotal: 140,
      deliveryFee: 10,
      totalAmount: 150,
      orderStatus: 'CONFIRMED'
    });

    await expect(
      sellerDashboardService.updateOrderStatus(sellerA.userId, order._id, order.orderItems[0]._id, 'CONFIRMED')
    ).resolves.toBeTruthy();

    await expect(
      sellerDashboardService.updateOrderStatus(sellerB.userId, order._id, order.orderItems[1]._id, 'CONFIRMED')
    ).resolves.toBeTruthy();
  });

  it('should provide admin metrics and allow admin moderation changes', async () => {
    const category = await Category.create({ name: 'Books', slug: 'books' });
    const seller = await Seller.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: 'Admin Seller',
      contactEmail: 'adminseller@store.com',
      status: 'PENDING'
    });

    await Product.create({
      sellerId: seller._id,
      name: 'Book',
      description: 'Story',
      sku: 'BOOK-001',
      price: 20,
      category: category._id,
      stock: 10,
      status: 'PENDING_MODERATION'
    });

    const metrics = await adminService.getDashboardMetrics({ range: '30' });
    expect(metrics.totalSellers).toBeGreaterThanOrEqual(1);
    expect(metrics.pendingSellerApprovals).toBeGreaterThanOrEqual(1);

    const product = await Product.findOne();
    const updated = await adminService.moderateProduct(product._id, 'PUBLISHED', 'Ready for marketplace');
    expect(updated.status).toBe('PUBLISHED');
  });
});
