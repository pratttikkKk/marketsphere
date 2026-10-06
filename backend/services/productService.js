const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Category = require('../models/Category');

class ProductService {
  async createProduct(sellerUserId, productData) {
    const seller = await Seller.findOne({ userId: sellerUserId });
    if (!seller) {
      throw new Error('No seller profile found. Please register as a seller first.');
    }
    if (seller.status !== 'APPROVED') {
      const err = new Error(`Seller account status is ${seller.status}. Only APPROVED sellers can publish products.`);
      err.statusCode = 403;
      throw err;
    }

    // Ensure category exists
    let categoryId = productData.category;
    if (!categoryId) {
      let defaultCat = await Category.findOne();
      if (!defaultCat) {
        defaultCat = await Category.create({ name: 'General', slug: 'general', description: 'General items' });
      }
      categoryId = defaultCat._id;
    }

    const price = Number(productData.price);
    if (isNaN(price) || price < 0) {
      throw new Error('Invalid product price');
    }

    const stock = Number(productData.stock || 0);
    if (isNaN(stock) || stock < 0) {
      throw new Error('Invalid product stock');
    }

    const sku = productData.sku && productData.sku.trim() !== '' 
      ? productData.sku.trim().toUpperCase() 
      : 'SKU-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

    // Check SKU uniqueness
    const existingSku = await Product.findOne({ sku });
    if (existingSku) {
      throw new Error(`SKU ${sku} is already in use`);
    }

    // New products are submitted for moderation (or DRAFT if explicitly requested)
    const initialStatus = productData.status === 'DRAFT' ? 'DRAFT' : 'PENDING_MODERATION';

    const sellerUpiId = productData.sellerUpiId ? productData.sellerUpiId.trim() : (seller.upiId || '');
    const sellerUpiQr = productData.sellerUpiQr ? productData.sellerUpiQr.trim() : (seller.upiQr || '');

    if (sellerUpiId && !seller.upiId) {
      seller.upiId = sellerUpiId;
      if (sellerUpiQr) seller.upiQr = sellerUpiQr;
      await seller.save();
    }

    const product = new Product({
      name: productData.name ? productData.name.trim() : 'Untitled Product',
      description: productData.description ? productData.description.trim() : '',
      sku,
      price,
      stock,
      category: categoryId,
      images: Array.isArray(productData.images) ? productData.images : [],
      attributes: productData.attributes || {},
      variants: Array.isArray(productData.variants) ? productData.variants : [],
      sellerId: seller._id,
      sellerUpiId,
      sellerUpiQr,
      status: initialStatus
    });

    return await product.save();
  }

  async updateProduct(sellerUserId, productId, updateData) {
    const seller = await Seller.findOne({ userId: sellerUserId });
    if (!seller) throw new Error('Seller profile not found');
    
    const product = await Product.findOne({ _id: productId, sellerId: seller._id });
    if (!product) throw new Error('Product not found or unauthorized');

    // Strict Field Whitelist for Seller Updates
    if (updateData.name !== undefined) product.name = updateData.name.trim();
    if (updateData.description !== undefined) product.description = updateData.description.trim();
    if (updateData.price !== undefined) {
      const p = Number(updateData.price);
      if (isNaN(p) || p < 0) throw new Error('Invalid price');
      product.price = p;
    }
    if (updateData.stock !== undefined) {
      const s = Number(updateData.stock);
      if (isNaN(s) || s < 0) throw new Error('Invalid stock quantity');
      product.stock = s;
    }
    if (updateData.category !== undefined) product.category = updateData.category;
    if (updateData.attributes !== undefined) product.attributes = updateData.attributes;
    if (updateData.variants !== undefined) product.variants = updateData.variants;
    if (updateData.images !== undefined && Array.isArray(updateData.images)) {
      product.images = updateData.images;
    }
    if (updateData.sellerUpiId !== undefined) product.sellerUpiId = updateData.sellerUpiId.trim();
    if (updateData.sellerUpiQr !== undefined) product.sellerUpiQr = updateData.sellerUpiQr.trim();

    // If product was previously REJECTED, editing moves it back to PENDING_MODERATION
    if (product.status === 'REJECTED') {
      product.status = 'PENDING_MODERATION';
    } else if (updateData.status === 'DRAFT' && product.status === 'PENDING_MODERATION') {
      product.status = 'DRAFT';
    } else if (updateData.status === 'PENDING_MODERATION' && product.status === 'DRAFT') {
      product.status = 'PENDING_MODERATION';
    }
    // Seller CANNOT set status = 'PUBLISHED'! That is reserved for Admin moderation.

    return await product.save();
  }

  async moderateProduct(productId, status) {
    if (!['PUBLISHED', 'REJECTED', 'DRAFT', 'ARCHIVED', 'PENDING_MODERATION'].includes(status)) {
      throw new Error('Invalid moderation status');
    }
    const product = await Product.findByIdAndUpdate(productId, { status }, { new: true });
    if (!product) throw new Error('Product not found');
    return product;
  }

  async getProductDetails(productId, requestingUser = null) {
    const product = await Product.findById(productId)
      .populate('category', 'name slug')
      .populate('sellerId', 'storeName status');
    if (!product) throw new Error('Product not found');

    // Security Gate: Non-PUBLISHED products are NOT accessible to the public
    if (product.status !== 'PUBLISHED') {
      if (!requestingUser) {
        throw new Error('Product not found');
      }
      if (requestingUser.role === 'ADMIN') {
        return product; // Admin can inspect
      }
      if (requestingUser.role === 'SELLER') {
        const seller = await Seller.findOne({ userId: requestingUser._id || requestingUser.id });
        if (seller && product.sellerId && product.sellerId._id.toString() === seller._id.toString()) {
          return product; // Owning seller can view
        }
      }
      throw new Error('Product not found');
    }

    return product;
  }

  async listCategories() {
    return await Category.find();
  }

  async searchProducts(query) {
    const { keyword, category, minPrice, maxPrice, sellerId, sortBy, page = 1, limit = 12 } = query;
    // Public queries ONLY return PUBLISHED products
    const filter = { status: 'PUBLISHED' };

    if (keyword && keyword.trim() !== '') {
      filter.$or = [
        { name: { $regex: keyword.trim(), $options: 'i' } },
        { description: { $regex: keyword.trim(), $options: 'i' } },
        { sku: { $regex: keyword.trim(), $options: 'i' } }
      ];
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
    if (sortBy === 'rating') sortObj = { averageRating: -1 };

    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 12));
    const skip = (parsedPage - 1) * parsedLimit;

    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parsedLimit)
      .populate('category', 'name slug')
      .populate('sellerId', 'storeName');
    
    const total = await Product.countDocuments(filter);
    
    return { products, total, page: parsedPage, pages: Math.ceil(total / parsedLimit) || 1 };
  }
}

module.exports = new ProductService();