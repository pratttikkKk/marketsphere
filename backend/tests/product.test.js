const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const productService = require('../services/productService');
const Seller = require('../models/Seller');
const Category = require('../models/Category');

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

describe('Product Management', () => {
  let categoryId, approvedSellerId, unapprovedSellerId;
  const approvedUserId = new mongoose.Types.ObjectId();
  const unapprovedUserId = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    const cat = await Category.create({ name: 'Electronics', slug: 'electronics' });
    categoryId = cat._id;

    const s1 = await Seller.create({ userId: approvedUserId, storeName: 'Appr Store', contactEmail: 'a@a.com', status: 'APPROVED' });
    approvedSellerId = s1._id;

    await Seller.create({ userId: unapprovedUserId, storeName: 'Pend Store', contactEmail: 'p@p.com', status: 'PENDING' });
  });

  it('should prevent unapproved sellers from creating products', async () => {
    await expect(
      productService.createProduct(unapprovedUserId, { name: 'Item', description: 'desc', sku: 'SKU1', price: 10, category: categoryId })
    ).rejects.toThrow(/Only APPROVED sellers can publish products|Only approved sellers can create products/i);
  });

  it('should allow approved sellers to create products defaulting to PENDING_MODERATION', async () => {
    const p = await productService.createProduct(approvedUserId, { name: 'Item', description: 'desc', sku: 'SKU2', price: 10, category: categoryId });
    expect(p.name).toBe('Item');
    expect(p.status).toBe('PENDING_MODERATION');
  });

  it('should strictly enforce ownership: seller cannot update another sellers product', async () => {
    const p = await productService.createProduct(approvedUserId, { name: 'My Item', description: 'desc', sku: 'SKU3', price: 10, category: categoryId });
    
    const anotherApprovedUserId = new mongoose.Types.ObjectId();
    await Seller.create({ userId: anotherApprovedUserId, storeName: 'Another Store', contactEmail: 'b@b.com', status: 'APPROVED' });
    
    await expect(
      productService.updateProduct(anotherApprovedUserId, p._id, { price: 20 })
    ).rejects.toThrow('Product not found or unauthorized');
  });
});