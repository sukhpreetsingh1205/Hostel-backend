import { verifyToken } from '../utils/generateToken.js';
import User from '../models/User.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// Protect routes - require authentication
const protect = catchAsync(async (req, res, next) => {
  let token;
  
  // Check for token in headers or cookies
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  
  if (!token) {
    return next(new AppError('You are not logged in. Please log in to access this resource.', ErrorTypes.UNAUTHORIZED));
  }
  
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new AppError('User no longer exists.', ErrorTypes.UNAUTHORIZED));
    }
    
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact admin.', ErrorTypes.UNAUTHORIZED));
    }
    
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError('Invalid token. Please log in again.', ErrorTypes.UNAUTHORIZED));
  }
});

// Restrict to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', ErrorTypes.FORBIDDEN));
    }
    next();
  };
};

// Optional authentication (doesn't throw error if no token)
const optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  
  if (token) {
    try {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (error) {
      // Invalid token - just continue without user
    }
  }
  
  next();
});

export { protect, restrictTo, optionalAuth };
