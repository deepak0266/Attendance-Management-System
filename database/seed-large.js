const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const moment = require('moment');

mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 60000);

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const config = {
  mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system'
};

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const DEPARTMENTS = [
  'Management', 'Human Resources', 'Engineering', 'Sales',
  'Marketing', 'Finance', 'Operations', 'Customer Support',
  'IT', 'Administration', 'Product', 'Quality Assurance'
];

const FIRST_NAMES = [
  'Aarav', 'Vihaan', 'Vivaan', 'Ananya', 'Diya', 'Advik', 'Kabir', 'Anaya', 'Aaradhya', 'Reyansh',
  'Sai', 'Arjun', 'Ishaan', 'Rudra', 'Sanya', 'Aryan', 'Ishita', 'Myra', 'Shaurya', 'Yash',
  'Raj', 'Priya', 'Rahul', 'Neha', 'Vikram', 'Pooja', 'Amit', 'Kavita', 'Suresh', 'Anita',
  'Deepak', 'Sunita', 'Ramesh', 'Geeta', 'Mahesh', 'Seema', 'Naresh', 'Kiran', 'Manoj', 'Asha',
  'Ajay', 'Divya', 'Vijay', 'Shweta', 'Sanjay', 'Ritu', 'Rajesh', 'Meena', 'Mukesh', 'Rekha',
  'Nitin', 'Preeti', 'Gaurav', 'Swati', 'Hemant', 'Lata', 'Pankaj', 'Jyoti', 'Abhishek', 'Smita',
  'Rohit', 'Nisha', 'Tarun', 'Pallavi', 'Varun', 'Arti', 'Akash', 'Bhavna', 'Kunal', 'Chhaya',
  'Sachin', 'Garima', 'Tushar', 'Ruchika', 'Manish', 'Shruti', 'Ankur', 'Tanvi', 'Harsh', 'Megha',
  'Bharat', 'Sneha', 'Pranav', 'Komal', 'Mohit', 'Sapna', 'Chirag', 'Payal', 'Dhruv', 'Nikita',
  'Siddharth', 'Kriti', 'Aditya', 'Anu', 'Karthik', 'Madhuri', 'Ravi', 'Amisha', 'Dev', 'Tara'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Kumar', 'Singh', 'Patel', 'Reddy', 'Rao', 'Joshi', 'Nair',
  'Menon', 'Iyer', 'Malhotra', 'Kapoor', 'Khanna', 'Mehta', 'Chopra', 'Bhat', 'Desai', 'Chauhan',
  'Yadav', 'Jha', 'Mishra', 'Pandey', 'Tiwari', 'Dubey', 'Saxena', 'Srivastava', 'Agarwal', 'Jain',
  'Thakur', 'Pillai', 'Banerjee', 'Mukherjee', 'Das', 'Sen', 'Roy', 'Dutta', 'Bose', 'Ghosh'
];

const DESIGNATIONS = {
  SUPER_ADMIN: ['Chief Executive Officer', 'Chief Operating Officer'],
  HEAD_HR: ['VP - Human Resources'],
  HR: ['HR Manager', 'Senior HR Executive'],
  MANAGER: ['Engineering Manager', 'Sales Manager', 'Marketing Manager', 'Operations Manager', 'IT Manager', 'Finance Manager'],
  EMPLOYEE: [
    'Software Engineer', 'Senior Software Engineer', 'Data Analyst', 'QA Engineer',
    'Business Analyst', 'UI/UX Designer', 'DevOps Engineer', 'Product Analyst',
    'Sales Executive', 'Marketing Executive', 'Accountant', 'Support Executive',
    'System Administrator', 'Content Writer', 'Frontend Developer', 'Backend Developer',
    'Full Stack Developer', 'Mobile Developer'
  ]
};

const TEAM_DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Operations', 'IT', 'Finance'];

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// ═══════════════════════════════════════════════════════════════════
// SHIFTS
// ═══════════════════════════════════════════════════════════════════

const shifts = [
  {
    name: 'General Shift',
    code: 'GEN-001',
    type: 'Fixed',
    description: 'Standard 9-6 shift for most departments',
    start_time: '09:00',
    end_time: '18:00',
    grace_period_minutes: 15,
    late_threshold_minutes: 30,
    half_day_threshold_hours: 4,
    break_duration_minutes: 60,
    break_is_paid: false,
    working_days: [1, 2, 3, 4, 5],
    applicable_departments: ['Engineering', 'Marketing', 'Sales', 'IT', 'Administration', 'Product', 'Quality Assurance'],
    is_active: true,
    version: 1,
    effective_from: '2024-01-01'
  },
  {
    name: 'Night Shift',
    code: 'NIGHT-001',
    type: 'Night',
    description: 'Night shift for operations and customer support',
    start_time: '22:00',
    end_time: '06:00',
    grace_period_minutes: 15,
    late_threshold_minutes: 30,
    half_day_threshold_hours: 4,
    break_duration_minutes: 45,
    break_is_paid: true,
    working_days: [1, 2, 3, 4, 5],
    night_shift_config: { cross_midnight: true, night_shift_allowance: 200, next_day_punch_out: true },
    applicable_departments: ['Operations', 'Customer Support'],
    is_active: true,
    version: 1,
    effective_from: '2024-01-01'
  },
  {
    name: 'Flexible Shift',
    code: 'FLEX-001',
    type: 'Flexible',
    description: 'Flexible hours for management and HR',
    start_time: '08:00',
    end_time: '20:00',
    grace_period_minutes: 30,
    late_threshold_minutes: 60,
    half_day_threshold_hours: 4,
    break_duration_minutes: 60,
    break_is_paid: false,
    working_days: [1, 2, 3, 4, 5],
    flexible_hours: { enabled: true, core_start_time: '10:00', core_end_time: '16:00', min_hours_per_day: 6, max_hours_per_day: 10 },
    applicable_departments: ['Management', 'Human Resources', 'Finance'],
    is_active: true,
    version: 1,
    effective_from: '2024-01-01'
  }
];

