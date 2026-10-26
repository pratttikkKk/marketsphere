import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import SellerOnboarding from './SellerOnboarding';
import { useNotification } from '../../context/NotificationContext';

const formatCurrency = (value = 0) => `$${Number(value).toLocaleString()}`;

const SellerDashboard = () => {
  const { toast, modal } = useNotification();
  const [sellerId, setSellerId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [verifyingOrder, setVerifyingOrder] = useState(null);
  const [receivedAmountInput, setReceivedAmountInput] = useState('');
  const [verifyingUtrInput, setVerifyingUtrInput] = useState('');
  const [verificationError, setVerificationError] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);

  const [refundingOrder, setRefundingOrder] = useState(null);
  const [refundUtrInput, setRefundUtrInput] = useState('');
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundNotesInput, setRefundNotesInput] = useState('');
  const [refundError, setRefundError] = useState(null);
  const [refundLoading, setRefundLoading] = useState(false);

  const loadDashboard = async () => {
    try {
      const [dashboardResp, ordersResp, productsResp] = await Promise.all([
        apiClient.get('/sellers/dashboard'),
        apiClient.get('/sellers/orders'),
        apiClient.get('/sellers/products')
      ]);

      setDashboard(dashboardResp?.data || {});
      setOrders(ordersResp?.data || []);
      setProducts(productsResp?.data?.products || []);
    } catch (error) {
      console.error('Seller dashboard failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleUpdateOrderStatus = async (orderId, status = 'PLACED') => {
    try {
      await apiClient.patch(`/sellers/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, orderStatus: status } : o));
      toast.success(`Order #${orderId.slice(-6).toUpperCase()} updated to ${status}!`, 'Status Updated');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Status update failed', 'Update Error');
    }
  };

  const handleOpenVerifyModal = (order) => {
    setVerifyingOrder(order);
    setReceivedAmountInput(order.paymentDetails?.paidAmount || order.totalAmount || '');
    setVerifyingUtrInput(order.paymentDetails?.utrNumber || '');
    setVerificationError(null);
  };

  const handleConfirmVerification = async (e) => {
    e.preventDefault();
    if (!verifyingOrder) return;
    setVerificationError(null);
    setVerificationLoading(true);

    try {
      const res = await apiClient.patch(`/sellers/orders/${verifyingOrder._id}/verify-payment`, {
        receivedAmount: Number(receivedAmountInput),
        utrNumber: verifyingUtrInput
      });

      const updated = res.data?.data || res.data;
      modal.success({
        title: 'Payment Verified! ✅',
        message: `Payment of ₹${receivedAmountInput} for Order #${verifyingOrder._id.slice(-6).toUpperCase()} verified and marked as PAID.`,
        confirmText: 'Done'
      });
      setOrders(prev => prev.map(o => o._id === verifyingOrder._id ? { ...o, paymentStatus: 'PAID', paymentDetails: updated.paymentDetails || o.paymentDetails } : o));
      setVerifyingOrder(null);
      loadDashboard();
    } catch (err) {
      setVerificationError(err.response?.data?.message || err.message || 'Payment verification failed');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleMarkCodPaid = async (orderId) => {
    if (!window.confirm('Confirm that cash payment has been received upon delivery?')) return;
    try {
      await apiClient.patch(`/sellers/orders/${orderId}/mark-paid`);
      toast.success(`COD Payment collected! Order #${orderId.slice(-6).toUpperCase()} marked as PAID.`, 'COD Paid');
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, paymentStatus: 'PAID' } : o));
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to mark COD as paid', 'Payment Error');
    }
  };

  const handleOpenRefundModal = (order) => {
    setRefundingOrder(order);
    setRefundAmountInput(order.totalAmount || '');
    setRefundUtrInput('');
    setRefundNotesInput('');
    setRefundError(null);
  };

  const handleConfirmRefund = async (e) => {
    e.preventDefault();
    if (!refundingOrder) return;
    if (!refundUtrInput.trim()) {
      setRefundError('Please enter the UPI transaction reference / UTR number from your payment app.');
      return;
    }
    setRefundError(null);
    setRefundLoading(true);

    try {
      const res = await apiClient.patch(`/sellers/orders/${refundingOrder._id}/refund`, {
        refundUtr: refundUtrInput.trim(),
        refundAmount: Number(refundAmountInput) || refundingOrder.totalAmount,
        notes: refundNotesInput.trim()
      });

      const updated = res.data?.data || res.data;
      modal.success({
        title: 'Refund Recorded 💸',
        message: `Refund of ₹${refundAmountInput || refundingOrder.totalAmount} for Order #${refundingOrder._id.slice(-6).toUpperCase()} recorded! Order marked as REFUNDED.`,
        confirmText: 'Done'
      });
      setOrders(prev => prev.map(o => o._id === refundingOrder._id ? { ...o, paymentStatus: 'REFUNDED', paymentDetails: updated.paymentDetails || o.paymentDetails } : o));
      setRefundingOrder(null);
      loadDashboard();
    } catch (err) {
      setRefundError(err.response?.data?.message || err.message || 'Refund processing failed');
    } finally {
      setRefundLoading(false);
    }
  };

  if (loading) return <div className='p-8 text-center text-gray-600'>Loading seller dashboard...</div>;

  if (!dashboard) {
    return <SellerOnboarding onComplete={() => window.location.reload()} />;
  }

  const cards = [
    { label: 'Total products', value: dashboard.totalProducts ?? 0 },
    { label: 'Active products', value: dashboard.activeProducts ?? 0 },
    { label: 'Out of stock', value: dashboard.outOfStockProducts ?? 0 },
    { label: 'Total orders', value: dashboard.totalOrders ?? 0 },
    { label: 'Pending', value: dashboard.pendingOrders ?? 0 },
    { label: 'Processing', value: dashboard.processingOrders ?? 0 },
    { label: 'Shipped', value: dashboard.shippedOrders ?? 0 },
    { label: 'Delivered', value: dashboard.deliveredOrders ?? 0 },
    { label: 'Cancelled', value: dashboard.cancelledOrders ?? 0 },
    { label: 'Total revenue', value: formatCurrency(dashboard.totalRevenue ?? 0) },
    { label: `Revenue (${dashboard.selectedRangeDays || 30}d)`, value: formatCurrency(dashboard.revenueForRange ?? 0) }
  ];

  return (
    <div className='space-y-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Seller Dashboard</h1>
          <p className='text-gray-600'>MarketSphere Seller Hub & Store Manager</p>
        </div>
        <a href="/seller/products/new" className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm transition">
          + Add New Product
        </a>
      </div>

      {/* Metrics Grid */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {cards.map((card) => (
          <div key={card.label} className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm'>
            <p className='text-sm text-gray-500'>{card.label}</p>
            <p className='mt-3 text-2xl font-bold text-gray-900'>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Products Table with Details & Status */}
      <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-xl font-semibold text-gray-900'>My Products</h2>
            <p className='text-sm text-gray-500'>View product details, inventory and status</p>
          </div>
          <a href="/seller/products/new" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm">
            Add Product
          </a>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-left text-sm'>
            <thead>
              <tr className='border-b bg-gray-50 text-gray-700'>
                <th className='py-3 px-4'>Product</th>
                <th className='py-3 px-4'>SKU</th>
                <th className='py-3 px-4'>Status</th>
                <th className='py-3 px-4'>Stock</th>
                <th className='py-3 px-4'>Price</th>
                <th className='py-3 px-4 text-right'>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.length ? products.map((product) => (
                <tr key={product._id} className='border-b hover:bg-gray-50 transition'>
                  <td className='py-3 px-4 font-medium text-gray-900 flex items-center gap-3'>
                    <img 
                      src={product.images?.[0] || 'https://via.placeholder.com/40'} 
                      alt="" 
                      className="w-10 h-10 object-cover rounded border"
                    />
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-xs text-gray-500 line-clamp-1">{product.description}</p>
                    </div>
                  </td>
                  <td className='py-3 px-4 text-gray-600 font-mono text-xs'>{product.sku || 'N/A'}</td>
                  <td className='py-3 px-4'>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      product.status === 'PUBLISHED' 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className='py-3 px-4 font-medium'>
                    <span className={product.stock > 0 ? 'text-gray-800' : 'text-red-600'}>
                      {product.stock} units
                    </span>
                  </td>
                  <td className='py-3 px-4 font-semibold text-gray-900'>{formatCurrency(product.price)}</td>
                  <td className='py-3 px-4 text-right'>
                    <button 
                      onClick={() => setSelectedProduct(product)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs underline"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              )) : <tr><td className='py-4 text-center text-gray-500' colSpan='6'>No products found. Click "Add Product" to create one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders Management Table */}
      <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-xl font-semibold text-gray-900'>Orders & Fulfillment</h2>
            <p className='text-sm text-gray-500'>Manage customer orders and update status</p>
          </div>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-left text-sm'>
            <thead>
              <tr className='border-b bg-gray-50 text-gray-700'>
                <th className='py-3 px-4'>Order ID</th>
                <th className='py-3 px-4'>Customer / Items</th>
                <th className='py-3 px-4'>Total</th>
                <th className='py-3 px-4'>Payment Status</th>
                <th className='py-3 px-4'>Order Status</th>
                <th className='py-3 px-4 text-right'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length ? orders.map((order) => (
                <tr key={order._id} className='border-b hover:bg-gray-50 transition'>
                  <td className='py-3 px-4 font-mono font-medium text-gray-900'>
                    #{String(order._id).slice(-8).toUpperCase()}
                  </td>
                  <td className='py-3 px-4'>
                    <p className="text-xs font-semibold text-gray-800">
                      {order.customerId?.firstName ? `${order.customerId.firstName} ${order.customerId.lastName || ''}` : 'Customer'}
                    </p>
                    {order.orderItems?.map((item, idx) => (
                      <div key={idx} className="text-xs text-gray-600">
                        {item.productId?.name || 'Product'} × {item.quantity} (${item.priceAtPurchase})
                      </div>
                    ))}
                  </td>
                  <td className='py-3 px-4 font-semibold text-gray-900'>
                    ₹{order.totalAmount}
                  </td>
                  <td className='py-3 px-4'>
                    <div className="space-y-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                        order.paymentStatus === 'REFUNDED' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        order.paymentStatus === 'REFUND_PENDING' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        order.paymentStatus === 'PENDING_SELLER_CONFIRMATION' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.paymentStatus === 'PENDING_SELLER_CONFIRMATION' ? 'UTR SUBMITTED' : (order.paymentStatus || 'PENDING')}
                      </span>
                      {order.paymentStatus === 'REFUND_PENDING' && (
                        <p className="text-[11px] text-rose-700 font-semibold">
                          Refund Pending
                        </p>
                      )}
                      {(order.paymentStatus === 'REFUND_PENDING' || order.orderStatus === 'CANCELLED' || order.orderStatus === 'RETURN_REQUESTED' || order.orderStatus === 'RETURNED') && (
                        <div className="mt-1 p-2 bg-rose-50 border border-rose-200 rounded text-left">
                          <span className="block text-[10px] uppercase font-bold text-rose-800">Refund To Customer UPI:</span>
                          <span className="font-mono text-xs font-bold text-rose-950 select-all block break-all">
                            {order.customerRefundUpi || order.paymentDetails?.customerRefundUpi || order.paymentDetails?.senderUpiId || (order.customerId?.phone ? `${order.customerId.phone}@upi` : 'Customer UPI not recorded')}
                          </span>
                        </div>
                      )}
                      {order.paymentStatus === 'REFUNDED' && order.paymentDetails?.refundUtr && (
                        <p className="text-[11px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                          Refund UTR: #{order.paymentDetails.refundUtr}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-500 font-medium">Method: {order.paymentMethod}</p>
                      {order.paymentDetails?.utrNumber && order.paymentStatus !== 'REFUNDED' && (
                        <p className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          Payment UTR: {order.paymentDetails.utrNumber}
                        </p>
                      )}
                      {order.paymentDetails?.verifiedBySellerAt && (
                        <p className="text-[10px] text-gray-400">Verified by you</p>
                      )}
                    </div>
                  </td>
                  <td className='py-3 px-4'>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      order.orderStatus === 'PLACED' ? 'bg-blue-100 text-blue-800' :
                      order.orderStatus === 'DELIVERED' || order.orderStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      order.orderStatus === 'PROCESSING' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {order.orderStatus || 'PENDING'}
                    </span>
                  </td>
                  <td className='py-3 px-4 text-right space-y-1.5'>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {/* Online Payment Verification */}
                      {order.paymentStatus !== 'PAID' && order.paymentStatus !== 'REFUNDED' && order.paymentStatus !== 'REFUND_PENDING' && order.paymentMethod !== 'COD' && (
                        <button
                          onClick={() => handleOpenVerifyModal(order)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded text-xs font-bold shadow-sm transition active:scale-95 whitespace-nowrap"
                        >
                          Verify & Mark Paid
                        </button>
                      )}

                      {/* Process Refund Action for Cancelled, Returned, or Refund-Pending orders */}
                      {(order.paymentStatus === 'REFUND_PENDING' || (order.paymentStatus === 'PAID' && ['CANCELLED', 'RETURNED', 'RETURN_REQUESTED'].includes(order.orderStatus))) && (
                        <button
                          onClick={() => handleOpenRefundModal(order)}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded text-xs font-bold shadow-sm transition active:scale-95 whitespace-nowrap"
                        >
                          Process Refund
                        </button>
                      )}

                      {/* Cash on Delivery: Only when delivered */}
                      {order.paymentStatus !== 'PAID' && order.paymentMethod === 'COD' && (
                        order.orderStatus === 'DELIVERED' ? (
                          <button
                            onClick={() => handleMarkCodPaid(order._id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded text-xs font-bold shadow-sm transition active:scale-95 whitespace-nowrap"
                          >
                            Mark COD as Paid
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                            Deliver to mark COD paid
                          </span>
                        )
                      )}

                      {order.orderStatus !== 'PLACED' && order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'COMPLETED' && (
                        <button 
                          onClick={() => handleUpdateOrderStatus(order._id, 'PLACED')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition whitespace-nowrap"
                        >
                          Mark Placed
                        </button>
                      )}

                      <select
                        value={order.orderStatus || 'PENDING'}
                        onChange={(e) => handleUpdateOrderStatus(order._id, e.target.value)}
                        className="border rounded px-2 py-1 text-xs bg-white text-gray-800"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PLACED">PLACED</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="SHIPPED">SHIPPED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="COMPLETED">COMPLETED</option>
                      </select>
                    </div>
                  </td>
                </tr>
              )) : <tr><td className='py-4 text-center text-gray-500' colSpan='6'>No customer orders found yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedProduct.name}</h3>
                <p className="text-xs text-gray-500">SKU: {selectedProduct.sku}</p>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <img 
              src={selectedProduct.images?.[0] || 'https://via.placeholder.com/300'} 
              alt={selectedProduct.name} 
              className="w-full h-48 object-cover rounded-lg border"
            />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 block text-xs">Current Status</span>
                <span className="font-bold text-green-700 text-base">{selectedProduct.status}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 block text-xs">Unit Price</span>
                <span className="font-bold text-gray-900 text-base">${selectedProduct.price}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 block text-xs">Available Stock</span>
                <span className="font-bold text-gray-900 text-base">{selectedProduct.stock} units</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-500 block text-xs">Category</span>
                <span className="font-bold text-gray-900 text-base">{selectedProduct.category?.name || 'General'}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedProduct.description}</p>
            </div>
            <button 
              onClick={() => setSelectedProduct(null)}
              className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Seller UPI Payment Verification Modal */}
      {verifyingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Verify Payment Credit</h3>
                <p className="text-xs text-gray-500 font-mono">
                  Order #{String(verifyingOrder._id).slice(-8).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setVerifyingOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
              <p className="font-bold">⚠️ Accounting Rule:</p>
              <p>
                Please open your UPI app (Google Pay, PhonePe, Paytm, or Bank App) and confirm that the exact money has been credited into your account before marking as paid.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3.5 text-xs space-y-2 border border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Actual Order Total:</span>
                <span className="font-bold text-gray-900 text-sm">₹{verifyingOrder.totalAmount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Customer Submitted UTR:</span>
                <span className="font-mono font-bold text-indigo-700">
                  {verifyingOrder.paymentDetails?.utrNumber || 'No UTR submitted yet'}
                </span>
              </div>
              {verifyingOrder.paymentDetails?.senderUpiId && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Sender UPI ID:</span>
                  <span className="font-mono text-gray-800">{verifyingOrder.paymentDetails.senderUpiId}</span>
                </div>
              )}
            </div>

            {verificationError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-medium">
                {verificationError}
              </div>
            )}

            <form onSubmit={handleConfirmVerification} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Actual Money Received in Your Account (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={receivedAmountInput}
                  onChange={(e) => setReceivedAmountInput(e.target.value)}
                  placeholder={`e.g. ${verifyingOrder.totalAmount}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Must match the order total of ₹{verifyingOrder.totalAmount} exactly.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Verified UTR / Bank Reference Number
                </label>
                <input
                  type="text"
                  value={verifyingUtrInput}
                  onChange={(e) => setVerifyingUtrInput(e.target.value)}
                  placeholder="12-digit transaction ID / UTR"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingOrder(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verificationLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50"
                >
                  {verificationLoading ? 'Verifying...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Refund Modal */}
      {refundingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-100">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                  <span className="text-rose-600">💸</span> Process Customer Refund
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Order #{String(refundingOrder._id).slice(-8).toUpperCase()}
                </p>
              </div>
              <button 
                onClick={() => setRefundingOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {refundError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg">
                {refundError}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs text-amber-900">
              <div className="flex justify-between items-center">
                <p className="font-bold flex items-center gap-1 text-xs">
                  <span>📍</span> Customer Refund UPI ID:
                </p>
                {(refundingOrder.customerRefundUpi || refundingOrder.paymentDetails?.customerRefundUpi || refundingOrder.paymentDetails?.senderUpiId) && (
                  <button
                    type="button"
                    onClick={() => {
                      const upi = refundingOrder.customerRefundUpi || refundingOrder.paymentDetails?.customerRefundUpi || refundingOrder.paymentDetails?.senderUpiId;
                      navigator.clipboard.writeText(upi);
                      toast.success('UPI ID copied to clipboard!', 'Copied');
                    }}
                    className="bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold px-2 py-0.5 rounded text-[10px] transition"
                  >
                    Copy UPI
                  </button>
                )}
              </div>
              <div className="bg-white p-2.5 rounded border border-amber-200 font-mono text-sm font-bold text-gray-900 select-all break-all">
                {refundingOrder.customerRefundUpi || refundingOrder.paymentDetails?.customerRefundUpi || refundingOrder.paymentDetails?.senderUpiId || (refundingOrder.customerId?.phone ? `${refundingOrder.customerId.phone}@upi` : 'No UPI recorded (Please contact customer)')}
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Please transfer ₹{refundingOrder.totalAmount} to the customer's UPI ID above using PhonePe, GPay, Paytm, or your bank app, then enter the 12-digit UTR below.
              </p>
            </div>

            <form onSubmit={handleConfirmRefund} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Refund Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Refund Bank / UPI Transaction Reference (UTR) *
                </label>
                <input
                  type="text"
                  required
                  value={refundUtrInput}
                  onChange={(e) => setRefundUtrInput(e.target.value)}
                  placeholder="12-digit UPI UTR from your bank payment"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  This UTR will be shared with the customer as verifiable proof of refund.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Notes / Reason
                </label>
                <input
                  type="text"
                  value={refundNotesInput}
                  onChange={(e) => setRefundNotesInput(e.target.value)}
                  placeholder="e.g. Returned item inspected and refund issued"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundingOrder(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundLoading}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50"
                >
                  {refundLoading ? 'Recording Refund...' : 'Confirm Refund Sent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;