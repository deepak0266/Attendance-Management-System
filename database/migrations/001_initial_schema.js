/**
 * Migration: 001_initial_schema
 * Description: Creates initial database schema and indexes
 * Date: 2024-01-01
 */

module.exports = {
  async up(db) {
    console.log('Running migration: 001_initial_schema - UP');
    
    // Create collections with validation schemas
    
    // Users collection
    await db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['employee_id', 'email', 'full_name', 'department', 'role'],
          properties: {
            employee_id: { bsonType: 'string', minLength: 3, maxLength: 20 },
            email: { bsonType: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
            full_name: { bsonType: 'string', minLength: 2, maxLength: 100 },
            department: { bsonType: 'string' },
            role: { enum: ['SUPER_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
            status: { enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED', 'ON_LEAVE'] }
          }
        }
      }
    });
    
    // Create indexes
    await db.collection('users').createIndex({ employee_id: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ phone: 1 }, { unique: true });
    await db.collection('users').createIndex({ manager_id: 1 });
    await db.collection('users').createIndex({ role: 1 });
    await db.collection('users').createIndex({ status: 1 });
    await db.collection('users').createIndex({ department: 1 });
    
    // Attendance logs collection
    await db.createCollection('attendance_logs');
    await db.collection('attendance_logs').createIndex({ user_id: 1, date: -1 });
    await db.collection('attendance_logs').createIndex({ status: 1 });
    await db.collection('attendance_logs').createIndex({ approval_status: 1 });
    await db.collection('attendance_logs').createIndex({ idempotency_key: 1 }, { unique: true });
    
    // Shifts collection
    await db.createCollection('shifts');
    await db.collection('shifts').createIndex({ code: 1 }, { unique: true });
    await db.collection('shifts').createIndex({ is_active: 1 });
    await db.collection('shifts').createIndex({ type: 1 });
    
    // Policies collection
    await db.createCollection('policies');
    await db.collection('policies').createIndex({ code: 1 });
    await db.collection('policies').createIndex({ version: 1 });
    await db.collection('policies').createIndex({ is_active: 1 });
    await db.collection('policies').createIndex({ is_default: 1 });
    
    // Geo-fences collection
    await db.createCollection('geofences');
    await db.collection('geofences').createIndex({ code: 1 }, { unique: true });
    await db.collection('geofences').createIndex({ is_active: 1 });
    await db.collection('geofences').createIndex({ type: 1 });
    
    // System action logs collection
    await db.createCollection('systemactionlogs');
    await db.collection('systemactionlogs').createIndex({ timestamp: -1 });
    await db.collection('systemactionlogs').createIndex({ actor_user_id: 1 });
    await db.collection('systemactionlogs').createIndex({ action_type: 1 });
    await db.collection('systemactionlogs').createIndex({ is_super_admin_action: 1 });
    
    // Revoked permissions collection
    await db.createCollection('revokedpermissions');
    await db.collection('revokedpermissions').createIndex({ user_id: 1, is_active: 1 });
    await db.collection('revokedpermissions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    
    // Regularization requests collection
    await db.createCollection('regularizationrequests');
    await db.collection('regularizationrequests').createIndex({ user_id: 1 });
    await db.collection('regularizationrequests').createIndex({ status: 1 });
    await db.collection('regularizationrequests').createIndex({ manager_id: 1 });
    
    // Break logs collection
    await db.createCollection('breaklogs');
    await db.collection('breaklogs').createIndex({ user_id: 1 });
    await db.collection('breaklogs').createIndex({ attendance_id: 1 });
    await db.collection('breaklogs').createIndex({ status: 1 });
    
    // Payroll locks collection
    await db.createCollection('payrolllocks');
    await db.collection('payrolllocks').createIndex({ month: 1, year: 1 }, { unique: true });
    await db.collection('payrolllocks').createIndex({ is_locked: 1 });
    
    console.log('Migration 001_initial_schema completed successfully');
  },

  async down(db) {
    console.log('Running migration: 001_initial_schema - DOWN');
    
    // Drop collections in reverse order
    await db.collection('payrolllocks').drop();
    await db.collection('breaklogs').drop();
    await db.collection('regularizationrequests').drop();
    await db.collection('revokedpermissions').drop();
    await db.collection('systemactionlogs').drop();
    await db.collection('geofences').drop();
    await db.collection('policies').drop();
    await db.collection('shifts').drop();
    await db.collection('attendance_logs').drop();
    await db.collection('users').drop();
    
    console.log('Migration 001_initial_schema rolled back successfully');
  }
};