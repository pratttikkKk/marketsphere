const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sellerService = require('../services/sellerService');

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

describe('Seller Management', () => {
  const userId = new mongoose.Types.ObjectId();
  
  it('should allow seller to create profile and default to PENDING', async () => {
    const profile = await sellerService.createProfile(userId, {
      storeName: 'Test Store',
      contactEmail: 'test@store.com'
    });
    expect(profile.storeName).toBe('Test Store');
    expect(profile.status).toBe('PENDING');
  });

  it('should prevent seller from updating their own status', async () => {
    await sellerService.createProfile(userId, { storeName: 'Store 1', contactEmail: 'test@test.com' });
    const updated = await sellerService.updateProfile(userId, { status: 'APPROVED' });
    expect(updated.status).toBe('PENDING'); // Should ignore status
  });

  it('should allow ADMIN to update seller status', async () => {
    const profile = await sellerService.createProfile(userId, { storeName: 'Store', contactEmail: 'a@a.com' });
    const updated = await sellerService.updateSellerStatus(profile._id, 'APPROVED');
    expect(updated.status).toBe('APPROVED');
  });
});