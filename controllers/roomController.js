import Room from '../models/Room.js';
import Student from '../models/Student.js';
import { AppError, ErrorTypes } from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';
import { sendEmail } from '../services/emailService.js';

const getStudentName = (student) => student.userId?.name || student.fullName || 'Student';
const getStudentEmail = (student) => student.userId?.email || student.email;
const getId = (value) => value?._id?.toString() || value?.toString() || null;

const sendRoomAllotmentEmail = async (student, room) => {
  const to = getStudentEmail(student);
  if (!to) return;

  try {
    await sendEmail({
      to,
      subject: `Room ${room.roomNumber} allotted`,
      html: `
        <h2>Room Allotment Confirmation</h2>
        <p>Hello ${getStudentName(student)},</p>
        <p>Your hostel room has been allotted successfully.</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
          <tr><td><strong>Room</strong></td><td>${room.roomNumber}</td></tr>
          <tr><td><strong>Block</strong></td><td>${room.block}</td></tr>
          <tr><td><strong>Floor</strong></td><td>${room.floor}</td></tr>
          <tr><td><strong>Type</strong></td><td>${room.type}</td></tr>
        </table>
        <p>Please contact the hostel office if any detail looks incorrect.</p>
      `,
      text: `Hello ${getStudentName(student)}, your hostel room has been allotted. Room: ${room.roomNumber}, Block: ${room.block}, Floor: ${room.floor}, Type: ${room.type}.`,
    });
  } catch (error) {
    console.error('Failed to send room allotment email:', error.message);
  }
};

// @desc    Get all rooms
// @route   GET /api/v1/rooms
// @access  Private/Admin,Warden,Student
const getAllRooms = catchAsync(async (req, res) => {
  const features = new APIFeatures(Room.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const { results: rooms, pagination } = await features.execute();
  
  res.json({
    success: true,
    count: rooms.length,
    pagination,
    data: rooms,
  });
});

// @desc    Get single room
// @route   GET /api/v1/rooms/:id
// @access  Private/Admin,Warden,Student
const getRoom = catchAsync(async (req, res) => {
  const room = await Room.findById(req.params.id)
    .populate({
      path: 'currentStudents',
      select: 'studentId rollNumber course year userId',
      populate: { path: 'userId', select: 'name email phone' },
    });
  
  if (!room) {
    throw new AppError('Room not found', ErrorTypes.NOT_FOUND);
  }
  
  res.json({
    success: true,
    data: room,
  });
});

// @desc    Create room
// @route   POST /api/v1/rooms
// @access  Private/Admin
const createRoom = catchAsync(async (req, res) => {
  const room = await Room.create(req.body);
  
  res.status(201).json({
    success: true,
    data: room,
  });
});

// @desc    Update room
// @route   PUT /api/v1/rooms/:id
// @access  Private/Admin
const updateRoom = catchAsync(async (req, res) => {
  let room = await Room.findById(req.params.id);
  
  if (!room) {
    throw new AppError('Room not found', ErrorTypes.NOT_FOUND);
  }
  
  room = await Room.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );
  
  res.json({
    success: true,
    data: room,
  });
});

// @desc    Delete room
// @route   DELETE /api/v1/rooms/:id
// @access  Private/Admin
const deleteRoom = catchAsync(async (req, res) => {
  const room = await Room.findById(req.params.id);
  
  if (!room) {
    throw new AppError('Room not found', ErrorTypes.NOT_FOUND);
  }
  
  // Check if room has students
  if (room.currentOccupancy > 0) {
    throw new AppError('Cannot delete room with occupied beds', ErrorTypes.BAD_REQUEST);
  }
  
  await room.deleteOne();
  
  res.json({
    success: true,
    message: 'Room deleted successfully',
  });
});

