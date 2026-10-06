const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireAuth, requireRole, requireApprovedSeller, optionalAuth } = require('../middlewares/auth');

const upload = require('../middlewares/upload');

// Public Discovery Routes (Public only sees PUBLISHED; authenticated owners/admins can inspect their drafts)
router.get('/', productController.searchProducts);
router.get('/categories', productController.listCategories);
router.get('/:id', optionalAuth, productController.getProductDetails);

// Seller Management Routes - Strictly require APPROVED seller status
router.post('/', requireAuth, requireApprovedSeller, upload.array('images', 5), productController.createProduct);
router.put('/:id', requireAuth, requireApprovedSeller, upload.array('images', 5), productController.updateProduct);

// Admin Moderation Routes
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), productController.moderateProduct);

module.exports = router;