import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { Link } from 'react-router-dom';
import { launchRazorpayModal } from '../../utils/razorpay';
import UpiPaymentModal from '../../components/common/UpiPaymentModal';
import { useNotification } from '../../context/NotificationContext';

export default function CustomerDashboard() {
  const { toast, modal } = useNotification();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [selectedBillOrder, setSelectedBillOrder] = useState(null);
  const [selectedUpiOrder, setSelectedUpiOrder] = useState(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchOrders = () => {
    apiClient.get('/orders')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.orders || []);
        setOrders(list);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleMakePayment = async (orderId) => {
    const targetOrder = orders.find(o => o._id === orderId);
    if (!targetOrder) return;

    setPayingOrderId(orderId);
    try {
      const razorpayResponse = await launchRazorpayModal({
        keyId: targetOrder.paymentDetails?.keyId || 'rzp_test_dev_marketsphere',
        providerOrderId: targetOrder.paymentDetails?.providerOrderId,
        amountInPaise: Math.round(targetOrder.totalAmount * 100),
        currency: 'INR',
        name: 'MarketSphere Marketplace',
        description: `Order #${String(orderId).slice(-8).toUpperCase()}`,
        prefill: {
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email || ''
        }
      });

      const confirmRes = await apiClient.post('/orders/confirm-payment', {
        orderId,
        providerOrderId: razorpayResponse.razorpay_order_id,
        providerPaymentId: razorpayResponse.razorpay_payment_id,
        providerSignature: razorpayResponse.razorpay_signature
      });

      const updatedOrder = confirmRes.data || confirmRes;
      toast.success('Payment verified and confirmed via Razorpay!', 'Payment Verified');
      setOrders(prev => prev.map(o => o._id === orderId ? updatedOrder : o));
      if (selectedBillOrder && selectedBillOrder._id === orderId) {
        setSelectedBillOrder(updatedOrder);
      }
    } catch (err) {
      if (err.message === 'PAYMENT_DISMISSED') {
        toast.info('Payment window was dismissed. Order remains Pending Payment.', 'Payment Dismissed');
      } else {
        toast.error(err.response?.data?.message || err.message || 'Payment processing failed', 'Payment Error');
      }
    } finally {
      setPayingOrderId(null);
    }
  };

  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: 'cancel',
    order: null,
    reason: '',
    customerRefundUpi: '',
    loading: false,
    error: ''
  });

  const openCancelModal = (order) => {
    setActionModal({
      isOpen: true,
      type: 'cancel',
      order,
      reason: 'Changed mind',
      customerRefundUpi: order.customerRefundUpi || order.paymentDetails?.customerRefundUpi || order.paymentDetails?.senderUpiId || (user.phone ? `${user.phone}@upi` : ''),
      loading: false,
      error: ''
    });
  };

  const openReturnModal = (order) => {
    setActionModal({
      isOpen: true,
      type: 'return',
      order,
      reason: 'Product defective or damaged',
      customerRefundUpi: order.customerRefundUpi || order.paymentDetails?.customerRefundUpi || order.paymentDetails?.senderUpiId || (user.phone ? `${user.phone}@upi` : ''),
      loading: false,
      error: ''
    });
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    if (!actionModal.order) return;
    const { order, type, reason, customerRefundUpi } = actionModal;

    const isRefundNeeded = order.paymentStatus === 'PAID' || order.paymentStatus === 'PENDING_SELLER_CONFIRMATION';
    if (isRefundNeeded && !customerRefundUpi?.trim()) {
      setActionModal(prev => ({ ...prev, error: 'Please enter your UPI ID so your refund can be processed directly.' }));
      return;
    }

    setActionModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const endpoint = type === 'cancel' ? `/orders/${order._id}/cancel` : `/orders/${order._id}/return`;
      const res = await apiClient.post(endpoint, {
        reason: reason?.trim() || (type === 'cancel' ? 'Customer cancelled' : 'Return requested'),
        customerRefundUpi: customerRefundUpi?.trim() || undefined
      });

      const updated = res.data?.data || res.data;
      setOrders(prev => prev.map(o => o._id === order._id ? updated : o));

      setActionModal({ isOpen: false, type: 'cancel', order: null, reason: '', customerRefundUpi: '', loading: false, error: '' });

      modal.success({
        title: type === 'cancel' ? 'Order Cancelled' : 'Return Request Submitted',
        message: type === 'cancel' 
          ? `Order #${order._id.slice(-6).toUpperCase()} was cancelled. Refund destination set to: ${customerRefundUpi || 'Original source'}.`
          : `Return request submitted for Order #${order._id.slice(-6).toUpperCase()}. The seller will review and process refund upon inspection.`,
        confirmText: 'Done'
      });
    } catch (err) {
      setActionModal(prev => ({ ...prev, loading: false, error: err.response?.data?.message || err.message || 'Operation failed' }));
    }
  };

  if (loading) return <div className="p-16 text-center text-gray-500 font-medium">Loading your orders...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Profile Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Customer Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Logged in as <span className="font-semibold text-gray-800">{user.firstName || 'Customer'} {user.lastName || ''}</span> ({user.email})
          </p>
        </div>
        <Link 
          to="/products" 
          className="bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold px-5 py-2.5 rounded-xl shadow-sm transition text-sm active:scale-95"
        >
          Explore Catalog
        </Link>
      </div>
      
      {/* Orders List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Orders & Purchase Invoices</h2>
            <p className="text-xs text-gray-500">Track delivery timeline, download bills, request returns</p>
          </div>
          <span className="text-sm font-semibold text-gray-500">{orders.length} Total Orders</span>
        </div>

        {orders.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-4xl">📦</p>
            <p className="text-gray-600 font-semibold">You have not placed any orders yet.</p>
            <Link to="/products" className="inline-block text-blue-600 font-medium hover:underline text-sm">
              Start shopping in catalog →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const isPaid = order.paymentStatus === 'PAID';
              const canCancel = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PROCESSING'].includes(order.orderStatus);
              const canReturn = order.orderStatus === 'DELIVERED';

              return (
                <div 
                  key={order._id} 
                  className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition bg-white shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-gray-900 text-base">
                        #{String(order._id).slice(-8).toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 space-y-0.5">
                      {order.orderItems?.map((it, idx) => (
                        <span key={idx} className="inline-block mr-3 bg-gray-50 px-2 py-1 rounded border">
                          {it.productId?.name || 'Item'} × {it.quantity} (₹{it.priceAtPurchase})
                        </span>
                      ))}
                    </div>

                    <div className="pt-1 flex items-center gap-4 text-xs">
                      <span>Total: <strong className="text-sm text-gray-900">₹{order.totalAmount}</strong></span>
                      <span>Payment: <strong className="text-gray-700">{order.paymentMethod}</strong></span>
                      {order.trackingNumber && (
                        <span>Tracking: <strong className="font-mono text-blue-600">{order.trackingNumber}</strong></span>
                      )}
                      {order.paymentStatus === 'REFUND_PENDING' && (
                        <div className="mt-2 text-xs bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="font-bold">Refund Status:</span> Refund of ₹{order.totalAmount} Pending
                            <p className="text-[11px] text-rose-700 mt-0.5">
                              Queued for direct transfer to: <strong className="font-mono">{order.paymentDetails?.customerRefundUpi || 'Your UPI / Bank account'}</strong>
                            </p>
                          </div>
                          <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded">Awaiting Transfer</span>
                        </div>
                      )}
                      {order.paymentStatus === 'REFUNDED' && (
                        <div className="mt-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg">
                          <span className="font-bold">✓ Refund Completed:</span> ₹{order.paymentDetails?.refundAmount || order.totalAmount} refunded
                          {order.paymentDetails?.refundUtr && (
                            <span className="block text-[11px] font-mono text-emerald-700 mt-0.5">
                              Bank / UPI UTR: #{order.paymentDetails.refundUtr}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badges & Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-center">
                      <span className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Payment</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        isPaid ? 'bg-green-100 text-green-800 border border-green-200' : 
                        order.paymentStatus === 'PENDING_SELLER_CONFIRMATION' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        order.paymentStatus === 'REFUNDED' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        order.paymentStatus === 'REFUND_PENDING' ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {order.paymentStatus === 'PENDING_SELLER_CONFIRMATION' ? 'UTR SUBMITTED' : (order.paymentStatus || 'PENDING')}
                      </span>
                    </div>

                    <div className="text-center">
                      <span className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Order Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        order.orderStatus === 'DELIVERED' ? 'bg-green-100 text-green-800 border border-green-200' :
                        order.orderStatus === 'CANCELLED' ? 'bg-red-100 text-red-800 border border-red-200' :
                        order.orderStatus === 'RETURNED' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        order.orderStatus === 'RETURN_REQUESTED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {order.orderStatus || 'PENDING'}
                      </span>
                    </div>

                    {(order.customerRefundUpi || order.paymentDetails?.customerRefundUpi) && (
                      <div className="text-center">
                        <span className="block text-[10px] uppercase font-bold text-amber-600 mb-0.5">Refund UPI</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          {order.customerRefundUpi || order.paymentDetails?.customerRefundUpi}
                        </span>
                      </div>
                    )}

                    {!isPaid && order.paymentMethod !== 'COD' && order.orderStatus !== 'CANCELLED' && (
                      <button
                        onClick={() => {
                          setSelectedUpiOrder(order);
                          setShowUpiModal(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition active:scale-95 whitespace-nowrap"
                      >
                        {order.paymentStatus === 'PENDING_SELLER_CONFIRMATION' ? 'View / Re-submit UTR' : 'Pay via UPI / Scanner'}
                      </button>
                    )}

                    {canCancel && (
                      <button
                        onClick={() => openCancelModal(order)}
                        className="border border-red-300 text-red-600 hover:bg-red-50 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
                      >
                        Cancel
                      </button>
                    )}

                    {canReturn && (
                      <button
                        onClick={() => openReturnModal(order)}
                        className="border border-amber-500 text-amber-700 hover:bg-amber-50 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
                      >
                        Request Return
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedBillOrder(order)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
                    >
                      View Invoice
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {selectedBillOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-amber-500 font-extrabold text-xl">MarketSphere</span>
                <h3 className="text-lg font-bold text-gray-900 mt-1">Official Tax Invoice</h3>
                <p className="font-mono text-xs text-gray-500">#{selectedBillOrder._id.toUpperCase()}</p>
              </div>
              <button 
                onClick={() => setSelectedBillOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-between text-xs bg-gray-50 p-3 rounded-xl">
              <div>
                <p className="font-bold text-gray-500">Payment Status:</p>
                <p className={`font-bold text-sm ${selectedBillOrder.paymentStatus === 'PAID' ? 'text-green-600' : 'text-amber-600'}`}>
                  {selectedBillOrder.paymentStatus}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-500">Order Status:</p>
                <p className="font-bold text-sm text-blue-700">
                  {selectedBillOrder.orderStatus}
                </p>
              </div>
            </div>

            {/* Item Breakdown */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedBillOrder.orderItems?.map((it, i) => (
                    <tr key={i}>
                      <td className="p-2.5 font-medium">{it.productId?.name || 'Item'}</td>
                      <td className="p-2.5 text-center">{it.quantity}</td>
                      <td className="p-2.5 text-right font-semibold">₹{it.priceAtPurchase}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="border-t pt-3 flex justify-between items-center text-sm">
              <span className="font-bold text-gray-700">Grand Total:</span>
              <span className="font-extrabold text-xl text-green-700">₹{selectedBillOrder.totalAmount?.toFixed(2)}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedBillOrder(null)}
                className="w-full bg-gray-900 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-gray-800 transition"
              >
                Close Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPI Payment Modal */}
      {selectedUpiOrder && (
        <UpiPaymentModal
          isOpen={showUpiModal}
          onClose={() => {
            setShowUpiModal(false);
            setSelectedUpiOrder(null);
          }}
          order={selectedUpiOrder}
          paymentData={{
            sellerUpiId: selectedUpiOrder.paymentDetails?.sellerUpiId,
            sellerUpiQr: selectedUpiOrder.paymentDetails?.sellerUpiQr,
            sellerStoreName: selectedUpiOrder.paymentDetails?.sellerStoreName
          }}
          onPaymentSuccess={(updatedOrder) => {
            setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
            if (selectedBillOrder && selectedBillOrder._id === updatedOrder._id) {
              setSelectedBillOrder(updatedOrder);
            }
            fetchOrders();
          }}
        />
      )}

      {/* Styled Interactive Cancel / Return Modal */}
      {actionModal.isOpen && actionModal.order && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>{actionModal.type === 'cancel' ? '🚫' : '📦'}</span>
                  {actionModal.type === 'cancel' ? 'Cancel Order' : 'Request Product Return'}
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Order #{actionModal.order._id.slice(-8).toUpperCase()} • Total: ₹{actionModal.order.totalAmount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none p-1"
              >
                ×
              </button>
            </div>

            {actionModal.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-medium">
                {actionModal.error}
              </div>
            )}

            <form onSubmit={handleSubmitAction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {actionModal.type === 'cancel' ? 'Cancellation Reason *' : 'Reason for Return *'}
                </label>
                <select
                  value={actionModal.reason}
                  onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none mb-2"
                >
                  {actionModal.type === 'cancel' ? (
                    <>
                      <option value="Changed mind">Changed mind</option>
                      <option value="Found lower price elsewhere">Found lower price elsewhere</option>
                      <option value="Ordered by mistake">Ordered by mistake</option>
                      <option value="Delivery time too long">Delivery time too long</option>
                      <option value="Other">Other (specify below)</option>
                    </>
                  ) : (
                    <>
                      <option value="Product defective or damaged">Product defective or damaged</option>
                      <option value="Item does not match description">Item does not match description</option>
                      <option value="Wrong item received">Wrong item received</option>
                      <option value="Quality not as expected">Quality not as expected</option>
                      <option value="Other">Other (specify below)</option>
                    </>
                  )}
                </select>
                <input
                  type="text"
                  value={actionModal.reason}
                  onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Describe your reason in detail..."
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* UPI ID Input for refunds */}
              {(actionModal.order.paymentStatus === 'PAID' || actionModal.order.paymentStatus === 'PENDING_SELLER_CONFIRMATION') && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <span>💳</span>
                    <span>Your Refund Destination UPI ID *</span>
                  </div>
                  <input
                    type="text"
                    value={actionModal.customerRefundUpi}
                    onChange={(e) => setActionModal(prev => ({ ...prev, customerRefundUpi: e.target.value }))}
                    placeholder="e.g. yourname@okhdfcbank or 9876543210@upi"
                    required
                    className="w-full border border-amber-300 bg-white rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    The seller will send your full refund of ₹{actionModal.order.totalAmount} directly to this UPI ID upon approval.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={actionModal.loading}
                  className={`flex-1 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50 ${
                    actionModal.type === 'cancel'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {actionModal.loading ? 'Submitting...' : actionModal.type === 'cancel' ? 'Confirm Cancellation' : 'Submit Return Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}