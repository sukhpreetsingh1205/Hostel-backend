import Fee from '../models/Fee.js';
import Student from '../models/Student.js';
import Room from '../models/Room.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';
import { sendEmail } from '../services/emailService.js';

// @desc    Get all fees
// @route   GET /api/v1/fees
// @access  Private/Admin
const getAllFees = catchAsync(async (req, res) => {
  const features = new APIFeatures(Fee.find().populate('studentId', 'studentId name rollNumber'), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const { results: fees, pagination } = await features.execute();
  
  res.json({
    success: true,
    count: fees.length,
    pagination,
    data: fees,
  });
});

// @desc    Get student fees
// @route   GET /api/v1/fees/student/:studentId
// @access  Private/Admin,Student
const getStudentFees = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  
  // Check permission
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (student._id.toString() !== studentId) {
      throw new AppError('You can only view your own fees', ErrorTypes.FORBIDDEN);
    }
  }
  
  const fees = await Fee.find({ studentId })
    .sort({ year: -1, month: -1 });
  
  const summary = {
    totalDue: fees.reduce((sum, fee) => sum + fee.balance, 0),
    totalPaid: fees.reduce((sum, fee) => sum + fee.paidAmount, 0),
    pendingCount: fees.filter(f => f.status === 'pending').length,
    overdueCount: fees.filter(f => f.status === 'overdue').length,
  };
  
  res.json({
    success: true,
    summary,
    count: fees.length,
    data: fees,
  });
});

// @desc    Get single fee
// @route   GET /api/v1/fees/:id
// @access  Private/Admin
const getFee = catchAsync(async (req, res) => {
  const fee = await Fee.findById(req.params.id)
    .populate('studentId', 'studentId name rollNumber course year roomId')
    .populate('payments.receivedBy', 'name');
  
  if (!fee) {
    throw new AppError('Fee record not found', ErrorTypes.NOT_FOUND);
  }
  
  res.json({
    success: true,
    data: fee,
  });
});

// @desc    Generate monthly fee for all students
// @route   POST /api/v1/fees/generate-monthly
// @access  Private/Admin
const generateMonthlyFees = catchAsync(async (req, res) => {
  const { month, year } = req.body;
  
  // Check if fees already generated for this month
  const existingFees = await Fee.findOne({ month, year });
  if (existingFees) {
    throw new AppError('Fees already generated for this month', ErrorTypes.CONFLICT);
  }
  
  // Get all active students with their room details
  const students = await Student.find({ status: 'active' }).populate('roomId');
  
  const feesData = [];
  
  for (const student of students) {
    if (!student.roomId) {
      console.log(`Student ${student.studentId} has no room allotted`);
      continue;
    }
    
    // Calculate fee components
    const components = [
      { name: 'Hostel Rent', amount: student.roomId.rent },
      { name: 'Mess Fee', amount: 3000 },
      { name: 'Electricity', amount: 500 },
      { name: 'Maintenance', amount: 400 },
    ];
    
    // Add optional services
    if (student.messPreference === 'non-veg') {
      components.push({ name: 'Non-Veg Surcharge', amount: 500 });
    }
    
    const totalAmount = components.reduce((sum, comp) => sum + comp.amount, 0);
    
    const fee = await Fee.create({
      studentId: student._id,
      month,
      year,
      dueDate: new Date(year, new Date(Date.parse(month + " 1, " + year)).getMonth(), 10),
      components,
      totalAmount,
      status: 'pending',
    });
    
    feesData.push(fee);
    
    // Send email notification
    try {
      await sendEmail({
        to: student.userId?.email,
        subject: `Hostel Fee for ${month} ${year}`,
        html: `
          <h2>Fee Generation Notification</h2>
          <p>Dear ${student.userId?.name},</p>
          <p>Your hostel fee for ${month} ${year} has been generated.</p>
          <p>Total Amount: ₹${totalAmount}</p>
          <p>Due Date: ${new Date(year, new Date(Date.parse(month + " 1, " + year)).getMonth(), 10).toLocaleDateString()}</p>
          <p>Please make the payment before the due date to avoid late fees.</p>
        `,
      });
    } catch (error) {
      console.error(`Failed to send email to ${student.userId?.email}:`, error);
    }
  }
  
  res.status(201).json({
    success: true,
    message: `Generated fees for ${feesData.length} students`,
    count: feesData.length,
    data: feesData,
  });
});

