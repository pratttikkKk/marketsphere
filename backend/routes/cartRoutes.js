const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth, requireRole('CUSTOMER', 'SELLER'));
router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.put('/items/:productId', cartController.updateItem);
router.delete('/items/:productId', cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;