// ═══════════════════════════════════════════════════════════════════
// POLICIES
// ═══════════════════════════════════════════════════════════════════

const policies = [
  {
    name: 'Default Attendance Policy',
    code: 'POL-001',
    description: 'Standard attendance policy applicable to all employees',
    version: 1,
    effective_from: '2024-01-01',
    is_active: true,
    is_default: true,
    priority: 1,
    rules: {
      attendance: {
        auto_punch_out: { enabled: true, after_shift_end_hours: 2 },
        min_work_hours_for_present: 4,
        allow_weekend_punch: true,
        allow_holiday_punch: true,
        require_location_for_punch: true,
        location_accuracy_threshold_meters: 50
      },
      overtime: {
        enabled: true,
        rate_multiplier: 1.5,
        threshold_hours: 8,
        double_rate_after_hours: 12,
        approval_required: true,
        min_overtime_minutes: 15,
        max_overtime_hours_per_day: 4,
        max_overtime_hours_per_week: 20,
        max_overtime_hours_per_month: 50
      },
      late_arrival: {
        grace_minutes: 15,
        deduction_per_minute: 0.5,
        max_deduction_minutes: 60,
        allowed_instances_per_month: 3,
        escalate_after_instances: 5
      },
      early_exit: {
        grace_minutes: 15,
        penalty_per_minute: 1,
        allowed_instances_per_month: 3
      },
      half_day: { threshold_hours_worked: 4, requires_approval: false, auto_apply: true },
      absence: { auto_mark_after_hours: 2, requires_justification: true, consecutive_absences_threshold: 3 },
      breaks: { auto_deduct_unpaid_after_minutes: 60, max_break_minutes_per_day: 120, mandatory_break_minutes: 30 },
      regularization: { allowed_days_back: 7, require_proof_for_old_requests: true, max_requests_per_month: 5 },
      leave: {
        casual_leave_days: 12, sick_leave_days: 12, earned_leave_days: 15,
        maternity_leave_days: 180, paternity_leave_days: 15, bereavement_leave_days: 5
      },
      payroll: { lock_period_days: 5, working_days_per_month: 22, daily_work_hours: 8 }
    }
  }
];

// ═══════════════════════════════════════════════════════════════════
// GEO-FENCES
// ═══════════════════════════════════════════════════════════════════

const geoFences = [
  {
    name: 'Main Office - Current Location',
    code: 'OFFICE-DEL',
    description: 'Current company headquarters',
    type: 'circle',
    center: { lat: 28.3974083, lng: 77.0415066 },
    radius_meters: 100,
    buffer_meters: 20,
    validation_rules: { strict_mode: true, accuracy_threshold_meters: 50, allow_manual_override: true, max_distance_for_approval_meters: 500 },
    schedule: { always_active: true, active_days: [1, 2, 3, 4, 5] },
    is_active: true,
    is_default: true,
    priority: 10,
    version: 1
  },
  {
    name: 'Branch Office - Mumbai',
    code: 'OFFICE-BOM',
    description: 'Mumbai branch office',
    type: 'circle',
    center: { lat: 19.0760, lng: 72.8777 },
    radius_meters: 80,
    buffer_meters: 15,
    validation_rules: { strict_mode: true, accuracy_threshold_meters: 50, allow_manual_override: true, max_distance_for_approval_meters: 400 },
    schedule: { always_active: true, active_days: [1, 2, 3, 4, 5] },
    applicable_departments: ['Sales', 'Marketing', 'Finance'],
    is_active: true,
    priority: 5,
    version: 1
  },
  {
    name: 'Tech Park - Bangalore',
    code: 'OFFICE-BLR',
    description: 'Bangalore tech campus',
    type: 'circle',
    center: { lat: 12.9716, lng: 77.5946 },
    radius_meters: 120,
    buffer_meters: 25,
    validation_rules: { strict_mode: true, accuracy_threshold_meters: 50, allow_manual_override: true, max_distance_for_approval_meters: 500 },
    schedule: { always_active: true, active_days: [1, 2, 3, 4, 5] },
    applicable_departments: ['Engineering', 'IT', 'Product'],
    is_active: true,
    priority: 8,
    version: 1
  }
];

// ═══════════════════════════════════════════════════════════════════
// ROLES (Custom Roles for the Roles collection)
// ═══════════════════════════════════════════════════════════════════

