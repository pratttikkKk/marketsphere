const fs = require('fs');
const path = require('path');

const files = {
  'backend/package.json': JSON.stringify({
    "name": "marketsphere-backend",
    "version": "1.0.0",
    "description": "Backend for MarketSphere",
    "main": "server.js",
    "scripts": {
      "start": "node server.js",
      "dev": "nodemon server.js"
    },
    "dependencies": {
      "cors": "^2.8.5",
      "dotenv": "^16.4.5",
      "express": "^4.19.2",
      "helmet": "^7.1.0",
      "mongoose": "^8.3.2",
      "morgan": "^1.10.0"
    },
    "devDependencies": {
      "nodemon": "^3.1.0"
    }
  }, null, 2),
  'backend/.env.example': "PORT=5000\nNODE_ENV=development\nMONGO_URI=mongodb://localhost:27017/marketsphere\nJWT_SECRET=your_jwt_secret_here",
  'backend/.gitignore': "node_modules\n.env\nnpm-debug.log\n",
  'backend/server.js': "require('dotenv').config();\nconst app = require('./app');\nconst connectDB = require('./config/db');\n\nconst PORT = process.env.PORT || 5000;\n\nconnectDB();\n\napp.listen(PORT, () => {\n  console.log('Server running on port ' + PORT);\n});",
  'backend/app.js': "const express = require('express');\nconst cors = require('cors');\nconst helmet = require('helmet');\nconst morgan = require('morgan');\nconst routes = require('./routes');\nconst { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');\n\nconst app = express();\n\napp.use(helmet());\napp.use(cors());\napp.use(express.json());\napp.use(morgan('dev'));\n\napp.use('/api/v1', routes);\n\napp.get('/health', (req, res) => {\n  res.status(200).json({ status: 'success', message: 'API is healthy', timestamp: new Date() });\n});\n\napp.use(notFoundHandler);\napp.use(errorHandler);\n\nmodule.exports = app;",
  'backend/config/db.js': "const mongoose = require('mongoose');\n\nconst connectDB = async () => {\n  try {\n    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/marketsphere');\n    console.log('MongoDB Connected: ' + conn.connection.host);\n  } catch (error) {\n    console.error('Error connecting to MongoDB: ' + error.message);\n    process.exit(1);\n  }\n};\n\nmodule.exports = connectDB;",
  'backend/middlewares/errorHandler.js': "const notFoundHandler = (req, res, next) => {\n  const error = new Error('Not Found - ' + req.originalUrl);\n  res.status(404);\n  next(error);\n};\n\nconst errorHandler = (err, req, res, next) => {\n  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;\n  res.status(statusCode);\n  res.json({\n    status: 'error',\n    message: err.message,\n    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,\n  });\n};\n\nmodule.exports = { notFoundHandler, errorHandler };",
  'backend/routes/index.js': "const express = require('express');\nconst router = express.Router();\n\nrouter.get('/', (req, res) => {\n  res.json({ message: 'MarketSphere API v1' });\n});\n\nmodule.exports = router;",
  'frontend/package.json': JSON.stringify({
    "name": "marketsphere-frontend",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "lint": "eslint .",
      "preview": "vite preview"
    },
    "dependencies": {
      "axios": "^1.6.8",
      "lucide-react": "^0.372.0",
      "react": "^18.2.0",
      "react-dom": "^18.2.0",
      "react-router-dom": "^6.22.3"
    },
    "devDependencies": {
      "@types/react": "^18.2.66",
      "@types/react-dom": "^18.2.22",
      "@vitejs/plugin-react": "^4.2.1",
      "autoprefixer": "^10.4.19",
      "eslint": "^8.57.0",
      "eslint-plugin-react": "^7.34.1",
      "eslint-plugin-react-hooks": "^4.6.0",
      "eslint-plugin-react-refresh": "^0.4.6",
      "postcss": "^8.4.38",
      "tailwindcss": "^3.4.3",
      "vite": "^5.2.0"
    }
  }, null, 2),
  'frontend/vite.config.js': "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})",
  'frontend/tailwind.config.js': "/** @type {import('tailwindcss').Config} */\nexport default {\n  content: [\n    './index.html',\n    './src/**/*.{js,ts,jsx,tsx}',\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}",
  'frontend/postcss.config.js': "export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}",
  'frontend/index.html': "<!doctype html>\n<html lang='en'>\n  <head>\n    <meta charset='UTF-8' />\n    <meta name='viewport' content='width=device-width, initial-scale=1.0' />\n    <title>MarketSphere</title>\n  </head>\n  <body class='bg-gray-50 text-gray-900 font-sans'>\n    <div id='root'></div>\n    <script type='module' src='/src/main.jsx'></script>\n  </body>\n</html>",
  'frontend/src/index.css': "@tailwind base;\n@tailwind components;\n@tailwind utilities;",
  'frontend/src/main.jsx': "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)",
  'frontend/src/App.jsx': "import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';\nimport MainLayout from './components/layout/MainLayout';\nimport Home from './pages/Home';\nimport NotFound from './pages/NotFound';\nimport CustomerDashboard from './pages/customer/CustomerDashboard';\nimport SellerDashboard from './pages/seller/SellerDashboard';\nimport AdminDashboard from './pages/admin/AdminDashboard';\n\nfunction App() {\n  return (\n    <Router>\n      <Routes>\n        <Route path='/' element={<MainLayout />}>\n          <Route index element={<Home />} />\n          <Route path='customer' element={<CustomerDashboard />} />\n          <Route path='seller' element={<SellerDashboard />} />\n          <Route path='admin' element={<AdminDashboard />} />\n          <Route path='*' element={<NotFound />} />\n        </Route>\n      </Routes>\n    </Router>\n  );\n}\n\nexport default App;",
  'frontend/src/components/layout/MainLayout.jsx': "import { Outlet, Link } from 'react-router-dom';\n\nconst MainLayout = () => {\n  return (\n    <div className='min-h-screen flex flex-col'>\n      <header className='bg-white shadow-sm sticky top-0 z-10'>\n        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>\n          <div className='flex justify-between h-16 items-center'>\n            <Link to='/' className='text-2xl font-bold text-blue-600'>MarketSphere</Link>\n            <nav className='flex space-x-4'>\n              <Link to='/customer' className='text-gray-600 hover:text-blue-600'>Customer</Link>\n              <Link to='/seller' className='text-gray-600 hover:text-blue-600'>Seller</Link>\n              <Link to='/admin' className='text-gray-600 hover:text-blue-600'>Admin</Link>\n            </nav>\n          </div>\n        </div>\n      </header>\n      \n      <main className='flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>\n        <Outlet />\n      </main>\n      \n      <footer className='bg-gray-800 text-white py-6 mt-auto'>\n        <div className='max-w-7xl mx-auto px-4 text-center'>\n          <p>&copy; {new Date().getFullYear()} MarketSphere. All rights reserved.</p>\n        </div>\n      </footer>\n    </div>\n  );\n};\n\nexport default MainLayout;",
  'frontend/src/pages/Home.jsx': "const Home = () => {\n  return (\n    <div className='text-center py-12'>\n      <h1 className='text-4xl font-extrabold text-gray-900 sm:text-5xl'>\n        Welcome to MarketSphere\n      </h1>\n      <p className='mt-4 text-lg text-gray-500'>\n        The ultimate multi-vendor e-commerce platform.\n      </p>\n    </div>\n  );\n};\n\nexport default Home;",
  'frontend/src/pages/NotFound.jsx': "import { Link } from 'react-router-dom';\n\nconst NotFound = () => {\n  return (\n    <div className='text-center py-20'>\n      <h1 className='text-6xl font-bold text-gray-900'>404</h1>\n      <p className='mt-2 text-xl text-gray-600'>Page not found.</p>\n      <Link to='/' className='mt-6 inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition'>\n        Go Back Home\n      </Link>\n    </div>\n  );\n};\n\nexport default NotFound;",
  'frontend/src/pages/customer/CustomerDashboard.jsx': "const CustomerDashboard = () => <div><h1 className='text-2xl font-bold'>Customer Dashboard</h1><p>Placeholder for customer orders and profile.</p></div>;\nexport default CustomerDashboard;",
  'frontend/src/pages/seller/SellerDashboard.jsx': "const SellerDashboard = () => <div><h1 className='text-2xl font-bold'>Seller Dashboard</h1><p>Placeholder for seller products and sales.</p></div>;\nexport default SellerDashboard;",
  'frontend/src/pages/admin/AdminDashboard.jsx': "const AdminDashboard = () => <div><h1 className='text-2xl font-bold'>Admin Dashboard</h1><p>Placeholder for platform moderation and stats.</p></div>;\nexport default AdminDashboard;",
  'frontend/src/api/client.js': "import axios from 'axios';\n\nconst apiClient = axios.create({\n  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',\n  headers: {\n    'Content-Type': 'application/json',\n  },\n  withCredentials: true,\n});\n\napiClient.interceptors.response.use(\n  (response) => response.data,\n  (error) => {\n    console.error('API Error:', error.response?.data?.message || error.message);\n    return Promise.reject(error);\n  }\n);\n\nexport default apiClient;",
  'frontend/src/components/common/Loading.jsx': "const Loading = () => <div className='flex justify-center p-8'><div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div></div>;\nexport default Loading;",
  'frontend/src/components/common/ErrorState.jsx': "const ErrorState = ({ message = 'Something went wrong' }) => <div className='text-center text-red-600 p-8'>{message}</div>;\nexport default ErrorState;",
  'frontend/src/components/common/EmptyState.jsx': "const EmptyState = ({ message = 'No data found' }) => <div className='text-center text-gray-500 p-8'>{message}</div>;\nexport default EmptyState;",
  'frontend/.gitignore': "node_modules\ndist\n.env\n.env.local\n"
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  console.log("Created " + filePath);
}
