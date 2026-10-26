const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectTestDb = async () => {
  if (process.env.MONGO_URI) {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    return;
  }
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoServer.getUri());
  }
};

const disconnectTestDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    try {
      await mongoServer.stop();
    } catch (e) {
      // Ignore cleanup error if already stopped
    }
    mongoServer = null;
  }
};

const clearDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  }
};

module.exports = { connectTestDb, disconnectTestDb, clearDatabase };
