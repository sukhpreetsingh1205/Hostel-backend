import 'dotenv/config';
import mongoose from 'mongoose';
import Student from '../models/Student.js';
import User from '../models/User.js';

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const [studentDocs, studentUsers] = await Promise.all([
    Student.countDocuments(),
    User.countDocuments({ role: 'student' }),
  ]);

  // eslint-disable-next-line no-console
  console.log('Student documents:', studentDocs);
  // eslint-disable-next-line no-console
  console.log('Users with role=student:', studentUsers);

  await mongoose.disconnect();
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

