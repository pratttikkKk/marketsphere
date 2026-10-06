const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Coupon = require('../models/Coupon');
const paymentService = require('./paymentService');
const notificationService = require('./notificationService');
const { assertValidOrderTransition, assertValidPaymentTransition } = require('./orderStateMachine');

class OrderService {
  /**
   * Complete checkout workflow with atomic inventory reservation and backend-authoritative calculations
   */
  async checkout(customerId, checkoutData, idempotencyKey = null) {
    const { shippingAddress, paymentMethod = 'COD', couponCode } = checkoutData;

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city || !shippingAddress.zipCode) {
      throw new Error('Complete shipping address (street, city, state, zipCode) is required');
    }

    const cart = await Cart.findOne({ customerId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      throw new Error('Your shopping cart is empty');
    }

    const orderItems = [];
    let subtotal = 0;
    const securedProducts = [];

    // 1. Atomic Inventory Reservation
    try {
      for (const item of cart.items) {
        const p = item.productId;
        if (!p) {
          throw new Error('One of the products in your cart is no longer available');
        }

        if (p.status !== 'PUBLISHED') {
          throw new Error(`Product "${p.name}" is currently not available for purchase`);
        }

        // Validate seller status
        const seller = await Seller.findById(p.sellerId);
        if (!seller || seller.status !== 'APPROVED') {
          throw new Error(`The seller for "${p.name}" is currently not active`);
        }

        // Atomically decrement stock ONLY IF stock >= item.quantity
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: p._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!updatedProduct) {
          throw new Error(`Insufficient stock for "${p.name}". Available: ${p.stock}, Requested: ${item.quantity}`);
        }

        securedProducts.push({ id: p._id, qty: item.quantity });

        orderItems.push({
          sellerId: updatedProduct.sellerId,
          productId: updatedProduct._id,
          quantity: item.quantity,
          priceAtPurchase: updatedProduct.price,
          status: 'PENDING'
        });

        subtotal += (updatedProduct.price * item.quantity);
      }

      // 2. Server-Authoritative Atomic Coupon Calculation
      let discount = 0;
      let appliedCouponCode = null;
      let appliedCouponDoc = null;

      if (couponCode && String(couponCode).trim() !== '') {
        const normalizedCode = String(couponCode).trim().toUpperCase();
        
        // Atomically reserve coupon usage limit to prevent concurrent usage race
        appliedCouponDoc = await Coupon.findOneAndUpdate(
          { 
            code: normalizedCode, 
            isActive: true,
            expiresAt: { $gt: new Date() },
            $expr: { $lt: ['$usedCount', '$usageLimit'] },
            minOrderValue: { $lte: subtotal }
          },
          { $inc: { usedCount: 1 } },
          { new: true }
        );

        if (appliedCouponDoc) {
          if (appliedCouponDoc.discountType === 'PERCENTAGE') {
            discount = (subtotal * appliedCouponDoc.discountValue) / 100;
            if (appliedCouponDoc.maxDiscount && discount > appliedCouponDoc.maxDiscount) {
              discount = appliedCouponDoc.maxDiscount;
            }
          } else if (appliedCouponDoc.discountType === 'FIXED') {
            discount = Math.min(appliedCouponDoc.discountValue, subtotal);
          }
          discount = Math.round(discount * 100) / 100;
          appliedCouponCode = appliedCouponDoc.code;
        }
      }

      // 3. Dynamic Delivery Fee Policy (Free delivery above ₹500, else ₹40)
      const discountedSubtotal = Math.max(0, subtotal - discount);
      const deliveryFee = discountedSubtotal >= 500 || discountedSubtotal === 0 ? 0 : 40;

      // 4. Tax Calculation (5% GST on discounted goods)
      const tax = Math.round((discountedSubtotal * 0.05) * 100) / 100;

      // 5. Final Total
      const totalAmount = Math.round((discountedSubtotal + deliveryFee + tax) * 100) / 100;

      // 6. Payment Provider Intent Creation
      let paymentStatus = 'PENDING';
      let orderStatus = 'PENDING_PAYMENT';
      let paymentDetails = {
        provider: paymentService.getProviderName(),
        providerOrderId: null
      };

      let clientPaymentData = null;

      if (paymentMethod === 'COD') {
        paymentStatus = 'PENDING';
        orderStatus = 'CONFIRMED';
        paymentDetails.provider = 'COD';
        orderItems.forEach(i => i.status = 'CONFIRMED');
      } else {
        // Online Payment (Razorpay or Sandbox)
        const paymentOrder = await paymentService.createPaymentOrder({
          orderId: `MS_${Date.now()}`,
          amountInRupees: totalAmount,
          currency: 'INR'
        });

        paymentDetails.provider = paymentOrder.provider;
        paymentDetails.providerOrderId = paymentOrder.providerOrderId;
        clientPaymentData = paymentOrder;
      }

      // Attach seller's verified UPI ID and Scanner for customer payment
      const primaryProduct = await Product.findById(orderItems[0].productId);
      const primarySeller = await Seller.findById(orderItems[0].sellerId);
      const sellerUpiId = primaryProduct?.sellerUpiId || primarySeller?.upiId || 'marketsphere.pay@upi';
      const sellerUpiQr = primaryProduct?.sellerUpiQr || primarySeller?.upiQr || null;

      paymentDetails.sellerUpiId = sellerUpiId;
      paymentDetails.sellerUpiQr = sellerUpiQr;

      if (clientPaymentData) {
        clientPaymentData.sellerUpiId = sellerUpiId;
        clientPaymentData.sellerUpiQr = sellerUpiQr;
        clientPaymentData.sellerStoreName = primarySeller?.storeName || 'MarketSphere Verified Seller';
      }

      // Estimated delivery date (4 days from order)
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + 4);

