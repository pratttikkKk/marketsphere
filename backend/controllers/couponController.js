const Coupon = require('../models/Coupon');

exports.createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ status: 'success', data: coupon });
  } catch (err) { next(err); }
};

exports.getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ isActive: true, expiresAt: { $gt: new Date() } });
    res.json({ status: 'success', data: coupons });
  } catch (err) { next(err); }
};