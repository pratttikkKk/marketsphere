const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const { requireAuth, requireRole, requireApprovedSeller } = require('../middlewares/auth');

// Seller Application - Authenticated customer can apply
router.post('/apply', requireAuth, sellerController.apply);

// Check own seller profile / status
router.get('/me', requireAuth, sellerController.getProfile);

// Update own profile - Must be approved seller
router.put('/me', requireAuth, requireApprovedSeller, sellerController.updateProfile);

// Seller Operations - Strictly require approved seller status
router.get('/dashboard', requireAuth, requireApprovedSeller, sellerController.getDashboard);
router.get('/products', requireAuth, requireApprovedSeller, sellerController.getProducts);
router.get('/orders', requireAuth, requireApprovedSeller, sellerController.getOrders);

router.patch('/orders/:orderId/items/:itemId', requireAuth, requireApprovedSeller, sellerController.updateOrderStatus);
router.put('/orders/:orderId/items/:itemId', requireAuth, requireApprovedSeller, sellerController.updateOrderStatus);
router.patch('/orders/:orderId/status', requireAuth, requireApprovedSeller, sellerController.updateOrderLevelStatus);
router.put('/orders/:orderId/status', requireAuth, requireApprovedSeller, sellerController.updateOrderLevelStatus);
router.patch('/orders/:orderId/verify-payment', requireAuth, requireApprovedSeller, sellerController.verifyOrderPayment);
router.patch('/orders/:orderId/mark-paid', requireAuth, requireApprovedSeller, sellerController.markOrderAsPaid);

// Admin moderation of sellers
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), sellerController.moderateSeller);

module.exports = router;