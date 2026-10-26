import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';

const formatCurrency = (value = 0) => `₹${Number(value).toLocaleString()}`;

const AdminDashboard = () => {
  const { toast, modal } = useNotification();
  const [metrics, setMetrics] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [moderation, setModeration] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [dashboardResp, sellersResp, moderationResp, usersResp, ordersResp] = await Promise.all([
          apiClient.get('/admin/dashboard'),
          apiClient.get('/admin/seller-applications'),
          apiClient.get('/admin/moderation'),
          apiClient.get('/admin/users'),
          apiClient.get('/admin/orders')
        ]);

        setMetrics(dashboardResp?.data || {});
        setSellers(sellersResp?.data || []);
        setModeration(moderationResp?.data?.products || []);
        setUsers(usersResp?.data?.users || []);
        setOrders(ordersResp?.data?.orders || []);
      } catch (error) {
        console.error('Admin dashboard failed:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const handleApproveProduct = async (productId) => {
    try {
      await apiClient.patch(`/admin/products/${productId}/moderate`, { status: 'PUBLISHED' });
      setModeration(prev => prev.filter(p => p._id !== productId));
      toast.success('Product approved and PUBLISHED to marketplace catalog!', 'Product Approved');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, 'Moderation Error');
    }
  };

  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    type: 'product',
    targetId: null,
    targetName: '',
    reason: '',
    loading: false
  });

  const handleOpenRejectProduct = (product) => {
    setRejectModal({
      isOpen: true,
      type: 'product',
      targetId: product._id,
      targetName: product.name,
      reason: 'Quality guidelines not met or missing required specifications.',
      loading: false
    });
  };

  const handleOpenRejectSeller = (seller) => {
    setRejectModal({
      isOpen: true,
      type: 'seller',
      targetId: seller._id,
      targetName: seller.storeName,
      reason: 'Business documentation incomplete or invalid UPI credentials.',
      loading: false
    });
  };

  const handleConfirmRejection = async (e) => {
    e.preventDefault();
    const { type, targetId, reason } = rejectModal;
    setRejectModal(prev => ({ ...prev, loading: true }));
    try {
      if (type === 'product') {
        await apiClient.patch(`/admin/products/${targetId}/moderate`, { status: 'REJECTED', reason });
        setModeration(prev => prev.filter(p => p._id !== targetId));
        toast.info('Product rejected.', 'Moderation Updated');
      } else {
        await apiClient.patch(`/admin/sellers/${targetId}/status`, { status: 'REJECTED', reason });
        setSellers(prev => prev.filter(s => s._id !== targetId));
        toast.info('Seller application rejected.', 'Seller Status Updated');
      }
      setRejectModal({ isOpen: false, type: 'product', targetId: null, targetName: '', reason: '', loading: false });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, 'Rejection Error');
      setRejectModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSellerStatus = async (sellerId, status) => {
    try {
      await apiClient.patch(`/admin/sellers/${sellerId}/status`, { status });
      setSellers(prev => prev.filter(s => s._id !== sellerId));
      toast.success(`Seller application marked as ${status}!`, 'Seller Status Updated');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, 'Seller Status Error');
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await apiClient.patch(`/admin/users/${userId}/status`, { isActive: !currentStatus });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: !currentStatus } : u));
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully!`, 'User Status');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, 'User Status Error');
    }
  };

  const handleReturnDecision = async (orderId, decision) => {
    try {
      await apiClient.patch(`/admin/orders/${orderId}/returns`, { decision });
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, orderStatus: decision === 'APPROVE' ? 'RETURNED' : 'DELIVERED' } : o));
      toast.success(`Return ${decision.toLowerCase()}ed!`, 'Return Decision');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, 'Return Error');
    }
  };

  if (loading) return <div className='p-8 text-center text-gray-600'>Loading admin operations center...</div>;

  const cards = [
    { label: 'Total customers', value: metrics?.totalCustomers ?? 0 },
    { label: 'Total sellers', value: metrics?.totalSellers ?? 0 },
    { label: 'Pending seller approvals', value: metrics?.pendingSellerApprovals ?? 0 },
    { label: 'Approved sellers', value: metrics?.approvedSellers ?? 0 },
    { label: 'Total products', value: metrics?.totalProducts ?? 0 },
    { label: 'Pending product moderation', value: metrics?.pendingProductApprovals ?? 0 },
    { label: 'Active published products', value: metrics?.activeProducts ?? 0 },
    { label: 'Total orders placed', value: metrics?.totalOrders ?? 0 },
    { label: 'Marketplace sales', value: formatCurrency(metrics?.totalMarketplaceSales ?? 0) }
  ];

  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-3xl font-bold text-gray-900'>Administrator Control Center</h1>
        <p className='text-gray-600'>Marketplace moderation, vendor vetting, and order operations</p>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-3'>
        {cards.map((card) => (
          <div key={card.label} className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm'>
            <p className='text-xs uppercase tracking-wider text-gray-500 font-semibold'>{card.label}</p>
            <p className='mt-2 text-2xl font-bold text-gray-900'>{card.value}</p>
          </div>
        ))}
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        {/* Pending Seller Applications */}
        <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
          <h2 className='mb-4 text-xl font-semibold text-gray-900'>Pending Seller Applications</h2>
          <div className='space-y-3'>
            {sellers.length ? sellers.map((seller) => (
              <div key={seller._id} className='flex items-center justify-between rounded-lg bg-gray-50 p-3 border'>
                <div>
                  <p className='font-semibold text-gray-900'>{seller.storeName}</p>
                  <p className='text-xs text-gray-500'>{seller.contactEmail} | {seller.contactPhone || 'No phone'}</p>
                  <p className='text-xs text-gray-600 mt-1'>{seller.businessAddress || 'No address provided'}</p>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold'>
                    {seller.status}
                  </span>
                  {seller.status === 'PENDING' && (
                    <>
                      <button 
                        onClick={() => handleSellerStatus(seller._id, 'APPROVED')} 
                        className='text-xs bg-green-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition'
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleOpenRejectSeller(seller)} 
                        className='text-xs bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition'
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            )) : <p className='text-gray-500 text-sm'>No pending seller applications at this time.</p>}
          </div>
        </div>

        {/* Products Awaiting Moderation */}
        <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
          <h2 className='mb-4 text-xl font-semibold text-gray-900'>Products Awaiting Moderation</h2>
          <div className='space-y-3'>
            {moderation.length ? moderation.map((product) => (
              <div key={product._id} className='flex items-center justify-between rounded-lg bg-yellow-50 p-3 border border-yellow-200'>
                <div>
                  <p className='font-semibold text-gray-900'>{product.name}</p>
                  <p className='text-xs text-gray-600'>Vendor: {product.sellerId?.storeName || 'Unknown'} | Price: ₹{product.price}</p>
                  <p className='text-xs text-gray-500 font-mono'>SKU: {product.sku}</p>
                </div>
                <div className='flex gap-2 items-center'>
                  <span className='rounded-full bg-yellow-200 px-2.5 py-0.5 text-xs font-semibold text-yellow-800'>
                    {product.status}
                  </span>
                  <button 
                    onClick={() => handleApproveProduct(product._id)} 
                    className='text-xs bg-green-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition'
                  >
                    Publish
                  </button>
                  <button 
                    onClick={() => handleOpenRejectProduct(product)} 
                    className='text-xs bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition'
                  >
                    Reject
                  </button>
                </div>
              </div>
            )) : <p className='text-gray-500 text-sm'>All submitted products have been moderated.</p>}
          </div>
        </div>
      </div>

      {/* Users and Orders Management */}
      <div className='grid gap-6 lg:grid-cols-2'>
        <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
          <h2 className='mb-4 text-xl font-semibold text-gray-900'>Registered Users</h2>
          <div className='space-y-3 max-h-96 overflow-y-auto'>
            {users.length ? users.map((user) => (
              <div key={user._id} className='flex items-center justify-between rounded-lg bg-gray-50 p-3 border'>
                <div>
                  <p className='font-semibold text-gray-900'>{user.firstName} {user.lastName}</p>
                  <p className='text-xs text-gray-500'>{user.email} • Role: <strong className="text-blue-600">{user.role}</strong></p>
                </div>
                <div className='flex items-center gap-2'>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Active' : 'Suspended'}
                  </span>
                  {user.role !== 'ADMIN' && (
                    <button 
                      onClick={() => handleToggleUserStatus(user._id, user.isActive)} 
                      className={`text-xs text-white font-semibold px-3 py-1 rounded-lg transition ${user.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                      {user.isActive ? 'Suspend' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            )) : <p className='text-gray-500 text-sm'>No users found.</p>}
          </div>
        </div>

        <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
          <h2 className='mb-4 text-xl font-semibold text-gray-900'>Recent Orders & Returns</h2>
          <div className='space-y-3 max-h-96 overflow-y-auto'>
            {orders.length ? orders.map((order) => (
              <div key={order._id} className='flex items-center justify-between rounded-lg bg-blue-50 p-3 border border-blue-100'>
                <div>
                  <p className='font-semibold text-gray-900'>Order #{order._id.slice(-8).toUpperCase()}</p>
                  <p className='text-xs text-gray-600'>₹{order.totalAmount} • {new Date(order.createdAt).toLocaleDateString()}</p>
                  {order.returnReason && <p className='text-xs text-red-600 mt-1'>Return Reason: {order.returnReason}</p>}
                </div>
                <div className='flex items-center gap-2'>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    order.orderStatus === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                    order.orderStatus === 'CANCELLED' || order.orderStatus === 'RETURNED' ? 'bg-red-100 text-red-800' :
                    order.orderStatus === 'RETURN_REQUESTED' ? 'bg-amber-100 text-amber-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.orderStatus}
                  </span>
                  {order.orderStatus === 'RETURN_REQUESTED' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleReturnDecision(order._id, 'APPROVE')}
                        className="text-xs bg-green-600 text-white font-semibold px-2 py-1 rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReturnDecision(order._id, 'REJECT')}
                        className="text-xs bg-red-600 text-white font-semibold px-2 py-1 rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )) : <p className='text-gray-500 text-sm'>No orders found.</p>}
          </div>
        </div>
      </div>

      {/* Styled Rejection Modal */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-rose-600">⚠️</span>
                  {rejectModal.type === 'product' ? 'Reject Product Submission' : 'Reject Seller Application'}
                </h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  Target: {rejectModal.targetName || 'Selected Item'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModal(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmRejection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  rows="3"
                  required
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Specify why this submission is being rejected so the applicant can correct it..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  This explanation will be recorded and communicated to the vendor.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectModal.loading}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50"
                >
                  {rejectModal.loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;