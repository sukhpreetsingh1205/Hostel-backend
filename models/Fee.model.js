import mongoose from "mongoose";

const feeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  month: {
    type: String,
    required: [true, 'Month is required'],
    enum: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: 2026,
    max: 2035
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  components: [{
    name: {
      type: String,
      required: true,
      enum: ['Hostel Rent', 'Mess Fee', 'Electricity', 'Laundry', 'Internet', 'Maintenance', 'Late Fee']
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    default: function() {
      return this.totalAmount - this.paidAmount;
    }
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'overdue', 'partial', 'waived'],
    default: 'pending'
  },
  lateFee: {
    type: Number,
    default: 0,
    min: 0
  },
  payments: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank transfer', 'cheque'],
      required: true
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true
    },
    receiptNo: {
      type: String,
      unique: true,
      sparse: true
    },
    remarks: String,
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountReason: String,
  remindersSent: [{
    sentDate: Date,
    type: String, // email, sms
    status: String
  }]
}, {
  timestamps: true
});

// Indexes
feeSchema.index({ studentId: 1, month: 1, year: 1 }, { unique: true });
feeSchema.index({ status: 1, dueDate: 1 });
feeSchema.index({ 'payments.transactionId': 1 });

// Calculate balance before saving
feeSchema.pre('save', function(next) {
  this.balance = this.totalAmount - this.paidAmount + this.lateFee - this.discount;
  
  if (this.balance <= 0) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  }
  
  // Check if overdue
  if (this.status !== 'paid' && new Date() > this.dueDate) {
    this.status = 'overdue';
  }
  
  next();
});

// Method to make a payment
feeSchema.methods.makePayment = async function(amount, method, transactionId, receivedBy) {
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }
  
  const payment = {
    amount,
    date: new Date(),
    method,
    transactionId,
    receiptNo: `RCP${Date.now()}${Math.floor(Math.random() * 1000)}`,
    receivedBy
  };
  
  this.payments.push(payment);
  this.paidAmount += amount;
  this.balance = this.totalAmount - this.paidAmount + this.lateFee - this.discount;
  
  if (this.balance <= 0) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  }
  
  await this.save();
  return payment;
};

// Method to calculate late fee
feeSchema.methods.calculateLateFee = function(ratePerDay = 100) {
  if (this.status === 'paid') return 0;
  
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  
  if (today > dueDate) {
    const daysLate = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
    this.lateFee = daysLate * ratePerDay;
    this.status = 'overdue';
  }
  
  return this.lateFee;
};

// Static method to get fee summary
feeSchema.statics.getFeeSummary = async function() {
  const summary = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        totalDue: { $sum: '$balance' }
      }
    }
  ]);
  return summary;
};
export const Fee = mongoose.model('Fee', feeSchema);