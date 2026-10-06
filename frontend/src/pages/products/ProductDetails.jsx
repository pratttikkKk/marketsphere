import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
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
      alert('Please login to add to cart');
      navigate('/login');
      return;
    }
    setAddingToCart(true);
    try {
      await apiClient.post('/cart/items', { productId: product._id, quantity });
      alert('Added to cart successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add to cart');
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
          src={product.images?.[0] || 'https://via.placeholder.com/400'} 
          alt={product.name} 
          className="w-full h-auto object-contain rounded"
        />
      </div>
      <div className="md:w-1/2 flex flex-col">
        <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
        <p className="text-gray-500 mb-4">{product.sellerId?.storeName || 'MarketSphere Store'}</p>
        
        <div className="text-3xl font-bold text-gray-900 mb-4">${product.price}</div>
        
        <p className="text-gray-700 mb-6 flex-1">{product.description}</p>
        
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-600 mb-2">Availability:</p>
          {product.stock > 0 ? (
            <p className="text-green-600 font-bold">In Stock ({product.stock} available)</p>
          ) : (
            <p className="text-red-600 font-bold">Out of Stock</p>
          )}
        </div>

        {product.stock > 0 && (
          <div className="flex items-center gap-4">
            <input 
              type="number" 
              min="1" 
              max={product.stock} 
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-20 border rounded px-3 py-2 text-center"
            />
            <button 
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 rounded-full transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              {addingToCart ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
