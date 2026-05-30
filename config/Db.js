import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let connectionListenersBound = false;

const bindConnectionListenersOnce = () => {
  if (connectionListenersBound) return;
  connectionListenersBound = true;

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected successfully');
  });
};

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const conn = await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      bindConnectionListenersOnce();
      logger.info(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      const message = error?.message ?? String(error);
      logger.error(`Error connecting to MongoDB (attempt ${attempt}): ${message}`);
      await sleep(5000);
    }
  }
};

export default connectDB;
