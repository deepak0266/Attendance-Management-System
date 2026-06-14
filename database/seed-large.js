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

// Departments list
const DEPARTMENTS = [
  'Management', 'Human Resources', 'Engineering', 'Sales',
  'Marketing', 'Finance', 'Operations', 'Customer Support',
  'IT', 'Administration', 'Product', 'Quality Assurance'
];

// Indian names for generating employees
const FIRST_NAMES = [
  'Aarav', 'Vihaan', 'Vivaan', 'Ananya', 'Diya', 'Advik', 'Kabir', 'Anaya', 'Aaradhya', 'Reyansh',
  'Sai', 'Arjun', 'Ishaan', 'Rudra', 'Sanya', 'Aryan', 'Ishita', 'Myra', 'Shaurya', 'Yash',
  'Raj', 'Priya', 'Rahul', 'Neha', 'Vikram', 'Pooja', 'Amit', 'Kavita', 'Suresh', 'Anita',
  'Deepak', 'Sunita', 'Ramesh', 'Geeta', 'Mahesh', 'Seema', 'Naresh', 'Kiran', 'Manoj', 'Asha',
  'Ajay', 'Divya', 'Vijay', 'Shweta', 'Sanjay', 'Ritu', 'Rajesh', 'Meena', 'Mukesh', 'Rekha'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Kumar', 'Singh', 'Patel', 'Reddy', 'Rao', 'Joshi', 'Nair',
  'Menon', 'Iyer', 'Malhotra', 'Kapoor', 'Khanna', 'Mehta', 'Chopra', 'Bhat', 'Desai', 'Chauhan',
  'Yadav', 'Jha', 'Mishra', 'Pandey', 'Tiwari', 'Dubey', 'Saxena', 'Srivastava', 'Agarwal', 'Jain'
];

// Helper Functions
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

function generateEmployeeId(prefix, index) {
  return `${prefix}${String(index).padStart(3, '0')}`;
}

