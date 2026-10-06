const productService = require('../services/productService');

exports.createProduct = async (req, res, next) => {
  try {
    const productData = req.body;
    if (req.files && req.files.length > 0) {
      productData.images = req.files.map(file => `/uploads/${file.filename}`);
    }
    const product = await productService.createProduct(req.user._id || req.user.id, productData);
    res.status(201).json({ 
      status: 'success', 
      message: 'Product created and submitted for administrator moderation.', 
      data: product 
    });
  } catch (error) { 
    next(error); 
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const updateData = req.body;
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => `/uploads/${file.filename}`);
    }
    const product = await productService.updateProduct(req.user._id || req.user.id, req.params.id, updateData);
    res.json({ 
      status: 'success', 
      message: 'Product updated successfully.', 
      data: product 
    });
  } catch (error) { 
    next(error); 
  }
};

exports.moderateProduct = async (req, res, next) => {
  try {
    const product = await productService.moderateProduct(req.params.id, req.body.status);
    res.json({ status: 'success', message: `Product status updated to ${req.body.status}`, data: product });
  } catch (error) { 
    next(error); 
  }
};

exports.searchProducts = async (req, res, next) => {
  try {
    const result = await productService.searchProducts(req.query);
    res.json({ status: 'success', data: result });
  } catch (error) { 
    next(error); 
  }
};

exports.getProductDetails = async (req, res, next) => {
  try {
    const product = await productService.getProductDetails(req.params.id, req.user);
    res.json({ status: 'success', data: product });
  } catch (error) { 
    if (error.message === 'Product not found') {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }
    next(error); 
  }
};

exports.listCategories = async (req, res, next) => {
  try {
    const categories = await productService.listCategories();
    res.json({ status: 'success', data: categories });
  } catch (error) { 
    next(error); 
  }
};