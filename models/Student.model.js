import mongoose from "mongoose" ;

const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    unique: true,
    trim: true
  },
  course: {
    type: String,
    required: [true, 'Course is required'],
    enum: ['B.Tech', 'M.Tech', 'BCA', 'MCA', 'B.Sc', 'M.Sc', 'MBA', 'PhD']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: 1,
    max: 5
  },
  branch: {
    type: String,
    required: [true, 'Branch is required'],
    trim: true
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    min: 1,
    max: 10
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
    default: 'Unknown'
  },
  parentName: {
    type: String,
    required: [true, 'Parent/Guardian name is required'],
    trim: true
  },
  parentPhone: {
    type: String,
    required: [true, 'Parent/Guardian phone is required'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  emergencyContact: {
    type: String,
    required: [true, 'Emergency contact is required'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'alumni', 'suspended', 'left'],
    default: 'active'
  },
  // Additional fields for hostel management
  messPreference: {
    type: String,
    enum: ['veg', 'non-veg'],
    default: 'veg'
  },
  medicalConditions: {
    type: String,
    default: 'None'
  },
   guardianEmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ]
  }
}, {
  timestamps: true
});

// Index for faster searches
studentSchema.index({ studentId: 1, rollNumber: 1, status: 1 });
studentSchema.index({ roomId: 1 });
studentSchema.index({ course: 1, year: 1, branch: 1 });

// Virtual for getting full name from User model
studentSchema.virtual('fullName').get(function() {
  return this.userId ? this.userId.name : '';
});

// Method to check if student is active
studentSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Pre-query middleware to populate userId
studentSchema.pre(/^find/, function(next) {
  this.populate('userId', 'name email phone profilePic isActive');
  this.populate('roomId', 'roomNumber block floor type rent');
  next();
});
export const Student = mongoose.model('Student', studentSchema);