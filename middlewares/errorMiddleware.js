import { logger } from '../utils/logger.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';

// Handle mongoose duplicate key error
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyPattern)[0];
  const message = `Duplicate value for ${field}. Please use another value.`;
  return new AppError(message, ErrorTypes.CONFLICT);
};

// Handle mongoose validation error
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, ErrorTypes.VALIDATION_ERROR);
};

// Handle cast error (invalid ObjectId)
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, ErrorTypes.BAD_REQUEST);
};

// Handle JWT errors
const handleJWTError = () => new AppError('Invalid token. Please log in again.', ErrorTypes.UNAUTHORIZED);
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', ErrorTypes.UNAUTHORIZED);

// Send error response in development
const sendErrorDev = (err, res) => {
  logger.error(err);
  
  res.status(err.statusCode || ErrorTypes.INTERNAL_SERVER_ERROR).json({
    success: false,
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  } else {
    logger.error('ERROR 💥', err);
    
    res.status(ErrorTypes.INTERNAL_SERVER_ERROR).json({
      success: false,
      status: 'error',
      message: 'Something went wrong. Please try again later.',
    });
  }
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
    return;
  }
  
  // Production error handling
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'CastError') error = handleCastError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  
  sendErrorProd(error, res);
};

// 404 Not Found handler
const notFound = (req, res, next) => {
  const error = new AppError(`Cannot find ${req.originalUrl} on this server.`, ErrorTypes.NOT_FOUND);
  next(error);
};

export { errorHandler, notFound };