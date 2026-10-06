import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { Link } from 'react-router-dom';
import { launchRazorpayModal } from '../../utils/razorpay';
import UpiPaymentModal from '../../components/common/UpiPaymentModal';

export default function CustomerDashboard() {
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
      alert('Payment verified and confirmed via Razorpay!');
      setOrders(prev => prev.map(o => o._id === orderId ? updatedOrder : o));
      if (selectedBillOrder && selectedBillOrder._id === orderId) {
        setSelectedBillOrder(updatedOrder);
      }
    } catch (err) {
      if (err.message === 'PAYMENT_DISMISSED') {
        alert('Payment window dismissed. Order remains Pending Payment.');
      } else {
        alert(err.response?.data?.message || err.message || 'Payment processing failed');
      }
    } finally {
      setPayingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    const reason = prompt('Please enter cancellation reason:') || 'Changed mind';
    try {
      const res = await apiClient.post(`/orders/${orderId}/cancel`, { reason });
      alert('Order successfully cancelled. Inventory restored.');
      setOrders(prev => prev.map(o => o._id === orderId ? res.data : o));
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Cancellation failed');
    }
  };

  const handleRequestReturn = async (orderId) => {
    const reason = prompt('Please describe why you are returning this order:') || 'Product defective or damaged';
    try {
      const res = await apiClient.post(`/orders/${orderId}/return`, { reason });
      alert('Return request submitted for administrator review.');
      setOrders(prev => prev.map(o => o._id === orderId ? res.data : o));
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Return request failed');
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
                        onClick={() => handleCancelOrder(order._id)}
                        className="border border-red-300 text-red-600 hover:bg-red-50 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
                      >
                        Cancel
                      </button>
                    )}

                    {canReturn && (
                      <button
                        onClick={() => handleRequestReturn(order._id)}
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
    </div>
  );
}