const sellerService = require('../services/sellerService');
const sellerDashboardService = require('../services/sellerDashboardService');

exports.apply = async (req, res, next) => {
  try {
    const profile = await sellerService.applyForSeller(req.user._id || req.user.id, req.body);
    res.status(201).json({ 
      status: 'success', 
      message: 'Seller application submitted successfully and is pending administrator review.',
      data: profile 
    });
  } catch (error) { 
    next(error); 
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await sellerService.getProfileByUserId(req.user._id || req.user.id);
    if (!profile) return res.status(404).json({ status: 'error', message: 'No seller profile found. Please submit an application.' });
    res.json({ status: 'success', data: profile });
  } catch (error) { 
    next(error); 
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const profile = await sellerService.updateProfile(req.user._id || req.user.id, req.body);
    res.json({ status: 'success', message: 'Seller profile updated successfully', data: profile });
  } catch (error) { 
    next(error); 
  }
};

exports.moderateSeller = async (req, res, next) => {
  try {
    const profile = await sellerService.updateSellerStatus(req.params.id, req.body.status);
    res.json({ status: 'success', data: profile });
  } catch (error) { 
    next(error); 
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const data = await sellerDashboardService.getDashboardMetrics(req.user._id || req.user.id);
    res.json({ status: 'success', data });
  } catch (error) { 
    next(error); 
  }
};

exports.getProducts = async (req, res, next) => {
  try {
    const data = await sellerDashboardService.getSellerProducts(req.user._id || req.user.id);
    res.json({ status: 'success', data });
  } catch (error) { 
    next(error); 
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const data = await sellerDashboardService.getSellerOrders(req.user._id || req.user.id);
    res.json({ status: 'success', data });
  } catch (error) { 
    next(error); 
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { status } = req.body;
    const order = await sellerDashboardService.updateOrderStatus(req.user._id || req.user.id, orderId, itemId, status);
    res.json({ status: 'success', message: 'Order item status updated', data: order });
  } catch (error) { 
    next(error); 
  }
};

exports.updateOrderLevelStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const order = await sellerDashboardService.updateOrderLevelStatus(req.user._id || req.user.id, orderId, status);
    res.json({ status: 'success', message: 'Order status updated', data: order });
  } catch (error) { 
    next(error); 
  }
};

exports.verifyOrderPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { receivedAmount, utrNumber } = req.body;
    const order = await sellerDashboardService.verifyPayment(
      req.user._id || req.user.id,
      orderId,
      { receivedAmount, utrNumber }
    );
    res.json({
      status: 'success',
      message: 'Payment verified and confirmed by seller. Order marked as PAID.',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

exports.markOrderAsPaid = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await sellerDashboardService.markCodAsPaid(
      req.user._id || req.user.id,
      orderId
    );
    res.json({
      status: 'success',
      message: 'Order successfully marked as PAID upon delivery.',
      data: order
    });
  } catch (error) {
    next(error);
  }
};