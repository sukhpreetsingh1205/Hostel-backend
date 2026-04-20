import Complaint from '../models/Complaint.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';
import { sendEmail } from '../services/emailService.js';

// @desc    Get all complaints
// @route   GET /api/v1/complaints
// @access  Private/Admin,Warden
const getAllComplaints = catchAsync(async (req, res) => {
  const features = new APIFeatures(Complaint.find().populate('studentId', 'studentId name rollNumber'), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const { results: complaints, pagination } = await features.execute();
  
  res.json({
    success: true,
    count: complaints.length,
    pagination,
    data: complaints,
  });
});

// @desc    Get student complaints
// @route   GET /api/v1/complaints/student/:studentId
// @access  Private/Admin,Warden,Student
const getStudentComplaints = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  
  // Check permission
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (student._id.toString() !== studentId) {
      throw new AppError('You can only view your own complaints', ErrorTypes.FORBIDDEN);
    }
  }
  
  const complaints = await Complaint.find({ studentId })
    .sort({ createdAt: -1 });
  
  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'pending').length,
    inProgress: complaints.filter(c => c.status === 'in-progress').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    averageRating: complaints.reduce((sum, c) => sum + (c.studentRating || 0), 0) / complaints.filter(c => c.studentRating).length || 0,
  };
  
  res.json({
    success: true,
    stats,
    count: complaints.length,
    data: complaints,
  });
});

// @desc    Get single complaint
// @route   GET /api/v1/complaints/:id
// @access  Private/Admin,Warden,Student
const getComplaint = catchAsync(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id)
    .populate('studentId', 'studentId name rollNumber roomId phone email')
    .populate('assignedTo', 'name email role')
    .populate('resolution.resolvedBy', 'name')
    .populate('comments.commentedBy', 'name role');
  
  if (!complaint) {
    throw new AppError('Complaint not found', ErrorTypes.NOT_FOUND);
  }
  
  // Check permission
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (complaint.studentId._id.toString() !== student._id.toString()) {
      throw new AppError('You can only view your own complaints', ErrorTypes.FORBIDDEN);
    }
  }
  
  res.json({
    success: true,
    data: complaint,
  });
});

