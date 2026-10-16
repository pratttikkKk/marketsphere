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
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [otp, setOtp] = useState('');
  const [previewOtp, setPreviewOtp] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

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
    setSuccessMsg('');

    try {
      const res = await apiClient.post('/auth/register', {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      });

      if (res.status === 'success') {
        if (res.requiresOtp) {
          setVerificationEmail(res.email || formData.email);
          if (res.previewOtp) setPreviewOtp(res.previewOtp);
          setStep('otp');
          setSuccessMsg(res.message || 'Verification code sent to your email.');
        } else if (res.data?.token) {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data));
          navigate('/products');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      return setError('Please enter the 6-digit verification code');
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post('/auth/verify-otp', {
        email: verificationEmail,
        otp: otp.trim()
      });

      if (res.status === 'success') {
        const userData = res.data;
        if (userData?.token) {
          localStorage.setItem('token', userData.token);
          localStorage.setItem('user', JSON.stringify(userData));
        }
        alert('Email verified successfully! Welcome to MarketSphere.');
        navigate('/products');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error?.message || err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiClient.post('/auth/resend-otp', { email: verificationEmail });
      if (res.status === 'success') {
        if (res.previewOtp) setPreviewOtp(res.previewOtp);
        setSuccessMsg(res.message || 'A new verification code has been dispatched.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-lg border border-amber-100">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl text-2xl mb-3 shadow-inner">
            ✉️
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">Verify Your Email</h2>
          <p className="text-xs text-gray-500 mt-1">
            We sent a 6-digit verification OTP to
          </p>
          <p className="text-sm font-bold text-gray-800 mt-0.5 font-mono">
            {verificationEmail}
          </p>
        </div>

        {error && (
          <div className="mb-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 text-green-700 bg-green-50 border border-green-200 p-3 rounded-xl text-xs font-medium">
            {successMsg}
          </div>
        )}

        {previewOtp && (
          <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <span className="font-bold">Sandbox Dev Mode:</span>
            <span className="ml-1">Use free test code:</span>
            <span className="ml-2 font-mono font-extrabold text-base tracking-widest bg-white px-2 py-0.5 rounded border border-amber-300">
              {previewOtp}
            </span>
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 text-center uppercase tracking-wider">
              Enter 6-Digit Code
            </label>
            <input
              type="text"
              maxLength="6"
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full text-center text-3xl font-mono font-extrabold tracking-[0.5em] py-3.5 border-2 border-gray-300 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 outline-none transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold py-3.5 rounded-xl transition shadow active:scale-95 disabled:opacity-50 text-sm"
          >
            {loading ? 'Verifying Code...' : 'Verify Email & Complete Sign Up'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resending}
            className="text-amber-600 hover:text-amber-700 font-semibold hover:underline disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend Code'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setError('');
              setSuccessMsg('');
            }}
            className="text-gray-500 hover:text-gray-700 hover:underline"
          >
            ← Change Email
          </button>
        </div>
      </div>
    );
  }

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
          {loading ? 'Sending Verification Code...' : 'Register with Email OTP'}
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
