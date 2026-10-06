const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', requireAuth, authController.getMe);
router.post('/change-password', requireAuth, authController.changePassword);
router.put('/profile', requireAuth, authController.updateProfile);
router.post('/addresses', requireAuth, authController.addAddress);
router.delete('/addresses/:addressId', requireAuth, authController.deleteAddress);

module.exports = router;
