/**
 * Branded HTML email templates for the Hostel Management System.
 * Each function returns an HTML string ready to use with sendEmail().
 */

const brandColor = '#6366f1';
const brandDark = '#1e1b4b';

const baseLayout = (content, preheader = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hostel Management</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f7; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, ${brandColor}, ${brandDark}); padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 24px; margin: 0; letter-spacing: 1px; }
    .header p { color: rgba(255,255,255,0.8); font-size: 13px; margin: 8px 0 0; }
    .body { padding: 32px 24px; color: #333; line-height: 1.7; }
    .body h2 { color: ${brandDark}; font-size: 20px; margin: 0 0 16px; }
    .body p { margin: 0 0 12px; font-size: 15px; }
    .btn { display: inline-block; padding: 12px 32px; background: ${brandColor}; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 16px 0; }
    .info-box { background: #f0f0ff; border-left: 4px solid ${brandColor}; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    .info-box p { margin: 4px 0; font-size: 14px; }
    .info-box strong { color: ${brandDark}; }
    .footer { background: #f9fafb; padding: 20px 24px; text-align: center; border-top: 1px solid #eee; }
    .footer p { color: #999; font-size: 12px; margin: 4px 0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    table.details { width: 100%; border-collapse: collapse; margin: 12px 0; }
    table.details td { padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
    table.details td:first-child { color: #666; width: 40%; }
    table.details td:last-child { font-weight: 600; color: #333; }
  </style>
</head>
<body>
  <span style="display:none;font-size:0;line-height:0;">${preheader}</span>
  <div style="padding: 24px 16px;">
    <div class="container">
      <div class="header">
        <h1>🏠 Hostel Management</h1>
        <p>Smart Hostel Administration System</p>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Hostel Management System</p>
        <p>This is an automated message. Please do not reply directly.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

// ────────────────────────────────────────────
// Welcome Email
// ────────────────────────────────────────────
export const welcomeEmail = ({ name, email, role, password }) => ({
  subject: '🎉 Welcome to Hostel Management System',
  html: baseLayout(`
    <h2>Welcome, ${name}!</h2>
    <p>Your account has been created successfully. Here are your login details:</p>
    <div class="info-box">
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Role:</strong> <span class="badge badge-info">${role}</span></p>
      ${password ? `<p><strong>Temporary Password:</strong> ${password}</p>` : ''}
    </div>
    <p>Please log in and change your password immediately for security.</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="btn">Login Now →</a>
    <p style="font-size:13px; color:#999;">If you did not request this account, please contact the hostel administrator.</p>
  `, `Welcome to Hostel Management, ${name}!`),
});

// ────────────────────────────────────────────
// Password Reset
// ────────────────────────────────────────────
export const passwordResetEmail = ({ name, resetUrl }) => ({
  subject: '🔐 Password Reset Request',
  html: baseLayout(`
    <h2>Password Reset</h2>
    <p>Hello ${name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn">Reset My Password →</a>
    </div>
    <div class="info-box">
      <p>⏰ This link is valid for <strong>10 minutes</strong> only.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
  `, 'Reset your Hostel Management password'),
});

// ────────────────────────────────────────────
// Fee Generated
// ────────────────────────────────────────────
export const feeGeneratedEmail = ({ name, month, year, totalAmount, dueDate, components = [] }) => ({
  subject: `💰 Hostel Fee Generated — ${month} ${year}`,
  html: baseLayout(`
    <h2>Fee Generated</h2>
    <p>Dear ${name},</p>
    <p>Your hostel fee for <strong>${month} ${year}</strong> has been generated.</p>
    <table class="details">
      ${components.map(c => `<tr><td>${c.name}</td><td>₹${c.amount.toLocaleString()}</td></tr>`).join('')}
      <tr style="border-top: 2px solid ${brandColor};">
        <td><strong>Total Amount</strong></td>
        <td style="color: ${brandColor}; font-size: 18px;"><strong>₹${totalAmount.toLocaleString()}</strong></td>
      </tr>
    </table>
    <div class="info-box">
      <p>📅 <strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
    <p>Please make the payment before the due date to avoid late fees.</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/fees" class="btn">Pay Now →</a>
  `, `Your hostel fee of ₹${totalAmount} is due`),
});

// ────────────────────────────────────────────
// Payment Confirmation
// ────────────────────────────────────────────
export const paymentReceivedEmail = ({ name, amount, month, year, receiptNo, transactionId, balance }) => ({
  subject: `✅ Payment Received — ₹${amount.toLocaleString()}`,
  html: baseLayout(`
    <h2>Payment Confirmed</h2>
    <p>Dear ${name},</p>
    <p>We have received your payment. Here's your receipt:</p>
    <table class="details">
      <tr><td>Receipt No</td><td>${receiptNo}</td></tr>
      <tr><td>Transaction ID</td><td>${transactionId || 'N/A'}</td></tr>
      <tr><td>Period</td><td>${month} ${year}</td></tr>
      <tr><td>Amount Paid</td><td style="color: #059669;">₹${amount.toLocaleString()}</td></tr>
      <tr><td>Remaining Balance</td><td>${balance > 0 ? `₹${balance.toLocaleString()}` : '<span class="badge badge-success">Fully Paid</span>'}</td></tr>
    </table>
    <p>Thank you for your timely payment! 🙏</p>
  `, `Payment of ₹${amount} received successfully`),
});

// ────────────────────────────────────────────
// Fee Reminder
// ────────────────────────────────────────────
export const feeReminderEmail = ({ name, month, year, balance, lateFee, totalDue }) => ({
  subject: `⚠️ Fee Overdue — ${month} ${year}`,
  html: baseLayout(`
    <h2 style="color: #dc2626;">Payment Overdue</h2>
    <p>Dear ${name},</p>
    <p>Your hostel fee for <strong>${month} ${year}</strong> is overdue. Please clear the dues immediately.</p>
    <table class="details">
      <tr><td>Outstanding Amount</td><td>₹${balance.toLocaleString()}</td></tr>
      <tr><td>Late Fee</td><td style="color: #dc2626;">₹${lateFee.toLocaleString()}</td></tr>
      <tr style="border-top: 2px solid #dc2626;">
        <td><strong>Total Due</strong></td>
        <td style="color: #dc2626; font-size: 18px;"><strong>₹${totalDue.toLocaleString()}</strong></td>
      </tr>
    </table>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/fees" class="btn" style="background: #dc2626;">Pay Now →</a>
    <p style="font-size: 13px; color: #999;">Continued non-payment may result in administrative action.</p>
  `, `Your hostel fee of ₹${totalDue} is overdue`),
});

// ────────────────────────────────────────────
// Leave Request Notification (to warden/admin)
// ────────────────────────────────────────────
export const leaveRequestEmail = ({ studentName, rollNumber, leaveId, fromDate, toDate, reason, destination }) => ({
  subject: `📋 New Leave Request — ${leaveId}`,
  html: baseLayout(`
    <h2>New Leave Request</h2>
    <p>A student has submitted a leave request for your review:</p>
    <table class="details">
      <tr><td>Leave ID</td><td>${leaveId}</td></tr>
      <tr><td>Student</td><td>${studentName}</td></tr>
      <tr><td>Roll Number</td><td>${rollNumber}</td></tr>
      <tr><td>From</td><td>${new Date(fromDate).toLocaleDateString('en-IN')}</td></tr>
      <tr><td>To</td><td>${new Date(toDate).toLocaleDateString('en-IN')}</td></tr>
      <tr><td>Reason</td><td>${reason}</td></tr>
      <tr><td>Destination</td><td>${destination}</td></tr>
    </table>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/leaves" class="btn">Review Request →</a>
  `, `Leave request from ${studentName}`),
});

// ────────────────────────────────────────────
// Leave Status Update (to student)
// ────────────────────────────────────────────
export const leaveStatusEmail = ({ name, leaveId, status, fromDate, toDate, remarks }) => {
  const isApproved = status === 'approved';
  return {
    subject: `${isApproved ? '✅' : '❌'} Leave ${isApproved ? 'Approved' : 'Rejected'} — ${leaveId}`,
    html: baseLayout(`
      <h2>Leave Request ${isApproved ? 'Approved' : 'Rejected'}</h2>
      <p>Dear ${name},</p>
      <p>Your leave request has been <span class="badge ${isApproved ? 'badge-success' : 'badge-danger'}">${status.toUpperCase()}</span></p>
      <table class="details">
        <tr><td>Leave ID</td><td>${leaveId}</td></tr>
        <tr><td>Period</td><td>${new Date(fromDate).toLocaleDateString('en-IN')} — ${new Date(toDate).toLocaleDateString('en-IN')}</td></tr>
        ${remarks ? `<tr><td>Remarks</td><td>${remarks}</td></tr>` : ''}
      </table>
      ${isApproved ? '<p>Have a safe trip! 🚗</p>' : '<p>Please contact the warden for more details.</p>'}
    `, `Your leave request has been ${status}`),
  };
};

// ────────────────────────────────────────────
// Complaint Notification (to admin)
// ────────────────────────────────────────────
export const complaintNotificationEmail = ({ studentName, complaintId, category, title, priority }) => ({
  subject: `🔔 New Complaint — ${complaintId}`,
  html: baseLayout(`
    <h2>New Complaint Received</h2>
    <table class="details">
      <tr><td>Complaint ID</td><td>${complaintId}</td></tr>
      <tr><td>Student</td><td>${studentName}</td></tr>
      <tr><td>Category</td><td>${category}</td></tr>
      <tr><td>Title</td><td>${title}</td></tr>
      <tr><td>Priority</td><td><span class="badge ${priority === 'emergency' ? 'badge-danger' : priority === 'high' ? 'badge-warning' : 'badge-info'}">${priority.toUpperCase()}</span></td></tr>
    </table>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/complaints" class="btn">Review Complaint →</a>
  `, `New ${priority} complaint: ${title}`),
});

// ────────────────────────────────────────────
// Complaint Resolved (to student)
// ────────────────────────────────────────────
export const complaintResolvedEmail = ({ name, complaintId, resolution }) => ({
  subject: `✅ Complaint Resolved — ${complaintId}`,
  html: baseLayout(`
    <h2>Complaint Resolved</h2>
    <p>Dear ${name},</p>
    <p>Your complaint <strong>${complaintId}</strong> has been resolved.</p>
    <div class="info-box">
      <p><strong>Resolution:</strong> ${resolution}</p>
    </div>
    <p>Please log in to rate our service and provide feedback.</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/complaints" class="btn">Rate Service →</a>
  `, `Your complaint ${complaintId} has been resolved`),
});

// ────────────────────────────────────────────
// Urgent Notice
// ────────────────────────────────────────────
export const urgentNoticeEmail = ({ title, content, postedBy, date }) => ({
  subject: `🚨 URGENT: ${title}`,
  html: baseLayout(`
    <div style="border-left: 4px solid #dc2626; padding-left: 16px;">
      <h2 style="color: #dc2626;">⚠️ Important Notice</h2>
      <h3>${title}</h3>
      <p>${content}</p>
      <p style="font-size: 13px; color: #666;">Posted by: ${postedBy} • ${new Date(date).toLocaleString('en-IN')}</p>
    </div>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/notices" class="btn" style="background: #dc2626;">View Notices →</a>
  `, `Urgent notice: ${title}`),
});
