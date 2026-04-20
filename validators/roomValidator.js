import { body } from 'express-validator';
import validate from '../middlewares/validationMiddleware.js';

const createRoomValidation = [
  body('roomNumber').notEmpty().withMessage('Room number is required').trim(),
  body('block').notEmpty().withMessage('Block is required').trim(),
  body('floor').isInt({ min: 0 }).withMessage('Floor must be a number'),
  body('type').notEmpty().withMessage('Room type is required'),
  validate,
];

const updateRoomValidation = [
  body('floor').optional().isInt({ min: 0 }).withMessage('Floor must be a number'),
  validate,
];

export { createRoomValidation, updateRoomValidation };
