import { Router } from 'express';
import authRoutes from './authRoutes.js';
import studentRoutes from './studentRoutes.js';
import roomRoutes from './roomRoutes.js';
import feeRoutes from './feeRoutes.js';
import attendanceRoutes from './attendenceRoutes.js';
import leaveRoutes from './leaveRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import noticeRoutes from './noticeRoutes.js';

const router = Router();

const mount = (path, childRouter) => {
  // Attach mount metadata to help with debugging/route introspection.
  // Express Router instances are functions, so attaching props is OK.
  childRouter.__mountPath = path;
  router.use(path, childRouter);
};

// Mount routes
mount('/auth', authRoutes);
mount('/students', studentRoutes);
mount('/rooms', roomRoutes);
mount('/fees', feeRoutes);
mount('/attendance', attendanceRoutes);
mount('/leaves', leaveRoutes);
mount('/complaints', complaintRoutes);
mount('/notices', noticeRoutes);

// API documentation route
router.get('/docs', (req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        logout: 'POST /api/v1/auth/logout',
        me: 'GET /api/v1/auth/me',
        updatePassword: 'PUT /api/v1/auth/updatepassword',
        forgotPassword: 'POST /api/v1/auth/forgotpassword',
        resetPassword: 'PUT /api/v1/auth/resetpassword/:token (or :resettoken)',
        refreshToken: 'POST /api/v1/auth/refreshtoken',
      },
      students: {
        getAll: 'GET /api/v1/students',
        getOne: 'GET /api/v1/students/:id',
        create: 'POST /api/v1/students',
        update: 'PUT /api/v1/students/:id',
        delete: 'DELETE /api/v1/students/:id',
      },
      // Add more endpoint documentation
    },
  });
});

// API health (under /api/v1)
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
