import { Router } from 'express';
import {
  getAllAttendance,
  getStudentAttendance,
  getAttendanceByDate,
  markAttendance,
  updateAttendance,
  getAttendanceStats,
  getTodaySummary,
} from '../controllers/attendanceController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

// Student can view their own attendance
router.get('/student/:studentId', getStudentAttendance);

// Warden and Admin routes
router.use(restrictTo('admin', 'warden'));
router.get('/', getAllAttendance);
router.get('/date/:date', getAttendanceByDate);
router.get('/stats', getAttendanceStats);
router.get('/today/summary', getTodaySummary);
router.post('/mark', markAttendance);
router.put('/:id', updateAttendance);

export default router;
