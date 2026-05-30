import User from '../models/User.js';
import Student from '../models/Student.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { generateToken, generateRefreshToken, verifyToken } from '../utils/generateToken.js';
import { sendEmail } from '../services/emailService.js';
import crypto from 'crypto';

// @desc    Register user (Admin only)
// @route   POST /api/v1/auth/register
// @access  Private/Admin
const register = catchAsync(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  console.log('Registering user with data:', { name, email, role, phone }); // Debug log
  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User already exists with this email', ErrorTypes.CONFLICT);
  }
  
  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role: role || 'student',
    phone,
  });
  
  // If student, create student profile
  if (user.role === 'student') {
    const {
      studentId,
      rollNumber,
      course,
      year,
      branch,
      semester,
      dob,
      parentName,
      parentPhone,
      address,
    } = req.body;

    const hasAllStudentFields = Boolean(
      studentId &&
        rollNumber &&
        course &&
        year &&
        branch &&
        semester &&
        dob &&
        parentName &&
        parentPhone &&
        address
    );

    if (!hasAllStudentFields) {
      throw new AppError(
        'Student profile details are required (studentId, rollNumber, course, year, branch, semester, dob, parentName, parentPhone, address).',
        ErrorTypes.BAD_REQUEST
      );
    }

    await Student.create({
      userId: user._id,
      studentId,
      rollNumber,
      course,
      year,
      branch,
      semester,
      dob,
      parentName,
      parentPhone,
      address,
      emergencyContact: parentPhone,
    });
  }
  
  // Generate tokens
  const token = generateToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id, user.role);
  
  // Set cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
      refreshToken,
    },
  });
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  
  // Check for user
  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password', ErrorTypes.UNAUTHORIZED);
  }
  
  // Update last login
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });
  
  // Generate tokens
  const token = generateToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id, user.role);
  
  // Set cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profilePic: user.profilePic,
      },
      token,
      refreshToken,
    },
  });
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
const logout = catchAsync(async (req, res) => {
  res.clearCookie('token');
  
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
const getMe = catchAsync(async (req, res) => {
  let userData = { ...req.user.toObject() };
  
  // If student, get additional student data
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    if (student) {
      userData.studentInfo = student;
    }
  }
  
  res.json({
    success: true,
    data: userData,
  });
});

// @desc    Update password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
const updatePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const user = await User.findById(req.user.id).select('+password');
  
  if (!(await user.matchPassword(currentPassword))) {
    throw new AppError('Current password is incorrect', ErrorTypes.UNAUTHORIZED);
  }
  
  user.password = newPassword;
  await user.save();
  
  const token = generateToken(user._id, user.role);
  
  res.json({
    success: true,
    message: 'Password updated successfully',
    token,
  });
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  
  const user = await User.findOne({ email });
  
  if (!user) {
    throw new AppError('No user found with this email', ErrorTypes.NOT_FOUND);
  }
  
  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  await user.save({ validateBeforeSave: false });
  
  // Create reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  
  const message = `
    <h1>Password Reset Request</h1>
    <p>You requested a password reset. Please click the link below to reset your password:</p>
    <a href="${resetUrl}" target="_blank">Reset Password</a>
    <p>This link is valid for 10 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;
  
  try {
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: message,
    });
    
    res.json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    
    throw new AppError('Email could not be sent', ErrorTypes.INTERNAL_SERVER_ERROR);
  }
});

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:resettoken
// @access  Public
const resetPassword = catchAsync(async (req, res) => {
  const rawToken = req.params.resettoken || req.params.token;

  if (!rawToken) {
    throw new AppError('Reset token is required', ErrorTypes.BAD_REQUEST);
  }

  const resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  
  if (!user) {
    throw new AppError('Invalid or expired token', ErrorTypes.BAD_REQUEST);
  }
  
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  
  const token = generateToken(user._id, user.role);
  
  res.json({
    success: true,
    message: 'Password reset successful',
    token,
  });
});

// @desc    Refresh token
// @route   POST /api/v1/auth/refreshtoken
// @access  Public
const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken: token } = req.body;
  
  if (!token) {
    throw new AppError('Refresh token required', ErrorTypes.BAD_REQUEST);
  }
  
  try {
    const decoded = verifyToken(token, true);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      throw new AppError('Invalid refresh token', ErrorTypes.UNAUTHORIZED);
    }
    
    const newToken = generateToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id, user.role);
    
    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    throw new AppError('Invalid refresh token', ErrorTypes.UNAUTHORIZED);
  }
});

export {
  register,
  login,
  logout,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
};
