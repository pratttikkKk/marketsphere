import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useNotification();

  useEffect(() => {
    apiClient.get('/cart')
      .then(res => setCart(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (productId) => {
    try {
      const res = await apiClient.delete(`/cart/items/${productId}`);
      setCart(res.data);
      toast.success('Item removed from cart', 'Cart Updated');
    } catch(err) { 
      toast.error(err.response?.data?.message || err.message, 'Cart Error'); 
    }
  };

  const handleUpdateQuantity = async (productId, quantity) => {
    try {
      const res = await apiClient.put(`/cart/items/${productId}`, { quantity });
      setCart(res.data);
      toast.success('Quantity updated', 'Cart Updated');
    } catch(err) { 
      toast.error(err.response?.data?.message || err.message, 'Cart Error'); 
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-2"></div>
        <p className="text-gray-500">Loading your shopping cart...</p>
      </div>
    );
  }

  const items = cart?.items || [];
  const subtotal = items.reduce((sum, item) => {
    const price = item.price || item.productId?.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  if (!cart || items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-16 bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
          🛒
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Cart is Empty</h2>
        <p className="text-gray-500 text-sm mb-6">Looks like you haven't added anything to your cart yet.</p>
        <Link 
          to="/products" 
          className="inline-block bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-8 py-3 rounded-xl transition shadow-sm active:scale-95 text-sm"
        >
          Explore Authentic Merchandise
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto my-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Shopping Cart</h1>
          <p className="text-gray-500 text-sm">{items.length} {items.length === 1 ? 'item' : 'items'} in your bag</p>
        </div>
        <Link to="/products" className="text-sm text-amber-600 hover:underline font-semibold">
          ← Continue Shopping
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Item List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => {
            const product = item.productId || {};
            const price = item.price || product.price || 0;
            const lineTotal = price * item.quantity;
            const image = product.images?.[0] || 'https://via.placeholder.com/150';

            return (
              <div key={item._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex gap-4 items-center transition hover:border-gray-200">
                <Link to={`/products/${product._id}`} className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-50 border">
                  <img src={image} alt={product.name} className="w-full h-full object-cover" />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link to={`/products/${product._id}`} className="font-bold text-gray-900 hover:text-amber-600 transition text-sm sm:text-base line-clamp-1">
                    {product.name || 'Marketplace Item'}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">Unit Price: ₹{price}</p>
                  
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center border rounded-lg bg-gray-50">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(product._id, Math.max(1, item.quantity - 1))}
                        className="px-2.5 py-1 text-gray-600 hover:bg-gray-200 font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="w-10 text-center font-bold text-xs">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(product._id, Math.min(product.stock || 99, item.quantity + 1))}
                        className="px-2.5 py-1 text-gray-600 hover:bg-gray-200 font-bold text-xs"
                      >
                        +
                      </button>
                    </div>

                    <button 
                      onClick={() => handleRemove(product._id)} 
                      className="text-xs text-rose-500 hover:text-rose-700 hover:underline font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-base sm:text-lg font-extrabold text-gray-900">₹{lineTotal}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-24 space-y-5">
            <h2 className="text-lg font-extrabold text-gray-900 border-b pb-3">Order Summary</h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-bold text-gray-900">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Standard Delivery</span>
                <span className="font-bold text-emerald-600">FREE</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Taxes & Fees</span>
                <span className="font-bold text-gray-900">Included</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-extrabold text-base text-gray-900">Total Amount</span>
                <span className="font-extrabold text-xl text-amber-600">₹{subtotal}</span>
              </div>
            </div>

            <Link 
              to="/checkout" 
              className="w-full block text-center bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-extrabold py-3.5 rounded-xl transition shadow-md shadow-yellow-400/20 active:scale-95 text-sm"
            >
              Proceed to Checkout 💳
            </Link>

            <div className="pt-2 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
              <span>🔒 Direct UPI QR & Online Simulated Gateway Protected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}