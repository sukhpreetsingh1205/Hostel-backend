import { validationResult } from 'express-validator';
import { AppError, ErrorTypes } from '../utils/AppError.js';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
    }));
    
    return next(new AppError(JSON.stringify(errorMessages), ErrorTypes.VALIDATION_ERROR));
  }
  
  next();
};

export default validate;