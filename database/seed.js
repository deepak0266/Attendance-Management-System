const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const moment = require('moment');


mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 30000);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

// Import models
// const User = require('../backend/src/models/User');
// const Shift = require('../backend/src/models/Shift');
// const Policy = require('../backend/src/models/Policy');
// const GeoFence = require('../backend/src/models/GeoFence');
// const AttendanceLog = require('../backend/src/models/AttendanceLog');
// const SystemActionLog = require('../backend/src/models/SystemActionLog');

// Models will be loaded AFTER connection
let User, Shift, Policy, GeoFence, AttendanceLog, SystemActionLog;

// Configuration
const config = {
  mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system',
  options: {
    serverSelectionTimeoutMS: 30000, // 30 seconds timeout
    socketTimeoutMS: 45000,          // 45 seconds socket timeout
    connectTimeoutMS: 30000,         // 30 seconds connection timeout
    bufferCommands: false,           // Disable buffering
    bufferTimeoutMS: 30000           // Buffer timeout 30 seconds
  }
};

// Default data
const defaultData = {
  departments: [
    'Management',
    'Human Resources',
    'Engineering',
    'Sales',
    'Marketing',
    'Finance',
    'Operations',
    'Customer Support',
    'IT',
    'Administration'
  ],
  
  users: [
    {
      employee_id: 'SA001',
      email: 'superadmin@company.com',
      phone: '+1234567890',
      full_name: 'Super Admin',
      department: 'Management',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      password: 'Admin@123',
      joining_date: '2024-01-01',
      gender: 'MALE',
      date_of_birth: '1985-01-01'
    },
    {
      employee_id: 'HR001',
      email: 'hr@company.com',
      phone: '+1234567891',
      full_name: 'HR Admin',
      department: 'Human Resources',
      role: 'HR',
      status: 'ACTIVE',
      password: 'Hr@123',
      joining_date: '2024-01-01',
      gender: 'FEMALE',
      date_of_birth: '1990-05-15'
    },
    {
      employee_id: 'MGR001',
      email: 'manager@company.com',
      phone: '+1234567892',
      full_name: 'Team Manager',
      department: 'Engineering',
      role: 'MANAGER',
      status: 'ACTIVE',
      password: 'Manager@123',
      joining_date: '2024-01-01',
      gender: 'MALE',
      date_of_birth: '1988-08-20'
    },
    {
      employee_id: 'EMP001',
      email: 'employee@company.com',
      phone: '+1234567893',
      full_name: 'John Employee',
      department: 'Engineering',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      password: 'Employee@123',
      joining_date: '2024-01-01',
      gender: 'MALE',
      date_of_birth: '1995-03-10'
    },
    {
      employee_id: 'EMP002',
      email: 'jane@company.com',
      phone: '+1234567894',
      full_name: 'Jane Smith',
      department: 'Marketing',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      password: 'Employee@123',
      joining_date: '2024-02-01',
      gender: 'FEMALE',
      date_of_birth: '1992-11-25'
    },
    {
      employee_id: 'EMP003',
      email: 'mike@company.com',
      phone: '+1234567895',
      full_name: 'Mike Johnson',
      department: 'Sales',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      password: 'Employee@123',
      joining_date: '2024-01-15',
      gender: 'MALE',
      date_of_birth: '1993-07-12'
    },
    {
      employee_id: 'EMP004',
      email: 'sarah@company.com',
      phone: '+1234567896',
      full_name: 'Sarah Williams',
      department: 'Engineering',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      password: 'Employee@123',
      joining_date: '2024-03-01',
      gender: 'FEMALE',
      date_of_birth: '1994-09-18'
    },
    {
      employee_id: 'EMP005',
      email: 'david@company.com',
      phone: '+1234567897',
      full_name: 'David Brown',
      department: 'IT',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      password: 'Employee@123',
      joining_date: '2024-01-10',
      gender: 'MALE',
      date_of_birth: '1991-12-05'
    }
  ],
  
  shifts: [
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
      applicable_departments: ['Engineering', 'Marketing', 'Sales', 'IT', 'Administration'],
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
      night_shift_config: {
        cross_midnight: true,
        night_shift_allowance: 200,
        next_day_punch_out: true
      },
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
      flexible_hours: {
        enabled: true,
        core_start_time: '10:00',
        core_end_time: '16:00',
        min_hours_per_day: 6,
        max_hours_per_day: 10
      },
      applicable_departments: ['Management', 'Human Resources'],
      is_active: true,
      version: 1,
      effective_from: '2024-01-01'
    }
  ],
  
  policies: [
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
        half_day: {
          threshold_hours_worked: 4,
          requires_approval: false,
          auto_apply: true
        },
        absence: {
          auto_mark_after_hours: 2,
          requires_justification: true,
          consecutive_absences_threshold: 3,
          notify_manager_after_days: 1,
          notify_hr_after_days: 3
        },
        breaks: {
          auto_deduct_unpaid_after_minutes: 60,
          max_break_minutes_per_day: 120,
          min_break_between_shifts_hours: 11,
          require_break_after_hours: 5,
          mandatory_break_minutes: 30
        },
        regularization: {
          allowed_days_back: 7,
          require_proof_for_old_requests: true,
          max_requests_per_month: 5,
          auto_approve_after_days: 7
        },
        leave: {
          casual_leave_days: 12,
          sick_leave_days: 12,
          earned_leave_days: 15,
          maternity_leave_days: 180,
          paternity_leave_days: 15,
          bereavement_leave_days: 5,
          require_approval_for: { casual: true, sick: true, earned: true },
          allow_negative_balance: false,
          max_negative_balance_days: 5,
          carry_forward_enabled: true,
          max_carry_forward_days: 45
        },
        payroll: {
          lock_period_days: 5,
          allow_edits_after_lock: false,
          require_super_admin_approval_for_edits: true,
          auto_lock_after_days: 10,
          working_days_per_month: 22,
          daily_work_hours: 8
        },
        notifications: {
          punch_reminder_before_shift_minutes: 15,
          punch_reminder_after_shift_start_minutes: 15,
          missed_punch_notification_delay_hours: 1,
          weekly_summary_day: 5,
          monthly_summary_day: 1
        }
      }
    }
  ],
  
  geoFences: [
    {
      name: 'Main Office - Current Location',
      code: 'OFFICE-001',
      description: 'Current company headquarters',
      type: 'circle',
      center: { lat: 28.3974083, lng: 77.0415066 },
      radius_meters: 100,
      buffer_meters: 20,
      address: {
        formatted: 'Connaught Place, New Delhi, India',
        city: 'New Delhi',
        state: 'Delhi',
        country: 'India'
      },
      validation_rules: {
        strict_mode: true,
        accuracy_threshold_meters: 50,
        allow_manual_override: true,
        require_photo_on_failure: false,
        max_distance_for_approval_meters: 500
      },
      schedule: {
        always_active: true,
        active_days: [1, 2, 3, 4, 5]
      },
      is_active: true,
      is_default: true,
      priority: 10,
      version: 1
    },
    {
      name: 'Branch Office',
      code: 'BRANCH-001',
      type: 'circle',
      center: { lat: 19.0760, lng: 72.8777 },
      radius_meters: 80,
      buffer_meters: 15,
      address: {
        formatted: 'Bandra, Mumbai, India',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India'
      },
      validation_rules: {
        strict_mode: true,
        accuracy_threshold_meters: 50,
        allow_manual_override: true,
        require_photo_on_failure: false,
        max_distance_for_approval_meters: 400
      },
      schedule: {
        always_active: true,
        active_days: [1, 2, 3, 4, 5]
      },
      applicable_departments: ['Sales', 'Marketing'],
      is_active: true,
      priority: 5,
      version: 1
    }
  ]
};

