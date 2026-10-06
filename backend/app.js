const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// Security Headers
app.use(helmet({ 
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false // Allows loading assets in development
}));

// Environment-Driven CORS with Production Cloud Support
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL.trim()] : [])
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (e.g. mobile apps, curl, webhooks)
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.replace(/\/$/, '');
    const isExplicitlyAllowed = allowedOrigins.some(o => o.replace(/\/$/, '') === cleanOrigin);
    const isVercel = cleanOrigin.endsWith('.vercel.app');
    const isRender = cleanOrigin.endsWith('.onrender.com');

    if (isExplicitlyAllowed || isVercel || isRender) {
      return callback(null, true);
    }
    console.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With']
}));

// Request Parsers (Captures raw byte buffer for cryptographic webhook HMAC verification)
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static Uploads Directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Tiered Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 min
  message: { status: 'error', error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many authentication attempts. Please try again after 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // 60 checkout actions per 15 min
  message: { status: 'error', error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many checkout requests. Please wait.' } },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { status: 'error', error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/orders/checkout', checkoutLimiter);
app.use('/api/', generalLimiter);

// Root & Health Probes (Supports Render health check & browser verification)
app.get(['/', '/health'], (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    service: 'MarketSphere Marketplace Backend API',
    database: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
    timestamp: new Date() 
  });
});

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'MarketSphere Backend API', timestamp: new Date() });
});

app.get('/api/v1/ready', (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  if (isDbReady) {
    return res.status(200).json({ 
      status: 'READY', 
      database: 'CONNECTED', 
      timestamp: new Date() 
    });
  }
  return res.status(503).json({ 
    status: 'NOT_READY', 
    database: 'DISCONNECTED', 
    timestamp: new Date() 
  });
});

// Primary API Router Mount
app.use('/api/v1', routes);

// Error Handling Pipeline
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;