import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  logout,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
} from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validationMiddleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Validation rules
const registerValidation = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
  body('role').optional().isIn(['admin', 'warden', 'student']),
  validate,
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const updatePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  validate,
];

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.post('/forgotpassword', forgotPassword);
// Support both param names (older docs/frontend may use :token)
// router.put('/resetpassword/:token', resetPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.post('/refreshtoken', refreshToken);

// Protected routes
router.use(protect);
router.post('/logout', logout);
router.get('/me', getMe);
router.put('/updatepassword', updatePasswordValidation, updatePassword);

export default router;
