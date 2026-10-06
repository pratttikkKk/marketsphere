const axios = require('axios');

const API_URL = 'http://127.0.0.1:5002/api/v1';

async function runE2ETest() {
  console.log('--- STARTING E2E TEST FLOW ---');
  try {
    const timestamp = Date.now();
    const customerEmail = `c_${timestamp}@gmail.com`;
    const sellerEmail = `s_${timestamp}@gmail.com`;
    const adminEmail = `admin_${timestamp}@marketsphere.com`;

    // 1. Register Customer
    console.log(`1. Registering Customer ${customerEmail}`);
    await axios.post(`${API_URL}/auth/register`, {
      firstName: 'Customer', lastName: 'Test', email: customerEmail, password: '123', role: 'CUSTOMER'
    });
    
    const customerLogin = await axios.post(`${API_URL}/auth/login`, { email: customerEmail, password: '123' });
    const customerToken = customerLogin.data.data.token;
    console.log('   Customer Login Success');

    // 2. Register Seller
    console.log(`2. Registering Seller ${sellerEmail}`);
    await axios.post(`${API_URL}/auth/register`, {
      firstName: 'Seller', lastName: 'Test', email: sellerEmail, password: '123', role: 'SELLER'
    });
    
    const sellerLogin = await axios.post(`${API_URL}/auth/login`, { email: sellerEmail, password: '123' });
    const sellerToken = sellerLogin.data.data.token;
    console.log('   Seller Login Success');

    // Seller Onboarding
    await axios.post(`${API_URL}/sellers`, { storeName: `Bangles Store ${timestamp}`, contactEmail: sellerEmail }, { headers: { Authorization: `Bearer ${sellerToken}` }});

    // 3. Admin approves seller
    console.log('3. Admin Approving Seller');
    await axios.post(`${API_URL}/auth/register`, {
      firstName: 'Admin', lastName: 'User', email: adminEmail, password: 'adminpassword', role: 'ADMIN'
    });
    const adminLogin = await axios.post(`${API_URL}/auth/login`, { email: adminEmail, password: 'adminpassword' });
    const adminToken = adminLogin.data.data.token;

    const sellersResp = await axios.get(`${API_URL}/admin/seller-applications`, { headers: { Authorization: `Bearer ${adminToken}` }});
    const pendingSeller = sellersResp.data.data.find(s => s.contactEmail === sellerEmail);
    if (pendingSeller && pendingSeller.status !== 'APPROVED') {
      await axios.patch(`${API_URL}/admin/sellers/${pendingSeller._id}/status`, { status: 'APPROVED' }, { headers: { Authorization: `Bearer ${adminToken}` }});
      console.log('   Seller Approved');
    }

    // 4. Seller adds product
    console.log('4. Seller adding Product (Bangles)');
    const categories = await axios.get(`${API_URL}/products/categories`);
    let catId = categories.data.data[0]?._id;
    if (!catId) {
      const newCat = await axios.post(`${API_URL}/admin/categories`, { name: 'Jewelry', slug: 'jewelry' }, { headers: { Authorization: `Bearer ${adminToken}` }});
      catId = newCat.data.data._id;
    }

    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('name', 'Bangles');
    formData.append('description', 'Beautiful bangles');
    formData.append('sku', 'BAN-001-' + Date.now());
    formData.append('price', '20');
    formData.append('stock', '50');
    formData.append('category', catId);

    const productResp = await axios.post(`${API_URL}/products`, formData, { headers: { Authorization: `Bearer ${sellerToken}`, 'Content-Type': 'multipart/form-data' }});
    const productId = productResp.data.data._id;
    
    // 5. Admin approves product
    console.log('5. Admin approving Product');
    await axios.patch(`${API_URL}/admin/products/${productId}/moderate`, { status: 'PUBLISHED' }, { headers: { Authorization: `Bearer ${adminToken}` }});

    // 6. Customer Add to cart & Checkout
    console.log('6. Customer Add to Cart and Checkout');
    await axios.post(`${API_URL}/cart/items`, { productId, quantity: 2 }, { headers: { Authorization: `Bearer ${customerToken}` }});
    const orderResp = await axios.post(`${API_URL}/orders/checkout`, { paymentMethod: 'COD', shippingAddress: { city: 'Test City' } }, { headers: { Authorization: `Bearer ${customerToken}` }});
    const orderId = orderResp.data.data._id;
    const itemId = orderResp.data.data.orderItems[0]._id;
    console.log(`   Order Created! ID: ${orderId}, Status: ${orderResp.data.data.orderStatus}`);

    // 7. Seller fulfills order
    console.log('7. Seller fulfills order');
    await axios.patch(`${API_URL}/sellers/orders/${orderId}/items/${itemId}`, { status: 'SHIPPED' }, { headers: { Authorization: `Bearer ${sellerToken}` }});
    console.log('   Order marked SHIPPED');
    await axios.patch(`${API_URL}/sellers/orders/${orderId}/items/${itemId}`, { status: 'DELIVERED' }, { headers: { Authorization: `Bearer ${sellerToken}` }});
    console.log('   Order marked DELIVERED');

    // 8. Admin reviews users and orders
    console.log('8. Admin reviewing orders and users');
    const adminOrders = await axios.get(`${API_URL}/admin/orders`, { headers: { Authorization: `Bearer ${adminToken}` }});
    console.log(`   Total orders visible to Admin: ${adminOrders.data.data.total}`);

    const adminUsers = await axios.get(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${adminToken}` }});
    const cUser = adminUsers.data.data.users.find(u => u.email === customerEmail);
    if (cUser) {
      await axios.patch(`${API_URL}/admin/users/${cUser._id}/status`, { isActive: false }, { headers: { Authorization: `Bearer ${adminToken}` }});
      console.log('   User successfully suspended by Admin.');
    }

    console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

runE2ETest();
