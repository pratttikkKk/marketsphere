const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const wishlistService = require('../services/wishlistService');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Wishlist Management', () => {
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  it('should add to wishlist', async () => {
    const list = await wishlistService.toggleWishlist(customerId, productId);
    expect(list.products).toContainEqual(productId);
  });

  it('should remove from wishlist if already present', async () => {
    const list = await wishlistService.toggleWishlist(customerId, productId);
    expect(list.products).not.toContainEqual(productId);
  });
});