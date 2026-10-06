const fs = require('fs');
const path = require('path');

const files = {
  'backend/models/Cart.js': `const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 }
});

const cartSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, // Ref to User
  items: [cartItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);`,

  'backend/models/Order.js': `const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  priceAtPurchase: { type: Number, required: true, min: 0 }, // Historic price capture
  status: { 
    type: String, 
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'],
    default: 'PENDING'
  }
});

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Ref to User
  orderItems: [orderItemSchema], // Multiple sellers supported in one order
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  paymentMethod: { type: String, enum: ['COD', 'MOCK_ONLINE'], required: true },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
  subtotal: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  orderStatus: { // Parent status
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  }
}, { timestamps: true });

orderSchema.index({ customerId: 1 });
orderSchema.index({ 'orderItems.sellerId': 1 }); // Important for seller suborder queries

module.exports = mongoose.model('Order', orderSchema);`,

  'backend/services/cartService.js': `const Cart = require('../models/Cart');
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
module.exports = new CartService();`,

  'backend/services/paymentService.js': `/**
 * Abstraction for Payment Gateway Integration
 */
class PaymentService {
  async processPayment(orderId, paymentMethod, amount) {
    if (paymentMethod === 'COD') {
      return { status: 'PENDING', reference: 'COD-' + Date.now() };
    }
    
    // MOCK_ONLINE flow: simulate successful card/UPI payment
    return { status: 'PAID', reference: 'MOCK-TXN-' + Date.now() };
  }

  async processRefund(transactionReference) {
    // Mock refund logic
    return { status: 'REFUNDED' };
  }
}
module.exports = new PaymentService();`,

  'backend/services/orderService.js': `const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const paymentService = require('./paymentService');

class OrderService {
  async checkout(customerId, checkoutData) {
    const { shippingAddress, paymentMethod } = checkoutData;
    
    const cart = await Cart.findOne({ customerId }).populate('items.productId');
    if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

    const orderItems = [];
    let subtotal = 0;

    // 1. Verify & Optimistically Lock Stock using atomic $inc
    // NOTE: This prevents overselling without requiring complex Replica Set Transactions for local dev.
    const securedProducts = [];
    try {
      for (const item of cart.items) {
        const p = item.productId;
        if (!p || p.status !== 'PUBLISHED') throw new Error(\`Product \${p?.name || item.productId} is no longer available\`);

        // Atomically decrease stock ONLY IF there is enough stock
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: p._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!updatedProduct) {
          throw new Error(\`Insufficient stock for \${p.name}\`);
        }
        
        securedProducts.push({ id: p._id, qty: item.quantity }); // Keep track to rollback if needed

        orderItems.push({
          sellerId: updatedProduct.sellerId,
          productId: updatedProduct._id,
          quantity: item.quantity,
          priceAtPurchase: updatedProduct.price,
          status: 'PENDING'
        });
        subtotal += (updatedProduct.price * item.quantity);
      }

      // 2. Create Order
      const deliveryFee = 10; // Flat fee for mock
      const totalAmount = subtotal + deliveryFee;

      let paymentStatus = 'PENDING';
      const paymentResult = await paymentService.processPayment('mock-id', paymentMethod, totalAmount);
      if (paymentResult.status === 'PAID') paymentStatus = 'PAID';

      const order = new Order({
        customerId,
        orderItems,
        shippingAddress,
        paymentMethod,
        paymentStatus,
        subtotal,
        deliveryFee,
        totalAmount,
        orderStatus: paymentStatus === 'PAID' ? 'CONFIRMED' : 'PENDING'
      });

      await order.save();
      
      // 3. Clear Cart
      await Cart.findOneAndUpdate({ customerId }, { items: [] });
      
      return order;
    } catch (error) {
      // Rollback secured stock if checkout failed halfway
      for (const sp of securedProducts) {
        await Product.updateOne({ _id: sp.id }, { $inc: { stock: sp.qty } });
      }
      throw error;
    }
  }

  async getCustomerOrders(customerId) {
    return await Order.find({ customerId }).sort({ createdAt: -1 });
  }

  async getOrderDetails(customerId, orderId) {
    const order = await Order.findOne({ _id: orderId, customerId }).populate('orderItems.productId', 'name images');
    if (!order) throw new Error('Order not found or unauthorized');
    return order;
  }

  async cancelOrder(customerId, orderId) {
    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) throw new Error('Order not found');
    if (!['PENDING', 'CONFIRMED'].includes(order.orderStatus)) {
      throw new Error('Order cannot be cancelled at this stage');
    }

    order.orderStatus = 'CANCELLED';
    order.orderItems.forEach(i => i.status = 'CANCELLED');
    if (order.paymentStatus === 'PAID') {
      order.paymentStatus = 'REFUNDED'; // Abstract integration
    }
    await order.save();

    // Restore stock
    for (const item of order.orderItems) {
      await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
    }
    return order;
  }
}
module.exports = new OrderService();`,

  'backend/controllers/cartController.js': `const cartService = require('../services/cartService');

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
};`,

  'backend/controllers/orderController.js': `const orderService = require('../services/orderService');

exports.checkout = async (req, res, next) => {
  try {
    const order = await orderService.checkout(req.user.id, req.body);
    res.status(201).json({ status: 'success', data: order });
  } catch (err) { next(err); }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getCustomerOrders(req.user.id);
    res.json({ status: 'success', data: orders });
  } catch (err) { next(err); }
};

exports.getOrderDetails = async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetails(req.user.id, req.params.id);
    res.json({ status: 'success', data: order });
  } catch (err) { next(err); }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.user.id, req.params.id);
    res.json({ status: 'success', data: order });
  } catch (err) { next(err); }
};`,

  'backend/routes/cartRoutes.js': `const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth, requireRole('CUSTOMER'));
router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.put('/items/:productId', cartController.updateItem);
router.delete('/items/:productId', cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;`,

  'backend/routes/orderRoutes.js': `const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth, requireRole('CUSTOMER'));
router.post('/checkout', orderController.checkout);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrderDetails);
router.post('/:id/cancel', orderController.cancelOrder);

module.exports = router;`,

  'backend/tests/order.test.js': `const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const orderService = require('../services/orderService');
const cartService = require('../services/cartService');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Category = require('../models/Category');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany();
});

describe('Checkout and Orders', () => {
  let customerId = new mongoose.Types.ObjectId();
  let p1, sellerId;

  beforeEach(async () => {
    sellerId = new mongoose.Types.ObjectId();
    const cat = await Category.create({ name: 'Cat', slug: 'cat' });
    p1 = await Product.create({ 
      sellerId, name: 'Item', description: 'Desc', sku: 'SKU', price: 100, category: cat._id, stock: 5, status: 'PUBLISHED' 
    });
  });

  it('should successfully checkout and decrement inventory', async () => {
    await cartService.addItem(customerId, p1._id, 2);
    
    const order = await orderService.checkout(customerId, { 
      paymentMethod: 'MOCK_ONLINE', 
      shippingAddress: { city: 'Test' } 
    });

    expect(order.totalAmount).toBe(210); // 200 + 10 delivery
    expect(order.orderStatus).toBe('CONFIRMED');

    const updatedP1 = await Product.findById(p1._id);
    expect(updatedP1.stock).toBe(3); // 5 - 2
  });

  it('should securely prevent overselling when stock is insufficient during checkout', async () => {
    await cartService.addItem(customerId, p1._id, 5);
    
    // Simulate concurrent purchase stealing stock
    await Product.findByIdAndUpdate(p1._id, { $inc: { stock: -1 } }); 

    await expect(
      orderService.checkout(customerId, { paymentMethod: 'COD' })
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('should restore inventory on order cancellation', async () => {
    await cartService.addItem(customerId, p1._id, 1);
    const order = await orderService.checkout(customerId, { paymentMethod: 'COD' });
    
    await orderService.cancelOrder(customerId, order._id);
    
    const restoredProduct = await Product.findById(p1._id);
    expect(restoredProduct.stock).toBe(5); // Restored
  });
});`,

  'frontend/src/pages/cart/Cart.jsx': `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mock header for the API since Auth is just headers in our setup
  const authHeaders = { 'x-user-id': '60d5ecb74d6bb892b4501234', 'x-user-role': 'CUSTOMER' };

  useEffect(() => {
    apiClient.get('/cart', { headers: authHeaders })
      .then(res => setCart(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (productId) => {
    try {
      const res = await apiClient.delete(\`/cart/items/\${productId}\`, { headers: authHeaders });
      setCart(res.data);
    } catch(err) { alert(err.message); }
  };

  if (loading) return <div className="p-8 text-center">Loading cart...</div>;
  if (!cart || cart.items.length === 0) return <div className="p-8 text-center text-gray-500">Your cart is empty. <Link to="/" className="text-blue-600">Browse Products</Link></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Shopping Cart</h1>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {cart.items.map(item => (
          <div key={item._id} className="flex justify-between items-center py-4 border-b last:border-b-0">
            <div>
              <p className="font-semibold text-gray-800">{item.productId?.name || 'Unknown Product'}</p>
              <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
            </div>
            <button onClick={() => handleRemove(item.productId?._id)} className="text-red-500 hover:text-red-700">Remove</button>
          </div>
        ))}
        <div className="mt-6 text-right">
          <Link to="/checkout" className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition">Proceed to Checkout</Link>
        </div>
      </div>
    </div>
  );
}`,
  
  'frontend/src/pages/checkout/Checkout.jsx': `import { useState } from 'react';
import apiClient from '../../api/client';

export default function Checkout() {
  const [loading, setLoading] = useState(false);
  const authHeaders = { 'x-user-id': '60d5ecb74d6bb892b4501234', 'x-user-role': 'CUSTOMER' };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const order = await apiClient.post('/orders/checkout', {
        paymentMethod: 'MOCK_ONLINE',
        shippingAddress: { city: 'New York', street: '123 Main St' }
      }, { headers: authHeaders });
      alert('Order placed successfully! ID: ' + order.data._id);
    } catch(err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-sm border mt-10">
      <h1 className="text-3xl font-bold mb-4">Checkout Summary</h1>
      <p className="mb-8 text-gray-600">Review your cart and confirm your delivery details.</p>
      <button 
        onClick={handleCheckout} 
        disabled={loading}
        className="w-full bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Place Order & Pay'}
      </button>
    </div>
  );
}`
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  console.log("Created " + filePath);
}

