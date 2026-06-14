import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import moment from 'moment';

// Human-readable labels for action types
const ACTION_LABELS = {
  USER_CREATE: 'User Created',
  USER_UPDATE: 'User Updated',
  USER_DELETE: 'User Deleted',
  USER_BULK_UPLOAD: 'Bulk Upload',
  PUNCH_EDIT: 'Punch Edited',
  ACCESS_REVOKE: 'Access Revoked',
  ACCESS_RESTORE: 'Access Restored',
  ATTENDANCE_OVERRIDE: 'Attendance Override',
  POLICY_CHANGE: 'Policy Changed',
  SHIFT_CHANGE: 'Shift Changed',
  PAYROLL_LOCK: 'Payroll Locked',
  PAYROLL_UNLOCK: 'Payroll Unlocked',
  PERMISSION_CHANGE: 'Permission Changed',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  FAILED_LOGIN: 'Failed Login',
  SYSTEM_CONFIG: 'System Config',
  GEOFENCE_CHANGE: 'Geo-fence Changed',
  REPORT_EXPORT: 'Report Exported',
  REQUEST_CREATE: 'Request Created',
  REQUEST_APPROVE: 'Request Approved',
  REQUEST_REJECT: 'Request Rejected',
  REQUEST_ESCALATE: 'Request Escalated',
  REQUEST_CANCEL: 'Request Cancelled',
  EMERGENCY_OVERRIDE: 'Emergency Override',
  SUPER_ADMIN_ACTION: 'Super Admin Action',
  BACKUP_CREATE: 'Backup Created',
  BACKUP_RESTORE: 'Backup Restored'
};

// Badge color by action category
const getActionBadgeClass = (actionType) => {
  if (['LOGIN', 'LOGOUT'].includes(actionType)) return 'badge-info';
  if (['FAILED_LOGIN'].includes(actionType)) return 'badge-danger';
  if (['USER_CREATE', 'REQUEST_APPROVE', 'ACCESS_RESTORE'].includes(actionType)) return 'badge-success';
  if (['USER_DELETE', 'ACCESS_REVOKE', 'REQUEST_REJECT'].includes(actionType)) return 'badge-danger';
  if (['USER_UPDATE', 'SHIFT_CHANGE', 'POLICY_CHANGE', 'GEOFENCE_CHANGE'].includes(actionType)) return 'badge-warning';
  if (['REQUEST_CREATE', 'REQUEST_ESCALATE', 'REQUEST_CANCEL'].includes(actionType)) return 'badge-primary';
  return 'badge-secondary';
};

// Build a human-readable summary of what changed
const getChangesSummary = (log) => {
  const parts = [];

  // Show reason if present
  if (log.reason) {
    parts.push(log.reason);
  }

  // For USER_UPDATE, diff old_value vs new_value
  if (log.action_type === 'USER_UPDATE' && log.old_value && log.new_value) {
    const interestingFields = ['status', 'role', 'department', 'full_name', 'manager_id'];
    interestingFields.forEach(field => {
      const oldVal = log.old_value[field];
      const newVal = log.new_value[field];
      if (oldVal !== undefined && newVal !== undefined && String(oldVal) !== String(newVal)) {
        const label = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        parts.push(`${label}: ${oldVal || '(empty)'} → ${newVal || '(empty)'}`);
      }
    });
  }

  // For USER_CREATE, show key info
  if (log.action_type === 'USER_CREATE' && log.new_value) {
    const nv = log.new_value;
    if (nv.role) parts.push(`Role: ${nv.role}`);
    if (nv.department) parts.push(`Dept: ${nv.department}`);
  }

  // For ACCESS_REVOKE / ACCESS_RESTORE
  if (['ACCESS_REVOKE', 'ACCESS_RESTORE'].includes(log.action_type) && log.new_value) {
    if (log.new_value.capabilities) {
      parts.push(`Capabilities: ${Array.isArray(log.new_value.capabilities) ? log.new_value.capabilities.join(', ') : log.new_value.capabilities}`);
    }
  }

  return parts.length > 0 ? parts : null;
};

const SystemLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    actionType: '',
    isSuperAdminAction: user?.role === 'SUPER_ADMIN' ? '' : 'false'
  });

  useEffect(() => {
    fetchLogs();
  }, [page, filters, user?.role]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await apiService.admin.getSystemLogs({
        page,
        limit,
        startDate: filters.startDate,
        endDate: filters.endDate,
        actionType: filters.actionType,
        isSuperAdminAction: filters.isSuperAdminAction || undefined
      });
      setLogs(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to load system logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="card">
      <div className="card-header d-flex justify-between align-center">
        <div>
          <h3>System Logs</h3>
          <p className="text-secondary">View audit and system action history</p>
        </div>
      </div>

      <div className="card-body">
        <div className="grid grid-4 gap-2 mb-3">
          <div>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.startDate}
              onChange={e => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.endDate}
              onChange={e => handleFilterChange('endDate', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Action Type</label>
            <select
              className="form-control"
              value={filters.actionType}
              onChange={e => handleFilterChange('actionType', e.target.value)}
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <div>
              <label className="form-label">Super Admin Only</label>
              <select
                className="form-control"
                value={filters.isSuperAdminAction}
                onChange={e => handleFilterChange('isSuperAdminAction', e.target.value)}
              >
                <option value="">All</option>
                <option value="true">Only Super Admin</option>
                <option value="false">Exclude Super Admin</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-screen">
            <LoadingSpinner size="large" />
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-secondary">
                        No logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => {
                      const changes = getChangesSummary(log);

                      return (
                        <tr key={log._id || `${log.action_type}-${log.timestamp}`}>
                          {/* Timestamp */}
                          <td>
                            <div style={{ whiteSpace: 'nowrap' }}>
                              {moment(log.timestamp || log.created_at).format('DD/MM/YYYY')}
                            </div>
                            <div className="text-secondary" style={{ fontSize: '12px' }}>
                              {moment(log.timestamp || log.created_at).format('HH:mm:ss')}
                            </div>
                          </td>

                          {/* Action */}
                          <td>
                            <span className={`badge ${getActionBadgeClass(log.action_type)}`}>
                              {ACTION_LABELS[log.action_type] || log.action_type}
                            </span>
                            {log.is_super_admin_action && (
                              <div style={{ marginTop: '4px' }}>
                                <span className="badge badge-danger" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                  SA
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Actor */}
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {log.actor_user_id?.full_name || 'System'}
                            </div>
                            {log.actor_user_id?.email && (
                              <div className="text-secondary" style={{ fontSize: '12px' }}>
                                {log.actor_user_id.email}
                              </div>
                            )}
                            {log.actor_user_id?.role && (
                              <div className="text-secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                                {log.actor_user_id.role}
                              </div>
                            )}
                          </td>

                          {/* Target */}
                          <td>
                            {log.target_user_id?.full_name ? (
                              <>
                                <div style={{ fontWeight: 500 }}>
                                  {log.target_user_id.full_name}
                                </div>
                                {log.target_user_id.email && (
                                  <div className="text-secondary" style={{ fontSize: '12px' }}>
                                    {log.target_user_id.email}
                                  </div>
                                )}
                              </>
                            ) : log.target_entity_type ? (
                              <div>
                                <span className="text-secondary">{log.target_entity_type}</span>
                              </div>
                            ) : (
                              <span className="text-secondary">—</span>
                            )}
                          </td>

                          {/* Details / Changes */}
                          <td>
                            {changes ? (
                              <div style={{ maxWidth: '320px' }}>
                                {changes.map((line, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: '12px',
                                      padding: '2px 0',
                                      borderBottom: i < changes.length - 1 ? '1px solid var(--border-color)' : 'none'
                                    }}
                                  >
                                    {line}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-secondary">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-between align-center mt-3">
              <div className="text-secondary">
                Showing {logs.length} of {total} logs
                {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
              </div>
              <div className="pagination-actions d-flex gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={page * limit >= total}
                  onClick={() => setPage(prev => prev + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SystemLogs;
