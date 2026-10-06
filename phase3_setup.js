const fs = require('fs');
const path = require('path');

const files = {
  'backend/models/Review.js': `const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Ref to User
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
  reported: { type: Boolean, default: false }
}, { timestamps: true });

reviewSchema.index({ productId: 1, customerId: 1 }, { unique: true }); // Prevent duplicate reviews

module.exports = mongoose.model('Review', reviewSchema);`,

  'backend/models/Wishlist.js': `const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, // Ref to User
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
}, { timestamps: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);`,

  'backend/services/reviewService.js': `const Review = require('../models/Review');
const Product = require('../models/Product');

class ReviewService {
  async addReview(customerId, productId, rating, comment) {
    // In Phase 3, we mock the order check. Assume customer has purchased it for now.
    // In reality: const hasPurchased = await Order.exists({ customerId, 'items.productId': productId, status: 'DELIVERED' });
    const hasPurchased = true; 
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
    // Ideally Product schema would have rating fields, for now we just compute it.
    // await Product.findByIdAndUpdate(productId, { averageRating: avg, numReviews: stats[0]?.numReviews || 0 });
  }
}
module.exports = new ReviewService();`,

  'backend/services/wishlistService.js': `const Wishlist = require('../models/Wishlist');

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
module.exports = new WishlistService();`,

  'backend/controllers/reviewController.js': `const reviewService = require('../services/reviewService');

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
};`,

  'backend/controllers/wishlistController.js': `const wishlistService = require('../services/wishlistService');

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
};`,

  'backend/routes/reviewRoutes.js': `const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.post('/', requireAuth, requireRole('CUSTOMER'), reviewController.addReview);
router.put('/:id', requireAuth, requireRole('CUSTOMER'), reviewController.updateReview);

module.exports = router;`,

  'backend/routes/wishlistRoutes.js': `const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/', requireAuth, requireRole('CUSTOMER'), wishlistController.getWishlist);
router.post('/toggle', requireAuth, requireRole('CUSTOMER'), wishlistController.toggleWishlist);

module.exports = router;`,

  'backend/seed.js': `require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Seller = require('./models/Seller');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/marketsphere');
    console.log('DB Connected for seeding');

    await Category.deleteMany();
    await Product.deleteMany();
    await Seller.deleteMany();

    const electronics = await Category.create({ name: 'Electronics', slug: 'electronics' });
    const fashion = await Category.create({ name: 'Fashion', slug: 'fashion' });

    const sellerUserId = new mongoose.Types.ObjectId();
    const seller = await Seller.create({
      userId: sellerUserId,
      storeName: 'Tech Haven',
      contactEmail: 'tech@haven.com',
      status: 'APPROVED'
    });

    const products = [
      { sellerId: seller._id, name: 'Wireless Headphones', description: 'Noise cancelling', sku: 'WH-01', price: 199, category: electronics._id, stock: 50, status: 'PUBLISHED', images: ['https://via.placeholder.com/400'] },
      { sellerId: seller._id, name: 'Mechanical Keyboard', description: 'Cherry MX Red', sku: 'KB-02', price: 120, category: electronics._id, stock: 30, status: 'PUBLISHED', images: ['https://via.placeholder.com/400'] },
      { sellerId: seller._id, name: 'Cotton T-Shirt', description: '100% organic cotton', sku: 'TS-03', price: 25, category: fashion._id, stock: 100, status: 'PUBLISHED', images: ['https://via.placeholder.com/400'] }
    ];
    await Product.insertMany(products);

    console.log('Database seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
seedData();`,

  'backend/tests/wishlist.test.js': `const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const wishlistService = require('../services/wishlistService');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Wishlist Management', () => {
  const customerId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  it('should add to wishlist', async () => {
    const list = await wishlistService.toggleWishlist(customerId, productId);
    expect(list.products).toContainEqual(productId);
  });

  it('should remove from wishlist if already present', async () => {
    const list = await wishlistService.toggleWishlist(customerId, productId);
    expect(list.products).not.toContainEqual(productId);
  });
});`,

  'frontend/src/components/product/ProductCard.jsx': `import { Link } from 'react-router-dom';
export default function ProductCard({ product }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border hover:shadow-md transition">
      <img src={product.images[0] || 'https://via.placeholder.com/300'} alt={product.name} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
        <p className="text-gray-500 text-sm mt-1 truncate">{product.description}</p>
        <div className="mt-4 flex justify-between items-center">
          <span className="text-xl font-bold text-blue-600">\${product.price}</span>
          <Link to={\`/products/\${product._id}\`} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100">View</Link>
        </div>
      </div>
    </div>
  );
}`,

  'frontend/src/pages/products/ProductList.jsx': `import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import ProductCard from '../../components/product/ProductCard';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/products')
      .then(res => setProducts(res.data.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading products...</div>;
  if (!products.length) return <div className="p-8 text-center text-gray-500">No products found.</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">All Products</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map(p => <ProductCard key={p._id} product={p} />)}
      </div>
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
if(!indexCode.includes('reviewRoutes')) {
  indexCode = indexCode.replace(
    "module.exports = router;",
    "const reviewRoutes = require('./reviewRoutes');\nconst wishlistRoutes = require('./wishlistRoutes');\n\nrouter.use('/reviews', reviewRoutes);\nrouter.use('/wishlists', wishlistRoutes);\n\nmodule.exports = router;"
  );
  fs.writeFileSync(indexRoutePath, indexCode);
}
console.log("Updated routes/index.js for reviews & wishlists");