// @desc    Create complaint
// @route   POST /api/v1/complaints
// @access  Private/Student
const createComplaint = catchAsync(async (req, res) => {
  const student = await Student.findOne({ userId: req.user.id });
  
  if (!student) {
    throw new AppError('Student profile not found', ErrorTypes.NOT_FOUND);
  }
  
  const complaint = await Complaint.create({
    ...req.body,
    studentId: student._id,
    complaintId: `CMP${Date.now()}${Math.floor(Math.random() * 1000)}`,
  });
  
  // Notify admin
  const admins = await User.find({ role: 'admin', isActive: true }).select('email');
  
  for (const admin of admins) {
    try {
      await sendEmail({
        to: admin.email,
        subject: `New Complaint - ${complaint.complaintId}`,
        html: `
          <h2>New Complaint Received</h2>
          <p>Complaint ID: ${complaint.complaintId}</p>
          <p>Student: ${student.userId.name}</p>
          <p>Category: ${complaint.category}</p>
          <p>Title: ${complaint.title}</p>
          <p>Priority: ${complaint.priority}</p>
          <p>Please review and assign a staff member.</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send notification to admin:', error);
    }
  }
  
  res.status(201).json({
    success: true,
    message: 'Complaint submitted successfully',
    data: complaint,
  });
});

// @desc    Update complaint
// @route   PUT /api/v1/complaints/:id
// @access  Private/Student (only pending)
const updateComplaint = catchAsync(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  
  if (!complaint) {
    throw new AppError('Complaint not found', ErrorTypes.NOT_FOUND);
  }
  
  const student = await Student.findOne({ userId: req.user.id });
  if (complaint.studentId.toString() !== student._id.toString()) {
    throw new AppError('You can only update your own complaints', ErrorTypes.FORBIDDEN);
  }
  
  if (complaint.status !== 'pending') {
    throw new AppError('Cannot update complaint that is already being processed', ErrorTypes.BAD_REQUEST);
  }
  
  const updatedComplaint = await Complaint.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );
  
  res.json({
    success: true,
    message: 'Complaint updated successfully',
    data: updatedComplaint,
  });
});

// @desc    Assign complaint to staff
// @route   PUT /api/v1/complaints/:id/assign
// @access  Private/Admin
const assignComplaint = catchAsync(async (req, res) => {
  const { assignedTo } = req.body;
  
  const complaint = await Complaint.findById(req.params.id);
  
  if (!complaint) {
    throw new AppError('Complaint not found', ErrorTypes.NOT_FOUND);
  }
  
  const staff = await User.findById(assignedTo);
  if (!staff || (staff.role !== 'warden' && staff.role !== 'admin')) {
    throw new AppError('Invalid staff assignment', ErrorTypes.BAD_REQUEST);
  }
  
  await complaint.assign(assignedTo);
  
  // Notify assigned staff
  try {
    await sendEmail({
      to: staff.email,
      subject: `Complaint Assigned - ${complaint.complaintId}`,
      html: `
        <h2>Complaint Assigned to You</h2>
        <p>Complaint ID: ${complaint.complaintId}</p>
        <p>Category: ${complaint.category}</p>
        <p>Title: ${complaint.title}</p>
        <p>Priority: ${complaint.priority}</p>
        <p>Please resolve this complaint at the earliest.</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send assignment email:', error);
  }
  
  res.json({
    success: true,
    message: 'Complaint assigned successfully',
    data: complaint,
  });
});

// @desc    Resolve complaint
// @route   PUT /api/v1/complaints/:id/resolve
// @access  Private/Admin,Warden
const resolveComplaint = catchAsync(async (req, res) => {
  const { resolutionDescription, cost } = req.body;
  
  const complaint = await Complaint.findById(req.params.id).populate('studentId');
  
  if (!complaint) {
    throw new AppError('Complaint not found', ErrorTypes.NOT_FOUND);
  }
  
  if (complaint.status !== 'in-progress') {
    throw new AppError('Complaint is not in progress', ErrorTypes.BAD_REQUEST);
  }
  
  await complaint.resolve(resolutionDescription, req.user.id, cost);
  
  // Notify student
  try {
    await sendEmail({
      to: complaint.studentId.userId?.email,
      subject: `Complaint Resolved - ${complaint.complaintId}`,
      html: `
        <h2>Complaint Resolved</h2>
        <p>Dear ${complaint.studentId.userId?.name},</p>
        <p>Your complaint has been resolved.</p>
        <p>Complaint ID: ${complaint.complaintId}</p>
        <p>Resolution: ${resolutionDescription}</p>
        <p>Please log in to rate our service.</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send resolution email:', error);
  }
  
  res.json({
    success: true,
    message: 'Complaint resolved successfully',
    data: complaint,
  });
});

// @desc    Close complaint with rating
// @route   PUT /api/v1/complaints/:id/close
// @access  Private/Student
const closeComplaint = catchAsync(async (req, res) => {
  const { rating, feedback } = req.body;
  
  const complaint = await Complaint.findById(req.params.id);
  
  if (!complaint) {
    throw new AppError('Complaint not found', ErrorTypes.NOT_FOUND);
  }
  
  const student = await Student.findOne({ userId: req.user.id });
  if (complaint.studentId.toString() !== student._id.toString()) {
    throw new AppError('You can only close your own complaints', ErrorTypes.FORBIDDEN);
  }
  
  if (complaint.status !== 'resolved') {
    throw new AppError('Only resolved complaints can be closed', ErrorTypes.BAD_REQUEST);
  }
  
  await complaint.close(rating, feedback);
  
  res.json({
    success: true,
    message: 'Complaint closed successfully',
    data: complaint,
  });
});

// @desc    Add comment to complaint
// @route   POST /api/v1/complaints/:id/comments
// @access  Private
const addComment = catchAsync(async (req, res) => {
  const { comment } = req.body;
  
  const complaint = await Complaint.findById(req.params.id);
  
  if (!complaint) {
    throw new AppError('Complaint not found', ErrorTypes.NOT_FOUND);
  }
  
  const isStaff = req.user.role !== 'student';
  
  await complaint.addComment(comment, req.user.id, isStaff);
  
  res.json({
    success: true,
    message: 'Comment added successfully',
    data: complaint,
  });
});

// @desc    Get complaint statistics
// @route   GET /api/v1/complaints/stats
// @access  Private/Admin
const getComplaintStats = catchAsync(async (req, res) => {
  const stats = await Complaint.getStatistics();
  
  const byCategory = await Complaint.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgResolutionTime: {
          $avg: {
            $subtract: ['$resolution.resolvedAt', '$createdAt'],
          },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);
  
  const byPriority = await Complaint.aggregate([
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
      },
    },
  ]);
  
  const unresolved = await Complaint.countDocuments({
    status: { $in: ['pending', 'in-progress'] },
  });
  
  res.json({
    success: true,
    data: {
      statusStats: stats,
      categoryStats: byCategory,
      priorityStats: byPriority,
      unresolvedCount: unresolved,
    },
  });
});

export {
  getAllComplaints,
  getStudentComplaints,
  getComplaint,
  createComplaint,
  updateComplaint,
  assignComplaint,
  resolveComplaint,
  closeComplaint,
  addComment,
  getComplaintStats,
};
