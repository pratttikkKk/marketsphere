const wishlistService = require('../services/wishlistService');

exports.toggleWishlist = async (req, res, next) => {
  try {
    const wishlist = await wishlistService.toggleWishlist(req.user.id, req.body.productId);
    res.json({ status: 'success', data: wishlist });
  } catch (err) { next(err); }
};

exports.getWishlist = async (req, res, next) => {
  try {
    const wishlist = await wishlistService.getWishlist(req.user.id);
    res.json({ status: 'success', data: wishlist || { products: [] } });
  } catch (err) { next(err); }
};