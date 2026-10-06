const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const idempotency = require('../middlewares/idempotency');

router.use(requireAuth, requireRole('CUSTOMER', 'SELLER'));

router.post('/checkout', idempotency, orderController.checkout);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrderDetails);
router.post('/:id/cancel', idempotency, orderController.cancelOrder);
router.post('/:id/return', idempotency, orderController.requestReturn);
router.post('/:id/submit-upi-payment', idempotency, orderController.submitUpiPayment);
router.post('/confirm-payment', idempotency, orderController.confirmPayment);
router.post('/simulate-sandbox-signature', orderController.simulateSandboxSignature);

module.exports = router;