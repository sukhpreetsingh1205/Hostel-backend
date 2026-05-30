import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    required: true,
    enum: ['present', 'absent', 'late', 'holiday', 'leave'],
    default: 'absent'
  },
  inTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide valid time in HH:MM format']
  },
  outTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide valid time in HH:MM format']
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  remarks: {
    type: String,
    maxlength: [200, 'Remarks cannot exceed 200 characters']
  },
  location: {
    type: String,
    default: 'Hostel'
  }
}, {
  timestamps: true
});

// Compound index to ensure one attendance record per student per day
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });

// Virtual for month and year
attendanceSchema.virtual('month').get(function() {
  return this.date.getMonth() + 1;
});

attendanceSchema.virtual('year').get(function() {
  return this.date.getFullYear();
});

// Method to mark attendance
attendanceSchema.methods.markAttendance = async function(status, markedBy, inTime, outTime) {
  this.status = status;
  this.markedBy = markedBy;
  if (inTime) this.inTime = inTime;
  if (outTime) this.outTime = outTime;
  await this.save();
  return this;
};

// Static method to get attendance summary for a student
attendanceSchema.statics.getStudentAttendanceSummary = async function(studentId, month, year) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const attendance = await this.find({
    studentId,
    date: { $gte: startDate, $lte: endDate }
  });
  
  const totalDays = new Date(year, month, 0).getDate();
  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const leave = attendance.filter(a => a.status === 'leave').length;
  const holiday = attendance.filter(a => a.status === 'holiday').length;
  
  const percentage = ((present + leave) / (totalDays - holiday)) * 100;
  
  return {
    month,
    year,
    totalDays,
    present,
    absent,
    late,
    leave,
    holiday,
    percentage: percentage.toFixed(2),
    requiredPercentage: 75,
    isEligible: percentage >= 75
  };
};

// Static method to get daily summary
attendanceSchema.statics.getDailySummary = async function(date) {
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) {
    return {
      present: 0,
      absent: 0,
      late: 0,
      holiday: 0,
      leave: 0,
      total: 0,
    };
  }

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const rows = await this.aggregate([
    {
      $match: {
        date: {
          $gte: start,
          $lte: end,
        },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    holiday: 0,
    leave: 0,
  };

  rows.forEach((row) => {
    if (row?._id && Object.prototype.hasOwnProperty.call(summary, row._id)) {
      summary[row._id] = row.count;
    }
  });

  const total = Object.values(summary).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return { ...summary, total };
};

export const Attendence = mongoose.model('Attendance', attendanceSchema);
