const cartService = require('../services/cartService');

exports.getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user.id);
    res.json({ status: 'success', data: cart });
  } catch (err) { next(err); }
};

exports.addItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const cart = await cartService.addItem(req.user.id, productId, quantity);
    res.json({ status: 'success', data: cart });
  } catch (err) { next(err); }
};

exports.updateItem = async (req, res, next) => {
  try {
    const cart = await cartService.updateItemQuantity(req.user.id, req.params.productId, req.body.quantity);
    res.json({ status: 'success', data: cart });
  } catch (err) { next(err); }
};

exports.removeItem = async (req, res, next) => {
  try {
    const cart = await cartService.removeItem(req.user.id, req.params.productId);
    res.json({ status: 'success', data: cart });
  } catch (err) { next(err); }
};

exports.clearCart = async (req, res, next) => {
  try {
    const cart = await cartService.clearCart(req.user.id);
    res.json({ status: 'success', data: cart });
  } catch (err) { next(err); }
};