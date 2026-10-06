const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'MarketSphere API v1 - Production E-Commerce Engine' });
});

router.get('/seed-db', async (req, res) => {
  try {
    const User = require('../models/User');
    const Seller = require('../models/Seller');
    const Category = require('../models/Category');
    const Product = require('../models/Product');
    const bcrypt = require('bcryptjs');

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Admin
    let admin = await User.findOne({ email: 'admin@marketsphere.com' });
    if (!admin) {
      admin = await User.create({
        firstName: 'Platform',
        lastName: 'Admin',
        email: 'admin@marketsphere.com',
        passwordHash,
        role: 'ADMIN',
        isActive: true
      });
    }

    // 2. Customer
    let customer = await User.findOne({ email: 'customer@marketsphere.com' });
    if (!customer) {
      customer = await User.create({
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'customer@marketsphere.com',
        passwordHash,
        role: 'CUSTOMER',
        isActive: true
      });
    }

    // 3. Seller
    let sellerUser = await User.findOne({ email: 'seller@marketsphere.com' });
    if (!sellerUser) {
      sellerUser = await User.create({
        firstName: 'Priya',
        lastName: 'Patel',
        email: 'seller@marketsphere.com',
        passwordHash,
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
    }

    // 4. Category
    let category = await Category.findOne({ slug: 'electronics' });
    if (!category) {
      category = await Category.create({
        name: 'Electronics',
        slug: 'electronics',
        description: 'Gadgets and audio devices'
      });
    }

    // 5. Products
    const existingProducts = await Product.countDocuments();
    if (existingProducts === 0) {
      await Product.insertMany([
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
      ]);
    }

    res.json({
      status: 'success',
      message: 'Database seeded successfully with Admin, Seller, Customer, and 4 Products!',
      credentials: {
        admin: 'admin@marketsphere.com / password123',
        customer: 'customer@marketsphere.com / password123',
        seller: 'seller@marketsphere.com / password123'
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const sellerRoutes = require('./sellerRoutes');
const productRoutes = require('./productRoutes');
const adminRoutes = require('./adminRoutes');
const reviewRoutes = require('./reviewRoutes');
const wishlistRoutes = require('./wishlistRoutes');
const cartRoutes = require('./cartRoutes');
const orderRoutes = require('./orderRoutes');
const couponRoutes = require('./couponRoutes');
const authRoutes = require('./authRoutes');
const paymentRoutes = require('./paymentRoutes');

// Aliased mounts for robustness
router.use('/seller', sellerRoutes);
router.use('/sellers', sellerRoutes);
router.use('/products', productRoutes);
router.use('/admin', adminRoutes);
router.use('/reviews', reviewRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/wishlists', wishlistRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/coupons', couponRoutes);
router.use('/auth', authRoutes);
router.use('/payments', paymentRoutes);

module.exports = router;