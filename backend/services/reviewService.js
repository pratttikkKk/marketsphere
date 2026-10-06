const Review = require('../models/Review');
const Product = require('../models/Product');

const Order = require('../models/Order');

class ReviewService {
  async addReview(customerId, productId, rating, comment) {
    const hasPurchased = await Order.exists({ customerId, 'orderItems.productId': productId, orderStatus: { $in: ['DELIVERED', 'SHIPPED', 'CONFIRMED'] } });
    
    if (!hasPurchased) throw new Error('You must purchase this product to review it');

    const review = new Review({ customerId, productId, rating, comment });
    await review.save();
    await this.updateProductRating(productId);
    return review;
  }

  async updateReview(customerId, reviewId, updateData) {
    const review = await Review.findOne({ _id: reviewId, customerId });
    if (!review) throw new Error('Review not found or unauthorized');
    
    if (updateData.rating) review.rating = updateData.rating;
    if (updateData.comment) review.comment = updateData.comment;
    await review.save();
    await this.updateProductRating(review.productId);
    return review;
  }

  async reportReview(customerId, reviewId) {
    return await Review.findByIdAndUpdate(reviewId, { reported: true });
  }

  async moderateReview(reviewId, status) {
    // Admin only
    const review = await Review.findByIdAndUpdate(reviewId, { status }, { new: true });
    await this.updateProductRating(review.productId);
    return review;
  }

  async updateProductRating(productId) {
    const stats = await Review.aggregate([
      { $match: { productId: new (require('mongoose')).Types.ObjectId(productId), status: 'APPROVED' } },
      { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, numReviews: { $sum: 1 } } }
    ]);
    const avg = stats.length > 0 ? stats[0].avgRating : 0;
    const numReviews = stats.length > 0 ? stats[0].numReviews : 0;
    
    await Product.findByIdAndUpdate(productId, { averageRating: avg, numReviews });
  }
}
module.exports = new ReviewService();