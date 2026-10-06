const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.post('/', requireAuth, requireRole('CUSTOMER', 'SELLER'), reviewController.addReview);
router.put('/:id', requireAuth, requireRole('CUSTOMER', 'SELLER'), reviewController.updateReview);

module.exports = router;