import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useNotification } from '../../context/NotificationContext';

const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://via.placeholder.com/400';
  if (imagePath.startsWith('http')) return imagePath;
  let baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '') : '';
  if (!baseUrl && typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      baseUrl = 'https://marketsphere-api.onrender.com';
    } else {
      baseUrl = 'http://localhost:5002';
    }
  }
  return `${baseUrl || ''}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, modal } = useNotification();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get(`/products/${id}`)
      .then(res => {
        const prod = res?.data || res;
        setProduct(prod);
      })
      .catch(err => setError(err.response?.data?.message || err.message || 'Failed to load product'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = async () => {
    if (!localStorage.getItem('token')) {
      modal.warning({
        title: 'Sign In Required',
        message: 'Please log in to your account to add items to your shopping cart.',
        confirmText: 'Sign In',
        onConfirm: () => navigate('/login')
      });
      return;
    }
    setAddingToCart(true);
    try {
      await apiClient.post('/cart/items', { productId: product._id, quantity });
      toast.success(`Added ${quantity} × "${product.name}" to your cart!`, 'Cart Updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add item to cart', 'Cart Error');
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading product details...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!product) return <div className="p-8 text-center">Product not found.</div>;

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm border mt-10 flex flex-col md:flex-row gap-8">
      <div className="md:w-1/2">
        <img 
          src={getImageUrl(product.images?.[0])} 
          alt={product.name} 
          className="w-full h-auto object-contain rounded"
        />
      </div>
      <div className="md:w-1/2 flex flex-col">
        <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl font-extrabold text-gray-900">₹{product.price}</div>
          {product.category?.name && (
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">
              {product.category.name}
            </span>
          )}
        </div>
        
        {product.sellerUpiId && (
          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg font-medium">
            <span>⚡ Direct UPI Scanner Available</span>
            <span className="text-gray-400">|</span>
            <span className="font-mono text-[11px]">{product.sellerUpiId}</span>
          </div>
        )}
        
        <p className="text-gray-700 mb-6 flex-1 text-sm leading-relaxed">{product.description}</p>
        
        <div className="mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Availability</p>
          {product.stock > 0 ? (
            <p className="text-emerald-600 font-extrabold text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              In Stock ({product.stock} units available)
            </p>
          ) : (
            <p className="text-rose-600 font-extrabold text-sm">Out of Stock</p>
          )}
        </div>

        {product.stock > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-xl overflow-hidden bg-gray-50">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-200 font-bold"
                >
                  -
                </button>
                <input 
                  type="number" 
                  min="1" 
                  max={product.stock} 
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
                  className="w-14 bg-transparent py-2 text-center text-sm font-bold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-200 font-bold"
                >
                  +
                </button>
              </div>

              <button 
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 rounded-xl transition shadow-sm active:scale-95 disabled:opacity-50 text-sm"
              >
                {addingToCart ? 'Adding to Cart...' : 'Add to Cart 🛒'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await handleAddToCart();
                  navigate('/checkout');
                }}
                disabled={addingToCart}
                className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl transition shadow-sm active:scale-95 disabled:opacity-50 text-sm"
              >
                Buy Now ⚡
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
