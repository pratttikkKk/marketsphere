const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/', couponController.getCoupons);
router.use(requireAuth, requireRole('ADMIN'));
router.post('/', couponController.createCoupon);

module.exports = router;