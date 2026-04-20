import { Router } from 'express';
import {
  getAllComplaints,
  getStudentComplaints,
  getComplaint,
  createComplaint,
  updateComplaint,
  assignComplaint,
  resolveComplaint,
  closeComplaint,
  addComment,
  getComplaintStats,
} from '../controllers/complaintController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

// Student routes
router.post('/', restrictTo('student'), createComplaint);
router.put('/:id', restrictTo('student'), updateComplaint);
router.put('/:id/close', restrictTo('student'), closeComplaint);
router.get('/student/:studentId', getStudentComplaints);

// Warden and Admin routes
router.use(restrictTo('admin', 'warden'));
router.get('/', getAllComplaints);
router.get('/stats', restrictTo('admin'), getComplaintStats);
router.get('/:id', getComplaint);
router.put('/:id/assign', restrictTo('admin'), assignComplaint);
router.put('/:id/resolve', resolveComplaint);
router.post('/:id/comments', addComment);

export default router;