const customRoles = [
  {
    name: 'SUPER_ADMIN',
    description: 'System-level super administrator with unrestricted access to all features',
    permissions: [
      'override_attendance', 'upload_employees', 'lock_payroll', 'define_policies',
      'view_all_data', 'handle_escalations', 'approve_requests', 'edit_punch_times',
      'view_reports', 'manage_users', 'manage_shifts', 'manage_geofence', 'view_sensitive_data'
    ],
    is_system: true
  },
  {
    name: 'HR',
    description: 'Human Resources manager with access to employee data, attendance overrides, and policy management',
    permissions: [
      'override_attendance', 'upload_employees', 'lock_payroll', 'define_policies',
      'view_all_data', 'handle_escalations', 'approve_requests', 'edit_punch_times',
      'view_reports', 'manage_users', 'manage_shifts', 'manage_geofence'
    ],
    is_system: true
  },
  {
    name: 'HEAD_HR',
    description: 'Vice President of Human Resources. Manages all HR personnel and has elevated access across all teams and departments',
    permissions: [
      'override_attendance', 'upload_employees', 'lock_payroll', 'define_policies',
      'view_all_data', 'handle_escalations', 'approve_requests', 'edit_punch_times',
      'view_reports', 'manage_users', 'manage_shifts', 'manage_geofence', 'view_sensitive_data'
    ],
    is_system: false
  },
  {
    name: 'MANAGER',
    description: 'Team manager with access to team attendance data and approval capabilities',
    permissions: [
      'view_team_data', 'approve_requests', 'view_reports', 'handle_escalations'
    ],
    is_system: true
  },
  {
    name: 'EMPLOYEE',
    description: 'Standard employee with basic self-service attendance capabilities',
    permissions: [
      'view_self_data', 'submit_requests'
    ],
    is_system: true
  },
  {
    name: 'DIRECTOR',
    description: 'Director level role with broad organizational visibility and approval authority',
    permissions: [
      'view_all_data', 'approve_requests', 'view_reports', 'handle_escalations', 'view_sensitive_data'
    ],
    is_system: false
  },
  {
    name: 'VP',
    description: 'Vice President with executive-level access to all organizational data and strategic reports',
    permissions: [
      'view_all_data', 'approve_requests', 'view_reports', 'handle_escalations',
      'define_policies', 'view_sensitive_data'
    ],
    is_system: false
  }
];

// ═══════════════════════════════════════════════════════════════════
// USER GENERATION (Exact Hierarchy)
// ═══════════════════════════════════════════════════════════════════

