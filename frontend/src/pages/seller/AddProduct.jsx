import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

export default function AddProduct() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    price: '',
    stock: '',
    category: '',
    sellerUpiId: '',
    sellerUpiQr: '',
    imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&q=80'
  });
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch categories
    apiClient.get('/products/categories')
      .then(res => {
        if (res.data?.data?.length) {
          setCategories(res.data.data);
          setFormData(prev => ({ ...prev, category: res.data.data[0]._id }));
        } else if (Array.isArray(res.data) && res.data.length) {
          setCategories(res.data);
          setFormData(prev => ({ ...prev, category: res.data[0]._id }));
        }
      })
      .catch(console.error);

    // Fetch existing seller profile to prefill UPI ID if available
    apiClient.get('/sellers/me')
      .then(res => {
        const seller = res.data?.data || res.data;
        if (seller?.upiId) {
          setFormData(prev => ({
            ...prev,
            sellerUpiId: seller.upiId,
            sellerUpiQr: seller.upiQr || ''
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => setImages([...e.target.files]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sellerUpiId || !formData.sellerUpiId.trim()) {
      setError('Seller UPI ID is mandatory so customers can pay directly via UPI / QR Scanner');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (key !== 'imageUrl' && formData[key]) {
          data.append(key, formData[key]);
        }
      });
      if (formData.imageUrl) {
        data.append('images', formData.imageUrl);
      }
      images.forEach(img => data.append('images', img));
      
      const res = await apiClient.post('/products', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.status === 'success' || res.data?.status === 'success') {
        alert('Product created successfully with your UPI QR settings!');
        navigate('/seller');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border mt-8">
      <div className="border-b pb-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Add New Marketplace Product</h2>
        <p className="text-sm text-gray-500">List your merchandise with instant UPI Scanner payment support</p>
      </div>

      {error && <div className="mb-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700">Product Name *</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            placeholder="e.g. Ergonomic Wireless Mouse"
            required 
            className="mt-1 block w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" 
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Description *</label>
          <textarea 
            name="description" 
            value={formData.description} 
            onChange={handleChange} 
            rows="3"
            placeholder="Describe product highlights, technical specs, and warranty details..."
            required 
            className="mt-1 block w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
          ></textarea>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">SKU (Stock Keeping Unit)</label>
            <input 
              type="text" 
              name="sku" 
              value={formData.sku} 
              onChange={handleChange} 
              placeholder="e.g. MS-ELEC-01"
              className="mt-1 block w-full border rounded-lg p-2.5 text-sm uppercase focus:ring-2 focus:ring-amber-400 focus:outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Price (₹ INR) *</label>
            <input 
              type="number" 
              name="price" 
              value={formData.price} 
              onChange={handleChange} 
              required 
              min="1" 
              step="1" 
              placeholder="e.g. 1499"
              className="mt-1 block w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Available Stock Quantity *</label>
            <input 
              type="number" 
              name="stock" 
              value={formData.stock} 
              onChange={handleChange} 
              required 
              min="0" 
              placeholder="e.g. 50"
              className="mt-1 block w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Category *</label>
            <select 
              name="category" 
              value={formData.category} 
              onChange={handleChange} 
              required 
              className="mt-1 block w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
            >
              <option value="">Select Category</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Seller Direct UPI & QR Scanner Integration */}
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <span>💳</span> Seller UPI & QR Scanner Payment Setup *
            </h3>
            <span className="text-[11px] bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded">Required</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Customers will scan this UPI QR code or pay to this UPI ID when choosing online payment. When money arrives in your account, verify the amount received to mark the order as paid.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Your UPI ID (VPA) *
              </label>
              <input 
                type="text" 
                name="sellerUpiId" 
                value={formData.sellerUpiId} 
                onChange={handleChange} 
                placeholder="e.g. mybusiness@okhdfcbank or 9876543210@paytm"
                required 
                className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Custom Scanner QR Image URL (Optional)
              </label>
              <input 
                type="url" 
                name="sellerUpiQr" 
                value={formData.sellerUpiQr} 
                onChange={handleChange} 
                placeholder="https://... (or auto-generated dynamic QR)"
                className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none" 
              />
            </div>
          </div>

          {formData.sellerUpiId && (
            <div className="flex items-center gap-3 pt-2 bg-white p-3 rounded-lg border border-amber-200">
              <img 
                src={formData.sellerUpiQr || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(formData.sellerUpiId)}%26pn%3DMarketSphere%20Seller%26cu%3DINR`} 
                alt="UPI Scanner Preview" 
                className="w-16 h-16 object-contain rounded border p-1 bg-white"
              />
              <div className="text-xs text-gray-600">
                <span className="font-semibold text-gray-900 block">UPI QR Scanner Active:</span>
                <span className="font-mono text-amber-700 font-bold">{formData.sellerUpiId}</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Compatible with Google Pay, PhonePe, Paytm, BHIM, CRED</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Product Images</label>
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            onChange={handleFileChange} 
            className="mt-1 block w-full border rounded-lg p-2 text-sm text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200" 
          />
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold py-3 rounded-xl shadow-sm transition disabled:opacity-50 active:scale-95 text-base"
          >
            {loading ? 'Creating & Moderating...' : 'Submit Product for Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
