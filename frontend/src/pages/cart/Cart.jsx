import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);

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
    } catch(err) { alert(err.message); }
  };

  const handleUpdateQuantity = async (productId, quantity) => {
    try {
      const res = await apiClient.put(`/cart/items/${productId}`, { quantity });
      setCart(res.data);
    } catch(err) { alert(err.message); }
  };

  if (loading) return <div className="p-8 text-center">Loading cart...</div>;
  if (!cart || cart.items.length === 0) return <div className="p-8 text-center text-gray-500">Your cart is empty. <Link to="/" className="text-blue-600">Browse Products</Link></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Shopping Cart</h1>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {cart.items.map(item => (
          <div key={item._id} className="flex justify-between items-center py-4 border-b last:border-b-0">
            <div>
              <p className="font-semibold text-gray-800">{item.productId?.name || 'Unknown Product'}</p>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <span>Qty:</span>
                <input 
                  type="number" 
                  min="1" 
                  max={item.productId?.stock || 99}
                  value={item.quantity} 
                  onChange={(e) => handleUpdateQuantity(item.productId?._id, Number(e.target.value))}
                  className="w-16 border rounded px-2 py-1 text-center"
                />
              </div>
            </div>
            <button onClick={() => handleRemove(item.productId?._id)} className="text-red-500 hover:text-red-700">Remove</button>
          </div>
        ))}
        <div className="mt-6 text-right">
          <Link to="/checkout" className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition">Proceed to Checkout</Link>
        </div>
      </div>
    </div>
  );
}