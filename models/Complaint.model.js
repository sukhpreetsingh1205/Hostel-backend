import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    unique: true,
    default: function() {
      return `CMP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Room Maintenance',
      'Mess Food Quality',
      'Cleanliness & Housekeeping',
      'Internet/WiFi Issue',
      'Security Concern',
      'Harassment/Bullying',
      'Medical Emergency',
      'Electricity/Water Issue',
      'Staff Behavior',
      'Other'
    ]
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date
  }],
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'rejected', 'closed'],
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedOn: Date,
  resolution: {
    description: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    cost: Number
  },
  studentRating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    maxlength: [500, 'Feedback cannot exceed 500 characters']
  },
  comments: [{
    comment: String,
    commentedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    commentedAt: {
      type: Date,
      default: Date.now
    },
    isStaff: Boolean
  }],
  escalationCount: {
    type: Number,
    default: 0
  },
  lastEscalatedAt: Date
}, {
  timestamps: true
});

// Indexes
complaintSchema.index({ complaintId: 1, status: 1 });
complaintSchema.index({ studentId: 1, createdAt: -1 });
complaintSchema.index({ priority: 1, status: 1 });
complaintSchema.index({ assignedTo: 1, status: 1 });

// Method to assign complaint
complaintSchema.methods.assign = async function(assignedTo) {
  this.assignedTo = assignedTo;
  this.assignedOn = new Date();
  this.status = 'in-progress';
  await this.save();
  return this;
};

// Method to resolve complaint
complaintSchema.methods.resolve = async function(resolutionDescription, resolvedBy, cost) {
  this.status = 'resolved';
  this.resolution = {
    description: resolutionDescription,
    resolvedBy,
    resolvedAt: new Date(),
    cost: cost || 0
  };
  await this.save();
  return this;
};

// Method to close complaint with rating
complaintSchema.methods.close = async function(rating, feedback) {
  this.status = 'closed';
  this.studentRating = rating;
  this.feedback = feedback;
  await this.save();
  return this;
};

// Method to escalate complaint
complaintSchema.methods.escalate = async function() {
  this.escalationCount += 1;
  this.lastEscalatedAt = new Date();
  this.priority = this.priority === 'medium' ? 'high' : 'emergency';
  await this.save();
  return this;
};

// Method to add comment
complaintSchema.methods.addComment = async function(comment, commentedBy, isStaff) {
  this.comments.push({
    comment,
    commentedBy,
    isStaff,
    commentedAt: new Date()
  });
  await this.save();
  return this;
};

// Static method to get complaint statistics
complaintSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgResolutionTime: {
          $avg: {
            $subtract: ['$resolution.resolvedAt', '$createdAt']
          }
        }
      }
    }
  ]);
  return stats;
};

// Pre-save middleware to auto-escalate if pending too long
complaintSchema.pre('save', async function(next) {
  if (this.status === 'pending' && this.createdAt) {
    const daysPending = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
    if (daysPending > 7 && this.escalationCount === 0) {
      this.escalationCount = 1;
      this.priority = 'high';
    } else if (daysPending > 14 && this.escalationCount === 1) {
      this.escalationCount = 2;
      this.priority = 'emergency';
    }
  }
  next();
});

export const Complaint = mongoose.model('Complaint', complaintSchema);