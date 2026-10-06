const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');

exports.checkout = async (req, res, next) => {
  try {
    const result = await orderService.checkout(
      req.user._id || req.user.id, 
      req.body, 
      req.headers['idempotency-key']
    );
    res.status(201).json({ status: 'success', data: result });
  } catch (err) { 
    next(err); 
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getCustomerOrders(req.user._id || req.user.id);
    res.json({ status: 'success', data: orders });
  } catch (err) { 
    next(err); 
  }
};

exports.getOrderDetails = async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetails(req.user._id || req.user.id, req.params.id);
    res.json({ status: 'success', data: order });
  } catch (err) { 
    next(err); 
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.user._id || req.user.id, req.params.id, req.body.reason);
    res.json({ status: 'success', message: 'Order successfully cancelled', data: order });
  } catch (err) { 
    next(err); 
  }
};

exports.confirmPayment = async (req, res, next) => {
  try {
    const { orderId, providerOrderId, providerPaymentId, providerSignature } = req.body;
    const order = await orderService.confirmPayment(req.user._id || req.user.id, {
      orderId,
      providerOrderId,
      providerPaymentId,
      providerSignature
    });
    res.json({ status: 'success', message: 'Payment verified and confirmed', data: order });
  } catch (err) { 
    next(err); 
  }
};

exports.requestReturn = async (req, res, next) => {
  try {
    const order = await orderService.requestReturn(req.user._id || req.user.id, req.params.id, req.body.reason);
    res.json({ status: 'success', message: 'Return requested successfully', data: order });
  } catch (err) { 
    next(err); 
  }
};

/**
 * Sandbox helper endpoint: Generates valid cryptographic signature for testing the verification flow
 */
exports.simulateSandboxSignature = async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      status: 'error',
      error: { code: 'FORBIDDEN', message: 'Sandbox signature simulator is disabled in production environments' }
    });
  }
  try {
    const { providerOrderId } = req.body;
    const providerPaymentId = `pay_sbx_${Date.now()}`;
    const providerSignature = paymentService.generateSandboxSignature(providerOrderId, providerPaymentId);
    res.json({
      status: 'success',
      data: {
        providerOrderId,
        providerPaymentId,
        providerSignature
      }
    });
  } catch (err) { 
    next(err); 
  }
};

exports.submitUpiPayment = async (req, res, next) => {
  try {
    const { utrNumber, amountPaid, senderUpiId } = req.body;
    const order = await orderService.submitUpiPayment(
      req.user._id || req.user.id,
      req.params.id,
      { utrNumber, amountPaid, senderUpiId }
    );
    res.json({
      status: 'success',
      message: 'UPI payment submitted successfully. Awaiting seller confirmation.',
      data: order
    });
  } catch (err) {
    next(err);
  }
};