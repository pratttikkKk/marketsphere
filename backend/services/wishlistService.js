const Wishlist = require('../models/Wishlist');

class WishlistService {
  async toggleWishlist(customerId, productId) {
    let wishlist = await Wishlist.findOne({ customerId });
    if (!wishlist) {
      wishlist = new Wishlist({ customerId, products: [] });
    }
    
    const index = wishlist.products.indexOf(productId);
    if (index === -1) {
      wishlist.products.push(productId);
    } else {
      wishlist.products.splice(index, 1);
    }
    
    await wishlist.save();
    return wishlist;
  }

  async getWishlist(customerId) {
    return await Wishlist.findOne({ customerId }).populate('products');
  }
}
module.exports = new WishlistService();