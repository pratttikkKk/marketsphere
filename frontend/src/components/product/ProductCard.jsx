import { Link } from 'react-router-dom';

const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://via.placeholder.com/300';
  if (imagePath.startsWith('http')) return imagePath;
  const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://localhost:5002';
  return `${baseUrl}${imagePath}`;
};

export default function ProductCard({ product }) {
  const avgRating = Math.round(product.averageRating || 0);
  const numReviews = product.numReviews || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden group cursor-pointer flex flex-col h-full relative">
      {product.stock < 10 && product.stock > 0 && (
        <span className="absolute top-2 left-2 bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded z-10">
          Only {product.stock} left!
        </span>
      )}
      {product.stock === 0 && (
        <span className="absolute top-2 left-2 bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded z-10">
          Out of Stock
        </span>
      )}
      <div className="relative h-56 overflow-hidden bg-gray-50 flex items-center justify-center p-4">
        <img 
          src={getImageUrl(product.images?.[0])} 
          alt={product.name} 
          className="max-h-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply" 
        />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-medium text-gray-900 line-clamp-2 leading-tight hover:text-blue-600 transition-colors">
          {product.name}
        </h3>
        
        {/* Genuine Rating Display - Zero Fabricated Ratings */}
        <div className="flex items-center gap-1 mt-2 text-sm">
          {numReviews > 0 ? (
            <>
              <span className="text-yellow-500">{'★'.repeat(avgRating)}{'☆'.repeat(5 - avgRating)}</span>
              <span className="text-gray-600 font-semibold text-xs ml-1">{product.averageRating?.toFixed(1)}</span>
              <span className="text-gray-400 text-xs ml-1">({numReviews})</span>
            </>
          ) : (
            <span className="text-gray-400 text-xs italic">No reviews yet</span>
          )}
        </div>

        <div className="mt-auto pt-4 flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold text-gray-900">₹{product.price}</span>
            <div className="text-xs text-gray-500 mt-1">
              {product.price >= 500 ? (
                <span className="text-green-600 font-semibold">Eligible for Free Delivery</span>
              ) : (
                <span>Standard Delivery ₹40</span>
              )}
            </div>
          </div>
          <Link 
            to={`/products/${product._id}`} 
            className="px-4 py-2 bg-amber-400 text-gray-900 rounded-full font-semibold hover:bg-amber-500 transition shadow-sm hover:shadow active:scale-95"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}