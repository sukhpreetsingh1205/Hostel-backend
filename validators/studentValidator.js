import { body } from 'express-validator';
import validate from '../middlewares/validationMiddleware.js';

const createStudentValidation = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
  body('studentId').notEmpty().withMessage('Student ID is required').trim(),
  body('rollNumber').notEmpty().withMessage('Roll number is required').trim(),
  body('course').notEmpty().withMessage('Course is required'),
  body('year').isInt({ min: 1 }).withMessage('Year must be a number'),
  validate,
];

const updateStudentValidation = [
  body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
  validate,
];

export { createStudentValidation, updateStudentValidation };
