import { useState } from 'react';
import apiClient from '../../api/client';
import { launchRazorpayModal } from '../../utils/razorpay';

export default function UpiPaymentModal({
  isOpen,
  onClose,
  order,
  paymentData,
  onPaymentSuccess
}) {
  const [utrNumber, setUtrNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payingRazorpay, setPayingRazorpay] = useState(false);
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
      alert(`UPI Payment submitted successfully with UTR #${utrNumber}! The seller will verify receipt of ₹${amount} in their account and confirm your order.`);
      onPaymentSuccess(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayViaRazorpay = async () => {
    setPayingRazorpay(true);
    setError('');
    try {
      const rzpRes = await launchRazorpayModal({
        keyId: paymentData?.keyId || 'rzp_test_dev_marketsphere',
        providerOrderId: paymentData?.providerOrderId || order.paymentDetails?.providerOrderId,
        amountInPaise: Math.round(amount * 100),
        currency: 'INR',
        name: sellerStoreName,
        description: `Order #${String(order._id).slice(-8).toUpperCase()}`,
        prefill: {
          fullName: order.shippingAddress?.fullName || '',
          phone: order.shippingAddress?.phone || ''
        }
      });

      // Confirm signature on backend
      const confirmRes = await apiClient.post('/orders/confirm-payment', {
        orderId: order._id,
        providerOrderId: rzpRes.razorpay_order_id,
        providerPaymentId: rzpRes.razorpay_payment_id,
        providerSignature: rzpRes.razorpay_signature
      });

      alert('Payment cryptographically verified and confirmed via Razorpay!');
      onPaymentSuccess(confirmRes.data?.data || confirmRes.data);
      onClose();
    } catch (err) {
      if (err.message === 'PAYMENT_DISMISSED') {
        setError('Razorpay payment modal was dismissed.');
      } else {
        setError(`Razorpay Note: ${err.message}. You can pay directly by scanning the Seller UPI QR Code above!`);
      }
    } finally {
      setPayingRazorpay(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b pb-3">
          <div>
            <span className="text-amber-500 font-extrabold text-xs tracking-wider uppercase">Direct Merchant Payment</span>
            <h2 className="text-xl font-bold text-gray-900 mt-0.5">Pay via Seller UPI / QR Scanner</h2>
            <p className="text-xs text-gray-500">Order #{String(order._id).slice(-8).toUpperCase()} • Total: <strong className="text-gray-900 text-sm">₹{amount}</strong></p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* Dynamic UPI QR Scanner */}
        <div className="text-center p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
          <p className="text-xs font-semibold text-amber-900">
            Scan with any UPI App (Google Pay, PhonePe, Paytm, BHIM, CRED)
          </p>

          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl shadow-md border inline-block">
              <img 
                src={qrUrl} 
                alt="Seller UPI QR Code" 
                className="w-48 h-48 object-contain"
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-500">Merchant Store: <strong className="text-gray-800">{sellerStoreName}</strong></p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-sm font-bold text-amber-900 bg-white px-3 py-1 rounded-lg border border-amber-300">
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

        {/* Alternate Razorpay option */}
        <div className="pt-2 border-t text-center space-y-2">
          <p className="text-xs text-gray-400">Prefer standard card or net banking?</p>
          <button 
            type="button" 
            onClick={handlePayViaRazorpay} 
            disabled={payingRazorpay} 
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2 rounded-xl text-xs transition disabled:opacity-50"
          >
            {payingRazorpay ? 'Opening Razorpay...' : 'Pay with Razorpay Gateway (Cards / NetBanking)'}
          </button>
        </div>
      </div>
    </div>
  );
}
