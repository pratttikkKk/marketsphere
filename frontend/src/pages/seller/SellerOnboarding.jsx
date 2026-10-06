import { useState } from 'react';
import apiClient from '../../api/client';

export default function SellerOnboarding({ onComplete }) {
  const [formData, setFormData] = useState({
    storeName: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    businessAddress: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/sellers', formData);
      if (res.status === 'success') {
        onComplete(); // Reload dashboard
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create seller profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Complete Your Seller Profile</h2>
      <p className="mb-6 text-gray-600 text-center">We need a few more details to set up your store before you can start selling.</p>
      
      {error && <div className="mb-4 text-red-600 bg-red-100 p-3 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Store Name *</label>
          <input 
            type="text" name="storeName"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
            value={formData.storeName} onChange={handleChange} required 
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Store Description</label>
          <textarea 
            name="description" rows="3"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
            value={formData.description} onChange={handleChange} 
          ></textarea>
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Contact Email *</label>
          <input 
            type="email" name="contactEmail"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
            value={formData.contactEmail} onChange={handleChange} required 
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-gray-700 mb-2">Contact Phone</label>
            <input 
              type="text" name="contactPhone"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
              value={formData.contactPhone} onChange={handleChange} 
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Business Address</label>
            <input 
              type="text" name="businessAddress"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
              value={formData.businessAddress} onChange={handleChange} 
            />
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Complete Profile'}
        </button>
      </form>
    </div>
  );
}
