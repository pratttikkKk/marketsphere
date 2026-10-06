const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Seller = require('./models/Seller');
const Category = require('./models/Category');
const Product = require('./models/Product');
require('dotenv').config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/marketsphere');
    console.log('Connected to MongoDB');

    // Clear existing
    await User.deleteMany({});
    await Seller.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Admin
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@marketsphere.com',
      passwordHash,
      role: 'ADMIN'
    });
    console.log('Created Admin: admin@marketsphere.com / password123');

    // 2. Customer
    const customer = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'customer@marketsphere.com',
      passwordHash,
      role: 'CUSTOMER'
    });
    console.log('Created Customer: customer@marketsphere.com / password123');

    // 3. Seller
    const sellerUser = await User.create({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'seller@marketsphere.com',
      passwordHash,
      role: 'SELLER'
    });
    console.log('Created Seller User: seller@marketsphere.com / password123');

    const sellerProfile = await Seller.create({
      userId: sellerUser._id,
      storeName: 'Tech Haven',
      storeDescription: 'Best gadgets in town',
      contactEmail: 'seller@marketsphere.com',
      status: 'APPROVED'
    });

    // 4. Category
    const category = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Gadgets and devices'
    });

    // 5. Products
    const products = [
      {
        sellerId: sellerProfile._id,
        name: 'Wireless Headphones',
        description: 'Noise cancelling over-ear headphones',
        sku: 'WH-1000',
        price: 199.99,
        category: category._id,
        stock: 50,
        status: 'PUBLISHED',
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80']
      },
      {
        sellerId: sellerProfile._id,
        name: 'Smart Watch',
        description: 'Fitness tracker with heart rate monitor',
        sku: 'SW-200',
        price: 149.50,
        category: category._id,
        stock: 30,
        status: 'PUBLISHED',
        images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80']
      },
      {
        sellerId: sellerProfile._id,
        name: '4K Action Camera',
        description: 'Waterproof action camera with 4K recording',
        sku: 'AC-4K',
        price: 249.00,
        category: category._id,
        stock: 15,
        status: 'PUBLISHED',
        images: ['https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&q=80']
      },
      {
        sellerId: sellerProfile._id,
        name: 'Portable Bluetooth Speaker',
        description: 'Waterproof speaker with 12hr battery',
        sku: 'PBS-12',
        price: 79.99,
        category: category._id,
        stock: 100,
        status: 'PUBLISHED',
        images: ['https://images.unsplash.com/photo-1608043152269-4171691a52b8?w=500&q=80']
      }
    ];

    await Product.insertMany(products);
    console.log('Created 4 dummy products');

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();