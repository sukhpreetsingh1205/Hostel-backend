import Leave from '../models/Leave.js';
import Student from '../models/Student.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';
import { sendEmail } from '../services/emailService.js';

// @desc    Get all leaves
// @route   GET /api/v1/leaves
// @access  Private/Admin,Warden
const getAllLeaves = catchAsync(async (req, res) => {
  const features = new APIFeatures(Leave.find().populate('studentId', 'studentId name rollNumber roomId'), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const { results: leaves, pagination } = await features.execute();
  
  res.json({
    success: true,
    count: leaves.length,
    pagination,
    data: leaves,
  });
});

// @desc    Get student leaves
// @route   GET /api/v1/leaves/student/:studentId
// @access  Private/Admin,Warden,Student
const getStudentLeaves = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  
  // Check permission
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (student._id.toString() !== studentId) {
      throw new AppError('You can only view your own leaves', ErrorTypes.FORBIDDEN);
    }
  }
  
  const leaves = await Leave.find({ studentId })
    .sort({ appliedOn: -1 });
  
  // Calculate leave statistics
  const stats = {
    total: leaves.length,
    approved: leaves.filter(l => l.status === 'approved').length,
    pending: leaves.filter(l => l.status === 'pending').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  };
  
  res.json({
    success: true,
    stats,
    count: leaves.length,
    data: leaves,
  });
});

// @desc    Get single leave
// @route   GET /api/v1/leaves/:id
// @access  Private/Admin,Warden,Student
const getLeave = catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id)
    .populate('studentId', 'studentId name rollNumber roomId parentPhone')
    .populate('approvedBy', 'name email');
  
  if (!leave) {
    throw new AppError('Leave request not found', ErrorTypes.NOT_FOUND);
  }
  
  // Check permission
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (leave.studentId._id.toString() !== student._id.toString()) {
      throw new AppError('You can only view your own leave requests', ErrorTypes.FORBIDDEN);
    }
  }
  
  res.json({
    success: true,
    data: leave,
  });
});

