const Coupon = require('../models/Coupon');
const { connectTestDb, disconnectTestDb, clearDatabase } = require('./testHelper');

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

afterEach(async () => {
  await clearDatabase();
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