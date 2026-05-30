import rateLimit from 'express-rate-limit';
import { ErrorTypes } from '../utils/AppError.js';

const isProd = process.env.NODE_ENV === 'production';

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  // In development, React dev mode and multiple parallel requests can hit the limiter quickly.
  // Keep production defaults strict, but allow a higher ceiling for local dev.
  max: (() => {
    const configuredMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
    return isProd ? configuredMax : Math.max(configuredMax, 2000);
  })(),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 5 : 50, // allow easier testing in development
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.',
  },
});

// Limiter for sensitive operations (fee payment, etc.)
const sensitiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many sensitive operations, please try again later.',
  },
});

export { apiLimiter, authLimiter, sensitiveOperationLimiter };
