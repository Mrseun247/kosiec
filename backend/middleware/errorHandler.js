const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 404;
    message = `Resource not found with id: ${err.value}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for field: ${field}`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token.'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Token expired.'; }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') { statusCode = 400; message = 'File too large. Maximum size is 5MB.'; }

  // Database/network connectivity errors — never leak internal hostnames,
  // DNS errors, or driver internals to the client. Only reclassify when no
  // more specific handler above already matched (statusCode still default),
  // and only for genuine connectivity error types — NOT MongoServerError,
  // which also covers ordinary operational errors like duplicate keys.
  const isDbConnectivityError =
    statusCode === 500 &&
    (/^Mongo(Network|ServerSelection|Timeout|TopologyClosed|NotConnected)Error$/.test(err.name || '') ||
     /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|topology was destroyed|buffering timed out/i.test(err.message || ''));
  if (isDbConnectivityError) {
    statusCode = 503;
    console.error('❌ Database connectivity error:', err.message);
    message = 'Service temporarily unavailable. Please try again in a moment.';
  }

  if (process.env.NODE_ENV === 'development' && !isDbConnectivityError) {
    console.error('❌ Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