function generatePhone() {
  return `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
}

function generateEmail(firstName, lastName, department) {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`;
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

// Generate Users
// Generate Users with UNIQUE emails
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

  // Helper to generate unique email
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

  // Helper to generate unique phone
  function getUniquePhone() {
    let phone;
    do {
      phone = `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
    } while (usedPhones.has(phone));
    usedPhones.add(phone);
    return phone;
  }

  // Helper to generate unique employee ID
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

  // 2 Super Admins
  for (let i = 1; i <= 2; i++) {
    const email = getUniqueEmail(`superadmin${i}@company.com`);
    const employeeId = getUniqueEmployeeId('SA', i);
    
    users.push({
      employee_id: employeeId,
      email: email,
      phone: getUniquePhone(),
      full_name: `Super Admin ${i}`,
      department: 'Management',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      password: passwords.superadmin,
      joining_date: randomDate(new Date('2023-01-01'), new Date('2024-01-01')),
      gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
      date_of_birth: randomDate(new Date('1980-01-01'), new Date('1990-12-31'))
    });
  }

  // 3 HR Admins
  const hrNames = ['Priya Sharma', 'Rahul Verma', 'Anjali Gupta'];
  for (let i = 0; i < 3; i++) {
    const email = getUniqueEmail(`hr${i + 1}@company.com`);
    const employeeId = getUniqueEmployeeId('HR', i + 1);
    
    users.push({
      employee_id: employeeId,
      email: email,
      phone: getUniquePhone(),
      full_name: hrNames[i],
      department: 'Human Resources',
      role: 'HR',
      status: 'ACTIVE',
      password: passwords.hr,
      joining_date: randomDate(new Date('2023-01-01'), new Date('2024-01-01')),
      gender: i === 1 ? 'MALE' : 'FEMALE',
      date_of_birth: randomDate(new Date('1985-01-01'), new Date('1995-12-31'))
    });
  }

  // 6 Managers
  const managerFirstNames = ['Vikram', 'Neha', 'Rajesh', 'Sunita', 'Amitabh', 'Kavya'];
  const managerLastNames = ['Singh', 'Kumar', 'Patel', 'Sharma', 'Verma', 'Gupta'];
  
  for (let i = 0; i < 6; i++) {
    const firstName = managerFirstNames[i];
    const lastName = managerLastNames[i];
    const email = getUniqueEmail(`${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`);
    const employeeId = getUniqueEmployeeId('MGR', i + 1);
    const department = DEPARTMENTS[i % DEPARTMENTS.length];
    
    users.push({
      employee_id: employeeId,
      email: email,
      phone: getUniquePhone(),
      full_name: `${firstName} ${lastName}`,
      department: department,
      role: 'MANAGER',
      status: 'ACTIVE',
      password: passwords.manager,
      joining_date: randomDate(new Date('2023-01-01'), new Date('2024-01-01')),
      gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
      date_of_birth: randomDate(new Date('1988-01-01'), new Date('1998-12-31'))
    });
  }

  // 60 Employees - with guaranteed unique emails
  for (let i = 1; i <= 60; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const department = DEPARTMENTS[i % DEPARTMENTS.length];
    
    // Use index to ensure uniqueness
    const email = getUniqueEmail(`${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@company.com`);
    const employeeId = getUniqueEmployeeId('EMP', i);
    
    users.push({
      employee_id: employeeId,
      email: email,
      phone: getUniquePhone(),
      full_name: `${firstName} ${lastName}`,
      department: department,
      role: 'EMPLOYEE',
      status: Math.random() > 0.05 ? 'ACTIVE' : 'INACTIVE',
      password: passwords.employee,
      joining_date: randomDate(new Date('2023-01-01'), new Date('2024-06-01')),
      gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
      date_of_birth: randomDate(new Date('1990-01-01'), new Date('2002-12-31'))
    });
  }

  console.log(`   Generated ${users.length} users with unique emails`);
  return users;
}

// Generate Shifts
const shifts = [
  {
    name: 'General Shift',
    code: 'GEN-001',
    type: 'Fixed',
    description: 'Standard 9-6 shift',
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
    description: 'Night shift for operations',
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
    description: 'Flexible hours with core time',
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

// Generate Policies
const policies = [
  {
    name: 'Default Attendance Policy',
    code: 'POL-001',
    description: 'Standard attendance policy',
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

// Generate Geo-fences
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
    description: 'Mumbai branch',
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

// Generate Attendance Logs
function generateAttendanceLogs(employees, shifts, policies, managerMap) {
  const logs = [];
  const generalShift = shifts.find(s => s.code === 'GEN-001');
  const defaultPolicy = policies.find(p => p.is_default);
  
  // Generate for last 60 days
  for (let day = 1; day <= 60; day++) {
    const date = moment().subtract(day, 'days').startOf('day').toDate();
    const dayOfWeek = moment(date).day();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends
    
    employees.forEach((employee, index) => {
      if (employee.role !== 'EMPLOYEE') return;
      if (Math.random() > 0.95) return; // 5% absent
      
      const punchInHour = 9 + Math.floor(Math.random() * 2);
      const punchInMinute = Math.floor(Math.random() * 30);
      const punchOutHour = 18;
      const punchOutMinute = Math.floor(Math.random() * 30);
      
      const punchInTime = moment(date).set({ hour: punchInHour, minute: punchInMinute, second: 0 });
      const punchOutTime = moment(date).set({ hour: punchOutHour, minute: punchOutMinute, second: 0 });
      
      const isLate = punchInHour > 9 || (punchInHour === 9 && punchInMinute > 15);
      const workMinutes = punchOutTime.diff(punchInTime, 'minutes') - 60;
      const overtimeMinutes = Math.max(0, workMinutes - 480);
      
      logs.push({
        user_id: employee._id,
        date: date,
        shift_id: generalShift._id,
        policy_version_id: defaultPolicy._id,
        punch_in: {
          timestamp: punchInTime.toDate(),
          server_timestamp: punchInTime.toDate(),
          client_timestamp: punchInTime.toDate(),
          location: { latitude: 28.3974083 + (Math.random() - 0.5) * 0.005, longitude: 77.0415066 + (Math.random() - 0.5) * 0.005, accuracy: 20 + Math.random() * 30 },
          ip: '192.168.1.1',
          source: 'WEB',
          is_valid: true,
          validation_details: { location_valid: true, accuracy_valid: true, time_valid: true }
        },
        punch_out: {
          timestamp: punchOutTime.toDate(),
          server_timestamp: punchOutTime.toDate(),
          client_timestamp: punchOutTime.toDate(),
          location: { latitude: 28.3974083 + (Math.random() - 0.5) * 0.005, longitude: 77.0415066 + (Math.random() - 0.5) * 0.005, accuracy: 20 + Math.random() * 30 },
          ip: '192.168.1.1',
          source: 'WEB',
          is_valid: true,
          validation_details: { location_valid: true, accuracy_valid: true, time_valid: true }
        },
        computed_data: {
          total_work_minutes: workMinutes + 60,
          total_break_minutes: 60,
          net_work_minutes: workMinutes,
          late_by_minutes: isLate ? punchInMinute + (punchInHour - 9) * 60 - 15 : 0,
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

// Generate System Logs
function generateSystemLogs(userMap) {
  const logs = [];
  const actions = ['USER_CREATE', 'USER_UPDATE', 'SHIFT_CHANGE', 'POLICY_CHANGE', 'GEOFENCE_CHANGE', 'LOGIN', 'LOGOUT', 'ATTENDANCE_OVERRIDE', 'REPORT_EXPORT'];
  const superAdminIds = userMap.superadmins || [];
  const hrIds = userMap.hr || [];
  
  // Generate 500 system logs
  for (let i = 0; i < 500; i++) {
    const actorId = i % 3 === 0 ? randomItem(superAdminIds) : randomItem(hrIds);
    const action = randomItem(actions);
    
    logs.push({
      actor_user_id: actorId,
      actor_role: i % 3 === 0 ? 'SUPER_ADMIN' : 'HR',
      action_type: action,
      target_user_id: randomItem([...userMap.employees, ...userMap.managers]),
      target_entity_type: action.includes('USER') ? 'User' : 'Attendance',
      reason: `${action} performed`,
      ip_address: `192.168.${randomInt(1, 255)}.${randomInt(1, 255)}`,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      is_super_admin_action: i % 3 === 0,
      is_read_only: true,
      timestamp: randomDate(new Date('2024-01-01'), new Date())
    });
  }
  
  return logs;
}

// Generate Approval Requests
function generateApprovalRequests(userMap) {
  const requests = [];
  const types = ['MISSED_PUNCH', 'INCORRECT_TIME', 'INVALID_LOCATION', 'OVERTIME'];
  
  for (let i = 0; i < 100; i++) {
    const employee = randomItem(userMap.employees);
    const manager = userMap.managers.find(m => m._id.toString() === employee.manager_id?.toString()) || randomItem(userMap.managers);
    const status = randomItem(['PENDING_MANAGER', 'APPROVED', 'REJECTED', 'ESCALATED']);
    
    requests.push({
      user_id: employee._id,
      request_type: randomItem(types),
      date: randomDate(new Date('2024-01-01'), new Date()),
      reason: `Request for ${randomItem(types).toLowerCase()}`,
      status: status,
      manager_id: manager._id,
      priority: randomItem(['LOW', 'MEDIUM', 'HIGH']),
      created_at: randomDate(new Date('2024-01-01'), new Date()),
      updated_at: new Date()
    });
  }
  
  return requests;
}

// Main Seed Function
async function seedLargeDatabase() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     Attendance System - LARGE DATABASE SEEDER         ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(config.mongoURI, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      maxPoolSize: 20
    });
    console.log('✅ Connected to MongoDB Atlas!\n');
    
    const db = mongoose.connection.db;
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await db.collection('users').deleteMany({});
    await db.collection('shifts').deleteMany({});
    await db.collection('policies').deleteMany({});
    // Preserve existing geo-fence definitions and coordinates
    await db.collection('attendancelogs').deleteMany({});
    await db.collection('systemactionlogs').deleteMany({});
    await db.collection('regularizationrequests').deleteMany({});
    console.log('✅ Data cleared\n');
    
    // Generate Users
    console.log('📝 Generating users...');
    const usersData = generateUsers();
    console.log(`   Total users: ${usersData.length} (2 SA, 3 HR, 6 MGR, 60 EMP)`);
    
    const userMap = { superadmins: [], hr: [], managers: [], employees: [] };
    
    for (const userData of usersData) {
      const hashedPassword = await hashPassword(userData.password);
      const { password, ...userWithoutPassword } = userData;
      const user = {
        ...userWithoutPassword,
        password_hash: hashedPassword,
        joining_date: new Date(userData.joining_date),
        date_of_birth: new Date(userData.date_of_birth),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('users').insertOne(user);
      
      if (userData.role === 'SUPER_ADMIN') userMap.superadmins.push({ _id: result.insertedId, ...user });
      else if (userData.role === 'HR') userMap.hr.push({ _id: result.insertedId, ...user });
      else if (userData.role === 'MANAGER') userMap.managers.push({ _id: result.insertedId, ...user });
      else userMap.employees.push({ _id: result.insertedId, ...user });
    }
    console.log(`✅ Users created: ${usersData.length}\n`);
    
    // Assign managers to employees
    console.log('📝 Assigning managers to employees...');
    for (const employee of userMap.employees) {
      const manager = userMap.managers[Math.floor(Math.random() * userMap.managers.length)];
      await db.collection('users').updateOne(
        { _id: employee._id },
        { $set: { manager_id: manager._id } }
      );
    }
    console.log('✅ Managers assigned\n');
    
    // Create Shifts
    console.log('📝 Creating shifts...');
    for (const shift of shifts) {
      await db.collection('shifts').insertOne({
        ...shift,
        effective_from: new Date(shift.effective_from),
        created_by: userMap.hr[0]._id,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    console.log(`✅ Shifts created: ${shifts.length}\n`);
    
    // Create Policies
    console.log('📝 Creating policies...');
    for (const policy of policies) {
      await db.collection('policies').insertOne({
        ...policy,
        effective_from: new Date(policy.effective_from),
        created_by: userMap.hr[0]._id,
        approved_by: userMap.superadmins[0]._id,
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    console.log(`✅ Policies created: ${policies.length}\n`);
    
    // Create or update Geo-fences without overwriting existing company coordinates
    console.log('📝 Creating geo-fences...');
    for (const fence of geoFences) {
      const existingFence = await db.collection('geofences').findOne({ code: fence.code });
      const updateData = {
        ...fence,
        updated_at: new Date()
      };

      if (existingFence && existingFence.center) {
        delete updateData.center;
      }

      await db.collection('geofences').updateOne(
        { code: fence.code },
        {
          $set: updateData,
          $setOnInsert: {
            created_by: userMap.hr[0]._id,
            created_at: new Date()
          }
        },
        { upsert: true }
      );
    }
    console.log(`✅ Geo-fences created/updated: ${geoFences.length}\n`);
    
    // Generate Attendance Logs
    console.log('📝 Generating attendance logs (this may take a minute)...');
    const attendanceLogs = generateAttendanceLogs(userMap.employees, shifts, policies, userMap.managers);
    if (attendanceLogs.length > 0) {
      await db.collection('attendancelogs').insertMany(attendanceLogs);
    }
    console.log(`✅ Attendance logs created: ${attendanceLogs.length}\n`);
    
    // Generate System Logs
    console.log('📝 Generating system logs...');
    const systemLogs = generateSystemLogs(userMap);
    if (systemLogs.length > 0) {
      await db.collection('systemactionlogs').insertMany(systemLogs);
    }
    console.log(`✅ System logs created: ${systemLogs.length}\n`);
    
    // Generate Approval Requests
    console.log('📝 Generating approval requests...');
    const approvalRequests = generateApprovalRequests(userMap);
    if (approvalRequests.length > 0) {
      await db.collection('regularizationrequests').insertMany(approvalRequests);
    }
    console.log(`✅ Approval requests created: ${approvalRequests.length}\n`);
    
    // Summary
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║              ✅ DATABASE SEEDED SUCCESSFULLY!         ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    
    console.log('\n📊 SEEDING SUMMARY:');
    console.log('─'.repeat(50));
    console.log(`👥 Users: ${usersData.length}`);
    console.log(`   - Super Admins: 2`);
    console.log(`   - HR Admins: 3`);
    console.log(`   - Managers: 6`);
    console.log(`   - Employees: 60`);
    console.log(`🕒 Shifts: ${shifts.length}`);
    console.log(`📋 Policies: ${policies.length}`);
    console.log(`📍 Geo-fences: ${geoFences.length}`);
    console.log(`📊 Attendance Logs: ${attendanceLogs.length}`);
    console.log(`📝 System Logs: ${systemLogs.length}`);
    console.log(`✅ Approval Requests: ${approvalRequests.length}`);
    console.log('─'.repeat(50));
    
    console.log('\n🔑 TEST CREDENTIALS:');
    console.log('─'.repeat(50));
    console.log('Super Admins:');
    console.log('   superadmin1@company.com / SuperAdmin@123');
    console.log('   superadmin2@company.com / SuperAdmin@123');
    console.log('\nHR Admins:');
    console.log('   hr1@company.com / HrAdmin@123');
    console.log('   hr2@company.com / HrAdmin@123');
    console.log('   hr3@company.com / HrAdmin@123');
    console.log('\nManagers (6):');
    console.log('   Password: Manager@123');
    console.log('\nEmployees (60):');
    console.log('   Password: Employee@123');
    console.log('─'.repeat(50));
    
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
