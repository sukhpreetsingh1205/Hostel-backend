import mongoose from "mongoose";
const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    maxlength: [5000, 'Content cannot exceed 5000 characters']
  },
  summary: {
    type: String,
    maxlength: [200, 'Summary cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Mess', 'Maintenance', 'Events', 'Rules', 'General', 'Emergency', 'Academic', 'Announcement']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  targetAudience: {
    type: String,
    enum: ['all', 'students', 'staff', 'wardens', 'specific_block', 'specific_floor'],
    default: 'all'
  },
  targetBlock: {
    type: String,
    required: function() {
      return this.targetAudience === 'specific_block';
    }
  },
  targetFloor: {
    type: Number,
    required: function() {
      return this.targetAudience === 'specific_floor';
    }
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    uploadedAt: Date
  }],
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validTill: {
    type: Date,
    required: [true, 'Valid till date is required']
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  readBy: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
noticeSchema.index({ category: 1, priority: 1 });
noticeSchema.index({ validFrom: 1, validTill: 1 });
noticeSchema.index({ isPinned: -1, createdAt: -1 });
noticeSchema.index({ tags: 1 });

// Virtual to check if notice is expired
noticeSchema.virtual('isExpired').get(function() {
  return new Date() > this.validTill;
});

// Virtual to check if notice is active
noticeSchema.virtual('isActiveNotice').get(function() {
  const now = new Date();
  return this.isActive && now >= this.validFrom && now <= this.validTill;
});

// Method to increment view count
noticeSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
  return this.views;
};

// Method to mark as read by student
noticeSchema.methods.markAsRead = async function(studentId) {
  const alreadyRead = this.readBy.some(r => r.studentId.toString() === studentId.toString());
  if (!alreadyRead) {
    this.readBy.push({ studentId, readAt: new Date() });
    await this.save();
  }
  return this;
};

// Method to get read percentage
noticeSchema.methods.getReadPercentage = async function(totalStudents) {
  if (!totalStudents) return 0;
  return (this.readBy.length / totalStudents) * 100;
};

// Static method to get pinned notices
noticeSchema.statics.getPinnedNotices = async function() {
  return await this.find({ isPinned: true, isActive: true })
    .populate('postedBy', 'name role')
    .sort({ createdAt: -1 });
};

// Static method to get active notices for user
noticeSchema.statics.getActiveNotices = async function(userRole, block, floor) {
  const now = new Date();
  let query = {
    isActive: true,
    validFrom: { $lte: now },
    validTill: { $gte: now }
  };
  
  if (userRole !== 'admin') {
    query.$or = [
      { targetAudience: 'all' },
      { targetAudience: 'students' },
      { targetAudience: 'staff' }
    ];
    
    if (block && query.targetAudience === 'specific_block') {
      query.targetBlock = block;
    }
    
    if (floor && query.targetAudience === 'specific_floor') {
      query.targetFloor = floor;
    }
  }
  
  return await this.find(query)
    .populate('postedBy', 'name role')
    .sort({ isPinned: -1, priority: -1, createdAt: -1 });
};

// Pre-save middleware to generate summary if not provided
noticeSchema.pre('save', function(next) {
  if (!this.summary && this.content) {
    this.summary = this.content.substring(0, 150) + (this.content.length > 150 ? '...' : '');
  }
  next();
});

export const Notice = mongoose.model('Notice', noticeSchema);
 