// @desc    Allot room to student
// @route   POST /api/v1/rooms/:roomId/allot/:studentId
// @access  Private/Admin
const allotRoom = catchAsync(async (req, res) => {
  const { roomId, studentId } = req.params;
  
  const room = await Room.findById(roomId);
  if (!room) {
    throw new AppError('Room not found', ErrorTypes.NOT_FOUND);
  }
  
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('Student not found', ErrorTypes.NOT_FOUND);
  }
  
  // Check if student already has a room
  if (student.roomId) {
    throw new AppError('Student already has a room allotted', ErrorTypes.BAD_REQUEST);
  }
  
  // Check if room has available beds
  if (!room.hasAvailableBeds()) {
    throw new AppError('Room is full or under maintenance', ErrorTypes.BAD_REQUEST);
  }
  
  // Allot room
  await room.allotRoom(studentId);
  student.roomId = roomId;
  await student.save();
  await sendRoomAllotmentEmail(student, room);
  
  res.json({
    success: true,
    message: 'Room allotted successfully',
    data: { room, student },
  });
});

// @desc    Vacate room
// @route   POST /api/v1/rooms/:roomId/vacate/:studentId
// @access  Private/Admin
const vacateRoom = catchAsync(async (req, res) => {
  const { roomId, studentId } = req.params;
  
  const room = await Room.findById(roomId);
  if (!room) {
    throw new AppError('Room not found', ErrorTypes.NOT_FOUND);
  }
  
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('Student not found', ErrorTypes.NOT_FOUND);
  }
  
  if (!student.roomId || getId(student.roomId) !== roomId) {
    throw new AppError('Student is not allotted to this room', ErrorTypes.BAD_REQUEST);
  }
  
  // Vacate room
  await room.vacateRoom(studentId);
  student.roomId = null;
  await student.save();
  
  res.json({
    success: true,
    message: 'Room vacated successfully',
    data: { room, student },
  });
});

// @desc    Get available rooms
// @route   GET /api/v1/rooms/available
// @access  Private/Admin,Warden
const getAvailableRooms = catchAsync(async (req, res) => {
  const rooms = await Room.find({
    status: 'available',
    
  }).sort({ block: 1, floor: 1, roomNumber: 1 });
  
  const availableRooms = rooms.filter(room => room.hasAvailableBeds());
  
  res.json({
    success: true,
    count: availableRooms.length,
    data: availableRooms,
  });
});

// @desc    Get room occupancy stats
// @route   GET /api/v1/rooms/stats/occupancy
// @access  Private/Admin
const getRoomStats = catchAsync(async (req, res) => {
  const totalRooms = await Room.countDocuments();
  const occupiedRooms = await Room.countDocuments({ status: 'full' });
  const availableRooms = await Room.countDocuments({ status: 'available' });
  const maintenanceRooms = await Room.countDocuments({ status: 'maintenance' });
  
  const occupancyByType = await Room.aggregate([
    {
      $group: {
        _id: '$type',
        totalRooms: { $sum: 1 },
        totalCapacity: { $sum: '$capacity' },
        currentOccupancy: { $sum: '$currentOccupancy' },
      },
    },
    {
      $project: {
        type: '$_id',
        totalRooms: 1,
        totalCapacity: 1,
        currentOccupancy: 1,
        occupancyPercentage: {
          $multiply: [
            { $divide: ['$currentOccupancy', '$totalCapacity'] },
            100
          ]
        },
      },
    },
  ]);
  
  res.json({
    success: true,
    data: {
      summary: {
        totalRooms,
        occupiedRooms,
        availableRooms,
        maintenanceRooms,
        occupancyRate: ((occupiedRooms / totalRooms) * 100).toFixed(2),
      },
      byType: occupancyByType,
    },
  });
});

// @desc    Get rooms by block
// @route   GET /api/v1/rooms/block/:block
// @access  Private/Admin,Warden
const getRoomsByBlock = catchAsync(async (req, res) => {
  const { block } = req.params;
  
  const rooms = await Room.find({ block: block.toUpperCase() })
    .sort({ floor: 1, roomNumber: 1 });
  
  // Group by floor
  const roomsByFloor = rooms.reduce((acc, room) => {
    if (!acc[room.floor]) {
      acc[room.floor] = [];
    }
    acc[room.floor].push(room);
    return acc;
  }, {});
  
  res.json({
    success: true,
    data: {
      block: block.toUpperCase(),
      floors: roomsByFloor,
    },
  });
});

export {
  getAllRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  allotRoom,
  vacateRoom,
  getAvailableRooms,
  getRoomStats,
  getRoomsByBlock,
};