      const timeline = [
        {
          status: orderStatus,
          timestamp: new Date(),
          note: paymentMethod === 'COD' 
            ? 'Order confirmed with Cash on Delivery' 
            : 'Order initiated, awaiting online payment confirmation'
        }
      ];

      // 7. Save Order Document
      const order = new Order({
        customerId,
        idempotencyKey,
        orderItems,
        shippingAddress,
        paymentMethod: paymentMethod === 'COD' ? 'COD' : paymentService.getProviderName(),
        paymentStatus,
        paymentDetails,
        subtotal,
        discount,
        couponCode: appliedCouponCode,
        tax,
        deliveryFee,
        totalAmount,
        orderStatus,
        estimatedDelivery,
        timeline
      });

      await order.save();

      // 8. Clear Customer Cart
      await Cart.findOneAndUpdate({ customerId }, { items: [] });

      // Notify customer asynchronously
      notificationService.createNotification(
        customerId,
        'ORDER_CREATED',
        `Your order #${order._id.toString().slice(-6)} has been created successfully.`,
        { orderId: order._id }
      ).catch(e => console.error(e.message));

      return {
        order,
        clientPaymentData
      };
    } catch (error) {
      // Rollback secured stock if checkout failed halfway
      for (const sp of securedProducts) {
        await Product.updateOne({ _id: sp.id }, { $inc: { stock: sp.qty } });
      }
      throw error;
    }
  }

  /**
   * Cryptographically verifies payment signature, validates provider state, and marks order PAID
   */
  async confirmPayment(customerId, { orderId, providerOrderId, providerPaymentId, providerSignature }) {
    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) {
      throw new Error('Order not found or unauthorized');
    }

    if (order.paymentStatus === 'PAID') {
      return order; // Already confirmed idempotently
    }

    assertValidPaymentTransition(order.paymentStatus, 'PAID');
    assertValidOrderTransition(order.orderStatus, 'CONFIRMED');

    const expectedOrderId = providerOrderId || order.paymentDetails?.providerOrderId;

    // 1. Verify HMAC-SHA256 signature
    const isValidSignature = paymentService.verifyPaymentSignature({
      providerOrderId: expectedOrderId,
      providerPaymentId,
      providerSignature
    });

    if (!isValidSignature) {
      order.paymentStatus = 'FAILED';
      order.timeline.push({
        status: 'PAYMENT_FAILED',
        timestamp: new Date(),
        note: 'Cryptographic signature verification failed'
      });
      await order.save();
      throw new Error('Cryptographic payment signature verification failed. Tampered or invalid credentials.');
    }

    // 2. Verify payment state with gateway
    await paymentService.verifyProviderPaymentState({
      paymentId: providerPaymentId,
      providerOrderId: expectedOrderId,
      expectedAmountInRupees: order.totalAmount
    });

    // 3. Payment Verified Successfully
    order.paymentStatus = 'PAID';
    order.orderStatus = 'CONFIRMED';
    order.paymentDetails.providerPaymentId = providerPaymentId;
    order.paymentDetails.providerSignature = providerSignature;
    order.paymentDetails.paidAt = new Date();

    // Confirm all pending items
    order.orderItems.forEach(item => {
      if (item.status === 'PENDING') {
        item.status = 'CONFIRMED';
      }
    });

    order.timeline.push({
      status: 'CONFIRMED',
      timestamp: new Date(),
      note: `Payment of ₹${order.totalAmount} verified via ${order.paymentDetails.provider}`
    });

    await order.save();

    // In-app notifications
    notificationService.createNotification(
      customerId,
      'PAYMENT_SUCCESS',
      `Payment of ₹${order.totalAmount} for order #${order._id.toString().slice(-6)} was successfully verified.`,
      { orderId: order._id }
    ).catch(e => console.error(e.message));

    return order;
  }

  async getCustomerOrders(customerId) {
    return await Order.find({ customerId })
      .populate('orderItems.productId', 'name images price sku')
      .sort({ createdAt: -1 });
  }

  async getOrderDetails(customerId, orderId) {
    const order = await Order.findOne({ _id: orderId, customerId })
      .populate('orderItems.productId', 'name images price sku')
      .populate('orderItems.sellerId', 'storeName contactEmail');
    if (!order) throw new Error('Order not found or unauthorized');
    return order;
  }

  /**
   * Cancellation workflow with policy enforcement, atomic stock restoration, and refund execution
   */
  async cancelOrder(customerId, orderId, reason = 'Customer requested cancellation') {
    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) throw new Error('Order not found or unauthorized');

    assertValidOrderTransition(order.orderStatus, 'CANCELLED');

    order.orderStatus = 'CANCELLED';
    order.cancellationReason = reason;

    // Restore stock atomically
    for (const item of order.orderItems) {
      item.status = 'CANCELLED';
      await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
    }

    // Process refund if order was paid online
    if (order.paymentStatus === 'PAID') {
      try {
        const refundResult = await paymentService.processRefund({
          paymentId: order.paymentDetails?.providerPaymentId,
          amountInRupees: order.totalAmount,
          notes: reason
        });
        order.paymentStatus = 'REFUNDED';
        order.paymentDetails.refundId = refundResult.refundId;
        order.paymentDetails.refundAmount = order.totalAmount;
        order.paymentDetails.refundedAt = new Date();
      } catch (refundErr) {
        console.error('[REFUND] Error issuing provider refund:', refundErr.message);
        // Do NOT mark as REFUNDED on failure. Set to REFUND_PENDING for administrative review!
        order.paymentStatus = 'REFUND_PENDING';
        order.timeline.push({
          status: 'REFUND_PENDING',
          timestamp: new Date(),
          note: `Provider refund error: ${refundErr.message}. Pending admin reconciliation.`
        });
      }
    }

    order.timeline.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      note: `Cancelled by customer: ${reason}`
    });

    await order.save();

    notificationService.createNotification(
      customerId,
      'ORDER_CANCELLED',
      `Your order #${order._id.toString().slice(-6)} has been cancelled.`,
      { orderId: order._id }
    ).catch(e => console.error(e.message));

    return order;
  }

  /**
   * Return request workflow
   */
  async requestReturn(customerId, orderId, reason) {
    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) throw new Error('Order not found or unauthorized');

    assertValidOrderTransition(order.orderStatus, 'RETURN_REQUESTED');

    order.orderStatus = 'RETURN_REQUESTED';
    order.returnReason = reason || 'Customer requested return';
    order.orderItems.forEach(i => i.status = 'RETURN_REQUESTED');

    order.timeline.push({
      status: 'RETURN_REQUESTED',
      timestamp: new Date(),
      note: `Return requested: ${order.returnReason}`
    });

    await order.save();
    return order;
  }

  /**
   * Customer submits UPI Payment reference (UTR / Transaction ID)
   */
  async submitUpiPayment(customerId, orderId, { utrNumber, amountPaid, senderUpiId }) {
    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) {
      throw new Error('Order not found or unauthorized');
    }

    if (!utrNumber || String(utrNumber).trim() === '') {
      throw new Error('12-digit UPI Transaction Reference (UTR Number) is required');
    }

    const paidNum = Number(amountPaid);
    if (isNaN(paidNum) || Math.round(paidNum * 100) !== Math.round(order.totalAmount * 100)) {
      throw new Error(`Submitted payment amount (₹${amountPaid}) must exactly match the order total amount (₹${order.totalAmount})`);
    }

    if (order.paymentStatus === 'PAID') {
      return order; // Already paid
    }

    order.paymentStatus = 'PENDING_SELLER_CONFIRMATION';
    order.paymentDetails.utrNumber = String(utrNumber).trim();
    order.paymentDetails.paidAmount = paidNum;
    order.paymentDetails.senderUpiId = senderUpiId ? String(senderUpiId).trim() : null;
    order.paymentDetails.submittedAt = new Date();

    order.timeline.push({
      status: 'PENDING_SELLER_CONFIRMATION',
      timestamp: new Date(),
      note: `Customer submitted UPI payment with UTR #${utrNumber} for ₹${paidNum}. Awaiting seller verification.`
    });

    await order.save();

    // Notify seller
    for (const item of order.orderItems) {
      notificationService.createNotification(
        item.sellerId,
        'PAYMENT_SUBMITTED',
        `Customer submitted UPI payment of ₹${paidNum} (UTR: ${utrNumber}) for order #${order._id.toString().slice(-6)}. Please verify in your dashboard.`,
        { orderId: order._id }
      ).catch(e => console.error(e.message));
    }

    return order;
  }
}

module.exports = new OrderService();