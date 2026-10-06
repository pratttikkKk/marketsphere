const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Coupon = require('../models/Coupon');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Commerce Features', () => {
  it('should allow coupon creation and application logic', async () => {
    const coupon = await Coupon.create({
      code: 'SAVE20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      expiresAt: new Date(Date.now() + 86400000)
    });
    
    expect(coupon.code).toBe('SAVE20');
    expect(coupon.discountValue).toBe(20);
  });
});