// @desc    Create leave request
// @route   POST /api/v1/leaves
// @access  Private/Student
const createLeave = catchAsync(async (req, res) => {
  const student = await Student.findOne({ userId: req.user.id });
  
  if (!student) {
    throw new AppError('Student profile not found', ErrorTypes.NOT_FOUND);
  }
  
  // Check for overlapping leave requests
  const overlappingLeave = await Leave.findOne({
    studentId: student._id,
    status: { $in: ['pending', 'approved'] },
    $or: [
      {
        fromDate: { $lte: req.body.toDate },
        toDate: { $gte: req.body.fromDate },
      },
    ],
  });
  
  if (overlappingLeave) {
    throw new AppError('You already have a leave request for this period', ErrorTypes.CONFLICT);
  }
  
  const leave = await Leave.create({
    ...req.body,
    studentId: student._id,
    leaveId: `LV${Date.now()}${Math.floor(Math.random() * 1000)}`,
  });
  
  // Notify wardens
  const wardens = await User.find({ role: 'warden', isActive: true }).select('email');
  
  for (const warden of wardens) {
    try {
      await sendEmail({
        to: warden.email,
        subject: `New Leave Request - ${leave.leaveId}`,
        html: `
          <h2>New Leave Request</h2>
          <p>Student: ${student.userId.name}</p>
          <p>Roll Number: ${student.rollNumber}</p>
          <p>From: ${new Date(leave.fromDate).toLocaleString()}</p>
          <p>To: ${new Date(leave.toDate).toLocaleString()}</p>
          <p>Reason: ${leave.reason}</p>
          <p>Destination: ${leave.destination}</p>
          <p>Please review the request in the admin panel.</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send notification to warden:', error);
    }
  }
  
  res.status(201).json({
    success: true,
    message: 'Leave request submitted successfully',
    data: leave,
  });
});

// @desc    Update leave request
// @route   PUT /api/v1/leaves/:id
// @access  Private/Student
const updateLeave = catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  
  if (!leave) {
    throw new AppError('Leave request not found', ErrorTypes.NOT_FOUND);
  }
  
  // Check if student owns this leave
  const student = await Student.findOne({ userId: req.user.id });
  if (leave.studentId.toString() !== student._id.toString()) {
    throw new AppError('You can only update your own leave requests', ErrorTypes.FORBIDDEN);
  }
  
  // Can only update pending leaves
  if (leave.status !== 'pending') {
    throw new AppError('Cannot update leave request that is already processed', ErrorTypes.BAD_REQUEST);
  }
  
  const updatedLeave = await Leave.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );
  
  res.json({
    success: true,
    message: 'Leave request updated successfully',
    data: updatedLeave,
  });
});

// @desc    Approve leave
// @route   PUT /api/v1/leaves/:id/approve
// @access  Private/Admin,Warden
const approveLeave = catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id).populate('studentId');
  
  if (!leave) {
    throw new AppError('Leave request not found', ErrorTypes.NOT_FOUND);
  }
  
  if (leave.status !== 'pending') {
    throw new AppError('Leave request is already processed', ErrorTypes.BAD_REQUEST);
  }
  
  await leave.approve(req.user.id, req.body.remarks);
  
  // Send email to student
  try {
    await sendEmail({
      to: leave.studentId.userId?.email,
      subject: `Leave Request Approved - ${leave.leaveId}`,
      html: `
        <h2>Leave Request Approved</h2>
        <p>Dear ${leave.studentId.userId?.name},</p>
        <p>Your leave request has been approved.</p>
        <p>From: ${new Date(leave.fromDate).toLocaleString()}</p>
        <p>To: ${new Date(leave.toDate).toLocaleString()}</p>
        <p>Remarks: ${req.body.remarks || 'None'}</p>
        <p>Have a safe trip!</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send approval email:', error);
  }
  
  res.json({
    success: true,
    message: 'Leave request approved successfully',
    data: leave,
  });
});

// @desc    Reject leave
// @route   PUT /api/v1/leaves/:id/reject
// @access  Private/Admin,Warden
const rejectLeave = catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id).populate('studentId');
  
  if (!leave) {
    throw new AppError('Leave request not found', ErrorTypes.NOT_FOUND);
  }
  
  if (leave.status !== 'pending') {
    throw new AppError('Leave request is already processed', ErrorTypes.BAD_REQUEST);
  }
  
  const { rejectionReason } = req.body;
  if (!rejectionReason) {
    throw new AppError('Rejection reason is required', ErrorTypes.BAD_REQUEST);
  }
  
  await leave.reject(req.user.id, rejectionReason);
  
  // Send email to student
  try {
    await sendEmail({
      to: leave.studentId.userId?.email,
      subject: `Leave Request Rejected - ${leave.leaveId}`,
      html: `
        <h2>Leave Request Rejected</h2>
        <p>Dear ${leave.studentId.userId?.name},</p>
        <p>Your leave request has been rejected.</p>
        <p>From: ${new Date(leave.fromDate).toLocaleString()}</p>
        <p>To: ${new Date(leave.toDate).toLocaleString()}</p>
        <p>Reason: ${rejectionReason}</p>
        <p>Please contact the warden for more information.</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send rejection email:', error);
  }
  
  res.json({
    success: true,
    message: 'Leave request rejected',
    data: leave,
  });
});

// @desc    Cancel leave
// @route   PUT /api/v1/leaves/:id/cancel
// @access  Private/Student
const cancelLeave = catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  
  if (!leave) {
    throw new AppError('Leave request not found', ErrorTypes.NOT_FOUND);
  }
  
  const student = await Student.findOne({ userId: req.user.id });
  if (leave.studentId.toString() !== student._id.toString()) {
    throw new AppError('You can only cancel your own leave requests', ErrorTypes.FORBIDDEN);
  }
  
  if (leave.status === 'approved') {
    throw new AppError('Cannot cancel approved leave. Please contact warden.', ErrorTypes.BAD_REQUEST);
  }
  
  await leave.cancel();
  
  res.json({
    success: true,
    message: 'Leave request cancelled successfully',
    data: leave,
  });
});

// @desc    Get pending leaves
// @route   GET /api/v1/leaves/pending
// @access  Private/Admin,Warden
const getPendingLeaves = catchAsync(async (req, res) => {
  const leaves = await Leave.getPendingLeaves();
  
  res.json({
    success: true,
    count: leaves.length,
    data: leaves,
  });
});

// @desc    Get leave statistics
// @route   GET /api/v1/leaves/stats
// @access  Private/Admin,Warden
const getLeaveStats = catchAsync(async (req, res) => {
  const { month, year } = req.query;
  
  let matchQuery = {};
  if (month && year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    matchQuery = {
      appliedOn: { $gte: startDate, $lte: endDate },
    };
  }
  
  const stats = await Leave.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalDays: { $sum: '$duration' },
      },
    },
  ]);
  
  const byType = await Leave.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
      },
    },
  ]);
  
  res.json({
    success: true,
    data: {
      statusStats: stats,
      typeStats: byType,
    },
  });
});

export {
  getAllLeaves,
  getStudentLeaves,
  getLeave,
  createLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getPendingLeaves,
  getLeaveStats,
};
