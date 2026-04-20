import { Router } from 'express';
import {
  getAllLeaves,
  getStudentLeaves,
  getLeave,
  createLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getPendingLeaves,
  getLeaveStats,
} from '../controllers/leaveController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

// Student routes
router.post('/', restrictTo('student'), createLeave);
router.put('/:id', restrictTo('student'), updateLeave);
router.put('/:id/cancel', restrictTo('student'), cancelLeave);
router.get('/student/:studentId', getStudentLeaves);

// Warden and Admin routes
router.use(restrictTo('admin', 'warden'));
router.get('/', getAllLeaves);
router.get('/pending', getPendingLeaves);
router.get('/stats', getLeaveStats);
router.get('/:id', getLeave);
router.put('/:id/approve', approveLeave);
router.put('/:id/reject', rejectLeave);

export default router;
