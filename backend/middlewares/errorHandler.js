const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    status: 'error',
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`
    }
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // Mongoose Duplicate Key Error Handling
  let errorCode = err.code === 11000 ? 'DUPLICATE_RESOURCE' : (err.name || 'INTERNAL_ERROR');
  let message = err.message || 'An unexpected internal error occurred';

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}. Please use a unique value.`;
  }

  // Sanitize internal MongoDB validation error details
  if (err.name === 'ValidationError') {
    errorCode = 'VALIDATION_ERROR';
    const messages = Object.values(err.errors).map(val => val.message);
    message = messages.join('. ');
  }

  res.status(statusCode).json({
    success: false,
    status: 'error',
    error: {
      code: errorCode,
      message: message
    },
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = { notFoundHandler, errorHandler };