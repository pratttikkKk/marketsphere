const fs = require('fs');
const path = require('path');

const files = {
  'backend/models/Seller.js': `const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, // Ref to User (omitted for brevity)
  storeName: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  contactEmail: { type: String, required: true, match: /.+@.+\\..+/ },
  contactPhone: { type: String },
  businessAddress: { type: String },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], 
    default: 'PENDING' 
  }
}, { timestamps: true });

// Indexes for common queries
sellerSchema.index({ status: 1 });
sellerSchema.index({ storeName: 1 });

module.exports = mongoose.model('Seller', sellerSchema);`,

  'backend/models/Category.js': `const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);`,

  'backend/models/Product.js': `const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  sku: { type: String, required: true, unique: true, uppercase: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  images: [{ type: String }], // Array of URLs
  stock: { type: Number, required: true, min: 0, default: 0 },
  attributes: { type: Map, of: String }, // e.g., { brand: "Nike", material: "Cotton" }
  variants: [{ // Embedded for simplicity, avoiding joins for product options
    name: String, // e.g., "Size"
    value: String // e.g., "Large"
  }],
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'ARCHIVED'],
    default: 'DRAFT'
  }
}, { timestamps: true });

// Compound text index for search
productSchema.index({ name: 'text', description: 'text' });
// Indexes for filtering and sorting
productSchema.index({ category: 1, status: 1 });
productSchema.index({ sellerId: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);`,

  'backend/services/imageService.js': `/**
 * Abstraction for image storage. 
 * Currently uses a mock local approach to prepare for AWS S3 / Cloudinary.
 * Credentials should be read from process.env and never hardcoded.
 */
class ImageService {
  async uploadImage(fileBuffer, fileName) {
    // TODO: integrate with process.env.CLOUD_STORAGE_BUCKET
    // For development, simulate successful upload and return mock URL
    return \`https://mock-storage.local/images/\${Date.now()}_\${fileName}\`;
  }
  
  async deleteImage(imageUrl) {
    // TODO: Implement cloud deletion
    return true;
  }
}
module.exports = new ImageService();`,

  'backend/services/sellerService.js': `const Seller = require('../models/Seller');

class SellerService {
  async createProfile(userId, profileData) {
    const existing = await Seller.findOne({ userId });
    if (existing) throw new Error('Seller profile already exists for this user');
    const seller = new Seller({ ...profileData, userId });
    return await seller.save();
  }

  async getProfileByUserId(userId) {
    return await Seller.findOne({ userId });
  }

  async updateProfile(userId, updateData) {
    // Prevent status updates via profile edit
    delete updateData.status; 
    delete updateData.userId;
    const seller = await Seller.findOneAndUpdate({ userId }, updateData, { new: true });
    if (!seller) throw new Error('Seller profile not found');
    return seller;
  }

  async updateSellerStatus(sellerId, newStatus) {
    // Only Admin should call this
    const seller = await Seller.findByIdAndUpdate(sellerId, { status: newStatus }, { new: true });
    if (!seller) throw new Error('Seller not found');
    return seller;
  }
}
module.exports = new SellerService();`,

  'backend/services/productService.js': `const Product = require('../models/Product');
const Seller = require('../models/Seller');

class ProductService {
  async createProduct(sellerUserId, productData) {
    const seller = await Seller.findOne({ userId: sellerUserId });
    if (!seller) throw new Error('Seller profile not found');
    if (seller.status !== 'APPROVED') throw new Error('Only approved sellers can create products');

    const product = new Product({
      ...productData,
      sellerId: seller._id,
      status: 'PENDING_MODERATION' // Requires admin approval based on architecture rules
    });
    return await product.save();
  }

  async updateProduct(sellerUserId, productId, updateData) {
    const seller = await Seller.findOne({ userId: sellerUserId });
    if (!seller) throw new Error('Seller profile not found');
    
    const product = await Product.findOne({ _id: productId, sellerId: seller._id });
    if (!product) throw new Error('Product not found or unauthorized');

    // Prevent direct status changes to published by seller
    if (updateData.status && ['PUBLISHED', 'REJECTED'].includes(updateData.status)) {
      throw new Error('Sellers cannot directly publish or reject products');
    }

    Object.assign(product, updateData);
    return await product.save();
  }

  async moderateProduct(productId, status) {
    // Admin only
    const product = await Product.findByIdAndUpdate(productId, { status }, { new: true });
    if (!product) throw new Error('Product not found');
    return product;
  }

  async searchProducts(query) {
    const { keyword, category, minPrice, maxPrice, sellerId, sortBy, page = 1, limit = 10 } = query;
    const filter = { status: 'PUBLISHED' }; // Customers only see published items

    if (keyword) {
      filter.$text = { $search: keyword };
    }
    if (category) filter.category = category;
    if (sellerId) filter.sellerId = sellerId;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let sortObj = { createdAt: -1 };
    if (sortBy === 'price_asc') sortObj = { price: 1 };
    if (sortBy === 'price_desc') sortObj = { price: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .populate('category', 'name slug')
      .populate('sellerId', 'storeName');
    
    const total = await Product.countDocuments(filter);
    
    return { products, total, page: Number(page), pages: Math.ceil(total / limit) };
  }
}
module.exports = new ProductService();`,

  'backend/middlewares/auth.js': `// Mock Auth Middleware for testing
const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
  req.user = { id: userId, role: role || 'CUSTOMER' };
  next();
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };`,

  'backend/controllers/sellerController.js': `const sellerService = require('../services/sellerService');

exports.createProfile = async (req, res, next) => {
  try {
    const profile = await sellerService.createProfile(req.user.id, req.body);
    res.status(201).json({ status: 'success', data: profile });
  } catch (error) { next(error); }
};

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await sellerService.getProfileByUserId(req.user.id);
    if (!profile) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'success', data: profile });
  } catch (error) { next(error); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const profile = await sellerService.updateProfile(req.user.id, req.body);
    res.json({ status: 'success', data: profile });
  } catch (error) { next(error); }
};

exports.moderateSeller = async (req, res, next) => {
  try {
    const profile = await sellerService.updateSellerStatus(req.params.id, req.body.status);
    res.json({ status: 'success', data: profile });
  } catch (error) { next(error); }
};`,

  'backend/controllers/productController.js': `const productService = require('../services/productService');

exports.createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.user.id, req.body);
    res.status(201).json({ status: 'success', data: product });
  } catch (error) { next(error); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.user.id, req.params.id, req.body);
    res.json({ status: 'success', data: product });
  } catch (error) { next(error); }
};

exports.moderateProduct = async (req, res, next) => {
  try {
    const product = await productService.moderateProduct(req.params.id, req.body.status);
    res.json({ status: 'success', data: product });
  } catch (error) { next(error); }
};

exports.searchProducts = async (req, res, next) => {
  try {
    const result = await productService.searchProducts(req.query);
    res.json({ status: 'success', data: result });
  } catch (error) { next(error); }
};`,

  'backend/routes/sellerRoutes.js': `const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.post('/', requireAuth, requireRole('SELLER'), sellerController.createProfile);
router.get('/me', requireAuth, requireRole('SELLER'), sellerController.getProfile);
router.put('/me', requireAuth, requireRole('SELLER'), sellerController.updateProfile);

// Admin Routes
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), sellerController.moderateSeller);

module.exports = router;`,

  'backend/routes/productRoutes.js': `const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// Public Search
router.get('/', productController.searchProducts);

// Seller Routes
router.post('/', requireAuth, requireRole('SELLER'), productController.createProduct);
router.put('/:id', requireAuth, requireRole('SELLER'), productController.updateProduct);

// Admin Routes
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), productController.moderateProduct);

module.exports = router;`,

  'backend/tests/seller.test.js': `const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sellerService = require('../services/sellerService');

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

describe('Seller Management', () => {
  const userId = new mongoose.Types.ObjectId();
  
  it('should allow seller to create profile and default to PENDING', async () => {
    const profile = await sellerService.createProfile(userId, {
      storeName: 'Test Store',
      contactEmail: 'test@store.com'
    });
    expect(profile.storeName).toBe('Test Store');
    expect(profile.status).toBe('PENDING');
  });

  it('should prevent seller from updating their own status', async () => {
    await sellerService.createProfile(userId, { storeName: 'Store 1', contactEmail: 'test@test.com' });
    const updated = await sellerService.updateProfile(userId, { status: 'APPROVED' });
    expect(updated.status).toBe('PENDING'); // Should ignore status
  });

  it('should allow ADMIN to update seller status', async () => {
    const profile = await sellerService.createProfile(userId, { storeName: 'Store', contactEmail: 'a@a.com' });
    const updated = await sellerService.updateSellerStatus(profile._id, 'APPROVED');
    expect(updated.status).toBe('APPROVED');
  });
});`,

  'backend/tests/product.test.js': `const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const productService = require('../services/productService');
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

describe('Product Management', () => {
  let categoryId, approvedSellerId, unapprovedSellerId;
  const approvedUserId = new mongoose.Types.ObjectId();
  const unapprovedUserId = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    const cat = await Category.create({ name: 'Electronics', slug: 'electronics' });
    categoryId = cat._id;

    const s1 = await Seller.create({ userId: approvedUserId, storeName: 'Appr Store', contactEmail: 'a@a.com', status: 'APPROVED' });
    approvedSellerId = s1._id;

    await Seller.create({ userId: unapprovedUserId, storeName: 'Pend Store', contactEmail: 'p@p.com', status: 'PENDING' });
  });

  it('should prevent unapproved sellers from creating products', async () => {
    await expect(
      productService.createProduct(unapprovedUserId, { name: 'Item', description: 'desc', sku: 'SKU1', price: 10, category: categoryId })
    ).rejects.toThrow('Only approved sellers can create products');
  });

  it('should allow approved sellers to create products defaulting to PENDING_MODERATION', async () => {
    const p = await productService.createProduct(approvedUserId, { name: 'Item', description: 'desc', sku: 'SKU2', price: 10, category: categoryId });
    expect(p.name).toBe('Item');
    expect(p.status).toBe('PENDING_MODERATION');
  });

  it('should strictly enforce ownership: seller cannot update another sellers product', async () => {
    const p = await productService.createProduct(approvedUserId, { name: 'My Item', description: 'desc', sku: 'SKU3', price: 10, category: categoryId });
    
    const anotherApprovedUserId = new mongoose.Types.ObjectId();
    await Seller.create({ userId: anotherApprovedUserId, storeName: 'Another Store', contactEmail: 'b@b.com', status: 'APPROVED' });
    
    await expect(
      productService.updateProduct(anotherApprovedUserId, p._id, { price: 20 })
    ).rejects.toThrow('Product not found or unauthorized');
  });
});`
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

// Update routes/index.js to include new routes
const indexRoutePath = path.join(__dirname, 'backend/routes/index.js');
let indexCode = fs.readFileSync(indexRoutePath, 'utf8');
if(!indexCode.includes('sellerRoutes')) {
  indexCode = indexCode.replace(
    "module.exports = router;",
    "const sellerRoutes = require('./sellerRoutes');\nconst productRoutes = require('./productRoutes');\n\nrouter.use('/sellers', sellerRoutes);\nrouter.use('/products', productRoutes);\n\nmodule.exports = router;"
  );
  fs.writeFileSync(indexRoutePath, indexCode);
}
console.log("Updated routes/index.js");
