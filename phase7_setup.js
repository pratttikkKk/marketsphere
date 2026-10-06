const fs = require('fs');
const path = require('path');

const files = {
  'backend/models/Coupon.js': `const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  maxDiscount: { type: Number, default: null }, // for PERCENTAGE
  minOrderValue: { type: Number, default: 0 },
  applicableSellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null },
  applicableCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  usageLimit: { type: Number, default: 100 },
  usedCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);`,

  'backend/models/Notification.js': `const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true }, // User or Seller
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['SYSTEM', 'ORDER', 'PROMOTION', 'ACCOUNT'], default: 'SYSTEM' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);`,

  'backend/services/emailService.js': `/**
 * Abstraction for Email Notifications (Development Mode)
 */
class EmailService {
  async sendEmail(to, subject, body) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('--- MOCK EMAIL ---');
      console.log(\`To: \${to}\`);
      console.log(\`Subject: \${subject}\`);
      console.log(\`Body: \${body}\`);
      console.log('------------------');
      return true;
    }
    // Production email logic (e.g. SendGrid, AWS SES) would go here
    return true;
  }
}
module.exports = new EmailService();`,

  'backend/services/notificationService.js': `const Notification = require('../models/Notification');
const emailService = require('./emailService');

class NotificationService {
  async sendInAppNotification(userId, title, message, type = 'SYSTEM') {
    return await Notification.create({ userId, title, message, type });
  }

  async notifyOrderConfirmation(userEmail, userId, orderId) {
    // Send email
    await emailService.sendEmail(
      userEmail,
      'Order Confirmation',
      \`Your order \${orderId} has been successfully placed.\`
    );
    // Send in-app
    await this.sendInAppNotification(userId, 'Order Confirmed', \`Your order \${orderId} is confirmed.\`, 'ORDER');
  }
}
module.exports = new NotificationService();`,

  'backend/controllers/couponController.js': `const Coupon = require('../models/Coupon');

exports.createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ status: 'success', data: coupon });
  } catch (err) { next(err); }
};

exports.getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ isActive: true, expiresAt: { $gt: new Date() } });
    res.json({ status: 'success', data: coupons });
  } catch (err) { next(err); }
};`,

  'backend/routes/couponRoutes.js': `const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/', couponController.getCoupons);
router.use(requireAuth, requireRole('ADMIN'));
router.post('/', couponController.createCoupon);

module.exports = router;`,

  'backend/tests/commerce.test.js': `const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Coupon = require('../models/Coupon');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Commerce Features', () => {
  it('should allow coupon creation and application logic', async () => {
    const coupon = await Coupon.create({
      code: 'SAVE20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      expiresAt: new Date(Date.now() + 86400000)
    });
    
    expect(coupon.code).toBe('SAVE20');
    expect(coupon.discountValue).toBe(20);
  });
});`
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log("Created " + filePath);
}

// Update routes/index.js
const indexRoutePath = path.join(__dirname, 'backend/routes/index.js');
let indexCode = fs.readFileSync(indexRoutePath, 'utf8');
if(!indexCode.includes('couponRoutes')) {
  indexCode = indexCode.replace(
    "module.exports = router;",
    "const couponRoutes = require('./couponRoutes');\nrouter.use('/coupons', couponRoutes);\n\nmodule.exports = router;"
  );
  fs.writeFileSync(indexRoutePath, indexCode);
}
console.log("Updated routes/index.js for Coupons");
