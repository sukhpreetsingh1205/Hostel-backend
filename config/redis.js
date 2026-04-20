import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    return null;
  }
};

// Cache middleware
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    if (!redisClient) return next();
    
    const key = `cache:${req.originalUrl || req.url}`;
    
    try {
      const cachedData = await redisClient.get(key);
      
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
      
      // Store original send function
      const originalSend = res.json;
      
      // Override json method
      res.json = function(data) {
        // Cache the response
        redisClient.setex(key, duration, JSON.stringify(data));
        originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

// Clear cache helper
const clearCache = async (pattern) => {
  if (!redisClient) return;
  
  const keys = await redisClient.keys(`cache:${pattern}`);
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }
};

export { connectRedis, redisClient, cacheMiddleware, clearCache };