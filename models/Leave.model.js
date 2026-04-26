import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  leaveId: {
    type: String,
    unique: true,
    default: function() {
      return `LV${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['short_leave', 'day_leave', 'weekend_leave', 'long_leave', 'emergency_leave', 'medical_leave']
  },
  fromDate: {
    type: Date,
    required: [true, 'From date is required']
  },
  toDate: {
    type: Date,
    required: [true, 'To date is required']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  destination: {
    type: String,
    required: [true, 'Destination is required'],
    trim: true
  },
  parentContact: {
    type: String,
    required: [true, 'Parent/Guardian contact is required'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  appliedOn: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedOn: Date,
  rejectionReason: {
    type: String,
    maxlength: [200, 'Rejection reason cannot exceed 200 characters']
  },
  remarks: {
    type: String,
    maxlength: [200, 'Remarks cannot exceed 200 characters']
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date
  }],
  outTime: Date,
  inTime: Date
}, {
  timestamps: true
});

// Indexes
leaveSchema.index({ studentId: 1, status: 1 });
leaveSchema.index({ fromDate: 1, toDate: 1 });
leaveSchema.index({ leaveId: 1 });

// Validate that fromDate is before toDate
leaveSchema.pre('save', function(next) {
  if (this.fromDate >= this.toDate) {
    return next(new Error('From date must be before to date'));
  }
  next();
});

// Virtual for leave duration in days
leaveSchema.virtual('duration').get(function() {
  const diffTime = Math.abs(this.toDate - this.fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Method to approve leave
leaveSchema.methods.approve = async function(approvedBy, remarks) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedOn = new Date();
  if (remarks) this.remarks = remarks;
  await this.save();
  return this;
};

// Method to reject leave
leaveSchema.methods.reject = async function(approvedBy, rejectionReason) {
  this.status = 'rejected';
  this.approvedBy = approvedBy;
  this.approvedOn = new Date();
  this.rejectionReason = rejectionReason;
  await this.save();
  return this;
};

// Method to cancel leave
leaveSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  await this.save();
  return this;
};

// Static method to get pending leaves
leaveSchema.statics.getPendingLeaves = async function() {
  return await this.find({ status: 'pending' })
    .populate('studentId', 'studentId fullName roomId')
    .sort({ appliedOn: -1 });
};

// Static method to check if student is on leave
leaveSchema.statics.isStudentOnLeave = async function(studentId, date) {
  const leave = await this.findOne({
    studentId,
    status: 'approved',
    fromDate: { $lte: date },
    toDate: { $gte: date }
  });
  return !!leave;
};

export const Leave = mongoose.model('Leave', leaveSchema);