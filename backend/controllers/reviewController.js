const reviewService = require('../services/reviewService');

exports.addReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;
    const review = await reviewService.addReview(req.user.id, productId, rating, comment);
    res.status(201).json({ status: 'success', data: review });
  } catch (err) { next(err); }
};

exports.updateReview = async (req, res, next) => {
  try {
    const review = await reviewService.updateReview(req.user.id, req.params.id, req.body);
    res.json({ status: 'success', data: review });
  } catch (err) { next(err); }
};