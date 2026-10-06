const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const orderService = require('../services/orderService');
const cartService = require('../services/cartService');
const Product = require('../models/Product');
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

describe('Checkout and Orders', () => {
  let customerId = new mongoose.Types.ObjectId();
  let p1, sellerDoc;

  beforeEach(async () => {
    sellerDoc = await Seller.create({
      userId: new mongoose.Types.ObjectId(),
      storeName: 'Test Apex Store',
      contactEmail: 'apex@test.com',
      status: 'APPROVED'
    });

    const cat = await Category.create({ name: 'Cat', slug: 'cat' });
    p1 = await Product.create({ 
      sellerId: sellerDoc._id, 
      name: 'Item', 
      description: 'Desc', 
      sku: 'SKU-001', 
      price: 100, 
      category: cat._id, 
      stock: 5, 
      status: 'PUBLISHED' 
    });
  });

  const validAddress = {
    street: '123 Market Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    zipCode: '560001'
  };

  it('should successfully checkout and decrement inventory', async () => {
    await cartService.addItem(customerId, p1._id, 2);
    
    const result = await orderService.checkout(customerId, { 
      paymentMethod: 'COD', 
      shippingAddress: validAddress 
    });

    const order = result.order;
    expect(order.subtotal).toBe(200);
    expect(order.orderStatus).toBe('CONFIRMED');

    const updatedP1 = await Product.findById(p1._id);
    expect(updatedP1.stock).toBe(3); // 5 - 2
  });

  it('should securely prevent overselling when stock is insufficient during checkout', async () => {
    await cartService.addItem(customerId, p1._id, 5);
    
    // Simulate concurrent purchase stealing stock
    await Product.findByIdAndUpdate(p1._id, { $inc: { stock: -1 } }); 

    await expect(
      orderService.checkout(customerId, { 
        paymentMethod: 'COD',
        shippingAddress: validAddress
      })
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('should restore inventory on order cancellation', async () => {
    await cartService.addItem(customerId, p1._id, 1);
    const result = await orderService.checkout(customerId, { 
      paymentMethod: 'COD',
      shippingAddress: validAddress
    });
    
    await orderService.cancelOrder(customerId, result.order._id);
    
    const restoredProduct = await Product.findById(p1._id);
    expect(restoredProduct.stock).toBe(5); // Restored
  });
});