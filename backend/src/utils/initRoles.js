const Role = require('../models/Role');
const logger = require('./logger');

const systemRoles = [
  {
    name: 'SUPER_ADMIN',
    description: 'System Administrator with full access to all features',
    permissions: ['view_all_data', 'manage_users', 'manage_roles', 'override_attendance', 'lock_payroll', 'define_policies', 'handle_escalations', 'manage_shifts', 'manage_geofence'],
    is_system: true
  },
  {
    name: 'HR',
    description: 'Human Resources Admin',
    permissions: ['override_attendance', 'upload_employees', 'lock_payroll', 'define_policies', 'view_all_data', 'handle_escalations', 'approve_requests', 'edit_punch_times', 'view_reports', 'manage_users', 'manage_shifts', 'manage_geofence'],
    is_system: true
  },
  {
    name: 'MANAGER',
    description: 'Team Manager',
    permissions: ['view_team_data', 'approve_requests', 'view_reports', 'handle_escalations'],
    is_system: true
  },
  {
    name: 'EMPLOYEE',
    description: 'Standard Employee',
    permissions: ['view_self_data', 'submit_requests'],
    is_system: true
  }
];

const initializeRoles = async () => {
  try {
    for (const roleDef of systemRoles) {
      const existingRole = await Role.findOne({ name: roleDef.name });
      if (!existingRole) {
        await Role.create(roleDef);
        logger.info(`Initialized system role: ${roleDef.name}`);
      }
    }
  } catch (error) {
    logger.error('Failed to initialize system roles:', error);
  }
};

module.exports = initializeRoles;
