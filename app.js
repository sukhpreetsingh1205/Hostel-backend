import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import MongoStore from 'connect-mongo';

import { errorHandler } from './middlewares/errorMiddleware.js';
import { notFound } from './middlewares/errorMiddleware.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import routes from './routes/index.js';

// Initialize express app
const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: ['sort', 'page', 'limit', 'fields', 'status', 'priority']
}));

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 7 * 24 * 60 * 60, // 7 days
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'strict',
  },
}));

// Rate limiting
app.use('/api', apiLimiter);

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
  });
}

// API routes
app.use('/api/v1', routes);

// Development-only: list mounted API routes for debugging
if (process.env.NODE_ENV !== 'production') {
  const collectRoutes = (router, basePath = '') => {
    const collected = [];

    if (!router?.stack) return collected;

    for (const layer of router.stack) {
      if (layer?.route?.path) {
        const methods = Object.keys(layer.route.methods || {})
          .filter(m => layer.route.methods[m])
          .map(m => m.toUpperCase())
          .sort();

        collected.push({
          methods,
          path: `${basePath}${layer.route.path}`,
        });
        continue;
      }

      // Nested router via router.use(...)
      if (layer?.name === 'router' && layer?.handle?.stack) {
        const mountPath = layer.handle.__mountPath || '';
        collected.push(...collectRoutes(layer.handle, `${basePath}${mountPath}`));
      }
    }

    return collected;
  };

  app.get('/api/v1/__routes', (req, res) => {
    const routeList = collectRoutes(routes, '/api/v1')
      .map(r => ({ ...r, methods: r.methods.join(',') }))
      .sort((a, b) => a.path.localeCompare(b.path) || a.methods.localeCompare(b.methods));

    res.json({
      success: true,
      count: routeList.length,
      data: routeList,
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Hostel Management API',
    version: '2.0.0',
    status: 'active',
    documentation: '/api/v1/docs',
    endpoints: {
      auth: '/api/v1/auth',
      students: '/api/v1/students',
      rooms: '/api/v1/rooms',
      fees: '/api/v1/fees',
      attendance: '/api/v1/attendance',
      leaves: '/api/v1/leaves',
      complaints: '/api/v1/complaints',
      notices: '/api/v1/notices',
    },
  });
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
