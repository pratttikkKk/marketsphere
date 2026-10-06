const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/', requireAuth, requireRole('CUSTOMER', 'SELLER'), wishlistController.getWishlist);
router.post('/toggle', requireAuth, requireRole('CUSTOMER', 'SELLER'), wishlistController.toggleWishlist);

module.exports = router;