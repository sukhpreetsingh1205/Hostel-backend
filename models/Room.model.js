import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: [true, 'Room number is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  block: {
    type: String,
    required: [true, 'Block is required'],
    uppercase: true,
    trim: true
  },
  floor: {
    type: Number,
    required: [true, 'Floor number is required'],
    min: 0,
    max: 10
  },
  type: {
    type: String,
    required: [true, 'Room type is required'],
    enum: ['single', 'double', 'triple']
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: 1,
    max: 3
  },
  currentOccupancy: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(value) {
        return value <= this.capacity;
      },
      message: 'Current occupancy cannot exceed capacity'
    }
  },
  rent: {
    type: Number,
    required: [true, 'Rent amount is required'],
    min: 0
  },
  amenities: [{
    type: String,
    enum: ['bed', 'table', 'chair', 'cupboard', 'fan', 'balcony', 'study table', 'bookshelf']
  }],
 
  status: {
    type: String,
    enum: ['available', 'full', 'maintenance', 'reserved'],
    default: 'available'
  },
  currentStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  maintenanceHistory: [{
    issue: String,
    reportedDate: Date,
    resolvedDate: Date,
    cost: Number
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
roomSchema.index({ block: 1, floor: 1, roomNumber: 1 });
roomSchema.index({ status: 1, type: 1 });

// Virtual for available beds
roomSchema.virtual('availableBeds').get(function() {
  return this.capacity - this.currentOccupancy;
});

// Virtual for availability percentage
roomSchema.virtual('occupancyPercentage').get(function() {
  return (this.currentOccupancy / this.capacity) * 100;
});

// Method to check if room has available beds
roomSchema.methods.hasAvailableBeds = function() {
  return this.currentOccupancy < this.capacity && this.status === 'available';
};

// Method to allot room to student
roomSchema.methods.allotRoom = async function(studentId) {
  if (!this.hasAvailableBeds()) {
    throw new Error('Room is full or under maintenance');
  }
  
  this.currentOccupancy += 1;
  this.currentStudents.push(studentId);
  
  if (this.currentOccupancy === this.capacity) {
    this.status = 'full';
  }
  
  await this.save();
  return this;
};

// Method to vacate room
roomSchema.methods.vacateRoom = async function(studentId) {
  const index = this.currentStudents.indexOf(studentId);
  if (index > -1) {
    this.currentStudents.splice(index, 1);
    this.currentOccupancy -= 1;
    
    if (this.currentOccupancy < this.capacity && this.status === 'full') {
      this.status = 'available';
    }
    
    await this.save();
  }
  return this;
};

// Pre-save middleware to update status based on occupancy
roomSchema.pre('save', function(next) {
  if (this.currentOccupancy === this.capacity) {
    this.status = 'full';
  } else if (this.currentOccupancy < this.capacity && this.status === 'full') {
    this.status = 'available';
  }
  next();
});

export const Room = mongoose.model('Room', roomSchema);