import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import connectDB from './config/Db.js';

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Starting graceful shutdown...`);
  
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;

await connectDB();

const server = app.listen(PORT, () => {
  console.log(`
  ════════════════════════════════════════════════════
  🚀 Server is running!
  📡 Port: ${PORT}
  🌍 Environment: ${process.env.NODE_ENV}
  🔗 API URL: http://localhost:${PORT}/api/v1
  ════════════════════════════════════════════════════
  `);
});

// Graceful shutdown listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;