// Update routes/index.js
const indexRoutePath = path.join(__dirname, 'backend/routes/index.js');
let indexCode = fs.readFileSync(indexRoutePath, 'utf8');
if(!indexCode.includes('cartRoutes')) {
  indexCode = indexCode.replace(
    "module.exports = router;",
    "const cartRoutes = require('./cartRoutes');\nconst orderRoutes = require('./orderRoutes');\n\nrouter.use('/cart', cartRoutes);\nrouter.use('/orders', orderRoutes);\n\nmodule.exports = router;"
  );
  fs.writeFileSync(indexRoutePath, indexCode);
}
console.log("Updated routes/index.js for Cart & Orders");

// Update README
const readmePath = path.join(__dirname, 'README.md');
const readmeContent = `# MarketSphere

Multi-vendor E-Commerce Platform.

## Workflows

### Cart & Checkout
- **Cart:** Authenticated customers can add products to their persistent cart. Inventory is checked optimistically during \`/cart/items\` operations.
- **Checkout:** The \`/orders/checkout\` endpoint handles the final transaction. It calculates all totals on the backend natively using product references.
- **Inventory Logic:** To prevent overselling without requiring complex MongoDB Replica Sets (Transactions), we use atomic optimistic locking: \`$inc: { stock: -qty }\` combined with \`stock: { $gte: qty }\`. If the query matches 0 documents, the checkout forcefully fails and rolls back any partially held stock.

### Order Management
- Parent orders store the total summary and shipping details.
- \`orderItems\` contain seller-specific suborder details (\`sellerId\`, \`status\`).

### Payment Integration
Payments are abstracted via \`PaymentService\`. Currently supports \`COD\` and \`MOCK_ONLINE\`.

## Environment Setup
Create a \`.env\` inside \`backend/\`:
\`\`\`
PORT=5000
MONGO_URI=mongodb://localhost:27017/marketsphere
JWT_SECRET=supersecret
\`\`\`

## Run Locally
\`\`\`bash
cd backend
npm install
npm run dev

# Testing
npx jest
\`\`\`
`;
fs.writeFileSync(readmePath, readmeContent);
