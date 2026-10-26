const mongoose = require('mongoose');
const wishlistService = require('../services/wishlistService');
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

describe('Wishlist Management', () => {
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  it('should add to wishlist', async () => {
    const list = await wishlistService.toggleWishlist(customerId, productId);
    expect(list.products).toContainEqual(productId);
  });

  it('should remove from wishlist if already present', async () => {
    await wishlistService.toggleWishlist(customerId, productId);
    const list = await wishlistService.toggleWishlist(customerId, productId);
    expect(list.products).not.toContainEqual(productId);
  });
});