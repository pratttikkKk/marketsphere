const crypto = require('crypto');
const User = require('../models/User');
const Seller = require('../models/Seller');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getJwtSecret } = require('../middlewares/auth');
const emailService = require('../services/emailService');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, getJwtSecret(), {
    expiresIn: '7d',
  });
};

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Strict input validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'All fields (firstName, lastName, email, password) are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(400).json({ status: 'error', message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate accurate 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // SECURITY ENFORCEMENT: Public registration ALWAYS assigns 'CUSTOMER'.
    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'CUSTOMER',
      isActive: true,
      isEmailVerified: false,
      emailOtp: otp,
      emailOtpExpires
    });

    // Send verification OTP email for free
    await emailService.sendOtpEmail(user.email, otp);

    res.status(201).json({
      status: 'success',
      message: 'Account registered! A 6-digit verification code has been sent to your email.',
      requiresOtp: true,
      email: user.email,
      ...(!emailService.isConfigured || process.env.NODE_ENV !== 'production' ? { previewOtp: otp } : {})
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ status: 'error', message: 'Email and 6-digit verification OTP are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found with this email' });
    }

    if (user.isEmailVerified) {
      return res.json({
        status: 'success',
        message: 'Email is already verified. You can log in.',
        data: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          token: generateToken(user._id, user.role)
        }
      });
    }

    if (!user.emailOtp || !user.emailOtpExpires) {
      return res.status(400).json({ status: 'error', message: 'No pending verification OTP found. Please request a new code.' });
    }

    if (new Date() > new Date(user.emailOtpExpires)) {
      return res.status(400).json({ status: 'error', message: 'Verification code has expired. Please request a new OTP.' });
    }

    if (String(user.emailOtp).trim() !== String(otp).trim()) {
      return res.status(400).json({ status: 'error', message: 'Invalid verification code. Please check your email and try again.' });
    }

    user.isEmailVerified = true;
    user.emailOtp = null;
    user.emailOtpExpires = null;
    await user.save();

    res.json({
      status: 'success',
      message: 'Email verified successfully! Welcome to MarketSphere.',
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.role)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.resendEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found with this email' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ status: 'error', message: 'Email is already verified' });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    user.emailOtp = otp;
    user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await emailService.sendOtpEmail(user.email, otp);

    res.json({
      status: 'success',
      message: 'A new 6-digit verification code has been sent to your email.',
      email: user.email,
      ...(!emailService.isConfigured || process.env.NODE_ENV !== 'production' ? { previewOtp: otp } : {})
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ status: 'error', message: 'Account is deactivated or suspended. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    if (user.isEmailVerified === false && process.env.NODE_ENV !== 'test' && user.role !== 'ADMIN') {
      const otp = crypto.randomInt(100000, 1000000).toString();
      user.emailOtp = otp;
      user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await emailService.sendOtpEmail(user.email, otp);

      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Your email address is not verified yet. A 6-digit verification OTP has been sent to your email.',
        requiresOtp: true,
        email: user.email,
        ...(!emailService.isConfigured || process.env.NODE_ENV !== 'production' ? { previewOtp: otp } : {})
      });
    }

    let sellerStatus = null;
    if (user.role === 'SELLER') {
      const seller = await Seller.findOne({ userId: user._id });
      sellerStatus = seller ? seller.status : 'PENDING';
    }

    res.json({
      status: 'success',
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        sellerStatus,
        token: generateToken(user._id, user.role)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    let seller = null;
    if (user.role === 'SELLER') {
      seller = await Seller.findOne({ userId: user._id });
    }

    res.json({ 
      status: 'success', 
      data: {
        ...user.toObject(),
        seller: seller || null
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ status: 'success', message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    if (phone) user.phone = phone.trim();

    await user.save();
    res.json({ status: 'success', message: 'Profile updated', data: user });
  } catch (error) {
    next(error);
  }
};

exports.addAddress = async (req, res, next) => {
  try {
    const { fullName, phone, street, city, state, zipCode, country, isDefault } = req.body;
    if (!street || !city || !state || !zipCode) {
      return res.status(400).json({ status: 'error', message: 'Street, city, state, and zipCode are required' });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    if (isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }

    user.addresses.push({
      fullName: fullName || `${user.firstName} ${user.lastName}`,
      phone: phone || user.phone || 'N/A',
      street,
      city,
      state,
      zipCode,
      country: country || 'India',
      isDefault: Boolean(isDefault)
    });

    await user.save();
    res.status(201).json({ status: 'success', message: 'Address added', data: user.addresses });
  } catch (error) {
    next(error);
  }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    user.addresses = user.addresses.filter(a => a._id.toString() !== req.params.addressId);
    await user.save();
    res.json({ status: 'success', message: 'Address removed', data: user.addresses });
  } catch (error) {
    next(error);
  }
};
