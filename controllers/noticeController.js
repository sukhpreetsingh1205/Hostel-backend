import Notice from '../models/Notice.js';
import Student from '../models/Student.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';
import { sendEmail } from '../services/emailService.js';

// @desc    Get all notices
// @route   GET /api/v1/notices
// @access  Private
const getAllNotices = catchAsync(async (req, res) => {
  const features = new APIFeatures(Notice.find().populate('postedBy', 'name role'), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const { results: notices, pagination } = await features.execute();
  
  res.json({
    success: true,
    count: notices.length,
    pagination,
    data: notices,
  });
});

// @desc    Get active notices for current user
// @route   GET /api/v1/notices/active
// @access  Private
const getActiveNotices = catchAsync(async (req, res) => {
  let block, floor;
  
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id }).populate('roomId');
    if (student?.roomId) {
      block = student.roomId.block;
      floor = student.roomId.floor;
    }
  }
  
  const notices = await Notice.getActiveNotices(req.user.role, block, floor);
  
  // Mark notices as viewed
  notices.forEach(notice => {
    notice.incrementViews();
  });
  
  // Get pinned notices separately
  const pinnedNotices = await Notice.getPinnedNotices();
  
  res.json({
    success: true,
    count: notices.length,
    data: {
      pinned: pinnedNotices,
      recent: notices,
    },
  });
});

// @desc    Get single notice
// @route   GET /api/v1/notices/:id
// @access  Private
const getNotice = catchAsync(async (req, res) => {
  const notice = await Notice.findById(req.params.id)
    .populate('postedBy', 'name role email');
  
  if (!notice) {
    throw new AppError('Notice not found', ErrorTypes.NOT_FOUND);
  }
  
  // Increment view count
  await notice.incrementViews();
  
  // Mark as read if student
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    await notice.markAsRead(student._id);
  }
  
  res.json({
    success: true,
    data: notice,
  });
});

// @desc    Create notice
// @route   POST /api/v1/notices
// @access  Private/Admin,Warden
const createNotice = catchAsync(async (req, res) => {
  const notice = await Notice.create({
    ...req.body,
    postedBy: req.user.id,
  });
  
  // Send email notifications for urgent notices
  if (notice.priority === 'urgent' || notice.priority === 'high') {
    let recipients = [];
    
    if (notice.targetAudience === 'all') {
      const students = await Student.find({ status: 'active' }).populate('userId', 'email');
      recipients = students.map(s => s.userId?.email).filter(Boolean);
    } else if (notice.targetAudience === 'specific_block' && notice.targetBlock) {
      const students = await Student.find({ status: 'active' })
        .populate('roomId')
        .populate('userId', 'email');
      recipients = students
        .filter(s => s.roomId?.block === notice.targetBlock)
        .map(s => s.userId?.email)
        .filter(Boolean);
    }
    
    // Send emails in batches
    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      for (const email of batch) {
        try {
          await sendEmail({
            to: email,
            subject: `[URGENT] ${notice.title}`,
            html: `
              <div style="padding: 20px; border-left: 4px solid #ff0000;">
                <h2>⚠️ Important Notice</h2>
                <h3>${notice.title}</h3>
                <p>${notice.content}</p>
                <p>Posted by: ${req.user.name}</p>
                <p>Date: ${new Date().toLocaleString()}</p>
              </div>
            `,
          });
        } catch (error) {
          console.error(`Failed to send email to ${email}:`, error);
        }
      }
      
      // Small delay to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  res.status(201).json({
    success: true,
    message: 'Notice posted successfully',
    data: notice,
  });
});

// @desc    Update notice
// @route   PUT /api/v1/notices/:id
// @access  Private/Admin
const updateNotice = catchAsync(async (req, res) => {
  let notice = await Notice.findById(req.params.id);
  
  if (!notice) {
    throw new AppError('Notice not found', ErrorTypes.NOT_FOUND);
  }
  
  notice = await Notice.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );
  
  res.json({
    success: true,
    message: 'Notice updated successfully',
    data: notice,
  });
});

// @desc    Delete notice
// @route   DELETE /api/v1/notices/:id
// @access  Private/Admin
const deleteNotice = catchAsync(async (req, res) => {
  const notice = await Notice.findById(req.params.id);
  
  if (!notice) {
    throw new AppError('Notice not found', ErrorTypes.NOT_FOUND);
  }
  
  await notice.deleteOne();
  
  res.json({
    success: true,
    message: 'Notice deleted successfully',
  });
});

// @desc    Pin/Unpin notice
// @route   PUT /api/v1/notices/:id/pin
// @access  Private/Admin
const togglePinNotice = catchAsync(async (req, res) => {
  const notice = await Notice.findById(req.params.id);
  
  if (!notice) {
    throw new AppError('Notice not found', ErrorTypes.NOT_FOUND);
  }
  
  notice.isPinned = !notice.isPinned;
  await notice.save();
  
  res.json({
    success: true,
    message: `Notice ${notice.isPinned ? 'pinned' : 'unpinned'} successfully`,
    data: notice,
  });
});

// @desc    Get notice statistics
// @route   GET /api/v1/notices/stats
// @access  Private/Admin
const getNoticeStats = catchAsync(async (req, res) => {
  const totalNotices = await Notice.countDocuments();
  const activeNotices = await Notice.countDocuments({
    isActive: true,
    validTill: { $gt: new Date() },
  });
  
  const byCategory = await Notice.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalViews: { $sum: '$views' },
      },
    },
  ]);
  
  const mostViewed = await Notice.find()
    .sort({ views: -1 })
    .limit(5)
    .select('title views category');
  
  const readStats = await Notice.aggregate([
    {
      $project: {
        title: 1,
        readCount: { $size: '$readBy' },
      },
    },
    { $sort: { readCount: -1 } },
    { $limit: 5 },
  ]);
  
  res.json({
    success: true,
    data: {
      summary: {
        total: totalNotices,
        active: activeNotices,
      },
      byCategory,
      mostViewed,
      mostRead: readStats,
    },
  });
});

// @desc    Archive expired notices
// @route   POST /api/v1/notices/archive
// @access  Private/Admin
const archiveExpiredNotices = catchAsync(async (req, res) => {
  const result = await Notice.updateMany(
    {
      validTill: { $lt: new Date() },
      isActive: true,
    },
    {
      isActive: false,
    }
  );
  
  res.json({
    success: true,
    message: `Archived ${result.modifiedCount} expired notices`,
    data: { archived: result.modifiedCount },
  });
});

export {
  getAllNotices,
  getActiveNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  togglePinNotice,
  getNoticeStats,
  archiveExpiredNotices,
};
