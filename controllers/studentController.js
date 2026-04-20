import Student from '../models/Student.js';
import User from '../models/User.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';

// @desc    Get all students
// @route   GET /api/v1/students
// @access  Private/Admin,Warden
const getAllStudents = catchAsync(async (req, res) => {
  const features = new APIFeatures(Student.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const { results: students, pagination } = await features.execute();
  
  res.json({
    success: true,
    count: students.length,
    pagination,
    data: students,
  });
});

// @desc    Get single student
// @route   GET /api/v1/students/:id
// @access  Private/Admin,Warden,Owner
const getStudent = catchAsync(async (req, res) => {
  const student = await Student.findById(req.params.id);
  
  if (!student) {
    throw new AppError('Student not found', ErrorTypes.NOT_FOUND);
  }
  
  // Check if user has permission (admin, warden, or the student themselves)
  if (req.user.role === 'student' && student.userId.toString() !== req.user.id) {
    throw new AppError('You do not have permission to view this student', ErrorTypes.FORBIDDEN);
  }
  
  res.json({
    success: true,
    data: student,
  });
});

// @desc    Create student
// @route   POST /api/v1/students
// @access  Private/Admin
const createStudent = catchAsync(async (req, res) => {
  // First create user account
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password || 'Student@123', // Default password
    role: 'student',
    phone: req.body.phone,
  });
  
  // Then create student profile
  const student = await Student.create({
    userId: user._id,
    studentId: req.body.studentId,
    rollNumber: req.body.rollNumber,
    course: req.body.course,
    year: req.body.year,
    branch: req.body.branch,
    semester: req.body.semester,
    dob: req.body.dob,
    bloodGroup: req.body.bloodGroup,
    parentName: req.body.parentName,
    parentPhone: req.body.parentPhone,
    address: req.body.address,
    emergencyContact: req.body.emergencyContact,
    messPreference: req.body.messPreference,
    medicalConditions: req.body.medicalConditions,
  });
  
  res.status(201).json({
    success: true,
    data: student,
  });
});

// @desc    Update student
// @route   PUT /api/v1/students/:id
// @access  Private/Admin
const updateStudent = catchAsync(async (req, res) => {
  let student = await Student.findById(req.params.id);
  
  if (!student) {
    throw new AppError('Student not found', ErrorTypes.NOT_FOUND);
  }
  
  student = await Student.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );
  
  // Update user info if provided
  if (req.body.name || req.body.email || req.body.phone) {
    await User.findByIdAndUpdate(student.userId, {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
    });
  }
  
  res.json({
    success: true,
    data: student,
  });
});

// @desc    Delete student
// @route   DELETE /api/v1/students/:id
// @access  Private/Admin
const deleteStudent = catchAsync(async (req, res) => {
  const student = await Student.findById(req.params.id);
  
  if (!student) {
    throw new AppError('Student not found', ErrorTypes.NOT_FOUND);
  }
  
  // Delete user account
  await User.findByIdAndDelete(student.userId);
  
  // Delete student profile
  await student.remove();
  
  res.json({
    success: true,
    message: 'Student deleted successfully',
  });
});

// @desc    Get student statistics
// @route   GET /api/v1/students/stats/dashboard
// @access  Private/Admin
const getStudentStats = catchAsync(async (req, res) => {
  const totalStudents = await Student.countDocuments();
  const activeStudents = await Student.countDocuments({ status: 'active' });
  const byCourse = await Student.aggregate([
    {
      $group: {
        _id: { course: '$course', year: '$year' },
        count: { $sum: 1 },
      },
    },
  ]);
  
  res.json({
    success: true,
    data: {
      total: totalStudents,
      active: activeStudents,
      byCourse,
    },
  });
});

export {
  getAllStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentStats,
};
