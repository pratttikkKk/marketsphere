const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.get('/seller-applications', adminController.listSellerApplications);
router.get('/moderation', adminController.getModerationQueue);
router.get('/orders', adminController.getOrders);
router.patch('/orders/:orderId/returns', adminController.handleReturn);
router.patch('/orders/:orderId/tracking', adminController.updateTracking);
router.get('/categories', adminController.listCategories);
router.post('/categories', adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);
router.patch('/sellers/:id/status', adminController.updateSellerStatus);
router.patch('/products/:id/moderate', adminController.moderateProduct);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
