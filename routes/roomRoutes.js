import { Router } from 'express';
import {
  getAllRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  allotRoom,
  vacateRoom,
  getAvailableRooms,
  getRoomStats,
  getRoomsByBlock,
} from '../controllers/roomController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

// All routes require authentication
router.use(protect);

// Public routes (authenticated users)
router.get('/', getAllRooms);
router.get('/available', getAvailableRooms);
router.get('/stats/occupancy', restrictTo('admin'), getRoomStats);
router.get('/block/:block', getRoomsByBlock);
router.get('/:id', getRoom);

// Admin only routes
router.use(restrictTo('admin'));
router.post('/', createRoom);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);
router.post('/:roomId/allot/:studentId', allotRoom);
router.post('/:roomId/vacate/:studentId', vacateRoom);

export default router;
