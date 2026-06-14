import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaShieldAlt, FaUsers } from 'react-icons/fa';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../common/LoadingSpinner';

const AVAILABLE_PERMISSIONS = [
  { id: 'view_all_data', label: 'View All Data', desc: 'Can view data across all departments' },
  { id: 'view_team_data', label: 'View Team Data', desc: 'Can view data of subordinates' },
  { id: 'view_self_data', label: 'View Self Data', desc: 'Can view own data only' },
  { id: 'manage_users', label: 'Manage Users', desc: 'Can add, edit, or delete users' },
  { id: 'manage_roles', label: 'Manage Roles', desc: 'Can create and modify custom roles' },
  { id: 'override_attendance', label: 'Override Attendance', desc: 'Can manually adjust punch records' },
  { id: 'approve_requests', label: 'Approve Requests', desc: 'Can approve regularization/leave requests' },
  { id: 'view_reports', label: 'View Reports', desc: 'Can access reporting dashboards' },
  { id: 'handle_escalations', label: 'Handle Escalations', desc: 'Can process escalated requests' },
  { id: 'define_policies', label: 'Define Policies', desc: 'Can modify system policies' },
  { id: 'manage_shifts', label: 'Manage Shifts', desc: 'Can create and assign shifts' },
  { id: 'manage_geofence', label: 'Manage Geo-fences', desc: 'Can configure location boundaries' }
];

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState({});
  
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    description: '',
    permissions: [],
    is_system: false,
    approval_restrictions: {
      late_punch_in: false,
      early_punch_out: false,
      out_of_location: false
    }
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await apiService.roles.getAll();
      if (response.data?.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permissionId) => {
    if (formData.is_system) return; // Prevent changing permissions for system roles
    setFormData(prev => {
      const perms = prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId];
      return { ...prev, permissions: perms };
    });
  };

  const handleRestrictionToggle = (key) => {
    setFormData(prev => ({
      ...prev,
      approval_restrictions: {
        ...prev.approval_restrictions,
        [key]: !prev.approval_restrictions[key]
      }
    }));
  };

  const resetForm = () => {
    setFormData({ 
      id: null, 
      name: '', 
      description: '', 
      permissions: [], 
      is_system: false,
      approval_restrictions: {
        late_punch_in: false,
        early_punch_out: false,
        out_of_location: false
      }
    });
    setShowForm(false);
  };

  const toggleExpand = (roleId) => {
    setExpandedRoles(prev => ({
      ...prev,
      [roleId]: !prev[roleId]
    }));
  };

  const handleEdit = (role) => {
    setFormData({
      id: role._id,
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || [],
      is_system: role.is_system || false,
      approval_restrictions: role.approval_restrictions || {
        late_punch_in: false,
        early_punch_out: false,
        out_of_location: false
      }
    });
    setShowForm(true);
  };

  const handleDeleteRequest = async (roleId) => {
    if (window.confirm('Are you sure you want to request deletion for this role? This requires multi-admin approval.')) {
      try {
        const response = await apiService.roles.requestDeletion(roleId);
        if (response.data?.success) {
          toast.success('Deletion request submitted to Super Admins');
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to request deletion');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await apiService.roles.update(formData.id, {
          description: formData.description,
          permissions: formData.permissions,
          approval_restrictions: formData.approval_restrictions
        });
        toast.success('Role updated successfully');
      } else {
        await apiService.roles.create({
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
          approval_restrictions: formData.approval_restrictions
        });
        toast.success('Role created successfully');
      }
      fetchRoles();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save role');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="role-management">
      <div className="d-flex justify-content-between align-center mb-4">
        <div>
          <h3>Role Management</h3>
          <p className="text-secondary">Create custom roles and manage hierarchical permissions</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowForm(true); }}
        >
          <FaPlus className="mr-2" /> Create Custom Role
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card mb-4"
          >
            <div className="card-header d-flex justify-content-between align-center">
              <h4>{formData.id ? 'Edit Role' : 'Create New Role'}</h4>
              <button className="btn btn-secondary btn-sm" onClick={resetForm}>Cancel</button>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group mb-3">
                  <label>Role Name <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. DIRECTOR, VP"
                    disabled={!!formData.id}
                    required
                  />
                  <small className="text-secondary">Use descriptive names. Cannot be changed later.</small>
                </div>
                
                <div className="form-group mb-4">
                  <label>Description</label>
                  <textarea 
                    className="form-control" 
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Brief description of what this role does"
                    rows="2"
                  ></textarea>
                </div>

                <div className="mb-4">
                  <label className="mb-2 d-block"><strong>Permissions</strong></label>
                  <div className="permissions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                    {AVAILABLE_PERMISSIONS.map(perm => (
                      <div 
                        key={perm.id} 
                        className={`permission-card p-3 rounded border ${formData.permissions.includes(perm.id) ? 'border-primary bg-primary-light' : ''}`}
                        onClick={() => handlePermissionToggle(perm.id)}
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <div className="d-flex align-center gap-2 mb-1">
                          <input 
                            type="checkbox" 
                            checked={formData.permissions.includes(perm.id)}
                            onChange={() => {}}
                            disabled={formData.is_system}
                            style={{ cursor: formData.is_system ? 'not-allowed' : 'pointer' }}
                          />
                          <strong>{perm.label}</strong>
                        </div>
                        <p className="text-sm text-secondary m-0 pl-4">{perm.desc}</p>
                      </div>
                    ))}
                  </div>
                  {formData.is_system && <small className="text-warning mt-2 d-block">System role permissions cannot be modified.</small>}
                </div>

                <div className="mb-4">
                  <label className="mb-2 d-block"><strong>Approval Restrictions</strong></label>
                  <p className="text-sm text-secondary mb-3">Require manager approval for specific punch actions (Defaults to false for no approval required).</p>
                  <div className="d-flex flex-column gap-3">
                    <label className="d-flex align-center gap-2" style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.approval_restrictions.late_punch_in}
                        onChange={() => handleRestrictionToggle('late_punch_in')}
                      />
                      <span>Require Approval for <strong>Late Punch-In</strong></span>
                    </label>
                    <label className="d-flex align-center gap-2" style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.approval_restrictions.early_punch_out}
                        onChange={() => handleRestrictionToggle('early_punch_out')}
                      />
                      <span>Require Approval for <strong>Early Punch-Out</strong></span>
                    </label>
                    <label className="d-flex align-center gap-2" style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.approval_restrictions.out_of_location}
                        onChange={() => handleRestrictionToggle('out_of_location')}
                      />
                      <span>Require Approval for <strong>Out of Geo-fence Location</strong></span>
                    </label>
                  </div>
                </div>

                <div className="d-flex justify-content-end">
                  <button type="submit" className="btn btn-primary">
                    {formData.id ? 'Save Changes' : 'Create Role'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {roles.map(role => (
          <div key={role._id} className="card h-100">
            <div className="card-header d-flex justify-content-between align-center">
              <div className="d-flex align-center gap-2">
                <FaShieldAlt className={role.is_system ? 'text-primary' : 'text-success'} />
                <h4 className="m-0">{role.name}</h4>
              </div>
              {role.is_system ? (
                <span className="badge badge-info">System</span>
              ) : (
                <span className="badge badge-success">Custom</span>
              )}
            </div>
            <div className="card-body">
              <p className="text-secondary text-sm mb-3">{role.description || 'No description provided.'}</p>
              
              <div className="mb-3">
                <strong className="text-sm d-block mb-2">Permissions ({role.permissions?.length || 0})</strong>
                <div className="d-flex flex-wrap gap-1">
                  {role.permissions?.slice(0, expandedRoles[role._id] ? role.permissions.length : 3).map(p => (
                    <span key={p} className="badge badge-secondary" style={{ fontSize: '10px' }}>{p}</span>
                  ))}
                  {(role.permissions?.length || 0) > 3 && !expandedRoles[role._id] && (
                    <span 
                      className="badge badge-secondary" 
                      style={{ fontSize: '10px', cursor: 'pointer', backgroundColor: '#e2e8f0', color: '#475569' }}
                      onClick={() => toggleExpand(role._id)}
                    >
                      +{role.permissions.length - 3} more (click to expand)
                    </span>
                  )}
                  {expandedRoles[role._id] && (
                    <span 
                      className="badge badge-secondary" 
                      style={{ fontSize: '10px', cursor: 'pointer', backgroundColor: '#e2e8f0', color: '#475569' }}
                      onClick={() => toggleExpand(role._id)}
                    >
                      Show less
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="card-footer bg-light p-3 d-flex justify-content-between align-center border-top">
              <span className="text-xs text-secondary">
                {role.is_system ? 'Protected System Role' : `Created: ${new Date(role.createdAt).toLocaleDateString()}`}
              </span>
              <div className="btn-group">
                <button className="btn btn-icon btn-secondary btn-sm" onClick={() => handleEdit(role)} title="Edit Role">
                  <FaEdit />
                </button>
                {!role.is_system && (
                  <button className="btn btn-icon btn-outline-danger btn-sm" onClick={() => handleDeleteRequest(role._id)} title="Delete Role">
                    <FaTrash />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoleManagement;
