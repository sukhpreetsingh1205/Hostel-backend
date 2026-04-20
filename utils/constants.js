const Roles = Object.freeze({
  ADMIN: 'admin',
  WARDEN: 'warden',
  STUDENT: 'student',
});

const StudentStatus = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const ComplaintStatus = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

export { Roles, StudentStatus, ComplaintStatus };
