import { Router } from 'express';
import {
  getAllStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentStats,
} from '../controllers/studentController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', restrictTo('admin', 'warden'), getAllStudents);
router.get('/stats/dashboard', restrictTo('admin'), getStudentStats);
router.get('/:id', restrictTo('admin', 'warden', 'student'), getStudent);

router.use(restrictTo('admin'));
router.post('/', createStudent);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);

export default router;
