import Student from '../models/Student.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';
import { sendEmail } from '../services/emailService.js';

const getRoomId = (roomId) => roomId?._id?.toString() || roomId?.toString() || null;

const sendRoomAllotmentEmail = async (student, room) => {
  const studentName = student.userId?.name || 'Student';
  const to = student.userId?.email;
  if (!to) return;

  try {
    await sendEmail({
      to,
      subject: `Room ${room.roomNumber} allotted`,
      html: `
        <h2>Room Allotment Confirmation</h2>
        <p>Hello ${studentName},</p>
        <p>Your hostel room has been allotted successfully.</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
          <tr><td><strong>Room</strong></td><td>${room.roomNumber}</td></tr>
          <tr><td><strong>Block</strong></td><td>${room.block}</td></tr>
          <tr><td><strong>Floor</strong></td><td>${room.floor}</td></tr>
          <tr><td><strong>Type</strong></td><td>${room.type}</td></tr>
        </table>
        <p>Please contact the hostel office if any detail looks incorrect.</p>
      `,
      text: `Hello ${studentName}, your hostel room has been allotted. Room: ${room.roomNumber}, Block: ${room.block}, Floor: ${room.floor}, Type: ${room.type}.`,
    });
  } catch (error) {
    console.error('Failed to send room allotment email:', error.message);
  }
};

const validateAvailableRoom = async (roomId) => {
  if (!roomId) return null;

  const room = await Room.findById(roomId);
  if (!room) {
    throw new AppError('Selected room not found', ErrorTypes.NOT_FOUND);
  }
  if (!room.hasAvailableBeds()) {
    throw new AppError('Selected room is full or under maintenance', ErrorTypes.BAD_REQUEST);
  }

  return room;
};

const syncStudentRoom = async (student, nextRoomId) => {
  const currentRoomId = getRoomId(student.roomId);
  const requestedRoomId = nextRoomId || null;

  if (currentRoomId === requestedRoomId) return null;

  const newRoom = requestedRoomId ? await validateAvailableRoom(requestedRoomId) : null;

  if (currentRoomId) {
    const oldRoom = await Room.findById(currentRoomId);
    if (oldRoom) await oldRoom.vacateRoom(student._id);
  }

  if (!requestedRoomId) {
    student.roomId = null;
    await student.save();
    return null;
  }

  await newRoom.allotRoom(student._id);
  student.roomId = newRoom._id;
  await student.save();
  await sendRoomAllotmentEmail(student, newRoom);
  return newRoom;
};

// @desc    Get all students
// @route   GET /api/v1/students
// @access  Private/Admin,Warden
const getAllStudents = catchAsync(async (req, res) => {
  const queryString = { ...req.query };
  const search = (queryString.search || '').trim();
  delete queryString.search;

  const baseQuery = search
    ? Student.find({
        $or: [
          { studentId: { $regex: search, $options: 'i' } },
          { rollNumber: { $regex: search, $options: 'i' } },
          { branch: { $regex: search, $options: 'i' } },
          { course: { $regex: search, $options: 'i' } },
        ],
      })
    : Student.find();

  const features = new APIFeatures(baseQuery, queryString)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const { results: students, pagination } = await features.execute();
  console.log('Fetched students:', students); // Debug log
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
  const selectedRoom = await validateAvailableRoom(req.body.roomId);

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

  if (selectedRoom) {
    await selectedRoom.allotRoom(student._id);
    student.roomId = selectedRoom._id;
    await student.save();
    await sendRoomAllotmentEmail({ ...student.toObject(), userId: user }, selectedRoom);
  }
  
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
  
  const { roomId, ...studentUpdates } = req.body;

  student = await Student.findByIdAndUpdate(
    req.params.id,
    studentUpdates,
    {
      new: true,
      runValidators: true,
    }
  );

  if (Object.prototype.hasOwnProperty.call(req.body, 'roomId')) {
    await syncStudentRoom(student, roomId || null);
    student = await Student.findById(req.params.id);
  }
  
  // Update user info if provided
  if (req.body.name || req.body.email || req.body.phone) {
    await User.findByIdAndUpdate(student.userId?._id || student.userId, {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
    });
    student = await Student.findById(req.params.id);
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

  const assignedRoomId = getRoomId(student.roomId);
  if (assignedRoomId) {
    const room = await Room.findById(assignedRoomId);
    if (room) await room.vacateRoom(student._id);
  }
  
  // Delete user account
  await User.findByIdAndDelete(student.userId?._id || student.userId);
  
  // Delete student profile
  await Student.findByIdAndDelete(req.params.id);
  
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

// @desc    Get students without room
// @route   GET /api/v1/students/without-room
// @access  Private/Admin,Warden
const getStudentsWithoutRoom = catchAsync(async (req, res) => {
  const students = await Student.find({ roomId: null })
    .populate('userId', 'name email phone')
    .sort({ createdAt: -1 });
  
  // Transform to include user data
  const transformedStudents = students.map(student => ({
    _id: student._id,
    name: student.userId?.name,
    email: student.userId?.email,
    phone: student.userId?.phone,
    studentId: student.studentId,
    rollNumber: student.rollNumber,
    course: student.course,
    year: student.year,
    branch: student.branch,
    semester: student.semester,
  }));
  
  res.json({
    success: true,
    count: transformedStudents.length,
    data: transformedStudents,
  });
});

export {
  getAllStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentStats,
  getStudentsWithoutRoom,
};
