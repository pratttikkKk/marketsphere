const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Order = require('../models/Order');

class SellerDashboardService {
  async _getApprovedSeller(userId) {
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new Error('No seller profile found. Please submit a seller application first.');
    }
    if (seller.status !== 'APPROVED') {
      const err = new Error(`Seller account is currently ${seller.status}. You cannot access seller operations until approved by an administrator.`);
      err.statusCode = 403;
      err.sellerStatus = seller.status;
      throw err;
    }
    return seller;
  }

  async getDashboardMetrics(userId) {
    const seller = await this._getApprovedSeller(userId);

    const products = await Product.find({ sellerId: seller._id });
    const orders = await Order.find({ 'orderItems.sellerId': seller._id }).sort({ createdAt: -1 });

    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.status === 'PUBLISHED').length;
    const pendingProducts = products.filter(p => p.status === 'PENDING_MODERATION').length;
    const rejectedProducts = products.filter(p => p.status === 'REJECTED').length;
    const outOfStockProducts = products.filter(p => p.stock === 0).length;

    let totalOrders = 0;
    let pendingOrders = 0;
    let processingOrders = 0;
    let shippedOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let totalRevenue = 0;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let revenueForRange = 0;

    const recentOrders = [];

    orders.forEach(order => {
      let isSellerOrder = false;
      order.orderItems.forEach(item => {
        if (item.sellerId.toString() === seller._id.toString()) {
          isSellerOrder = true;
          totalRevenue += (item.priceAtPurchase * item.quantity);
          if (order.createdAt >= thirtyDaysAgo) {
            revenueForRange += (item.priceAtPurchase * item.quantity);
          }
          
          if (item.status === 'PENDING') pendingOrders++;
          else if (item.status === 'PROCESSING') processingOrders++;
          else if (item.status === 'SHIPPED') shippedOrders++;
          else if (item.status === 'DELIVERED') deliveredOrders++;
          else if (item.status === 'CANCELLED') cancelledOrders++;
        }
      });
      if (isSellerOrder) {
        totalOrders++;
        if (recentOrders.length < 5) recentOrders.push(order);
      }
    });

    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5).slice(0, 5);

    return {
      storeName: seller.storeName,
      status: seller.status,
      totalProducts,
      activeProducts,
      pendingProducts,
      rejectedProducts,
      outOfStockProducts,
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      revenueForRange,
      recentOrders,
      lowStock
    };
  }

  async getSellerProducts(userId) {
    const seller = await this._getApprovedSeller(userId);
    const products = await Product.find({ sellerId: seller._id })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 });
    return { products };
  }

  async getSellerOrders(userId) {
    const seller = await this._getApprovedSeller(userId);
    const orders = await Order.find({ 'orderItems.sellerId': seller._id })
      .populate('orderItems.productId', 'name sku price images')
      .populate('customerId', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Filter items to isolate only those belonging to this seller
    const filteredOrders = orders.map(order => {
      const o = order.toObject();
      o.orderItems = o.orderItems.filter(item => item.sellerId.toString() === seller._id.toString());
      return o;
    });
    return filteredOrders;
  }

  async updateOrderStatus(userId, orderId, itemId, newStatus) {
    const seller = await this._getApprovedSeller(userId);
    
    const order = await Order.findOne({ _id: orderId, 'orderItems._id': itemId });
    if (!order) throw new Error('Order not found');

    const item = order.orderItems.id(itemId);
    if (item.sellerId.toString() !== seller._id.toString()) {
      throw new Error('Unauthorized: Item does not belong to your store');
    }

    // State machine check for item status transition
    const validTransitions = {
      PENDING: ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
      PLACED: ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: ['RETURN_REQUESTED'],
      CANCELLED: [],
      RETURN_REQUESTED: ['RETURNED'],
      RETURNED: []
    };

    const current = item.status || 'PENDING';
    const allowed = validTransitions[current] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid item status transition from ${current} to ${newStatus}`);
    }

    item.status = newStatus;
    
    // Recalculate parent order status
    const allStatuses = order.orderItems.map(i => i.status);
    if (allStatuses.every(s => s === 'DELIVERED')) order.orderStatus = 'DELIVERED';
    else if (allStatuses.every(s => s === 'SHIPPED')) order.orderStatus = 'SHIPPED';
    else if (allStatuses.some(s => s === 'PROCESSING')) order.orderStatus = 'PROCESSING';
    else if (allStatuses.some(s => s === 'CONFIRMED')) order.orderStatus = 'CONFIRMED';
    else if (allStatuses.every(s => s === 'CANCELLED')) order.orderStatus = 'CANCELLED';
    
    await order.save();
    return order;
  }

  async updateOrderLevelStatus(userId, orderId, newStatus) {
    const seller = await this._getApprovedSeller(userId);
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    let updated = false;
    order.orderItems.forEach(item => {
      if (item.sellerId.toString() === seller._id.toString()) {
        item.status = newStatus;
        updated = true;
      }
    });

    if (!updated) throw new Error('No items in this order belong to this seller');

    const allStatuses = order.orderItems.map(i => i.status);
    if (allStatuses.every(s => s === 'DELIVERED')) order.orderStatus = 'DELIVERED';
    else if (allStatuses.every(s => s === 'SHIPPED')) order.orderStatus = 'SHIPPED';
    else if (allStatuses.some(s => s === 'PROCESSING')) order.orderStatus = 'PROCESSING';
    else if (allStatuses.every(s => s === 'CANCELLED')) order.orderStatus = 'CANCELLED';

    await order.save();
    return order;
  }

  /**
   * Seller verifies that actual money received in their UPI account matches the order amount
   */
  async verifyPayment(userId, orderId, { receivedAmount, utrNumber }) {
    const seller = await this._getApprovedSeller(userId);
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    const belongsToSeller = order.orderItems.some(i => i.sellerId.toString() === seller._id.toString());
    if (!belongsToSeller) {
      throw new Error('Unauthorized: No items in this order belong to your store');
    }

    const receivedNum = Number(receivedAmount);
    if (isNaN(receivedNum) || Math.round(receivedNum * 100) !== Math.round(order.totalAmount * 100)) {
      throw new Error(`Payment verification failed: Received amount (₹${receivedAmount}) must exactly match actual order total (₹${order.totalAmount})`);
    }

    order.paymentStatus = 'PAID';
    if (order.orderStatus === 'PENDING_PAYMENT') {
      order.orderStatus = 'CONFIRMED';
      order.orderItems.forEach(i => {
        if (i.sellerId.toString() === seller._id.toString() && i.status === 'PENDING') {
          i.status = 'CONFIRMED';
        }
      });
    }

    order.paymentDetails.paidAt = new Date();
    order.paymentDetails.verifiedBySellerAt = new Date();
    if (utrNumber) {
      order.paymentDetails.utrNumber = String(utrNumber).trim();
    }

    order.timeline.push({
      status: 'PAID',
      timestamp: new Date(),
      note: `Payment of ₹${receivedNum} verified and confirmed in bank account by seller (${seller.storeName})`
    });

    await order.save();
    return order;
  }

  /**
   * For Cash on Delivery, seller manually marks as Paid when product is delivered
   */
  async markCodAsPaid(userId, orderId) {
    const seller = await this._getApprovedSeller(userId);
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    const belongsToSeller = order.orderItems.some(i => i.sellerId.toString() === seller._id.toString());
    if (!belongsToSeller) {
      throw new Error('Unauthorized: No items in this order belong to your store');
    }

    order.paymentStatus = 'PAID';
    order.paymentDetails.paidAt = new Date();

    order.timeline.push({
      status: 'PAID',
      timestamp: new Date(),
      note: `Cash on Delivery (₹${order.totalAmount}) collected and marked as PAID by seller (${seller.storeName})`
    });

    await order.save();
    return order;
  }
}

module.exports = new SellerDashboardService();
