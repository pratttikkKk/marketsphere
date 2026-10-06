import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerApply from './pages/seller/SellerApply';
import AddProduct from './pages/seller/AddProduct';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductList from './pages/products/ProductList';
import ProductDetails from './pages/products/ProductDetails';
import Cart from './pages/cart/Cart';
import Checkout from './pages/checkout/Checkout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleRoute from './components/common/RoleRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path='login' element={<Login />} />
          <Route path='register' element={<Register />} />
          <Route path='products' element={<ProductList />} />
          <Route path='products/:id' element={<ProductDetails />} />

          {/* Protected Customer Routes */}
          <Route path='customer' element={
            <ProtectedRoute>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path='cart' element={
            <ProtectedRoute>
              <Cart />
            </ProtectedRoute>
          } />
          <Route path='checkout' element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          } />

          {/* Seller Onboarding & Management */}
          <Route path='seller/apply' element={
            <ProtectedRoute>
              <SellerApply />
            </ProtectedRoute>
          } />
          <Route path='seller' element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['SELLER', 'ADMIN']}>
                <SellerDashboard />
              </RoleRoute>
            </ProtectedRoute>
          } />
          <Route path='seller/products/new' element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['SELLER', 'ADMIN']}>
                <AddProduct />
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* Protected Administrator Route */}
          <Route path='admin' element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path='*' element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;