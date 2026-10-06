import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../api/client';
import ProductCard from '../../components/product/ProductCard';

export default function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKeyword = searchParams.get('keyword') || '';
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialKeyword);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const fetchProducts = (keyword = '', category = '') => {
    setLoading(true);
    let url = '/products?';
    if (keyword) url += `keyword=${encodeURIComponent(keyword)}&`;
    if (category) url += `category=${encodeURIComponent(category)}&`;

    apiClient.get(url)
      .then(res => setProducts(res.data?.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiClient.get('/products/categories')
      .then(res => setCategories(res.data?.data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const kw = searchParams.get('keyword') || '';
    setSearchInput(kw);
    fetchProducts(kw, selectedCategory);
  }, [searchParams, selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ keyword: searchInput.trim() });
    } else {
      setSearchParams({});
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSelectedCategory('');
    setSearchParams({});
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Search Controls */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Explore Products</h1>
            <p className="text-gray-500 text-sm">Discover top-rated tech, gadgets, and verified merchant deals</p>
          </div>
          
          {/* In-page Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products by title, sku, or description..." 
                className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:outline-none text-sm"
              />
              {searchInput && (
                <button 
                  type="button" 
                  onClick={handleClearSearch}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            <button 
              type="submit" 
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-5 py-2.5 rounded-lg font-semibold text-sm transition shadow-sm active:scale-95"
            >
              Search
            </button>
          </form>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 pt-2 border-t overflow-x-auto text-sm">
          <span className="text-gray-500 font-medium whitespace-nowrap">Categories:</span>
          <button 
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              selectedCategory === '' 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Items
          </button>
          {categories.map(c => (
            <button 
              key={c._id} 
              onClick={() => setSelectedCategory(c._id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === c._id 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {c.name}
            </button>
          ))}
          {(searchInput || selectedCategory) && (
            <button 
              onClick={handleClearSearch}
              className="text-xs text-red-600 hover:underline font-medium ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Product Grid / Loading / Empty */}
      {loading ? (
        <div className="p-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-3"></div>
          <p className="text-gray-500 font-medium">Loading catalog...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center space-y-3">
          <p className="text-4xl">🔍</p>
          <h3 className="text-xl font-bold text-gray-800">No matching products found</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Try searching for something else or clear your filters to view all available listings.
          </p>
          <button 
            onClick={handleClearSearch}
            className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-yellow-500"
          >
            Show All Products
          </button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4 text-xs text-gray-500 font-medium">
            <span>Showing {products.length} products</span>
            {searchInput && <span>Results matching "{searchInput}"</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}