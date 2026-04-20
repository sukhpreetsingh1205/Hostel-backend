import { Router } from 'express';
import {
  getAllNotices,
  getActiveNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  togglePinNotice,
  getNoticeStats,
  archiveExpiredNotices,
} from '../controllers/noticeController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

// All authenticated users can view notices
router.get('/', getAllNotices);
router.get('/active', getActiveNotices);
router.get('/:id', getNotice);

// Warden and Admin can create notices
router.use(restrictTo('admin', 'warden'));
router.post('/', createNotice);

// Admin only routes
router.use(restrictTo('admin'));
router.put('/:id', updateNotice);
router.delete('/:id', deleteNotice);
router.put('/:id/pin', togglePinNotice);
router.get('/stats/summary', getNoticeStats);
router.post('/archive', archiveExpiredNotices);

export default router;
