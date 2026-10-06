const Cart = require('../models/Cart');
const Product = require('../models/Product');

class CartService {
  async getCart(customerId) {
    let cart = await Cart.findOne({ customerId }).populate('items.productId', 'name price images stock status');
    if (!cart) cart = await Cart.create({ customerId, items: [] });
    return cart;
  }

  async addItem(customerId, productId, quantity) {
    const product = await Product.findOne({ _id: productId, status: 'PUBLISHED' });
    if (!product) throw new Error('Product not found or unavailable');
    if (product.stock < quantity) throw new Error('Not enough stock available');

    let cart = await Cart.findOne({ customerId });
    if (!cart) cart = new Cart({ customerId, items: [] });

    const itemIndex = cart.items.findIndex(i => i.productId.toString() === productId.toString());
    if (itemIndex > -1) {
      if (product.stock < cart.items[itemIndex].quantity + quantity) {
        throw new Error('Not enough stock available for this update');
      }
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    return await cart.save();
  }

  async updateItemQuantity(customerId, productId, quantity) {
    if (quantity < 1) return this.removeItem(customerId, productId);
    
    const product = await Product.findOne({ _id: productId, status: 'PUBLISHED' });
    if (!product || product.stock < quantity) throw new Error('Product unavailable or insufficient stock');

    const cart = await Cart.findOneAndUpdate(
      { customerId, 'items.productId': productId },
      { $set: { 'items.$.quantity': quantity } },
      { new: true }
    );
    if (!cart) throw new Error('Item not found in cart');
    return cart;
  }

  async removeItem(customerId, productId) {
    return await Cart.findOneAndUpdate(
      { customerId },
      { $pull: { items: { productId } } },
      { new: true }
    );
  }

  async clearCart(customerId) {
    return await Cart.findOneAndUpdate({ customerId }, { items: [] }, { new: true });
  }
}
module.exports = new CartService();