function generateUsers() {
  const users = [];
  const usedEmails = new Set();
  const usedPhones = new Set();
  const usedEmployeeIds = new Set();

  const passwords = {
    superadmin: 'SuperAdmin@123',
    hr: 'HrAdmin@123',
    manager: 'Manager@123',
    employee: 'Employee@123'
  };

  function getUniqueEmail(baseEmail) {
    let email = baseEmail;
    let counter = 1;
    while (usedEmails.has(email)) {
      email = baseEmail.replace('@', `${counter}@`);
      counter++;
    }
    usedEmails.add(email);
    return email;
  }

  function getUniquePhone() {
    let phone;
    do {
      phone = `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
    } while (usedPhones.has(phone));
    usedPhones.add(phone);
    return phone;
  }

  function getUniqueEmployeeId(prefix, index) {
    let id = `${prefix}${String(index).padStart(3, '0')}`;
    let counter = 1;
    while (usedEmployeeIds.has(id)) {
      id = `${prefix}${String(index + counter).padStart(3, '0')}`;
      counter++;
    }
    usedEmployeeIds.add(id);
    return id;
  }

  // ── 2 SUPER ADMINS ──
  const superAdminNames = [
    { full_name: 'Rajendra Prasad', gender: 'MALE' },
    { full_name: 'Meera Krishnan', gender: 'FEMALE' }
  ];
  for (let i = 0; i < 2; i++) {
    users.push({
      employee_id: getUniqueEmployeeId('SA', i + 1),
      email: getUniqueEmail(`superadmin${i + 1}@company.com`),
      phone: getUniquePhone(),
      full_name: superAdminNames[i].full_name,
      department: 'Management',
      designation: DESIGNATIONS.SUPER_ADMIN[i],
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      password: passwords.superadmin,
      joining_date: randomDate(new Date('2023-01-01'), new Date('2023-06-01')),
      gender: superAdminNames[i].gender,
      date_of_birth: randomDate(new Date('1975-01-01'), new Date('1985-12-31')),
      _hierarchy: 'SUPER_ADMIN'
    });
  }

  // ── 1 HEAD HR ──
  users.push({
    employee_id: getUniqueEmployeeId('HR', 1),
    email: getUniqueEmail('headhr@company.com'),
    phone: getUniquePhone(),
    full_name: 'Priya Sharma',
    department: 'Human Resources',
    designation: DESIGNATIONS.HEAD_HR[0],
    role: 'HEAD_HR',
    status: 'ACTIVE',
    password: passwords.hr,
    joining_date: randomDate(new Date('2023-01-01'), new Date('2023-06-01')),
    gender: 'FEMALE',
    date_of_birth: randomDate(new Date('1982-01-01'), new Date('1990-12-31')),
    _hierarchy: 'HEAD_HR'
  });

  // ── 2 HRs ──
  const hrDetails = [
    { full_name: 'Anjali Gupta', gender: 'FEMALE', email: 'hr1@company.com' },
    { full_name: 'Rahul Verma', gender: 'MALE', email: 'hr2@company.com' }
  ];
  for (let i = 0; i < 2; i++) {
    users.push({
      employee_id: getUniqueEmployeeId('HR', i + 2),
      email: getUniqueEmail(hrDetails[i].email),
      phone: getUniquePhone(),
      full_name: hrDetails[i].full_name,
      department: 'Human Resources',
      designation: DESIGNATIONS.HR[i],
      role: 'HR',
      status: 'ACTIVE',
      password: passwords.hr,
      joining_date: randomDate(new Date('2023-03-01'), new Date('2023-09-01')),
      gender: hrDetails[i].gender,
      date_of_birth: randomDate(new Date('1985-01-01'), new Date('1995-12-31')),
      _hierarchy: 'HR',
      _hrIndex: i // 0 = HR1 (manages Mgr 1,2,3), 1 = HR2 (manages Mgr 4,5,6)
    });
  }

  // ── 6 MANAGERS ──
  const managerDetails = [
    { full_name: 'Vikram Singh', gender: 'MALE', dept: 'Engineering' },
    { full_name: 'Neha Kumar', gender: 'FEMALE', dept: 'Sales' },
    { full_name: 'Rajesh Patel', gender: 'MALE', dept: 'Marketing' },
    { full_name: 'Sunita Sharma', gender: 'FEMALE', dept: 'Operations' },
    { full_name: 'Amitabh Verma', gender: 'MALE', dept: 'IT' },
    { full_name: 'Kavya Gupta', gender: 'FEMALE', dept: 'Finance' }
  ];
  for (let i = 0; i < 6; i++) {
    users.push({
      employee_id: getUniqueEmployeeId('MGR', i + 1),
      email: getUniqueEmail(`manager${i + 1}@company.com`),
      phone: getUniquePhone(),
      full_name: managerDetails[i].full_name,
      department: managerDetails[i].dept,
      designation: DESIGNATIONS.MANAGER[i],
      role: 'MANAGER',
      status: 'ACTIVE',
      password: passwords.manager,
      joining_date: randomDate(new Date('2023-06-01'), new Date('2024-01-01')),
      gender: managerDetails[i].gender,
      date_of_birth: randomDate(new Date('1988-01-01'), new Date('1998-12-31')),
      _hierarchy: 'MANAGER',
      _mgrIndex: i // 0-2 under HR1, 3-5 under HR2
    });
  }

  // ── 100 EMPLOYEES ──
  for (let i = 1; i <= 100; i++) {
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i - 1) % LAST_NAMES.length];
    const teamIndex = (i - 1) % 6; // Distributes evenly across 6 teams
    const department = TEAM_DEPARTMENTS[teamIndex];

    users.push({
      employee_id: getUniqueEmployeeId('EMP', i),
      email: getUniqueEmail(`${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@company.com`),
      phone: getUniquePhone(),
      full_name: `${firstName} ${lastName}`,
      department: department,
      designation: randomItem(DESIGNATIONS.EMPLOYEE),
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      password: passwords.employee,
      joining_date: randomDate(new Date('2023-06-01'), new Date('2025-06-01')),
      gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
      date_of_birth: randomDate(new Date('1990-01-01'), new Date('2002-12-31')),
      _hierarchy: 'EMPLOYEE',
      _teamIndex: teamIndex // 0=Team1(Mgr1), 1=Team2(Mgr2), ..., 5=Team6(Mgr6)
    });
  }

  console.log(`   Generated ${users.length} users (2 SA + 1 Head HR + 2 HR + 6 MGR + 100 EMP = 111)`);
  return users;
}

// ═══════════════════════════════════════════════════════════════════
// ATTENDANCE LOG GENERATION (60 days)
// ═══════════════════════════════════════════════════════════════════

function generateAttendanceLogs(allUsers, insertedShifts, insertedPolicies) {
  const logs = [];
  const generalShift = insertedShifts.find(s => s.code === 'GEN-001');
  const defaultPolicy = insertedPolicies.find(p => p.is_default);

  const employees = allUsers.filter(u => u.role === 'EMPLOYEE');

  for (let day = 1; day <= 60; day++) {
    const date = moment().subtract(day, 'days').startOf('day').toDate();
    const dayOfWeek = moment(date).day();

    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    employees.forEach((employee) => {
      if (Math.random() > 0.95) return; // 5% absent rate

      const punchInHour = 8 + Math.floor(Math.random() * 2); // 8 or 9
      const punchInMinute = Math.floor(Math.random() * 45);
      const punchOutHour = 17 + Math.floor(Math.random() * 2); // 17 or 18
      const punchOutMinute = Math.floor(Math.random() * 59);

      const punchInTime = moment(date).set({ hour: punchInHour, minute: punchInMinute, second: 0 });
      const punchOutTime = moment(date).set({ hour: punchOutHour, minute: punchOutMinute, second: 0 });

      const isLate = punchInHour > 9 || (punchInHour === 9 && punchInMinute > 15);
      const totalWorkMinutes = punchOutTime.diff(punchInTime, 'minutes');
      const netWorkMinutes = totalWorkMinutes - 60; // minus lunch break
      const overtimeMinutes = Math.max(0, netWorkMinutes - 480);
      const lateByMinutes = isLate ? (punchInHour - 9) * 60 + punchInMinute - 15 : 0;

      const baseLat = 28.3974083;
      const baseLng = 77.0415066;

      logs.push({
        user_id: employee._id,
        date: date,
        shift_id: generalShift._id,
        policy_version_id: defaultPolicy._id,
        punch_in: {
          timestamp: punchInTime.toDate(),
          server_timestamp: punchInTime.toDate(),
          client_timestamp: punchInTime.toDate(),
          location: {
            latitude: baseLat + (Math.random() - 0.5) * 0.001,
            longitude: baseLng + (Math.random() - 0.5) * 0.001,
            accuracy: 15 + Math.random() * 25
          },
          ip: `192.168.${randomInt(1, 10)}.${randomInt(1, 254)}`,
          source: 'WEB',
          is_valid: true,
          validation_details: { location_valid: true, accuracy_valid: true, time_valid: true }
        },
        punch_out: {
          timestamp: punchOutTime.toDate(),
          server_timestamp: punchOutTime.toDate(),
          client_timestamp: punchOutTime.toDate(),
          location: {
            latitude: baseLat + (Math.random() - 0.5) * 0.001,
            longitude: baseLng + (Math.random() - 0.5) * 0.001,
            accuracy: 15 + Math.random() * 25
          },
          ip: `192.168.${randomInt(1, 10)}.${randomInt(1, 254)}`,
          source: 'WEB',
          is_valid: true,
          validation_details: { location_valid: true, accuracy_valid: true, time_valid: true }
        },
        computed_data: {
          total_work_minutes: totalWorkMinutes,
          total_break_minutes: 60,
          net_work_minutes: netWorkMinutes,
          late_by_minutes: Math.max(0, lateByMinutes),
          early_exit_by_minutes: 0,
          overtime_minutes: overtimeMinutes,
          overtime_rate_applied: overtimeMinutes > 0 ? 1.5 : 1.0
        },
        status: isLate ? 'LATE' : 'PRESENT',
        is_locked: false,
        requires_approval: false,
        approval_status: 'APPROVED',
        breaks: [],
        created_at: new Date(),
        updated_at: new Date()
      });
    });
  }

  return logs;
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM ACTION LOG GENERATION (500 logs)
// ═══════════════════════════════════════════════════════════════════

function generateSystemLogs(userMap) {
  const logs = [];
  const actions = [
    'USER_CREATE', 'USER_UPDATE', 'SHIFT_CHANGE', 'POLICY_CHANGE',
    'GEOFENCE_CHANGE', 'LOGIN', 'LOGOUT', 'ATTENDANCE_OVERRIDE',
    'REPORT_EXPORT', 'PERMISSION_CHANGE', 'DEVICE_APPROVED', 'DEVICE_REJECTED'
  ];

  for (let i = 0; i < 500; i++) {
    const isSuperAdminAction = i % 5 === 0;
    const actorId = isSuperAdminAction
      ? randomItem(userMap.superadmins)._id
      : randomItem([...userMap.hr, userMap.headHr])._id;
    const action = randomItem(actions);

    const targetPool = [...userMap.employees, ...userMap.managers];

    logs.push({
      actor_user_id: actorId,
      actor_role: isSuperAdminAction ? 'SUPER_ADMIN' : 'HR',
      action_type: action,
      target_user_id: targetPool.length > 0 ? randomItem(targetPool)._id : actorId,
      target_entity_type: action.includes('USER') ? 'User' : action.includes('DEVICE') ? 'Device' : 'Attendance',
      reason: `${action.replace(/_/g, ' ').toLowerCase()} performed by admin`,
      ip_address: `192.168.${randomInt(1, 255)}.${randomInt(1, 255)}`,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      is_super_admin_action: isSuperAdminAction,
      is_read_only: true,
      timestamp: randomDate(new Date('2024-06-01'), new Date())
    });
  }

  return logs;
}

// ═══════════════════════════════════════════════════════════════════
// REGULARIZATION / APPROVAL REQUEST GENERATION (100 requests)
// ═══════════════════════════════════════════════════════════════════

function generateApprovalRequests(userMap) {
  const requests = [];
  const types = ['MISSED_PUNCH', 'INCORRECT_TIME', 'INVALID_LOCATION', 'OVERTIME'];
  const statuses = ['PENDING_MANAGER', 'APPROVED', 'REJECTED', 'ESCALATED'];

  for (let i = 0; i < 100; i++) {
    const employee = randomItem(userMap.employees);
    // Find the employee's manager from the map
    const manager = userMap.managers.find(m =>
      m._id.toString() === employee.manager_id?.toString()
    ) || randomItem(userMap.managers);

    const status = randomItem(statuses);

    requests.push({
      user_id: employee._id,
      request_type: randomItem(types),
      date: randomDate(new Date('2024-06-01'), new Date()),
      reason: `Requesting regularization due to ${randomItem([
        'forgot to punch out',
        'system was down',
        'was at client site',
        'network issue at office',
        'biometric not working',
        'mobile battery died',
        'was in a meeting that ran overtime',
        'had to rush for an emergency'
      ])}`,
      status: status,
      manager_id: manager._id,
      priority: randomItem(['LOW', 'MEDIUM', 'HIGH']),
      ...(status === 'APPROVED' ? {
        approved_by: manager._id,
        approved_at: new Date(),
        manager_remarks: 'Approved after verification'
      } : {}),
      ...(status === 'REJECTED' ? {
        rejected_by: manager._id,
        rejected_at: new Date(),
        manager_remarks: 'Insufficient justification'
      } : {}),
      created_at: randomDate(new Date('2024-06-01'), new Date()),
      updated_at: new Date()
    });
  }

  return requests;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════

async function seedLargeDatabase() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Attendance System - COMPREHENSIVE DATABASE SEEDER v2.0   ║');
  console.log('║   2 SA | 1 Head HR | 2 HR | 6 MGR | 100 EMP = 111 Users   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(config.mongoURI, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 120000,
      connectTimeoutMS: 60000,
      maxPoolSize: 20
    });
    console.log('✅ Connected to MongoDB Atlas!\n');

    const db = mongoose.connection.db;

    // ─────────────────────────────────────────────────────────────
    // STEP 1: CLEAR ALL EXISTING DATA
    // ─────────────────────────────────────────────────────────────
    console.log('🧹 Clearing ALL existing data...');
    const collectionsToClear = [
      'users', 'shifts', 'policies', 'devices', 'roles',
      'attendancelogs', 'systemactionlogs', 'regularizationrequests',
      'notifications', 'sessions'
    ];
    for (const col of collectionsToClear) {
      try {
        await db.collection(col).deleteMany({});
        console.log(`   ✓ Cleared: ${col}`);
      } catch (e) {
        console.log(`   ⚠ Collection ${col} may not exist yet, skipping...`);
      }
    }
    console.log('✅ All data cleared\n');

    // ─────────────────────────────────────────────────────────────
    // STEP 2: CREATE ROLES
    // ─────────────────────────────────────────────────────────────
    console.log('📝 Creating roles...');
    const insertedRoles = [];
    for (const role of customRoles) {
      const result = await db.collection('roles').insertOne({
        ...role,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      insertedRoles.push({ _id: result.insertedId, ...role });
    }
    console.log(`✅ Roles created: ${insertedRoles.length} (${insertedRoles.map(r => r.name).join(', ')})\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: CREATE USERS WITH HIERARCHY
    // ─────────────────────────────────────────────────────────────
    console.log('📝 Generating users...');
    const usersData = generateUsers();

    const userMap = {
      superadmins: [],
      headHr: null,
      hr: [],
      managers: [],
      employees: []
    };

    // Hash all passwords first
    console.log('   🔐 Hashing passwords (this takes a moment)...');
    const passwordHashes = {};
    passwordHashes.superadmin = await hashPassword('SuperAdmin@123');
    passwordHashes.hr = await hashPassword('HrAdmin@123');
    passwordHashes.manager = await hashPassword('Manager@123');
    passwordHashes.employee = await hashPassword('Employee@123');
    console.log('   ✓ Passwords hashed');

    // Insert all users
    console.log('   📥 Inserting users into database...');
    for (const userData of usersData) {
      const { password, _hierarchy, _hrIndex, _mgrIndex, _teamIndex, ...userWithoutMeta } = userData;

      let pwHash;
      if (_hierarchy === 'SUPER_ADMIN') pwHash = passwordHashes.superadmin;
      else if (_hierarchy === 'HEAD_HR' || _hierarchy === 'HR') pwHash = passwordHashes.hr;
      else if (_hierarchy === 'MANAGER') pwHash = passwordHashes.manager;
      else pwHash = passwordHashes.employee;

      const user = {
        ...userWithoutMeta,
        password_hash: pwHash,
        joining_date: new Date(userData.joining_date),
        date_of_birth: new Date(userData.date_of_birth),
        email_verified: true,
        phone_verified: true,
        failed_login_attempts: 0,
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: { email: true, sms: false, push: true },
          timezone: 'Asia/Kolkata'
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await db.collection('users').insertOne(user);
      const insertedUser = { _id: result.insertedId, ...user, _hierarchy, _hrIndex, _mgrIndex, _teamIndex };

      if (_hierarchy === 'SUPER_ADMIN') userMap.superadmins.push(insertedUser);
      else if (_hierarchy === 'HEAD_HR') userMap.headHr = insertedUser;
      else if (_hierarchy === 'HR') userMap.hr.push(insertedUser);
      else if (_hierarchy === 'MANAGER') userMap.managers.push(insertedUser);
      else userMap.employees.push(insertedUser);
    }
    console.log(`✅ Users inserted: ${usersData.length}\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 4: ASSIGN MANAGER_ID HIERARCHY
    // ─────────────────────────────────────────────────────────────
    console.log('🔗 Setting up organizational hierarchy...');

    // Head HR reports to Super Admin 1
    await db.collection('users').updateOne(
      { _id: userMap.headHr._id },
      { $set: { manager_id: userMap.superadmins[0]._id } }
    );
    console.log(`   ✓ Head HR (${userMap.headHr.full_name}) → reports to SA (${userMap.superadmins[0].full_name})`);

    // HR1 & HR2 report to Head HR
    for (const hr of userMap.hr) {
      await db.collection('users').updateOne(
        { _id: hr._id },
        { $set: { manager_id: userMap.headHr._id } }
      );
      hr.manager_id = userMap.headHr._id;
      console.log(`   ✓ ${hr.full_name} (HR) → reports to Head HR (${userMap.headHr.full_name})`);
    }

    // Managers 1-3 report to HR1, Managers 4-6 report to HR2
    for (const mgr of userMap.managers) {
      const hrSuperior = mgr._mgrIndex < 3 ? userMap.hr[0] : userMap.hr[1];
      await db.collection('users').updateOne(
        { _id: mgr._id },
        { $set: { manager_id: hrSuperior._id } }
      );
      mgr.manager_id = hrSuperior._id;
      console.log(`   ✓ ${mgr.full_name} (Manager ${mgr._mgrIndex + 1}) → reports to ${hrSuperior.full_name}`);
    }

    // Employees assigned to their team's manager
    for (const emp of userMap.employees) {
      const manager = userMap.managers[emp._teamIndex];
      await db.collection('users').updateOne(
        { _id: emp._id },
        { $set: { manager_id: manager._id } }
      );
      emp.manager_id = manager._id;
    }

    // Print team distribution
    console.log('\n   📊 Team Distribution:');
    for (let i = 0; i < 6; i++) {
      const teamSize = userMap.employees.filter(e => e._teamIndex === i).length;
      const hrName = i < 3 ? userMap.hr[0].full_name : userMap.hr[1].full_name;
      console.log(`   Team ${i + 1} (${TEAM_DEPARTMENTS[i]}): ${teamSize} employees → Mgr: ${userMap.managers[i].full_name} → HR: ${hrName}`);
    }
    console.log('✅ Hierarchy established\n');

    // ─────────────────────────────────────────────────────────────
    // STEP 5: CREATE SHIFTS
    // ─────────────────────────────────────────────────────────────
    console.log('📝 Creating shifts...');
    const insertedShifts = [];
    for (const shift of shifts) {
      const result = await db.collection('shifts').insertOne({
        ...shift,
        effective_from: new Date(shift.effective_from),
        created_by: userMap.headHr._id,
        created_at: new Date(),
        updated_at: new Date()
      });
      insertedShifts.push({ _id: result.insertedId, ...shift });
    }
    console.log(`✅ Shifts created: ${insertedShifts.length} (${insertedShifts.map(s => s.name).join(', ')})\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 6: CREATE POLICIES
    // ─────────────────────────────────────────────────────────────
    console.log('📝 Creating policies...');
    const insertedPolicies = [];
    for (const policy of policies) {
      const result = await db.collection('policies').insertOne({
        ...policy,
        effective_from: new Date(policy.effective_from),
        created_by: userMap.headHr._id,
        approved_by: userMap.superadmins[0]._id,
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
      insertedPolicies.push({ _id: result.insertedId, ...policy });
    }
    console.log(`✅ Policies created: ${insertedPolicies.length}\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 7: CREATE / UPDATE GEO-FENCES
    // ─────────────────────────────────────────────────────────────
    console.log('📝 Creating geo-fences...');
    for (const fence of geoFences) {
      const existingFence = await db.collection('geofences').findOne({ code: fence.code });
      const updateData = { ...fence, updated_at: new Date() };

      // Don't overwrite existing center coordinates (user may have customized them)
      if (existingFence && existingFence.center) {
        delete updateData.center;
      }

      await db.collection('geofences').updateOne(
        { code: fence.code },
        {
          $set: updateData,
          $setOnInsert: {
            created_by: userMap.headHr._id,
            created_at: new Date()
          }
        },
        { upsert: true }
      );
    }
    console.log(`✅ Geo-fences created/updated: ${geoFences.length}\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 8: REGISTER DEVICES FOR ALL USERS
    // ─────────────────────────────────────────────────────────────
    console.log('📱 Registering devices for all users...');
    const allUsers = [
      ...userMap.superadmins,
      userMap.headHr,
      ...userMap.hr,
      ...userMap.managers,
      ...userMap.employees
    ];

    const deviceDocs = allUsers.map(user => ({
      user_id: user._id,
      device_id: `seeded-device-${user.employee_id.toLowerCase()}`,
      device_name: randomItem(['Windows Desktop', 'MacBook Pro', 'Linux Workstation', 'iPad Pro', 'Android Tablet']),
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      status: 'APPROVED',
      approved_by: userMap.superadmins[0]._id,
      approved_at: randomDate(new Date('2024-01-01'), new Date('2024-06-01')),
      last_used: randomDate(new Date('2025-01-01'), new Date()),
      created_at: randomDate(new Date('2024-01-01'), new Date('2024-06-01')),
      updated_at: new Date()
    }));

    await db.collection('devices').insertMany(deviceDocs);
    console.log(`✅ Devices registered: ${deviceDocs.length} (all APPROVED)\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 9: GENERATE ATTENDANCE LOGS (60 DAYS)
    // ─────────────────────────────────────────────────────────────
    console.log('📊 Generating attendance logs for 60 days (this may take a moment)...');
    const attendanceLogs = generateAttendanceLogs(allUsers, insertedShifts, insertedPolicies);
    if (attendanceLogs.length > 0) {
      // Insert in batches of 1000 to avoid memory issues
      const batchSize = 1000;
      for (let i = 0; i < attendanceLogs.length; i += batchSize) {
        const batch = attendanceLogs.slice(i, i + batchSize);
        await db.collection('attendancelogs').insertMany(batch);
        console.log(`   ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(attendanceLogs.length / batchSize)}`);
      }
    }
    console.log(`✅ Attendance logs created: ${attendanceLogs.length}\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 10: GENERATE SYSTEM ACTION LOGS (500)
    // ─────────────────────────────────────────────────────────────
    console.log('📝 Generating system action logs...');
    const systemLogs = generateSystemLogs(userMap);
    if (systemLogs.length > 0) {
      await db.collection('systemactionlogs').insertMany(systemLogs);
    }
    console.log(`✅ System action logs created: ${systemLogs.length}\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 11: GENERATE REGULARIZATION REQUESTS (100)
    // ─────────────────────────────────────────────────────────────
    console.log('📝 Generating regularization/approval requests...');
    const approvalRequests = generateApprovalRequests(userMap);
    if (approvalRequests.length > 0) {
      await db.collection('regularizationrequests').insertMany(approvalRequests);
    }
    console.log(`✅ Approval requests created: ${approvalRequests.length}\n`);

    // ─────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║            ✅ DATABASE SEEDED SUCCESSFULLY!                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    console.log('\n📊 SEEDING SUMMARY:');
    console.log('═'.repeat(60));
    console.log(`👥 Total Users: ${usersData.length}`);
    console.log(`   ├── Super Admins: 2`);
    console.log(`   ├── Head HR: 1`);
    console.log(`   ├── HR: 2`);
    console.log(`   ├── Managers: 6`);
    console.log(`   └── Employees: 100`);
    console.log(`🔐 Roles: ${insertedRoles.length} (${insertedRoles.map(r => r.name).join(', ')})`);
    console.log(`🕒 Shifts: ${insertedShifts.length}`);
    console.log(`📋 Policies: ${insertedPolicies.length}`);
    console.log(`📍 Geo-fences: ${geoFences.length}`);
    console.log(`📱 Devices: ${deviceDocs.length}`);
    console.log(`📊 Attendance Logs: ${attendanceLogs.length}`);
    console.log(`📝 System Logs: ${systemLogs.length}`);
    console.log(`✅ Approval Requests: ${approvalRequests.length}`);
    console.log('═'.repeat(60));

    console.log('\n🏢 ORGANIZATIONAL HIERARCHY:');
    console.log('═'.repeat(60));
    console.log(`   Super Admin 1: ${userMap.superadmins[0].full_name} (${userMap.superadmins[0].email})`);
    console.log(`   Super Admin 2: ${userMap.superadmins[1].full_name} (${userMap.superadmins[1].email})`);
    console.log(`   │`);
    console.log(`   └── Head HR: ${userMap.headHr.full_name} (${userMap.headHr.email})`);
    console.log(`       │`);
    console.log(`       ├── HR 1: ${userMap.hr[0].full_name} (${userMap.hr[0].email})`);
    console.log(`       │   ├── Mgr 1: ${userMap.managers[0].full_name} (${userMap.managers[0].email}) → Team 1 [${TEAM_DEPARTMENTS[0]}]`);
    console.log(`       │   ├── Mgr 2: ${userMap.managers[1].full_name} (${userMap.managers[1].email}) → Team 2 [${TEAM_DEPARTMENTS[1]}]`);
    console.log(`       │   └── Mgr 3: ${userMap.managers[2].full_name} (${userMap.managers[2].email}) → Team 3 [${TEAM_DEPARTMENTS[2]}]`);
    console.log(`       │`);
    console.log(`       └── HR 2: ${userMap.hr[1].full_name} (${userMap.hr[1].email})`);
    console.log(`           ├── Mgr 4: ${userMap.managers[3].full_name} (${userMap.managers[3].email}) → Team 4 [${TEAM_DEPARTMENTS[3]}]`);
    console.log(`           ├── Mgr 5: ${userMap.managers[4].full_name} (${userMap.managers[4].email}) → Team 5 [${TEAM_DEPARTMENTS[4]}]`);
    console.log(`           └── Mgr 6: ${userMap.managers[5].full_name} (${userMap.managers[5].email}) → Team 6 [${TEAM_DEPARTMENTS[5]}]`);
    console.log('═'.repeat(60));

    console.log('\n🔑 TEST CREDENTIALS:');
    console.log('═'.repeat(60));
    console.log('Super Admins:');
    console.log('   superadmin1@company.com / SuperAdmin@123');
    console.log('   superadmin2@company.com / SuperAdmin@123');
    console.log('\nHead HR:');
    console.log('   headhr@company.com / HrAdmin@123');
    console.log('\nHR:');
    console.log('   hr1@company.com / HrAdmin@123');
    console.log('   hr2@company.com / HrAdmin@123');
    console.log('\nManagers (6):');
    console.log('   manager1@company.com through manager6@company.com');
    console.log('   Password: Manager@123');
    console.log('\nEmployees (100):');
    console.log('   Use employee_id (EMP001 to EMP100) or email to login');
    console.log('   Password: Employee@123');
    console.log('═'.repeat(60));

    console.log('\n💡 DEVICE TESTING TIP:');
    console.log('═'.repeat(60));
    console.log('All users have a seeded device (seeded-device-xxx).');
    console.log('When you log in from your real browser, your device ID will');
    console.log('be different, so you will see the "Unregistered Device" popup.');
    console.log('This is intentional for testing the device approval flow!');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed\n');
  }
}

// Run seeder
seedLargeDatabase();
