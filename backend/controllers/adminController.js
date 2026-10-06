const adminService = require('../services/adminService');

exports.getDashboard = async (req, res, next) => {
  try {
    const metrics = await adminService.getDashboardMetrics(req.query || {});
    res.json({ status: 'success', data: metrics });
  } catch (error) {
    next(error);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const result = await adminService.listUsers(req.query || {});
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const user = await adminService.updateUserStatus(req.params.id, req.body.isActive);
    res.json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
};

exports.listSellerApplications = async (req, res, next) => {
  try {
    const sellers = await adminService.listSellerApplications();
    res.json({ status: 'success', data: sellers });
  } catch (error) {
    next(error);
  }
};

exports.updateSellerStatus = async (req, res, next) => {
  try {
    const seller = await adminService.updateSellerStatus(req.params.id, req.body.status, req.body.reason || '', req.user.id);
    res.json({ status: 'success', data: seller });
  } catch (error) {
    next(error);
  }
};

exports.getModerationQueue = async (req, res, next) => {
  try {
    const result = await adminService.getModerationQueue(req.query || {});
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

exports.moderateProduct = async (req, res, next) => {
  try {
    const product = await adminService.moderateProduct(req.params.id, req.body.status, req.body.reason || '', req.user.id);
    res.json({ status: 'success', data: product });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const result = await adminService.getOrderSummary(req.query || {});
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

exports.listCategories = async (req, res, next) => {
  try {
    const categories = await adminService.listCategories();
    res.json({ status: 'success', data: categories });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const category = await adminService.createCategory(req.body);
    res.status(201).json({ status: 'success', data: category });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const category = await adminService.updateCategory(req.params.id, req.body);
    res.json({ status: 'success', data: category });
  } catch (error) {
    next(error);
  }
};

exports.handleReturn = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { decision, reason, refundAmount } = req.body;
    const order = await adminService.handleReturnDecision(orderId, { decision, reason, refundAmount }, req.user._id || req.user.id);
    res.json({ status: 'success', message: `Return ${decision.toLowerCase()}ed successfully`, data: order });
  } catch (error) {
    next(error);
  }
};

exports.updateTracking = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await adminService.updateOrderTracking(orderId, req.body, req.user._id || req.user.id);
    res.json({ status: 'success', message: 'Tracking updated successfully', data: order });
  } catch (error) {
    next(error);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const result = await adminService.getAuditLogs(req.query || {});
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};
