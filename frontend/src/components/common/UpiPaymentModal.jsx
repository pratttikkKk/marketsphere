import { useState } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';

export default function UpiPaymentModal({
  isOpen,
  onClose,
  order,
  paymentData,
  onPaymentSuccess
}) {
  const { modal } = useNotification();
  const [utrNumber, setUtrNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !order) return null;

  const sellerUpiId = paymentData?.sellerUpiId || order.paymentDetails?.sellerUpiId || 'marketsphere.seller@upi';
  const sellerStoreName = paymentData?.sellerStoreName || 'MarketSphere Seller';
  const amount = order.totalAmount;
  const qrUrl = paymentData?.sellerUpiQr || order.paymentDetails?.sellerUpiQr || 
    `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(sellerUpiId)}%26pn%3D${encodeURIComponent(sellerStoreName)}%26am%3D${amount}%26cu%3DINR`;
  
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(sellerUpiId)}&pn=${encodeURIComponent(sellerStoreName)}&am=${amount}&cu=INR`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(sellerUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitUpi = async (e) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      setError('Please enter the 12-digit UPI Transaction / UTR Number.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.post(`/orders/${order._id}/submit-upi-payment`, {
        utrNumber: utrNumber.trim(),
        amountPaid: amount
      });
      modal.success({
        title: 'UPI Payment Submitted! 📱',
        message: `UPI Payment reference UTR #${utrNumber} submitted successfully! The seller will verify receipt of ₹${amount} in their account and confirm order #${order._id.slice(-6).toUpperCase()}.`,
        confirmText: 'View Order Status'
      });
      onPaymentSuccess(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayViaSimulator = async () => {
    setSubmitting(true);
    setError('');
    try {
      const sigRes = await apiClient.post('/orders/simulate-signature', {
        providerOrderId: paymentData?.providerOrderId || order.paymentDetails?.providerOrderId || `order_online_${Date.now()}`
      });
      const { providerOrderId, providerPaymentId, providerSignature } = sigRes.data?.data || sigRes.data;

      const confirmRes = await apiClient.post('/orders/confirm-payment', {
        orderId: order._id,
        providerOrderId,
        providerPaymentId,
        providerSignature
      });

      modal.success({
        title: 'Online Payment Confirmed! 💳',
        message: 'Your payment was successfully verified and confirmed via Instant Online Payment.',
        confirmText: 'View Invoice'
      });
      onPaymentSuccess(confirmRes.data?.data || confirmRes.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Online payment confirmation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b pb-3">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Direct Merchant UPI Payment</h2>
            <p className="text-xs text-gray-500 mt-0.5">Order #{order._id?.slice(-8).toUpperCase()} • Total: ₹{amount}</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* QR Code Section */}
        <div className="bg-gray-50 rounded-2xl p-5 text-center border space-y-3">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Scan to Pay via any UPI App (GPay, PhonePe, Paytm, BHIM)
          </p>
          
          <div className="inline-block bg-white p-3 rounded-2xl shadow-sm border border-gray-200">
            <img 
              src={qrUrl} 
              alt="Seller UPI QR Code" 
              className="w-48 h-48 mx-auto object-contain"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-gray-500 font-medium">Merchant: <span className="font-bold text-gray-800">{sellerStoreName}</span></div>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-sm font-extrabold text-gray-900 bg-white px-3 py-1 rounded-lg border">
                {sellerUpiId}
              </span>
              <button 
                type="button" 
                onClick={handleCopyUpi} 
                className="bg-amber-400 hover:bg-amber-500 text-gray-900 text-xs px-2.5 py-1 rounded-lg font-bold transition active:scale-95 shadow-sm"
              >
                {copied ? '✓ Copied' : 'Copy UPI'}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <a 
              href={upiDeepLink} 
              className="inline-block text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
            >
              Open directly in Mobile UPI App →
            </a>
          </div>
        </div>

        {/* UTR Reference Input Form */}
        <form onSubmit={handleSubmitUpi} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Enter 12-Digit UPI Transaction Reference / UTR Number *
            </label>
            <input 
              type="text" 
              value={utrNumber} 
              onChange={(e) => setUtrNumber(e.target.value)} 
              placeholder="e.g. 428192817261 (Found in your UPI payment receipt)"
              required 
              maxLength="20"
              className="w-full border rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              After sending ₹{amount} to the seller's UPI account, enter your UTR number above.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={submitting} 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition disabled:opacity-50 active:scale-95"
          >
            {submitting ? 'Submitting to Seller...' : `I Have Paid ₹${amount} (Confirm Payment)`}
          </button>
        </form>

        {/* Instant Online Verification Option */}
        <div className="pt-2 border-t text-center space-y-2">
          <p className="text-xs text-gray-400">Want instant order confirmation without manual UTR submission?</p>
          <button 
            type="button" 
            onClick={handlePayViaSimulator} 
            disabled={submitting} 
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>⚡</span>
            {submitting ? 'Verifying Transaction...' : 'Instant 1-Click Online Payment Verification'}
          </button>
        </div>
      </div>
    </div>
  );
}
