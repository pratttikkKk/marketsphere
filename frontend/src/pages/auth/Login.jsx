import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [previewOtp, setPreviewOtp] = useState('');
  const [resending, setResending] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { 
        email: email.trim().toLowerCase(), 
        password 
      });
      if (res.status === 'success') {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        if (res.data.role === 'SELLER') {
          navigate('/seller');
        } else if (res.data.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/products');
        }
      }
    } catch (err) {
      if (err.response?.data?.requiresOtp) {
        setShowOtp(true);
        if (err.response.data.previewOtp) setPreviewOtp(err.response.data.previewOtp);
        setInfoMsg(err.response.data.message || 'Please verify your email address to continue.');
      } else {
        setError(err.response?.data?.message || err.message || 'Login failed');
      }
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
        email: email.trim().toLowerCase(),
        otp: otp.trim()
      });

      if (res.status === 'success') {
        const userData = res.data;
        if (userData?.token) {
          localStorage.setItem('token', userData.token);
          localStorage.setItem('user', JSON.stringify(userData));
        }
        alert('Email verified successfully! Welcome back to MarketSphere.');
        if (userData?.role === 'SELLER') {
          navigate('/seller');
        } else if (userData?.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/products');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/resend-otp', { email: email.trim().toLowerCase() });
      if (res.status === 'success') {
        if (res.previewOtp) setPreviewOtp(res.previewOtp);
        setInfoMsg(res.message || 'A new verification code has been dispatched.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  if (showOtp) {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-lg border border-amber-100">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl text-2xl mb-3 shadow-inner">
            ✉️
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">Verify Your Email</h2>
          <p className="text-xs text-gray-500 mt-1">Enter the 6-digit verification code sent to</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5 font-mono">{email}</p>
        </div>

        {error && (
          <div className="mb-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs font-medium">
            {infoMsg}
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
            {loading ? 'Verifying Code...' : 'Verify Email & Sign In'}
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
              setShowOtp(false);
              setError('');
              setInfoMsg('');
            }}
            className="text-gray-500 hover:text-gray-700 hover:underline"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">Welcome Back</h2>
      <p className="text-xs text-gray-500 mb-6 text-center">Log in to your MarketSphere customer or seller account</p>
      
      {error && <div className="mb-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl text-sm">{error}</div>}
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
          <input 
            type="email" 
            className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
          <input 
            type="password" 
            className="w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-amber-400 text-gray-900 font-bold py-3 rounded-xl hover:bg-amber-500 transition shadow-sm disabled:opacity-50 text-sm"
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>
      <div className="mt-6 pt-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-600">
          Don't have an account? <Link to="/register" className="text-blue-600 font-semibold hover:underline">Register as Customer</Link>
        </p>
      </div>
    </div>
  );
}
