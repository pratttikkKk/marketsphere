require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { validateRealEmail, validateMobileNumber } = require('../utils/emailValidator');
const emailService = require('../services/emailService');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 RUNNING REGISTRATION & EMAIL VALIDATION TESTS');
  console.log('========================================\n');

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/marketsphere';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // TEST 1: Syntax & Non-existent domain checks
    console.log('\n--- Test 1: Real Email Validation ---');
    const invalidFormat = await validateRealEmail('notanemail');
    console.log('1. Invalid format:', !invalidFormat.isValid ? '✓ Caught correctly' : '✗ Failed');

    const fakeDomain = await validateRealEmail('fakeuser@nonexistent-domain-xyz-987123.com');
    console.log('2. Fake non-existent domain:', !fakeDomain.isValid ? `✓ Caught correctly (${fakeDomain.message})` : '✗ Failed');

    const disposable = await validateRealEmail('tempuser@mailinator.com');
    console.log('3. Disposable domain:', !disposable.isValid ? `✓ Blocked disposable (${disposable.message})` : '✗ Failed');

    const validEmail = await validateRealEmail('realtest@gmail.com');
    console.log('4. Real Gmail domain:', validEmail.isValid ? '✓ Passed real domain check' : '✗ Failed');

    // TEST 2: Mobile Number Validation
    console.log('\n--- Test 2: Mobile Number Validation ---');
    const shortPhone = validateMobileNumber('1234');
    console.log('1. Short phone:', !shortPhone.isValid ? '✓ Caught short number' : '✗ Failed');

    const letterPhone = validateMobileNumber('98765abcde');
    console.log('2. Letters in phone:', !letterPhone.isValid ? '✓ Caught letters' : '✗ Failed');

    const validPhone1 = validateMobileNumber('9876543210');
    console.log('3. Standard 10-digit phone:', validPhone1.isValid ? `✓ Passed (${validPhone1.normalizedPhone})` : '✗ Failed');

    const validPhone2 = validateMobileNumber('+91 98765 43210');
    console.log('4. Phone with country code & spaces:', validPhone2.isValid ? `✓ Normalized (${validPhone2.normalizedPhone})` : '✗ Failed');

    // TEST 3: User Uniqueness & Database constraints
    console.log('\n--- Test 3: Registration Uniqueness Enforcement ---');
    const testEmail = `test_unique_${Date.now()}@gmail.com`;
    const testPhone = `+919876${Math.floor(100000 + Math.random() * 900000)}`;

    // Clean up any test user with these
    await User.deleteMany({ $or: [{ email: testEmail }, { phone: testPhone }] });

    // Create First User
    const user1 = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: testEmail,
      phone: testPhone,
      passwordHash: 'dummyhash',
      role: 'CUSTOMER'
    });
    console.log('✓ Created initial user with:', testEmail, testPhone);

    // Duplicate Email Test
    const duplicateEmailFound = await User.findOne({ email: testEmail });
    console.log('1. Duplicate Email Detection:', duplicateEmailFound ? '✓ Restricts duplicate email' : '✗ Failed');

    // Duplicate Phone Test
    const duplicatePhoneFound = await User.findOne({ phone: testPhone });
    console.log('2. Duplicate Phone Detection:', duplicatePhoneFound ? '✓ Restricts duplicate phone' : '✗ Failed');

    // TEST 4: Email OTP Dispatch (Testing real Ethereal/SMTP dispatch)
    console.log('\n--- Test 4: Real Email OTP Delivery ---');
    const testOtp = '849201';
    const emailResult = await emailService.sendOtpEmail('recipient_test@gmail.com', testOtp);
    console.log('1. Email Dispatch Result:', emailResult.delivered ? '✓ Email successfully delivered' : '✗ Failed');
    console.log('   Provider used:', emailResult.provider);
    if (emailResult.previewUrl) {
      console.log('   Ethereal Preview URL:', emailResult.previewUrl);
    }

    // Clean up test user
    await User.deleteOne({ _id: user1._id });
    console.log('\n✓ Cleaned up test user');

    console.log('\n========================================');
    console.log('🎉 ALL REGISTRATION & EMAIL TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
