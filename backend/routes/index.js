const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'MarketSphere API v1 - Production E-Commerce Engine' });
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