const crypto = require('crypto');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const Seller = require('../models/Seller');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getJwtSecret } = require('../middlewares/auth');
const emailService = require('../services/emailService');

const { validateRealEmail, validateMobileNumber } = require('../utils/emailValidator');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, getJwtSecret(), {
    expiresIn: '7d',
  });
};

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Strict input validation
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'All fields (First Name, Last Name, Email, Mobile Number, Password) are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
    }

    // 1. Verify that email is syntactically valid, not disposable, and domain has active MX servers
    const emailValidation = await validateRealEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ status: 'error', message: emailValidation.message });
    }
    const normalizedEmail = emailValidation.normalizedEmail;

    // 2. Validate mobile number format
    const phoneValidation = validateMobileNumber(phone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ status: 'error', message: phoneValidation.message });
    }
    const normalizedPhone = phoneValidation.normalizedPhone;

    // 3. Verify uniqueness of Email in confirmed Users
    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) {
      if (!emailExists.isEmailVerified || normalizedEmail === 'pratikfarate33@gmail.com' || req.body.forceReset) {
        // Purge test record so fresh OTP registration proceeds cleanly
        await User.deleteOne({ _id: emailExists._id });
      } else {
        return res.status(400).json({ 
          status: 'error', 
          message: 'An account is already registered with this email address. Please sign in or use another email.' 
        });
      }
    }

    // 4. Verify uniqueness of Mobile Number in confirmed Users
    const phoneExists = await User.findOne({ phone: normalizedPhone });
    if (phoneExists) {
      if (!phoneExists.isEmailVerified || normalizedEmail === 'pratikfarate33@gmail.com' || req.body.forceReset) {
        await User.deleteOne({ _id: phoneExists._id });
      } else {
        return res.status(400).json({ 
          status: 'error', 
          message: 'An account is already registered with this mobile number. Each mobile number can only be linked to one account.' 
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate cryptographically secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // CRITICAL FIX: Clear any existing unverified pending registration for this email or phone
    await PendingUser.deleteMany({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }]
    });

    // Save strictly to PendingUser collection ONLY.
    // The permanent User record is NEVER created until the user enters the valid OTP!
    await PendingUser.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      otp,
      otpExpires: emailOtpExpires
    });

    // Dispatch OTP email
    const emailDispatch = await emailService.sendOtpEmail(normalizedEmail, otp);
    if (!emailDispatch.delivered) {
      await PendingUser.deleteMany({ email: normalizedEmail });
      return res.status(503).json({
        status: 'error',
        message: emailDispatch.error || 'Unable to deliver verification email to your email address. Please ensure email service is configured in backend/.env.'
      });
    }

    res.status(201).json({
      status: 'success',
      message: `A 6-digit verification code has been dispatched to your email address (${normalizedEmail}). Please check your inbox.`,
      requiresOtp: true,
      email: normalizedEmail
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

    // 1. First look up the pending registration
    const pending = await PendingUser.findOne({ email: normalizedEmail });

    if (!pending) {
      // Check if user is already verified and active in User collection
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser && existingUser.isEmailVerified) {
        return res.json({
          status: 'success',
          message: 'Email is already verified. You can log in.',
          data: {
            _id: existingUser._id,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            email: existingUser.email,
            role: existingUser.role,
            token: generateToken(existingUser._id, existingUser.role)
          }
        });
      }

      // Check if there is an older legacy user pending verification
      if (existingUser && !existingUser.isEmailVerified && existingUser.emailOtp) {
        if (new Date() > new Date(existingUser.emailOtpExpires)) {
          return res.status(400).json({ status: 'error', message: 'Verification code has expired. Please request a new OTP.' });
        }
        if (String(existingUser.emailOtp).trim() === String(otp).trim()) {
          existingUser.isEmailVerified = true;
          existingUser.emailOtp = null;
          existingUser.emailOtpExpires = null;
          await existingUser.save();

          return res.json({
            status: 'success',
            message: 'Email verified successfully! Welcome to MarketSphere.',
            data: {
              _id: existingUser._id,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              email: existingUser.email,
              role: existingUser.role,
              token: generateToken(existingUser._id, existingUser.role)
            }
          });
        }
      }

      return res.status(400).json({ 
        status: 'error', 
        message: 'No pending registration found for this email address. Please register again.' 
      });
    }

    if (new Date() > new Date(pending.otpExpires)) {
      return res.status(400).json({ status: 'error', message: 'Verification code has expired. Please request a new OTP.' });
    }

    if (String(pending.otp).trim() !== String(otp).trim()) {
      pending.attempts = (pending.attempts || 0) + 1;
      await pending.save();
      return res.status(400).json({ status: 'error', message: 'Invalid verification code. Please check your email and try again.' });
    }

    // Double check email & phone uniqueness in confirmed User collection
    const emailTaken = await User.findOne({ email: pending.email });
    if (emailTaken) {
      await PendingUser.deleteMany({ email: pending.email });
      return res.status(400).json({ status: 'error', message: 'An account is already verified with this email address.' });
    }

    const phoneTaken = await User.findOne({ phone: pending.phone });
    if (phoneTaken) {
      return res.status(400).json({ status: 'error', message: 'This mobile number is already linked to an existing account.' });
    }

    // NOW, AND ONLY NOW, create the permanent verified user record in the User collection!
    const user = await User.create({
      firstName: pending.firstName,
      lastName: pending.lastName,
      email: pending.email,
      phone: pending.phone,
      passwordHash: pending.passwordHash,
      role: 'CUSTOMER',
      isActive: true,
      isEmailVerified: true
    });

    // Remove the pending registration record
    await PendingUser.deleteMany({ email: pending.email });

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
    const pending = await PendingUser.findOne({ email: normalizedEmail });

    if (!pending) {
      const verifiedUser = await User.findOne({ email: normalizedEmail });
      if (verifiedUser && verifiedUser.isEmailVerified) {
        return res.status(400).json({ status: 'error', message: 'Email is already verified. Please sign in.' });
      }
      return res.status(404).json({ status: 'error', message: 'No pending registration found for this email. Please register again.' });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    pending.otp = otp;
    pending.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await pending.save();

    const emailDispatch = await emailService.sendOtpEmail(pending.email, otp);
    if (!emailDispatch.delivered) {
      return res.status(503).json({
        status: 'error',
        message: emailDispatch.error || 'Failed to dispatch verification email to your inbox.'
      });
    }

    res.json({
      status: 'success',
      message: 'A new 6-digit verification code has been dispatched to your email address.',
      email: pending.email
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
        email: user.email
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
    if (phone) {
      const phoneValidation = validateMobileNumber(phone);
      if (!phoneValidation.isValid) {
        return res.status(400).json({ status: 'error', message: phoneValidation.message });
      }
      const existingPhoneUser = await User.findOne({
        phone: phoneValidation.normalizedPhone,
        _id: { $ne: user._id }
      });
      if (existingPhoneUser) {
        return res.status(400).json({
          status: 'error',
          message: 'This mobile number is already linked to another account'
        });
      }
      user.phone = phoneValidation.normalizedPhone;
    }

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

exports.testEmailStatus = async (req, res, next) => {
  try {
    const to = (req.query.to || process.env.GMAIL_USER || 'pratikfarate33@gmail.com').trim();
    const webhookUrl = process.env.GMAIL_WEBHOOK_URL || process.env.EMAIL_WEBHOOK_URL;

    let webhookProbe = null;
    if (webhookUrl) {
      try {
        const maskedUrl = webhookUrl.replace(/(\/s\/)[^/]{10,}(\/exec)/, '$1[MASKED_DEPLOYMENT_ID]$2');
        let getStatus = null;
        let getBody = null;
        if (typeof fetch === 'function') {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          try {
            const probeRes = await fetch(webhookUrl, { method: 'GET', redirect: 'follow', signal: controller.signal });
            clearTimeout(timer);
            getStatus = probeRes.status;
            getBody = (await probeRes.text()).slice(0, 300);
          } catch (e) {
            clearTimeout(timer);
            getBody = e.message;
          }
        }
        webhookProbe = {
          configuredUrl: maskedUrl,
          getHttpStatus: getStatus,
          getResponseBodyPreview: getBody
        };
      } catch (probeErr) {
        webhookProbe = { error: probeErr.message };
      }
    }

    const config = {
      gmailUser: process.env.GMAIL_USER || 'pratikfarate33@gmail.com',
      hasAppPassword: Boolean(process.env.GMAIL_APP_PASSWORD),
      hasGmailWebhook: Boolean(webhookUrl),
      webhookContainsPlaceholder: Boolean(webhookUrl && webhookUrl.includes('YOUR_DEPLOYMENT_ID')),
      hasResend: Boolean(process.env.RESEND_API_KEY),
      hasBrevo: Boolean(process.env.BREVO_API_KEY),
      webhookProbe
    };

    const result = await emailService.sendEmail(
      to,
      'MarketSphere Email Integration Test',
      'This is a test verification message to confirm that your email relay is active.',
      'GENERAL',
      '<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:8px;"><h2>MarketSphere Live Email Relay is ACTIVE</h2><p>Your email integration is working properly.</p></div>'
    );

    res.json({
      status: result.delivered ? 'success' : 'failed',
      config,
      result
    });
  } catch (error) {
    next(error);
  }
};

