const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoUri = (process.env.MONGO_URI || 'mongodb://localhost:27017/marketsphere').trim();
    // Strip accidental surrounding single or double quotes from environment variables
    if ((mongoUri.startsWith('"') && mongoUri.endsWith('"')) || (mongoUri.startsWith("'") && mongoUri.endsWith("'"))) {
      mongoUri = mongoUri.slice(1, -1).trim();
    }
    const conn = await mongoose.connect(mongoUri);
    console.log('MongoDB Connected: ' + conn.connection.host);

    // Auto-bootstrap Admin and essential categories if fresh database
    await autoBootstrapDatabase();
  } catch (error) {
    console.error('Error connecting to MongoDB: ' + error.message);
    if (error.code === 'EBADNAME' || error.message.includes('EBADNAME')) {
      console.error('\n[DIAGNOSTIC] EBADNAME indicates the host in MONGO_URI is malformed.');
      console.error('[DIAGNOSTIC] Ensure your Render MONGO_URI has no unreplaced placeholders (e.g. "..."), no extra spaces, and URL-encode special characters in the password.');
    }
    process.exit(1);
  }
};

async function autoBootstrapDatabase() {
  try {
    const User = require('../models/User');
    const Category = require('../models/Category');
    const bcrypt = require('bcryptjs');

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@marketsphere.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';

    // 1. Ensure Admin exists
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      admin = await User.create({
        firstName: 'Platform',
        lastName: 'Admin',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        isActive: true
      });
      console.log(`[BOOTSTRAP] Successfully created default ADMIN user: ${adminEmail} (password: ${adminPassword})`);
    } else if (admin.role !== 'ADMIN') {
      admin.role = 'ADMIN';
      admin.isActive = true;
      await admin.save();
      console.log(`[BOOTSTRAP] Promoted existing account to ADMIN: ${adminEmail}`);
    }

    // 2. Ensure initial categories exist if database is fresh
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      const initialCategories = [
        { name: 'Electronics', slug: 'electronics', description: 'Gadgets, devices, and accessories' },
        { name: 'Fashion & Apparel', slug: 'fashion-apparel', description: 'Clothing, footwear, and style' },
        { name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Furniture, kitchenware, and decor' },
        { name: 'Books & Stationery', slug: 'books-stationery', description: 'Novels, academic texts, and art supplies' }
      ];
      await Category.insertMany(initialCategories);
      console.log('[BOOTSTRAP] Populated initial product categories');
    }
  } catch (err) {
    console.error('[BOOTSTRAP] Warning during auto-provisioning:', err.message);
  }
}

module.exports = connectDB;