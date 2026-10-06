import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post('/auth/register', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password
      });

      if (res.status === 'success') {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        navigate('/products');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">Create an Account</h2>
      <p className="text-xs text-gray-500 mb-6 text-center">Join MarketSphere to shop authentic products across verified vendors</p>
      
      {error && <div className="mb-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl text-sm">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
            <input 
              type="text" 
              name="firstName"
              className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              value={formData.firstName} 
              onChange={handleChange} 
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
            <input 
              type="text" 
              name="lastName"
              className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              value={formData.lastName} 
              onChange={handleChange} 
              required 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
          <input 
            type="email" 
            name="email"
            className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            value={formData.email} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Password (min. 6 characters) *</label>
          <input 
            type="password" 
            name="password"
            className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            value={formData.password} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm Password *</label>
          <input 
            type="password" 
            name="confirmPassword"
            className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            value={formData.confirmPassword} 
            onChange={handleChange} 
            required 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-amber-400 text-gray-900 font-bold py-3 rounded-xl hover:bg-amber-500 transition shadow-sm disabled:opacity-50 text-sm"
        >
          {loading ? 'Creating Account...' : 'Register as Customer'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-2">
        <p className="text-xs text-gray-600">
          Already have an account? <Link to="/login" className="text-blue-600 font-semibold hover:underline">Log in</Link>
        </p>
        <p className="text-[11px] text-gray-400">
          Want to sell products? Register a customer account first, then submit a verified Seller Application from your account.
        </p>
      </div>
    </div>
  );
}
