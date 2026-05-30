import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import Leave from '../models/Leave.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';

const parseDateOnly = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

// @desc    Get all attendance records
// @route   GET /api/v1/attendance
// @access  Private/Admin,Warden
const getAllAttendance = catchAsync(async (req, res) => {
  const features = new APIFeatures(Attendance.find().populate('studentId', 'studentId name rollNumber'), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const { results: attendance, pagination } = await features.execute();
  
  res.json({
    success: true,
    count: attendance.length,
    pagination,
    data: attendance,
  });
});

// @desc    Get student attendance
// @route   GET /api/v1/attendance/student/:studentId
// @access  Private/Admin,Warden,Student
const getStudentAttendance = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  const { month, year } = req.query;
  
  // Check permission
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (student._id.toString() !== studentId) {
      throw new AppError('You can only view your own attendance', ErrorTypes.FORBIDDEN);
    }
  }
  
  let query = { studentId };
  
  if (month && year) {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    query.date = { $gte: startDate, $lte: endDate };
  }
  
  const attendance = await Attendance.find(query).sort({ date: -1 });
  
  let summary = null;
  if (month && year) {
    summary = await Attendance.getStudentAttendanceSummary(studentId, month, year);
  }
  
  res.json({
    success: true,
    summary,
    count: attendance.length,
    data: attendance,
  });
});

// @desc    Get attendance by date
// @route   GET /api/v1/attendance/date/:date
// @access  Private/Admin,Warden
const getAttendanceByDate = catchAsync(async (req, res) => {
  const { date } = req.params;
  const startOfDay = parseDateOnly(date);
  if (!startOfDay) {
    throw new AppError('Invalid date format', ErrorTypes.BAD_REQUEST);
  }

  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const attendance = await Attendance.find({
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }).populate('studentId', 'studentId name rollNumber roomId');
  
  const summary = await Attendance.getDailySummary(startOfDay);
  
  res.json({
    success: true,
    summary,
    count: attendance.length,
    data: attendance,
  });
});

// @desc    Mark attendance (bulk)
// @route   POST /api/v1/attendance/mark
// @access  Private/Admin,Warden
const markAttendance = catchAsync(async (req, res) => {
  const { date, records } = req.body;
  const markedBy = req.user.id;
  
  const targetDate = parseDateOnly(date);
  if (!targetDate) {
    throw new AppError('Invalid date format', ErrorTypes.BAD_REQUEST);
  }
  
  const results = {
    success: [],
    failed: [],
  };
  
  for (const record of records) {
    try {
      // Check if student is on leave
      const isOnLeave = await Leave.isStudentOnLeave(record.studentId, targetDate);
      
      let status = record.status;
      if (isOnLeave && status === 'absent') {
        status = 'leave';
      }
      
      const attendance = await Attendance.findOneAndUpdate(
        {
          studentId: record.studentId,
          date: targetDate,
        },
        {
          studentId: record.studentId,
          date: targetDate,
          status,
          inTime: record.inTime,
          outTime: record.outTime,
          markedBy,
          remarks: record.remarks,
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
      
      results.success.push({
        studentId: record.studentId,
        status: attendance.status,
      });
    } catch (error) {
      results.failed.push({
        studentId: record.studentId,
        error: error.message,
      });
    }
  }
  
  res.json({
    success: true,
    message: `Marked attendance for ${results.success.length} students`,
    data: results,
  });
});

// @desc    Update single attendance
// @route   PUT /api/v1/attendance/:id
// @access  Private/Admin,Warden
const updateAttendance = catchAsync(async (req, res) => {
  let attendance = await Attendance.findById(req.params.id);
  
  if (!attendance) {
    throw new AppError('Attendance record not found', ErrorTypes.NOT_FOUND);
  }
  
  attendance = await Attendance.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      markedBy: req.user.id,
    },
    {
      new: true,
      runValidators: true,
    }
  );
  
  res.json({
    success: true,
    data: attendance,
  });
});

// @desc    Get attendance statistics
// @route   GET /api/v1/attendance/stats
// @access  Private/Admin,Warden
const getAttendanceStats = catchAsync(async (req, res) => {
  const now = new Date();
  const month = Number.parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = Number.parseInt(req.query.year, 10) || now.getFullYear();
  const { course } = req.query;
  const studentYearRaw = req.query.studentYear ?? req.query.yearOfStudy ?? req.query.student_year;
  const studentYear = studentYearRaw ? Number.parseInt(studentYearRaw, 10) : undefined;

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError('Invalid month (expected 1-12)', ErrorTypes.BAD_REQUEST);
  }

  if (!Number.isInteger(year) || year < 1970) {
    throw new AppError('Invalid year', ErrorTypes.BAD_REQUEST);
  }
  
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
  let matchQuery = {
    date: { $gte: startDate, $lte: endDate },
  };
  
  // Build student filter
  const studentFilter = {};
  if (course) studentFilter.course = course;
  if (Number.isInteger(studentYear)) studentFilter.year = studentYear;
  
  const students = await Student.find(studentFilter).select('_id');
  const studentIds = students.map(s => s._id);
  
  matchQuery.studentId = { $in: studentIds };
  
  const stats = await Attendance.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$studentId',
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    {
      $project: {
        studentId: '$_id',
        present: 1,
        absent: 1,
        late: 1,
        leave: 1,
        total: 1,
        percentage: {
          $multiply: [
            { $divide: [{ $add: ['$present', '$leave'] }, '$total'] },
            100,
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'students',
        localField: 'studentId',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: '$student' },
    {
      $lookup: {
        from: 'users',
        localField: 'student.userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        studentId: 1,
        name: '$user.name',
        rollNumber: '$student.rollNumber',
        present: 1,
        absent: 1,
        late: 1,
        leave: 1,
        total: 1,
        percentage: { $round: ['$percentage', 2] },
      },
    },
    { $sort: { percentage: 1 } },
  ]);
  
  const averageAttendanceValue = stats.length
    ? stats.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0) / stats.length
    : 0;

  const summary = {
    totalStudents: stats.length,
    averageAttendance: averageAttendanceValue.toFixed(2),
    studentsBelow75: stats.filter(s => s.percentage < 75).length,
  };
  
  res.json({
    success: true,
    summary,
    data: stats,
  });
});

// @desc    Get today's attendance summary
// @route   GET /api/v1/attendance/today/summary
// @access  Private/Admin,Warden
const getTodaySummary = catchAsync(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  
  const totalStudents = await Student.countDocuments({ status: 'active' });
  const markedAttendance = await Attendance.countDocuments({
    date: {
      $gte: startOfToday,
      $lte: endOfToday,
    },
  });
  
  const summary = await Attendance.getDailySummary(startOfToday);
  
  res.json({
    success: true,
    data: {
      totalStudents,
      markedCount: markedAttendance,
      pendingCount: totalStudents - markedAttendance,
      summary,
    },
  });
});

export {
  getAllAttendance,
  getStudentAttendance,
  getAttendanceByDate,
  markAttendance,
  updateAttendance,
  getAttendanceStats,
  getTodaySummary,
};
