import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

export default function SellerApply() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    storeName: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    businessAddress: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiClient.post('/seller/apply', formData);
      setSuccess(true);
      // Update cached user role if changed
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        u.role = 'SELLER';
        u.sellerStatus = 'PENDING';
        localStorage.setItem('user', JSON.stringify(u));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ⏳
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
        <p className="text-gray-600 mb-6">
          Your seller application for <strong>{formData.storeName}</strong> has been received and is currently 
          <strong> PENDING ADMINISTRATOR REVIEW</strong>. You will be able to publish products once approved.
        </p>
        <button
          onClick={() => navigate('/seller')}
          className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          Go to Seller Portal
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Apply to Become a MarketSphere Seller</h1>
      <p className="text-gray-600 text-sm mb-6">
        Join our multi-vendor marketplace. Applications are vetted by administrators to ensure platform quality and trust.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
          <input
            type="text"
            name="storeName"
            required
            value={formData.storeName}
            onChange={handleChange}
            placeholder="e.g. Acme Electronics"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store Description</label>
          <textarea
            name="description"
            rows="3"
            value={formData.description}
            onChange={handleChange}
            placeholder="Brief overview of the goods you manufacture or distribute..."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Contact Email *</label>
            <input
              type="email"
              name="contactEmail"
              required
              value={formData.contactEmail}
              onChange={handleChange}
              placeholder="sales@store.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <input
              type="tel"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Registered Business Address</label>
          <input
            type="text"
            name="businessAddress"
            value={formData.businessAddress}
            onChange={handleChange}
            placeholder="123 Commercial Plaza, Tech City, Karnataka"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Submitting Application...' : 'Submit Application for Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