// @desc    Make payment
// @route   POST /api/v1/fees/:id/payment
// @access  Private/Admin,Student
const makePayment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { amount, method, transactionId } = req.body;
  
  const fee = await Fee.findById(id).populate('studentId');
  
  if (!fee) {
    throw new AppError('Fee record not found', ErrorTypes.NOT_FOUND);
  }
  
  // Check permission
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (fee.studentId._id.toString() !== student._id.toString()) {
      throw new AppError('You can only pay your own fees', ErrorTypes.FORBIDDEN);
    }
  }
  
  // Calculate late fee if applicable
  await fee.calculateLateFee();
  
  if (amount > fee.balance + fee.lateFee) {
    throw new AppError('Payment amount exceeds total due', ErrorTypes.BAD_REQUEST);
  }
  
  const payment = await fee.makePayment(amount, method, transactionId, req.user.id);
  
  // Send payment confirmation email
  try {
    await sendEmail({
      to: fee.studentId.userId?.email,
      subject: `Payment Confirmation - ${fee.month} ${fee.year}`,
      html: `
        <h2>Payment Received</h2>
        <p>Dear ${fee.studentId.userId?.name},</p>
        <p>We have received your payment of ₹${amount} for ${fee.month} ${fee.year}.</p>
        <p>Receipt No: ${payment.receiptNo}</p>
        <p>Transaction ID: ${transactionId}</p>
        <p>Remaining Balance: ₹${fee.balance}</p>
        <p>Thank you for your payment!</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send payment email:', error);
  }
  
  res.json({
    success: true,
    message: 'Payment successful',
    data: {
      fee,
      payment,
    },
  });
});

// @desc    Update fee record
// @route   PUT /api/v1/fees/:id
// @access  Private/Admin
const updateFee = catchAsync(async (req, res) => {
  let fee = await Fee.findById(req.params.id);
  
  if (!fee) {
    throw new AppError('Fee record not found', ErrorTypes.NOT_FOUND);
  }
  
  fee = await Fee.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );
  
  res.json({
    success: true,
    data: fee,
  });
});

// @desc    Delete fee record
// @route   DELETE /api/v1/fees/:id
// @access  Private/Admin
const deleteFee = catchAsync(async (req, res) => {
  const fee = await Fee.findById(req.params.id);
  
  if (!fee) {
    throw new AppError('Fee record not found', ErrorTypes.NOT_FOUND);
  }
  
  await fee.deleteOne();
  
  res.json({
    success: true,
    message: 'Fee record deleted successfully',
  });
});

// @desc    Get fee statistics
// @route   GET /api/v1/fees/stats/summary
// @access  Private/Admin
const getFeeStats = catchAsync(async (req, res) => {
  const summary = await Fee.getFeeSummary();
  
  const monthlyCollection = await Fee.aggregate([
    {
      $group: {
        _id: { month: '$month', year: '$year' },
        totalCollected: { $sum: '$paidAmount' },
        totalDue: { $sum: '$balance' },
        totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        totalOverdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
  ]);
  
  const defaulters = await Fee.find({ status: 'overdue', balance: { $gt: 0 } })
    .populate('studentId', 'studentId name rollNumber email phone')
    .limit(10);
  
  res.json({
    success: true,
    data: {
      summary,
      monthlyCollection,
      topDefaulters: defaulters,
    },
  });
});

// @desc    Send reminders for pending fees
// @route   POST /api/v1/fees/send-reminders
// @access  Private/Admin
const sendFeeReminders = catchAsync(async (req, res) => {
  const overdueFees = await Fee.find({
    status: 'overdue',
    balance: { $gt: 0 },
  }).populate('studentId');
  
  let remindersSent = 0;
  
  for (const fee of overdueFees) {
    try {
      await sendEmail({
        to: fee.studentId.userId?.email,
        subject: `Fee Payment Reminder - ${fee.month} ${fee.year}`,
        html: `
          <h2>Fee Payment Overdue</h2>
          <p>Dear ${fee.studentId.userId?.name},</p>
          <p>Your hostel fee for ${fee.month} ${fee.year} is overdue.</p>
          <p>Due Amount: ₹${fee.balance}</p>
          <p>Late Fee: ₹${fee.lateFee}</p>
          <p>Total Due: ₹${fee.balance + fee.lateFee}</p>
          <p>Please make the payment immediately to avoid further late fees.</p>
        `,
      });
      
      fee.remindersSent.push({
        sentDate: new Date(),
        type: 'email',
        status: 'sent',
      });
      await fee.save();
      remindersSent++;
    } catch (error) {
      console.error(`Failed to send reminder to ${fee.studentId.userId?.email}:`, error);
    }
  }
  
  res.json({
    success: true,
    message: `Sent ${remindersSent} reminders`,
    data: { remindersSent },
  });
});

export {
  getAllFees,
  getStudentFees,
  getFee,
  generateMonthlyFees,
  makePayment,
  updateFee,
  deleteFee,
  getFeeStats,
  sendFeeReminders,
};
