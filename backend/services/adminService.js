const mongoose = require('mongoose');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const AuditLog = require('../models/AuditLog');

class AdminService {
  async getDashboardMetrics(options = {}) {
    const rangeDays = Number(options.range || 30);
    const startDate = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const totalSellers = await Seller.countDocuments();
    const pendingSellerApprovals = await Seller.countDocuments({ status: 'PENDING' });
    const approvedSellers = await Seller.countDocuments({ status: 'APPROVED' });
    const suspendedSellers = await Seller.countDocuments({ status: 'SUSPENDED' });
    const totalProducts = await Product.countDocuments();
    const pendingProductApprovals = await Product.countDocuments({ status: 'PENDING_MODERATION' });
    const activeProducts = await Product.countDocuments({ status: 'PUBLISHED' });
    const totalOrders = await Order.countDocuments();

    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
    ]);

    const salesSummary = await Order.aggregate([
      { $match: { paymentStatus: 'PAID', orderStatus: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } }
    ]);

    const customerIds = await Order.distinct('customerId');
    const totalCustomers = customerIds.length;

    const recentActivity = await Order.find({}).sort({ createdAt: -1 }).limit(5).lean();

    const dateFilteredSales = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate }, paymentStatus: 'PAID', orderStatus: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' } } }
    ]);

    return {
      totalCustomers,
      totalSellers,
      pendingSellerApprovals,
      approvedSellers,
      suspendedSellers,
      totalProducts,
      pendingProductApprovals,
      activeProducts,
      totalOrders,
      ordersByStatus: Object.fromEntries(ordersByStatus.map((item) => [item._id, item.count])),
      totalMarketplaceSales: salesSummary[0]?.totalSales || 0,
      revenueForRange: dateFilteredSales[0]?.revenue || 0,
      recentActivity
    };
  }

  async listUsers({ role, status, search, page = 1, limit = 10 }) {
    const filters = {};
    if (role) filters.role = role;
    if (status) filters.isActive = status === 'active';
    if (search) {
      filters.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const users = await User.find(filters).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const total = await User.countDocuments(filters);
    return { users, total, page: Number(page), pages: Math.ceil(total / Number(limit) || 1) };
  }

  async updateUserStatus(userId, isActive) {
    const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true }).select('-passwordHash');
    if (!user) throw new Error('User not found');
    return user;
  }

  async listSellerApplications() {
    return Seller.find({ status: { $in: ['PENDING', 'REJECTED', 'SUSPENDED'] } }).sort({ createdAt: -1 }).lean();
  }

  async updateSellerStatus(sellerId, status, reason = '', adminUserId = null) {
    if (!['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING'].includes(status)) {
      throw new Error('Invalid seller status');
    }

    const seller = await Seller.findByIdAndUpdate(sellerId, { status }, { new: true });
    if (!seller) throw new Error('Seller not found');

    await this.logAdminAction({
      adminId: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : new mongoose.Types.ObjectId(),
      action: `SELLER_${status}`,
      targetType: 'Seller',
      targetId: seller._id,
      reason
    });

    return seller;
  }

  async getModerationQueue({ search, sellerId, category, status, page = 1, limit = 10 }) {
    const filters = {};
    if (search) filters.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } }
    ];
    if (sellerId) filters.sellerId = sellerId;
    if (category) filters.category = category;
    if (status) filters.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const products = await Product.find(filters)
      .populate('sellerId', 'storeName status')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Product.countDocuments(filters);
    return { products, total, page: Number(page), pages: Math.ceil(total / Number(limit) || 1) };
  }

  async moderateProduct(productId, status, reason = '', adminUserId = null) {
    if (!['PUBLISHED', 'REJECTED', 'DRAFT', 'ARCHIVED'].includes(status)) {
      throw new Error('Invalid product moderation status');
    }

    const product = await Product.findByIdAndUpdate(productId, { status }, { new: true });
    if (!product) throw new Error('Product not found');

    await this.logAdminAction({
      adminId: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : new mongoose.Types.ObjectId(),
      action: `PRODUCT_${status}`,
      targetType: 'Product',
      targetId: product._id,
      reason
    });

    return product;
  }

  async getOrderSummary({ status, sellerId, startDate, endDate, page = 1, limit = 10 }) {
    const filters = {};
    if (status) filters.orderStatus = status;
    if (sellerId) filters['orderItems.sellerId'] = sellerId;
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(filters).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const total = await Order.countDocuments(filters);

    return { orders, total, page: Number(page), pages: Math.ceil(total / Number(limit) || 1) };
  }

  async listCategories() {
    return Category.find({}).sort({ createdAt: -1 }).lean();
  }

  async createCategory(categoryData) {
    if (!categoryData.name || !categoryData.slug) {
      throw new Error('Category name and slug are required');
    }
    return Category.create(categoryData);
  }

  async updateCategory(categoryId, updateData) {
    const category = await Category.findByIdAndUpdate(categoryId, updateData, { new: true });
    if (!category) throw new Error('Category not found');
    return category;
  }

  async getAuditLogs({ page = 1, limit = 20 } = {}) {
    const skip = (Number(page) - 1) * Number(limit);
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const total = await AuditLog.countDocuments();
    return { logs, total, page: Number(page), pages: Math.ceil(total / Number(limit) || 1) };
  }

  async handleReturnDecision(orderId, { decision, reason = '', refundAmount = null }, adminUserId = null) {
    const paymentService = require('./paymentService');
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (decision === 'APPROVE') {
      order.orderStatus = 'RETURNED';
      order.orderItems.forEach(i => i.status = 'RETURNED');

      // Restore inventory
      for (const item of order.orderItems) {
        await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
      }

      // Process refund
      const amountToRefund = refundAmount !== null ? Number(refundAmount) : order.totalAmount;
      if (order.paymentStatus === 'PAID') {
        try {
          const refundResult = await paymentService.processRefund({
            paymentId: order.paymentDetails?.providerPaymentId,
            amountInRupees: amountToRefund,
            notes: `Return approved by admin: ${reason}`
          });
          order.paymentStatus = 'REFUNDED';
          order.paymentDetails.refundId = refundResult.refundId;
          order.paymentDetails.refundAmount = amountToRefund;
          order.paymentDetails.refundedAt = new Date();
        } catch (err) {
          console.error('[REFUND] Provider error during return approval:', err.message);
          order.paymentStatus = 'REFUND_FAILED';
          order.timeline.push({
            status: 'REFUND_FAILED',
            timestamp: new Date(),
            note: `Provider refund execution error: ${err.message}`
          });
        }
      }

      order.timeline.push({
        status: 'RETURNED',
        timestamp: new Date(),
        note: `Return approved by admin. Refund of ₹${amountToRefund} processed. Reason: ${reason}`
      });

      await order.save();

      await this.logAdminAction({
        adminId: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : new mongoose.Types.ObjectId(),
        action: 'RETURN_APPROVED',
        targetType: 'Order',
        targetId: order._id,
        reason,
        metadata: { refundAmount: amountToRefund }
      });

      return order;
    } else if (decision === 'REJECT') {
      order.orderStatus = 'DELIVERED';
      order.orderItems.forEach(i => i.status = 'DELIVERED');
      order.timeline.push({
        status: 'RETURN_REJECTED',
        timestamp: new Date(),
        note: `Return request rejected by admin. Reason: ${reason}`
      });
      await order.save();

      await this.logAdminAction({
        adminId: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : new mongoose.Types.ObjectId(),
        action: 'RETURN_REJECTED',
        targetType: 'Order',
        targetId: order._id,
        reason
      });

      return order;
    } else {
      throw new Error('Invalid return decision. Must be APPROVE or REJECT.');
    }
  }

  async updateOrderTracking(orderId, { carrier, trackingNumber, estimatedDelivery, status }, adminUserId = null) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (carrier) order.carrier = carrier;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery);
    if (status) {
      order.orderStatus = status;
      if (status === 'DELIVERED') {
        order.deliveredAt = new Date();
        order.orderItems.forEach(i => {
          i.status = 'DELIVERED';
          i.deliveredAt = new Date();
        });
      } else if (status === 'SHIPPED') {
        order.orderItems.forEach(i => {
          i.status = 'SHIPPED';
          i.shippedAt = new Date();
        });
      }
    }

    order.timeline.push({
      status: status || order.orderStatus,
      timestamp: new Date(),
      note: `Tracking updated: Carrier ${order.carrier || 'N/A'}, Tracking #${order.trackingNumber || 'N/A'}`
    });

    await order.save();

    await this.logAdminAction({
      adminId: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : new mongoose.Types.ObjectId(),
      action: 'ORDER_TRACKING_UPDATED',
      targetType: 'Order',
      targetId: order._id,
      metadata: { carrier, trackingNumber, status }
    });

    return order;
  }

  async logAdminAction({ adminId, action, targetType, targetId, reason, metadata = {} }) {
    return AuditLog.create({ adminId, action, targetType, targetId, reason, metadata });
  }
}

module.exports = new AdminService();
