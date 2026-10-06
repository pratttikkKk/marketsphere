const Seller = require('../models/Seller');
const User = require('../models/User');

class SellerService {
  async createProfile(userId, profileData) {
    return this.applyForSeller(userId, profileData);
  }

  async applyForSeller(userId, applicationData) {
    const existing = await Seller.findOne({ userId });
    if (existing) {
      if (existing.status === 'PENDING') {
        throw new Error('Your seller application is already pending admin review');
      }
      if (existing.status === 'APPROVED') {
        throw new Error('You are already an approved seller');
      }
      if (existing.status === 'SUSPENDED') {
        throw new Error('Your seller account has been suspended. Please contact support.');
      }
      // If REJECTED, allow re-application by updating existing record to PENDING
      existing.storeName = applicationData.storeName || existing.storeName;
      existing.description = applicationData.description || existing.description;
      existing.contactEmail = applicationData.contactEmail || existing.contactEmail;
      existing.contactPhone = applicationData.contactPhone || existing.contactPhone;
      existing.businessAddress = applicationData.businessAddress || existing.businessAddress;
      existing.status = 'PENDING';
      return await existing.save();
    }

    if (!applicationData.storeName || !applicationData.contactEmail) {
      throw new Error('Store name and contact email are required');
    }

    // Check store name uniqueness
    const storeExists = await Seller.findOne({ storeName: applicationData.storeName.trim() });
    if (storeExists) {
      throw new Error('Store name already taken. Please choose a different store name.');
    }

    // Create seller profile in PENDING status - strictly NO auto-approval!
    const seller = new Seller({
      userId,
      storeName: applicationData.storeName.trim(),
      description: applicationData.description ? applicationData.description.trim() : '',
      contactEmail: applicationData.contactEmail.trim().toLowerCase(),
      contactPhone: applicationData.contactPhone ? applicationData.contactPhone.trim() : '',
      businessAddress: applicationData.businessAddress ? applicationData.businessAddress.trim() : '',
      status: 'PENDING'
    });

    const savedSeller = await seller.save();

    // Assign role 'SELLER' to user record
    await User.findByIdAndUpdate(userId, { role: 'SELLER' });

    return savedSeller;
  }

  async getProfileByUserId(userId) {
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      return null;
    }
    return seller;
  }

  async updateProfile(userId, updateData) {
    const seller = await Seller.findOne({ userId });
    if (!seller) throw new Error('Seller profile not found');

    // Strict whitelist of permitted fields:
    if (updateData.storeName && updateData.storeName.trim() !== seller.storeName) {
      const storeExists = await Seller.findOne({ storeName: updateData.storeName.trim(), _id: { $ne: seller._id } });
      if (storeExists) throw new Error('Store name is already in use');
      seller.storeName = updateData.storeName.trim();
    }
    if (updateData.description !== undefined) seller.description = updateData.description.trim();
    if (updateData.contactEmail !== undefined) seller.contactEmail = updateData.contactEmail.trim().toLowerCase();
    if (updateData.contactPhone !== undefined) seller.contactPhone = updateData.contactPhone.trim();
    if (updateData.businessAddress !== undefined) seller.businessAddress = updateData.businessAddress.trim();

    // Protected fields can NEVER be modified by seller
    // seller.status, seller.userId, seller._id remain unchanged

    return await seller.save();
  }

  async updateSellerStatus(sellerId, newStatus) {
    if (!['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(newStatus)) {
      throw new Error('Invalid seller status');
    }
    const seller = await Seller.findByIdAndUpdate(sellerId, { status: newStatus }, { new: true });
    if (!seller) throw new Error('Seller not found');

    // If approved, ensure user has SELLER role
    if (newStatus === 'APPROVED') {
      await User.findByIdAndUpdate(seller.userId, { role: 'SELLER' });
    }
    return seller;
  }
}

module.exports = new SellerService();