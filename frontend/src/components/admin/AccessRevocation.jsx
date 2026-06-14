import React, { useState, useEffect } from 'react';
import { 
  FaShieldAlt, FaBan, FaUndo, FaHistory, FaSearch,
  FaUser, FaCalendar, FaExclamationTriangle, FaCheck
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';

const AccessRevocation = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('revoke');
  const [users, setUsers] = useState([]);
  const [revocations, setRevocations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    userId: '',
    capabilities: [],
    reason: '',
    expiresAt: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [errors, setErrors] = useState({});

  const capabilities = [
    { value: 'override_attendance', label: 'Override Attendance', description: 'Ability to override attendance records' },
    { value: 'upload_employees', label: 'Upload Employees', description: 'Bulk upload and create employee accounts' },
    { value: 'lock_payroll', label: 'Lock Payroll', description: 'Lock payroll periods' },
    { value: 'define_policies', label: 'Define Policies', description: 'Create and modify attendance policies' },
    { value: 'view_all_data', label: 'View All Data', description: 'Access all system data' },
    { value: 'handle_escalations', label: 'Handle Escalations', description: 'Handle escalated approval requests' },
    { value: 'approve_requests', label: 'Approve Requests', description: 'Approve attendance requests' },
    { value: 'edit_punch_times', label: 'Edit Punch Times', description: 'Edit punch in/out times' },
    { value: 'view_reports', label: 'View Reports', description: 'Access all reports' },
    { value: 'manage_users', label: 'Manage Users', description: 'Create, edit, and delete users' },
    { value: 'login', label: 'Login Access', description: 'Ability to login to the system' }
  ];

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      fetchUsers();
      fetchRevocations();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiService.users.getAll({ limit: 100 });
      setUsers(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchRevocations = async () => {
    try {
      // This would be a dedicated endpoint for revocations
      const response = await apiService.admin.getSystemLogs({ 
        actionType: 'ACCESS_REVOKE',
        isSuperAdminAction: true,
        limit: 50 
      });
      setRevocations(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch revocations:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.userId) newErrors.userId = 'User is required';
    if (formData.capabilities.length === 0) newErrors.capabilities = 'At least one capability must be selected';
    if (!formData.reason || formData.reason.length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters';
    }
    if (formData.expiresAt && new Date(formData.expiresAt) <= new Date()) {
      newErrors.expiresAt = 'Expiry date must be in the future';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRevoke = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      await apiService.admin.revokePermission(formData);
      toast.success('Permissions revoked successfully');
      setShowModal(false);
      resetForm();
      fetchRevocations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to revoke permissions');
    }
  };

  const handleRestore = async (revocationId) => {
    if (!window.confirm('Are you sure you want to restore these permissions?')) return;
    
    try {
      await apiService.admin.restorePermission(revocationId);
      toast.success('Permissions restored successfully');
      fetchRevocations();
    } catch (error) {
      toast.error('Failed to restore permissions');
    }
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      capabilities: [],
      reason: '',
      expiresAt: ''
    });
    setSelectedUser(null);
    setErrors({});
  };

  const openRevokeModal = (user = null) => {
    if (user) {
      setSelectedUser(user);
      setFormData(prev => ({ ...prev, userId: user._id }));
    }
    setShowModal(true);
  };

  const toggleCapability = (capability) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter(c => c !== capability)
        : [...prev.capabilities, capability]
    }));
  };

  const filteredUsers = users.filter(u => 
    u._id !== user?.id && (
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="card">
        <div className="empty-state p-4">
          <FaShieldAlt size={50} className="text-danger mb-2" />
          <h4>Access Denied</h4>
          <p className="text-secondary">Only Super Admin can access this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="access-revocation">
      <div className="d-flex justify-between align-center mb-2">
        <h3>Access Revocation</h3>
        <div className="d-flex gap-2">
          <button 
            className={`btn ${activeTab === 'revoke' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('revoke')}
          >
            <FaBan /> Revoke Access
          </button>
          <button 
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            <FaHistory /> Revocation History
          </button>
        </div>
      </div>

      {activeTab === 'revoke' && (
        <>
          <div className="card mb-2">
            <div className="alert alert-warning">
              <FaExclamationTriangle className="mr-2" />
              <strong>Warning:</strong> Revoking permissions will immediately affect the user's access.
              All actions are logged and auditable.
            </div>
            
            <div className="search-bar mb-2">
              <FaSearch className="text-tertiary" />
              <input
                type="text"
                placeholder="Search users by name, email, or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="text-center py-3">
                        <LoadingSpinner />
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-secondary py-3">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u._id}>
                        <td>
                          <div className="d-flex align-center gap-2">
                            <div className="user-avatar">
                              {u.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-medium">{u.full_name}</p>
                              <p className="text-sm text-secondary">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>{u.department}</td>
                        <td>
                          <span className={`badge badge-${u.role === 'SUPER_ADMIN' ? 'danger' : u.role === 'HR' ? 'info' : u.role === 'MANAGER' ? 'warning' : 'success'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${u.status === 'ACTIVE' ? 'success' : 'secondary'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => openRevokeModal(u)}
                          >
                            <FaBan /> Revoke Access
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Revoked Capabilities</th>
                  <th>Revoked By</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {revocations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-secondary py-3">
                      No revocation history found
                    </td>
                  </tr>
                ) : (
                  revocations.map(rev => (
                    <tr key={rev._id}>
                      <td>{moment(rev.timestamp).format('DD/MM/YYYY HH:mm')}</td>
                      <td>
                        <div>
                          <p className="font-medium">{rev.target_user_id?.full_name}</p>
                          <p className="text-sm text-secondary">{rev.target_user_id?.email}</p>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {rev.new_value?.capabilities?.map(cap => (
                            <span key={cap} className="badge badge-danger">{cap}</span>
                          ))}
                        </div>
                      </td>
                      <td>{rev.actor_user_id?.full_name}</td>
                      <td>{rev.reason}</td>
                      <td>
                        <span className={`badge ${rev.new_value?.is_active ? 'badge-warning' : 'badge-success'}`}>
                          {rev.new_value?.is_active ? 'Active' : 'Restored'}
                        </span>
                      </td>
                      <td>
                        {rev.new_value?.is_active && (
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleRestore(rev._id)}
                          >
                            <FaUndo /> Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <motion.div 
              className="modal modal-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Revoke Access Permissions</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              
              <form onSubmit={handleRevoke}>
                <div className="modal-body">
                  {!selectedUser && (
                    <div className="form-group">
                      <label className="form-label">Select User <span className="required">*</span></label>
                      <select
                        className={`form-control ${errors.userId ? 'error' : ''}`}
                        value={formData.userId}
                        onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                      >
                        <option value="">Select a user...</option>
                        {filteredUsers.map(u => (
                          <option key={u._id} value={u._id}>
                            {u.full_name} ({u.employee_id}) - {u.role}
                          </option>
                        ))}
                      </select>
                      {errors.userId && <span className="form-error">{errors.userId}</span>}
                    </div>
                  )}
                  
                  {selectedUser && (
                    <div className="selected-user-info mb-3">
                      <div className="d-flex align-center gap-3">
                        <div className="user-avatar-lg">
                          {selectedUser.full_name?.charAt(0)}
                        </div>
                        <div>
                          <h4>{selectedUser.full_name}</h4>
                          <p className="text-secondary">{selectedUser.email}</p>
                          <p className="text-sm">
                            <span className={`badge badge-${selectedUser.role === 'SUPER_ADMIN' ? 'danger' : 'info'}`}>
                              {selectedUser.role}
                            </span>
                            <span className="ml-2">{selectedUser.department}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="form-group">
                    <label className="form-label">
                      Capabilities to Revoke <span className="required">*</span>
                    </label>
                    <div className="capabilities-list">
                      {capabilities.map(cap => (
                        <label key={cap.value} className="capability-item">
                          <input
                            type="checkbox"
                            checked={formData.capabilities.includes(cap.value)}
                            onChange={() => toggleCapability(cap.value)}
                          />
                          <div className="capability-info">
                            <span className="capability-label">{cap.label}</span>
                            <span className="capability-desc">{cap.description}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    {errors.capabilities && <span className="form-error">{errors.capabilities}</span>}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Reason for Revocation <span className="required">*</span></label>
                    <textarea
                      className={`form-control ${errors.reason ? 'error' : ''}`}
                      rows="3"
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Provide a detailed reason for this revocation..."
                      maxLength={500}
                    />
                    <div className="form-hint">
                      {formData.reason.length}/500 characters
                    </div>
                    {errors.reason && <span className="form-error">{errors.reason}</span>}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Expires At (Optional)</label>
                    <input
                      type="datetime-local"
                      className={`form-control ${errors.expiresAt ? 'error' : ''}`}
                      value={formData.expiresAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                      min={moment().format('YYYY-MM-DDTHH:mm')}
                    />
                    <p className="form-hint">Leave empty for permanent revocation</p>
                    {errors.expiresAt && <span className="form-error">{errors.expiresAt}</span>}
                  </div>
                  
                  <div className="alert alert-danger">
                    <FaExclamationTriangle className="mr-2" />
                    <strong>This action cannot be undone without Super Admin approval.</strong>
                    <p className="mt-1">All revocation actions are permanently logged for audit purposes.</p>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger">
                    <FaBan /> Revoke Access
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }
        
        .user-avatar-lg {
          width: 60px;
          height: 60px;
          border-radius: 15px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 24px;
        }
        
        .search-bar {
          display: flex;
          align-items: center;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 8px;
          padding: 0 15px;
        }
        
        .search-bar input {
          flex: 1;
          padding: 12px 0 12px 10px;
          border: none;
          background: none;
          color: var(--text-primary);
        }
        
        .search-bar input:focus {
          outline: none;
        }
        
        .capabilities-list {
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px;
        }
        
        .capability-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .capability-item:last-child {
          border-bottom: none;
        }
        
        .capability-item:hover {
          background: var(--hover-bg);
        }
        
        .capability-info {
          flex: 1;
        }
        
        .capability-label {
          font-weight: 500;
          display: block;
          margin-bottom: 3px;
        }
        
        .capability-desc {
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .selected-user-info {
          padding: 15px;
          background: var(--bg-secondary);
          border-radius: 10px;
        }
        
        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }
        
        .mr-2 {
          margin-right: 8px;
        }
        
        .ml-2 {
          margin-left: 8px;
        }
        
        .gap-3 {
          gap: 15px;
        }
        
        .flex-wrap {
          flex-wrap: wrap;
        }
        
        .required {
          color: var(--danger-color);
        }
      `}</style>
    </div>
  );
};

export default AccessRevocation;