// Helper functions
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

async function createUsers(createdByMap) {
  console.log('\n📝 Creating users...');
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  
  for (const userData of defaultData.users) {
    // Direct MongoDB findOne
    const existingUser = await usersCollection.findOne({ 
      $or: [
        { employee_id: userData.employee_id },
        { email: userData.email }
      ]
    });
    
    if (!existingUser) {
      const hashedPassword = await hashPassword(userData.password);
      
      let managerId = null;
      if (userData.role === 'EMPLOYEE' && userData.department === 'Engineering') {
        managerId = createdByMap.get('manager@company.com');
      }
      
      const newUser = {
        ...userData,
        password_hash: hashedPassword,
        manager_id: managerId,
        joining_date: new Date(userData.joining_date),
        date_of_birth: new Date(userData.date_of_birth),
        created_by: createdByMap.get('superadmin@company.com'),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await usersCollection.insertOne(newUser);
      createdByMap.set(userData.email, result.insertedId);
      console.log(`  ✅ Created ${userData.role}: ${userData.full_name} (${userData.email})`);
    } else {
      createdByMap.set(userData.email, existingUser._id);
      console.log(`  ⏭️  User already exists: ${userData.email}`);
    }
  }
  
  return createdByMap;
}

async function createShifts(createdByMap) {
  console.log('\n📝 Creating shifts...');
  const db = mongoose.connection.db;
  const shiftsCollection = db.collection('shifts');
  const shifts = [];
  
  for (const shiftData of defaultData.shifts) {
    const existingShift = await shiftsCollection.findOne({ code: shiftData.code });
    
    if (!existingShift) {
      const newShift = {
        ...shiftData,
        effective_from: new Date(shiftData.effective_from),
        created_by: createdByMap.get('hr@company.com'),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await shiftsCollection.insertOne(newShift);
      shifts.push({ _id: result.insertedId, ...newShift });
      console.log(`  ✅ Created shift: ${shiftData.name} (${shiftData.code})`);
    } else {
      shifts.push(existingShift);
      console.log(`  ⏭️  Shift already exists: ${shiftData.code}`);
    }
  }
  
  return shifts;
}

async function createPolicies(createdByMap) {
  console.log('\n📝 Creating policies...');
  const db = mongoose.connection.db;
  const policiesCollection = db.collection('policies');
  const policies = [];
  
  for (const policyData of defaultData.policies) {
    const existingPolicy = await policiesCollection.findOne({ 
      code: policyData.code, 
      version: policyData.version 
    });
    
    if (!existingPolicy) {
      const newPolicy = {
        ...policyData,
        effective_from: new Date(policyData.effective_from),
        created_by: createdByMap.get('hr@company.com'),
        approved_by: createdByMap.get('superadmin@company.com'),
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await policiesCollection.insertOne(newPolicy);
      policies.push({ _id: result.insertedId, ...newPolicy });
      console.log(`  ✅ Created policy: ${policyData.name} v${policyData.version}`);
    } else {
      policies.push(existingPolicy);
      console.log(`  ⏭️  Policy already exists: ${policyData.code}`);
    }
  }
  
  return policies;
}

async function createGeoFences(createdByMap) {
  console.log('\n📝 Creating geo-fences...');
  const db = mongoose.connection.db;
  const fencesCollection = db.collection('geofences');
  const fences = [];
  
  for (const fenceData of defaultData.geoFences) {
    const existingFence = await fencesCollection.findOne({ code: fenceData.code });
    const updateData = {
      ...fenceData,
      updated_at: new Date()
    };

    if (existingFence && existingFence.center) {
      delete updateData.center;
    }

    const result = await fencesCollection.updateOne(
      { code: fenceData.code },
      {
        $set: updateData,
        $setOnInsert: {
          created_by: createdByMap.get('hr@company.com'),
          created_at: new Date()
        }
      },
      { upsert: true }
    );

    if (result.upsertedId) {
      fences.push({ _id: result.upsertedId._id, ...fenceData, created_by: createdByMap.get('hr@company.com'), created_at: new Date(), updated_at: new Date() });
      console.log(`  ✅ Created geo-fence: ${fenceData.name} (${fenceData.code})`);
    } else {
      const existing = await fencesCollection.findOne({ code: fenceData.code });
      fences.push(existing);
      console.log(`  ⏭️  Geo-fence already exists: ${fenceData.code}`);
    }
  }
  
  return fences;
}

async function createSampleAttendance(createdByMap, shifts, policies) {
  console.log('\n📝 Creating sample attendance records...');
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  const attendanceCollection = db.collection('attendancelogs');
  
  // Get employees using direct MongoDB
  const employees = await usersCollection.find({ role: 'EMPLOYEE' }).toArray();
  const generalShift = shifts.find(s => s.code === 'GEN-001');
  const defaultPolicy = policies.find(p => p.is_default);
  
  if (employees.length === 0 || !generalShift || !defaultPolicy) {
    console.log('  ⏭️  Skipping sample attendance (missing required data)');
    return;
  }
  
  const attendanceCount = await attendanceCollection.countDocuments();
  
  if (attendanceCount > 0) {
    console.log('  ⏭️  Attendance records already exist');
    return;
  }
  
  let created = 0;
  
  // Create attendance for the past 5 working days
  for (let i = 1; i <= 5; i++) {
    const date = moment().subtract(i, 'days').startOf('day').toDate();
    const dayOfWeek = moment(date).day();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    for (const employee of employees.slice(0, 3)) { // Only first 3 employees
      const nextDay = moment(date).add(1, 'day').toDate();
      
      const existingLog = await attendanceCollection.findOne({
        user_id: employee._id,
        date: {
          $gte: date,
          $lt: nextDay
        }
      });
      
      if (!existingLog) {
        // Randomize punch times
        const punchInHour = 9 + Math.floor(Math.random() * 2); // 9 or 10
        const punchInMinute = Math.floor(Math.random() * 30); // 0-29
        const punchOutHour = 18;
        const punchOutMinute = Math.floor(Math.random() * 30);
        
        const punchInTime = moment(date).set({
          hour: punchInHour,
          minute: punchInMinute,
          second: 0
        });
        
        const punchOutTime = moment(date).set({
          hour: punchOutHour,
          minute: punchOutMinute,
          second: 0
        });
        
        const isLate = punchInHour > 9 || (punchInHour === 9 && punchInMinute > 15);
        
        const workMinutes = punchOutTime.diff(punchInTime, 'minutes') - 60; // Subtract 1 hour break
        const overtimeMinutes = Math.max(0, workMinutes - 480); // 8 hours = 480 minutes
        
        const attendanceLog = {
          user_id: employee._id,
          date: date,
          shift_id: generalShift._id,
          policy_version_id: defaultPolicy._id,
          punch_in: {
            timestamp: punchInTime.toDate(),
            server_timestamp: punchInTime.toDate(),
            client_timestamp: punchInTime.toDate(),
            location: {
              latitude: 28.3974083 + (Math.random() - 0.5) * 0.001,
              longitude: 77.0415066 + (Math.random() - 0.5) * 0.001,
              accuracy: 20 + Math.random() * 30
            },
            ip: '192.168.1.1',
            source: 'WEB',
            is_valid: true,
            validation_details: {
              location_valid: true,
              accuracy_valid: true,
              time_valid: true
            }
          },
          punch_out: {
            timestamp: punchOutTime.toDate(),
            server_timestamp: punchOutTime.toDate(),
            client_timestamp: punchOutTime.toDate(),
            location: {
              latitude: 28.3974083 + (Math.random() - 0.5) * 0.001,
              longitude: 77.0415066 + (Math.random() - 0.5) * 0.001,
              accuracy: 20 + Math.random() * 30
            },
            ip: '192.168.1.1',
            source: 'WEB',
            is_valid: true,
            validation_details: {
              location_valid: true,
              accuracy_valid: true,
              time_valid: true
            }
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
        };
        
        await attendanceCollection.insertOne(attendanceLog);
        created++;
      }
    }
  }
  
  console.log(`  ✅ Created ${created} sample attendance records`);
}

async function createSystemLogs(createdByMap) {
  console.log('\n📝 Creating system logs...');
  const db = mongoose.connection.db;
  const logsCollection = db.collection('systemactionlogs');
  
  const logCount = await logsCollection.countDocuments();
  
  if (logCount > 0) {
    console.log('  ⏭️  System logs already exist');
    return;
  }
  
  const superAdminId = createdByMap.get('superadmin@company.com');
  const hrId = createdByMap.get('hr@company.com');
  
  const logs = [
    {
      actor_user_id: superAdminId,
      actor_role: 'SUPER_ADMIN',
      action_type: 'SYSTEM_CONFIG',
      target_user_id: null,
      target_entity_id: null,
      target_entity_type: null,
      old_value: null,
      new_value: { setup: 'initial' },
      reason: 'Initial system setup',
      ip_address: '127.0.0.1',
      user_agent: 'System/Seeder',
      session_id: null,
      is_super_admin_action: true,
      is_read_only: true,
      timestamp: new Date()
    },
    {
      actor_user_id: hrId,
      actor_role: 'HR',
      action_type: 'USER_CREATE',
      target_user_id: null,
      target_entity_id: null,
      target_entity_type: 'User',
      old_value: null,
      new_value: { action: 'bulk_create' },
      reason: 'Created initial employee accounts',
      ip_address: '127.0.0.1',
      user_agent: 'System/Seeder',
      session_id: null,
      is_super_admin_action: false,
      is_read_only: true,
      timestamp: new Date()
    },
    {
      actor_user_id: hrId,
      actor_role: 'HR',
      action_type: 'SHIFT_CHANGE',
      target_user_id: null,
      target_entity_id: null,
      target_entity_type: 'Shift',
      old_value: null,
      new_value: { shifts: ['GEN-001', 'NIGHT-001', 'FLEX-001'] },
      reason: 'Configured default shifts',
      ip_address: '127.0.0.1',
      user_agent: 'System/Seeder',
      session_id: null,
      is_super_admin_action: false,
      is_read_only: true,
      timestamp: new Date()
    },
    {
      actor_user_id: hrId,
      actor_role: 'HR',
      action_type: 'POLICY_CHANGE',
      target_user_id: null,
      target_entity_id: null,
      target_entity_type: 'Policy',
      old_value: null,
      new_value: { policy: 'POL-001' },
      reason: 'Configured attendance policies',
      ip_address: '127.0.0.1',
      user_agent: 'System/Seeder',
      session_id: null,
      is_super_admin_action: false,
      is_read_only: true,
      timestamp: new Date()
    },
    {
      actor_user_id: hrId,
      actor_role: 'HR',
      action_type: 'GEOFENCE_CHANGE',
      target_user_id: null,
      target_entity_id: null,
      target_entity_type: 'GeoFence',
      old_value: null,
      new_value: { fences: ['OFFICE-001', 'BRANCH-001'] },
      reason: 'Configured office geo-fences',
      ip_address: '127.0.0.1',
      user_agent: 'System/Seeder',
      session_id: null,
      is_super_admin_action: false,
      is_read_only: true,
      timestamp: new Date()
    }
  ];
  
  for (const logData of logs) {
    await logsCollection.insertOne(logData);
  }
  
  console.log(`  ✅ Created ${logs.length} system logs`);
}

async function updateManagerReferences(createdByMap) {
  console.log('\n📝 Updating manager references...');
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  
  const managerId = createdByMap.get('manager@company.com');
  const hrId = createdByMap.get('hr@company.com');
  
  if (managerId) {
    const result = await usersCollection.updateMany(
      { 
        role: 'EMPLOYEE',
        department: 'Engineering',
        manager_id: null 
      },
      { 
        $set: { 
          manager_id: managerId,
          updated_at: new Date()
        } 
      }
    );
    
    console.log(`  ✅ Updated ${result.modifiedCount} employees with manager reference`);
  }
  
  const manager = await usersCollection.findOne({ role: 'MANAGER', manager_id: null });
  if (manager && hrId) {
    await usersCollection.updateOne(
      { _id: manager._id },
      { 
        $set: { 
          manager_id: hrId,
          updated_at: new Date()
        } 
      }
    );
    console.log(`  ✅ Updated manager with HR reference`);
  }
}
// Main seed function
async function seedDatabase() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                                                      ║');
  console.log('║   Attendance Management System - Database Seeder     ║');
  console.log('║                                                      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  try {
    // Connect to MongoDB
console.log('🔌 Connecting to MongoDB Atlas...');
console.log('   (Free tier may take 5-10 seconds...)');await mongoose.connect(config.mongoURI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
  w: 'majority'
});
      console.log('✅ Connected to MongoDB Atlas!\n');

  // STEP: Load models AFTER connection
  console.log('📦 Loading models...');
  User = require('../backend/src/models/User');
  Shift = require('../backend/src/models/Shift');
  Policy = require('../backend/src/models/Policy');
  GeoFence = require('../backend/src/models/GeoFence');
  AttendanceLog = require('../backend/src/models/AttendanceLog');
  SystemActionLog = require('../backend/src/models/SystemActionLog');
  console.log('✅ Models loaded\n');

 console.log('📊 Checking existing data...');
let userCount = 0;
try {
  // Direct collection access - bypasses mongoose buffering
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  userCount = await usersCollection.countDocuments();
  console.log(`   Found ${userCount} existing users`);
} catch (err) {
  console.log('   First time setup, no data exists');
}
    
    if (userCount > 0) {
  console.log('⚠️  Database already contains data!');
  console.log('   Options:');
  console.log('   1. Run with --force to clear and reseed');
  console.log('   2. Run migrations to update existing data\n');
  
  if (process.argv.includes('--force')) {
    console.log('🧹 Clearing existing data...');
    const db = mongoose.connection.db;
    await db.collection('users').deleteMany({});
    await db.collection('shifts').deleteMany({});
    await db.collection('policies').deleteMany({});
    await db.collection('geofences').deleteMany({});
    await db.collection('attendancelogs').deleteMany({});
    await db.collection('systemactionlogs').deleteMany({});
    console.log('✅ Data cleared\n');
  } else {
    console.log('❌ Seeding cancelled. Use --force to override.\n');
    process.exit(0);
  }
}
    
    // Create users
    const createdByMap = new Map();
    await createUsers(createdByMap);
    
    // Create shifts
    const shifts = await createShifts(createdByMap);
    
    // Create policies
    const policies = await createPolicies(createdByMap);
    
    // Create geo-fences
    await createGeoFences(createdByMap);
    
    // Create sample attendance
    await createSampleAttendance(createdByMap, shifts, policies);
    
    // Create system logs
    await createSystemLogs(createdByMap);
    
    // Update manager references
    await updateManagerReferences(createdByMap);
    
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                                                      ║');
    console.log('║   ✅ Database seeded successfully!                   ║');
    console.log('║                                                      ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    
    console.log('\n📋 Test Credentials:');
    console.log('─'.repeat(50));
    console.log('Super Admin: superadmin@company.com / Admin@123');
    console.log('HR Admin:    hr@company.com / Hr@123');
    console.log('Manager:     manager@company.com / Manager@123');
    console.log('Employee:    employee@company.com / Employee@123');
    console.log('─'.repeat(50));
    
    console.log('\n🎯 Next Steps:');
    console.log('  1. Start the backend: cd backend && npm run dev');
    console.log('  2. Start the frontend: cd frontend && npm run dev');
    console.log('  3. Access the application at http://localhost:3000');
    console.log('  4. Login with the credentials above\n');
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed\n');
  }
}

// Run seeder
seedDatabase();