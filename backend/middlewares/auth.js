const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');

// Get JWT secret with secure production fallback
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your_jwt_secret_here' || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[SECURITY] JWT_SECRET is unset or below 32 chars. Using secure system production fallback secret.');
      return 'marketsphere_jwt_secure_prod_fallback_secret_key_2026_9876543210_enterprise';
    }
    return 'marketsphere_jwt_secure_development_secret_key_2026';
  }
  return secret;
};

const requireAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Not authorized: Authentication token missing' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Not authorized: User no longer exists' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Account has been deactivated or suspended' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Not authorized: Invalid or expired token' });
  }
};

const requireRole = (...roles) => {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Not authorized' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: `Forbidden: Requires one of [${allowed.join(', ')}] role` });
    }
    next();
  };
};

const requireApprovedSeller = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized' });
  }

  // Admin bypass for administrative maintenance
  if (req.user.role === 'ADMIN') {
    return next();
  }

  if (req.user.role !== 'SELLER') {
    return res.status(403).json({ status: 'error', message: 'Forbidden: Requires SELLER role' });
  }

  const seller = await Seller.findOne({ userId: req.user._id });
  if (!seller) {
    return res.status(403).json({ status: 'error', message: 'Forbidden: No seller profile found. Please submit an application.' });
  }

  if (seller.status !== 'APPROVED') {
    return res.status(403).json({ 
      status: 'error', 
      message: `Forbidden: Seller account is currently ${seller.status}. Access granted only after admin approval.`,
      sellerStatus: seller.status
    });
  }

  req.seller = seller;
  next();
};

const requireActiveAccount = (req, res, next) => {
  if (req.user && req.user.isActive === false) {
    return res.status(403).json({ status: 'error', message: 'Forbidden: Account is inactive' });
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (user && user.isActive !== false) {
      req.user = user;
    }
  } catch (err) {
    // Ignore invalid token for optional auth, user remains unauthenticated
  }
  next();
};

module.exports = {
  getJwtSecret,
  requireAuth,
  requireRole,
  requireApprovedSeller,
  requireActiveAccount,
  optionalAuth
};