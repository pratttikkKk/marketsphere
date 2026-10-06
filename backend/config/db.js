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
    const Seller = require('../models/Seller');
    const Category = require('../models/Category');
    const Product = require('../models/Product');
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
    let category = await Category.findOne({ slug: 'electronics' });
    if (!category) {
      const initialCategories = [
        { name: 'Electronics', slug: 'electronics', description: 'Gadgets, devices, and accessories' },
        { name: 'Fashion & Apparel', slug: 'fashion-apparel', description: 'Clothing, footwear, and style' },
        { name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Furniture, kitchenware, and decor' },
        { name: 'Books & Stationery', slug: 'books-stationery', description: 'Novels, academic texts, and art supplies' }
      ];
      const created = await Category.insertMany(initialCategories);
      category = created[0];
      console.log('[BOOTSTRAP] Populated initial product categories');
    }

    // 3. Ensure demo Customer exists
    let customer = await User.findOne({ email: 'customer@marketsphere.com' });
    if (!customer) {
      const custHash = await bcrypt.hash('password123', 10);
      customer = await User.create({
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'customer@marketsphere.com',
        passwordHash: custHash,
        role: 'CUSTOMER',
        isActive: true
      });
      console.log('[BOOTSTRAP] Created demo customer: customer@marketsphere.com / password123');
    }

    // 4. Ensure demo Seller exists
    let sellerUser = await User.findOne({ email: 'seller@marketsphere.com' });
    if (!sellerUser) {
      const sellerHash = await bcrypt.hash('password123', 10);
      sellerUser = await User.create({
        firstName: 'Priya',
        lastName: 'Patel',
        email: 'seller@marketsphere.com',
        passwordHash: sellerHash,
        role: 'SELLER',
        isActive: true
      });
    }

    let sellerProfile = await Seller.findOne({ userId: sellerUser._id });
    if (!sellerProfile) {
      sellerProfile = await Seller.create({
        userId: sellerUser._id,
        storeName: 'Tech Haven',
        storeDescription: 'Premium electronics and audio equipment',
        contactEmail: 'seller@marketsphere.com',
        upiId: 'techstore@okhdfcbank',
        status: 'APPROVED'
      });
      console.log('[BOOTSTRAP] Created demo seller: seller@marketsphere.com / password123 (Tech Haven)');
    }

    // 5. Ensure initial published products exist if none exist
    const productCount = await Product.countDocuments();
    if (productCount === 0 && category && sellerProfile) {
      const initialProducts = [
        {
          sellerId: sellerProfile._id,
          name: 'Pro ANC Wireless Headphones',
          description: 'High fidelity audio with active noise cancellation and 40h battery life.',
          sku: 'ANC-WH-100',
          price: 199.99,
          category: category._id,
          stock: 45,
          status: 'PUBLISHED',
          sellerUpiId: 'techstore@okhdfcbank',
          images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80']
        },
        {
          sellerId: sellerProfile._id,
          name: 'Smart AMOLED Fitness Watch',
          description: 'Precision heart-rate tracking, SpO2 sensor, and GPS tracking.',
          sku: 'SMT-WCH-200',
          price: 149.50,
          category: category._id,
          stock: 30,
          status: 'PUBLISHED',
          sellerUpiId: 'techstore@okhdfcbank',
          images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80']
        },
        {
          sellerId: sellerProfile._id,
          name: '4K Ultra HD Action Camera',
          description: 'Waterproof sports action camera with dual screen and optical stabilization.',
          sku: 'ACT-CAM-4K',
          price: 249.00,
          category: category._id,
          stock: 20,
          status: 'PUBLISHED',
          sellerUpiId: 'techstore@okhdfcbank',
          images: ['https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&q=80']
        },
        {
          sellerId: sellerProfile._id,
          name: 'Portable Bluetooth 360 Speaker',
          description: 'Rich bass, IPX7 waterproof rating, and 24h continuous playtime.',
          sku: 'BTS-SPK-360',
          price: 79.99,
          category: category._id,
          stock: 60,
          status: 'PUBLISHED',
          sellerUpiId: 'techstore@okhdfcbank',
          images: ['https://images.unsplash.com/photo-1608043152269-4171691a52b8?w=500&q=80']
        }
      ];
      await Product.insertMany(initialProducts);
      console.log('[BOOTSTRAP] Populated 4 initial marketplace products');
    }
  } catch (err) {
    console.error('[BOOTSTRAP] Warning during auto-provisioning:', err.message);
  }
}

module.exports = connectDB;