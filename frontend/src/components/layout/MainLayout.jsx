import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const MainLayout = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?keyword=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/products');
    }
  };

  return (
    <div className='min-h-screen flex flex-col bg-gray-50'>
      <header className='bg-gray-900 shadow-md sticky top-0 z-50 text-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between h-16 items-center'>
            <Link to='/' className='text-3xl font-extrabold text-amber-400 tracking-tight'>
              MarketSphere
            </Link>
            
            <div className="flex-1 max-w-2xl px-8 hidden md:block">
              <form onSubmit={handleSearch} className="relative w-full">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for products, categories, SKU..." 
                  className="w-full text-black px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500" 
                />
                <button type="submit" className="absolute right-0 top-0 h-full px-4 bg-amber-400 text-gray-900 rounded-r-md font-bold hover:bg-amber-500 transition">
                  Search
                </button>
              </form>
            </div>

            <nav className='flex space-x-5 items-center font-medium text-sm'>
              <Link to='/products' className='hover:text-amber-400 transition'>Explore</Link>
              <Link to='/cart' className='hover:text-amber-400 transition flex items-center gap-1'>
                <span>🛒</span> Cart
              </Link>
              
              {user?.role === 'CUSTOMER' && (
                <>
                  <Link to='/customer' className='hover:text-amber-400 transition'>My Account</Link>
                  <Link to='/seller/apply' className='text-amber-400 hover:text-amber-300 transition text-xs border border-amber-400 px-2 py-1 rounded'>
                    Become a Seller
                  </Link>
                </>
              )}
              {user?.role === 'SELLER' && (
                <Link to='/seller' className='hover:text-amber-400 transition bg-blue-600 px-3 py-1 rounded text-white'>
                  Seller Hub
                </Link>
              )}
              {user?.role === 'ADMIN' && (
                <Link to='/admin' className='hover:text-amber-400 transition bg-red-600 px-3 py-1 rounded text-white'>
                  Admin Panel
                </Link>
              )}
              
              {!token ? (
                <div className="flex items-center space-x-3 ml-2 border-l border-gray-700 pl-4">
                  <Link to='/login' className='hover:text-amber-400 transition'>Login</Link>
                  <Link to='/register' className='bg-amber-400 text-gray-900 px-3 py-1 rounded font-semibold hover:bg-amber-500 transition'>Sign up</Link>
                </div>
              ) : (
                <div className="flex items-center space-x-3 ml-2 border-l border-gray-700 pl-4">
                  <span className="text-xs text-gray-300">
                    {user.firstName || 'User'} <span className="text-amber-400">({user.role})</span>
                  </span>
                  <button onClick={handleLogout} className='text-red-400 hover:text-red-300 transition text-xs'>
                    Logout
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>
      
      <main className='flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <Outlet />
      </main>
      
      <footer className='bg-gray-800 text-white py-6 mt-auto'>
        <div className='max-w-7xl mx-auto px-4 text-center text-sm text-gray-400'>
          <p>&copy; {new Date().getFullYear()} MarketSphere Multi-Vendor Marketplace. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;