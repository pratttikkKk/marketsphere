const Notification = require('../models/Notification');
const emailService = require('./emailService');

class NotificationService {
  async sendInAppNotification(userId, title, message, type = 'SYSTEM', metadata = {}) {
    return await Notification.create({ userId, title, message, type });
  }

  async createNotification(userId, type, message, metadata = {}) {
    const titles = {
      ORDER_CREATED: 'Order Placed',
      PAYMENT_SUCCESS: 'Payment Confirmed',
      PAYMENT_FAILED: 'Payment Failed',
      ORDER_SHIPPED: 'Order Shipped',
      ORDER_DELIVERED: 'Order Delivered',
      ORDER_CANCELLED: 'Order Cancelled',
      SELLER_APPLICATION: 'Seller Application Status',
      PRODUCT_MODERATION: 'Product Moderation Update'
    };
    const title = titles[type] || 'MarketSphere Notification';
    return await this.sendInAppNotification(userId, title, message, 'ORDER', metadata);
  }

  async getUserNotifications(userId) {
    return await Notification.find({ userId }).sort({ createdAt: -1 }).limit(30);
  }

  async markAsRead(notificationId, userId) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );
  }

  async markAllAsRead(userId) {
    return await Notification.updateMany({ userId }, { isRead: true });
  }

  async notifyOrderConfirmation(userEmail, userId, orderId) {
    await emailService.sendEmail(
      userEmail,
      'Order Confirmation - MarketSphere',
      `Your order #${orderId} has been successfully placed and confirmed.`
    );
    await this.sendInAppNotification(userId, 'Order Confirmed', `Your order #${orderId} is confirmed.`, 'ORDER');
  }
}

module.exports = new NotificationService();