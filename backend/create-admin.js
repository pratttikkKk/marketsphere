require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function bootstrapAdmin() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/marketsphere';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@marketsphere.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@MarketSphere2026!';
  const firstName = process.env.ADMIN_FIRST_NAME || 'Platform';
  const lastName = process.env.ADMIN_LAST_NAME || 'Administrator';

  try {
    await mongoose.connect(mongoUri);
    console.log('[BOOTSTRAP] Connected to MongoDB for Admin creation');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    let admin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (admin) {
      admin.role = 'ADMIN';
      admin.passwordHash = passwordHash;
      admin.isActive = true;
      await admin.save();
      console.log(`[BOOTSTRAP] Existing user promoted to ADMIN: ${adminEmail}`);
    } else {
      admin = await User.create({
        firstName,
        lastName,
        email: adminEmail.toLowerCase(),
        passwordHash,
        role: 'ADMIN',
        isActive: true
      });
      console.log(`[BOOTSTRAP] New ADMIN account created successfully: ${adminEmail}`);
    }

    console.log(`[BOOTSTRAP] Admin user ID: ${admin._id}`);
  } catch (err) {
    console.error('[BOOTSTRAP] Error bootstrapping admin:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[BOOTSTRAP] Database disconnected');
  }
}

bootstrapAdmin();
