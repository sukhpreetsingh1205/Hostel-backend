import { Router } from 'express';
import {
  getAllFees,
  getStudentFees,
  getFee,
  generateMonthlyFees,
  makePayment,
  updateFee,
  deleteFee,
  getFeeStats,
  sendFeeReminders,
} from '../controllers/feeController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

// Student can view their own fees
router.get('/student/:studentId', getStudentFees);
router.post('/:id/payment', makePayment);

// Admin only routes
router.use(restrictTo('admin'));
router.get('/', getAllFees);
router.get('/stats/summary', getFeeStats);
router.post('/generate-monthly', generateMonthlyFees);
router.post('/send-reminders', sendFeeReminders);
router.get('/:id', getFee);
router.put('/:id', updateFee);
router.delete('/:id', deleteFee);

export default router;
