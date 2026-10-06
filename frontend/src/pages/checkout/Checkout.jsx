import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { launchRazorpayModal } from '../../utils/razorpay';
import UpiPaymentModal from '../../components/common/UpiPaymentModal';

export default function Checkout() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState('summary'); // 'summary' or 'bill'
  const [orderData, setOrderData] = useState(null);
  const [clientPaymentData, setClientPaymentData] = useState(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('ONLINE');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [address, setAddress] = useState({
    fullName: 'Rahul Sharma',
    phone: '+91 98765 43210',
    street: '123 MG Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    zipCode: '560038',
    country: 'India'
  });

  useEffect(() => {
    apiClient.get('/cart')
      .then(res => {
        setCart(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError(null);
    try {
      const res = await apiClient.get('/coupons');
      const valid = res.data?.find(c => c.code === couponCode.trim().toUpperCase());
      if (valid) {
        setAppliedCoupon(valid);
        alert(`Coupon ${valid.code} applied! Discount will be computed by backend.`);
      } else {
        setCouponError('Invalid or expired coupon code');
      }
    } catch (err) {
      setCouponError('Could not validate coupon');
    }
  };

  const handlePlaceOrder = async (e) => {
    e?.preventDefault();
    setPlacingOrder(true);
    try {
      // Generate a unique client idempotency key
      const idempotencyKey = `ms_chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      const res = await apiClient.post('/orders/checkout', {
        paymentMethod: paymentMethod === 'COD' ? 'COD' : 'RAZORPAY',
        shippingAddress: address,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined
      }, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });

      const { order, clientPaymentData: payData } = res.data?.data || res.data;
      setOrderData(order);
      setClientPaymentData(payData);
      setStep('bill');

      // If online payment was chosen, present Seller UPI Scanner & Payment Modal
      if (paymentMethod !== 'COD') {
        setShowUpiModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Checkout failed');
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleMakePaymentLater = () => {
    if (!orderData) return;
    setShowUpiModal(true);
  };

  if (loading) {
    return (
      <div className="p-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-2"></div>
        <p className="text-gray-500">Preparing checkout engine...</p>
      </div>
    );
  }

  // Official Tax Invoice / Bill View
  if (step === 'bill' && orderData) {
    const isPaid = orderData.paymentStatus === 'PAID';

    return (
      <div className="max-w-2xl mx-auto my-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-900 text-white p-6 sm:p-8 flex justify-between items-start">
            <div>
              <span className="text-amber-400 font-extrabold text-2xl tracking-tight">MarketSphere</span>
              <p className="text-xs text-gray-300 mt-1 uppercase tracking-wider">Verified Commercial Invoice</p>
              <h2 className="text-lg font-bold mt-3 font-mono">Invoice #{orderData._id.toUpperCase()}</h2>
              <p className="text-xs text-gray-400">Date: {new Date(orderData.createdAt || Date.now()).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isPaid ? 'bg-green-500 text-white' : 'bg-amber-400 text-gray-900'
              }`}>
                Payment: {orderData.paymentStatus || 'PENDING'}
              </span>
              <div className="mt-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-600 text-white">
                  Status: {orderData.orderStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isPaid 
                ? 'bg-green-50 border-green-200 text-green-900' 
                : orderData.paymentStatus === 'PENDING_SELLER_CONFIRMATION'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div>
                <p className="font-bold text-sm flex items-center gap-1.5">
                  {isPaid ? (
                    <><span>✓</span> Payment Verified & Confirmed</>
                  ) : orderData.paymentStatus === 'PENDING_SELLER_CONFIRMATION' ? (
                    <><span>⏳</span> Payment Submitted (UTR: #{orderData.paymentDetails?.utrNumber || 'Submitted'})</>
                  ) : orderData.paymentMethod === 'COD' ? (
                    <><span>💵</span> Cash on Delivery</>
                  ) : (
                    <><span>⚠️</span> Online Payment Pending</>
                  )}
                </p>
                <p className="text-xs mt-0.5 opacity-90">
                  {isPaid 
                    ? `Payment confirmed! Transaction ID / UTR: ${orderData.paymentDetails?.utrNumber || orderData.paymentDetails?.providerPaymentId || 'VERIFIED'}`
                    : orderData.paymentStatus === 'PENDING_SELLER_CONFIRMATION'
                    ? `Your UTR has been submitted. The seller will verify receipt of ₹${orderData.totalAmount} in their bank account before final confirmation.`
                    : orderData.paymentMethod === 'COD'
                    ? `Please pay ₹${orderData.totalAmount} in cash when the delivery agent delivers your package.`
                    : 'Scan the seller QR code or pay to the seller UPI ID to complete your order.'}
                </p>
              </div>
              {!isPaid && orderData.paymentMethod !== 'COD' && (
                <button
                  onClick={handleMakePaymentLater}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition active:scale-95 whitespace-nowrap"
                >
                  {orderData.paymentStatus === 'PENDING_SELLER_CONFIRMATION' ? 'View Seller UPI / Re-submit UTR' : 'Pay via Seller UPI / Scanner'}
                </button>
              )}
            </div>

            {/* Address & Tracking */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl">
              <div>
                <p className="font-bold text-gray-500 uppercase tracking-wider mb-1">Delivered To:</p>
                <p className="font-semibold text-gray-800">{orderData.shippingAddress?.fullName || address.fullName}</p>
                <p className="text-gray-600">{orderData.shippingAddress?.street}</p>
                <p className="text-gray-600">{orderData.shippingAddress?.city}, {orderData.shippingAddress?.state} {orderData.shippingAddress?.zipCode}</p>
                <p className="text-gray-600">{orderData.shippingAddress?.country || 'India'}</p>
              </div>
              <div>
                <p className="font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Method:</p>
                <p className="font-semibold text-gray-800">{orderData.paymentMethod}</p>
                <p className="font-bold text-gray-500 uppercase tracking-wider mt-2 mb-1">Estimated Delivery:</p>
                <p className="font-semibold text-gray-800">
                  {orderData.estimatedDelivery ? new Date(orderData.estimatedDelivery).toLocaleDateString() : '3-5 business days'}
                </p>
              </div>
            </div>

            {/* Items Breakdown */}
            <div>
              <h3 className="font-bold text-gray-800 text-sm mb-3">Purchased Items</h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Item</th>
                      <th className="py-2.5 px-4 font-semibold text-center">Qty</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Price</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orderData.orderItems?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-800">
                          {item.productId?.name || 'Item'}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600">{item.quantity}</td>
                        <td className="py-3 px-4 text-right text-gray-600">₹{item.priceAtPurchase}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">
                          ₹{(item.priceAtPurchase * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>₹{orderData.subtotal?.toFixed(2)}</span>
              </div>
              {orderData.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Coupon Discount ({orderData.couponCode}):</span>
                  <span>-₹{orderData.discount?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Tax (GST 5%):</span>
                <span>₹{orderData.tax?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee:</span>
                <span>{orderData.deliveryFee === 0 ? 'FREE' : `₹${orderData.deliveryFee?.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-2">
                <span>Final Total:</span>
                <span className="text-xl text-green-700">₹{orderData.totalAmount?.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Link
                to="/customer"
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-xl transition text-center text-sm"
              >
                Go to My Orders
              </Link>
              <Link
                to="/products"
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl text-sm transition text-center"
              >
                Continue Shopping
              </Link>
            </div>
          </div>

          {/* UPI Payment Modal for Direct Seller Payment */}
          <UpiPaymentModal
            isOpen={showUpiModal}
            onClose={() => setShowUpiModal(false)}
            order={orderData}
            paymentData={clientPaymentData}
            onPaymentSuccess={(updatedOrder) => {
              setOrderData(updatedOrder);
            }}
          />
        </div>
      </div>
    );
  }

  // Pre-Checkout Cart Summary
  const cartItems = cart?.items || [];
  const subtotal = cartItems.reduce((acc, item) => acc + (item.productId?.price || 0) * item.quantity, 0);
  const deliveryFee = subtotal >= 500 || subtotal === 0 ? 0 : 40;
  const estimatedTotal = subtotal + deliveryFee;

  if (cartItems.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-xl border text-center space-y-4">
        <p className="text-4xl">🛒</p>
        <h2 className="text-xl font-bold text-gray-800">Your cart is empty</h2>
        <p className="text-gray-500 text-sm">Add items from the marketplace before checking out.</p>
        <Link to="/products" className="inline-block bg-amber-400 font-bold px-6 py-2.5 rounded-lg text-gray-900 hover:bg-amber-500">
          Browse Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-8">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">MarketSphere Secure Checkout</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Shipping Address */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📍</span> Delivery Address
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Full Name *</label>
                <input 
                  type="text" 
                  value={address.fullName} 
                  onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none" 
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Phone Number *</label>
                <input 
                  type="text" 
                  value={address.phone} 
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none" 
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-gray-700 font-medium mb-1">Street Address *</label>
                <input 
                  type="text" 
                  value={address.street} 
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none" 
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">City *</label>
                <input 
                  type="text" 
                  value={address.city} 
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none" 
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">State *</label>
                <input 
                  type="text" 
                  value={address.state} 
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none" 
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">PIN / Postal Code *</label>
                <input 
                  type="text" 
                  value={address.zipCode} 
                  onChange={(e) => setAddress({ ...address, zipCode: e.target.value })}
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:outline-none" 
                  required
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>💳</span> Select Payment Method
            </h2>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition ${
                paymentMethod === 'ONLINE' ? 'border-amber-500 bg-amber-50' : 'hover:bg-gray-50'
              }`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="ONLINE" 
                  checked={paymentMethod === 'ONLINE'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Instant Online Payment (Razorpay / Cryptographic Sandbox)</p>
                  <p className="text-xs text-gray-500">Pay securely via UPI, Card, or Net Banking with verified HMAC signature.</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition ${
                paymentMethod === 'COD' ? 'border-amber-500 bg-amber-50' : 'hover:bg-gray-50'
              }`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="COD" 
                  checked={paymentMethod === 'COD'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Cash on Delivery (COD)</p>
                  <p className="text-xs text-gray-500">Pay cash upon delivery. Status remains pending until delivery confirmation.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Order Summary & Coupon Form */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 sticky top-24">
            <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>

            {/* Coupon Code Input */}
            <div>
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon code (e.g. SAVE20)"
                  className="flex-1 border rounded-lg p-2 text-xs uppercase font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800"
                >
                  Apply
                </button>
              </form>
              {appliedCoupon && (
                <p className="text-xs text-green-600 font-semibold mt-1">✓ Coupon {appliedCoupon.code} applied!</p>
              )}
              {couponError && (
                <p className="text-xs text-red-600 mt-1">{couponError}</p>
              )}
            </div>
            
            <div className="divide-y text-xs text-gray-700 max-h-48 overflow-y-auto">
              {cartItems.map(item => (
                <div key={item._id} className="py-2 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800 line-clamp-1">{item.productId?.name || 'Item'}</p>
                    <p className="text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-semibold text-gray-900">
                    ₹{((item.productId?.price || 0) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Estimated Delivery:</span>
                <span>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 border-t pt-2">
                <span>Estimated Total:</span>
                <span className="text-lg text-amber-600">₹{estimatedTotal.toFixed(2)}</span>
              </div>
            </div>

            <button 
              onClick={handlePlaceOrder}
              disabled={placingOrder}
              className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold py-3 rounded-xl transition shadow active:scale-95 disabled:opacity-50 text-sm"
            >
              {placingOrder ? 'Securing Inventory & Processing...' : 'Place Order & View Invoice'}
            </button>
            <p className="text-center text-xs text-gray-400">Cryptographically verified server checkout</p>
          </div>
        </div>
      </div>
    </div>
  );
}