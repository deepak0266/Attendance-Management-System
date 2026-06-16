import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  FaUsers, FaSearch, FaPlus, FaEdit, FaTrash, FaDownload, 
  FaUpload, FaUserCheck, FaUserTimes, FaFilter, FaEye,
  FaUserCog, FaKey
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';
import * as XLSX from 'xlsx';

const UserManagement = () => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialRole = searchParams.get('role') || '';

  const [filters, setFilters] = useState({
    department: '',
    role: initialRole,
    status: '',
    search: ''
  });
  const [showModal, setShowModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    email: '',
    phone: '',
    full_name: '',
    department: '',
    designation: '',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    joining_date: '',
    manager_id: '',
    password: ''
  });
  const [passwordData, setPasswordData] = useState({ new_password: '', reason: '' });
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [managers, setManagers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [errors, setErrors] = useState({});

  const departments = [
    'Management', 'Human Resources', 'Engineering', 'Sales',
    'Marketing', 'Finance', 'Operations', 'Customer Support',
    'IT', 'Administration'
  ];


  const statuses = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'TERMINATED', label: 'Terminated' },
    { value: 'ON_LEAVE', label: 'On Leave' }
  ];

  useEffect(() => {
    fetchUsers();
    fetchManagers();
    fetchRoles();
  }, [filters, pagination.page]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const roleParam = searchParams.get('role');
    if (roleParam !== null && roleParam !== filters.role) {
      setFilters(prev => ({ ...prev, role: roleParam }));
    }
  }, [location.search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };
      const response = await apiService.users.getAll(params);
      setUsers(response.data.data || []);
      setPagination(prev => ({ ...prev, total: response.data.pagination?.total || 0 }));
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await apiService.users.getAll({ limit: 100 });
      // Anyone who can be a manager should be available here. 
      // For simplicity, we just list active users since custom roles can vary.
      setManagers(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch managers:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiService.roles.getAll();
      if (response.data?.success) {
        setRoles(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.employee_id) newErrors.employee_id = 'Employee ID is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.phone) newErrors.phone = 'Phone is required';
    if (!formData.full_name) newErrors.full_name = 'Full name is required';
    if (!formData.department) newErrors.department = 'Department is required';
    if (!formData.joining_date) newErrors.joining_date = 'Joining date is required';
    
    if (!selectedUser && !formData.password) {
      newErrors.password = 'Password is required for new users';
    } else if (!selectedUser && formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      if (selectedUser) {
        await apiService.users.update(selectedUser._id, formData);
        toast.success('User updated successfully');
      } else {
        await apiService.users.create(formData);
        toast.success('User created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      const data = error.response?.data;
      if (data?.details) {
        const messages = Object.values(data.details).join(', ');
        toast.error(`Validation failed: ${messages}`);
      } else if (data?.errors && Array.isArray(data.errors)) {
        toast.error(data.errors[0].msg);
      } else {
        toast.error(data?.error || 'Failed to save user');
      }
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await apiService.users.delete(userId);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    try {
      await apiService.users.update(userId, { status: newStatus });
      toast.success(`User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.new_password || passwordData.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    if (!passwordData.reason) {
      toast.error('Please provide a reason');
      return;
    }
    
    try {
      await apiService.users.adminChangePassword(selectedUser._id, passwordData);
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordData({ new_password: '', reason: '' });
    } catch (error) {
      toast.error('Failed to change password');
    }
  };

  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setBulkFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setBulkPreview(jsonData.slice(0, 5));
    };
    reader.readAsArrayBuffer(file);
  };

  const submitBulkUpload = async () => {
    if (!bulkPreview.length) {
      toast.error('No data to upload');
      return;
    }
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const users = XLSX.utils.sheet_to_json(worksheet);
        
        const response = await apiService.users.bulkUpload(users);
        toast.success(`Successfully created ${response.data.data.successful.length} users`);
        setShowBulkUpload(false);
        setBulkFile(null);
        setBulkPreview([]);
        fetchUsers();
      };
      reader.readAsArrayBuffer(bulkFile);
    } catch (error) {
      toast.error('Bulk upload failed');
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        employee_id: 'EMP001',
        email: 'john@company.com',
        phone: '+1234567890',
        full_name: 'John Doe',
        department: 'Engineering',
        designation: 'Software Engineer',
        role: 'EMPLOYEE',
        joining_date: '2024-01-01',
        password: 'Temp@123'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'user_upload_template.xlsx');
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      email: '',
      phone: '',
      full_name: '',
      department: '',
      designation: '',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      joining_date: '',
      manager_id: '',
      password: ''
    });
    setSelectedUser(null);
    setErrors({});
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      employee_id: user.employee_id,
      email: user.email,
      phone: user.phone,
      full_name: user.full_name,
      department: user.department,
      designation: user.designation || '',
      role: user.role,
      status: user.status,
      joining_date: user.joining_date ? moment(user.joining_date).format('YYYY-MM-DD') : '',
      manager_id: user.manager_id || '',
      password: ''
    });
    setShowModal(true);
  };

  const openPasswordModal = (user) => {
    setSelectedUser(user);
    setShowPasswordModal(true);
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="user-management">
      {/* Header Actions */}
      <div className="d-flex justify-between align-center mb-2">
        <h3>User Management</h3>
        <div className="d-flex gap-2">
          <button className="btn btn-secondary" onClick={downloadTemplate}>
            <FaDownload /> Template
          </button>
          <button className="btn btn-secondary" onClick={() => setShowBulkUpload(true)}>
            <FaUpload /> Bulk Upload
          </button>
          {hasPermission('upload_employees') && (
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
              <FaPlus /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-2">
        <div className="d-flex flex-wrap gap-2 align-end">
          <div className="form-group">
            <label className="form-label">Search</label>
            <div className="search-bar">
              <FaSearch className="text-tertiary" />
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Department</label>
            <select
              className="form-control"
              value={filters.department}
              onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-control"
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
            >
              <option value="">All Roles</option>
              {roles.map(r => {
                if (r.name === 'SUPER_ADMIN' && user?.role !== 'SUPER_ADMIN') return null;
                return <option key={r._id} value={r.name}>{r.name}</option>;
              })}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-control"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Status</option>
              {statuses.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          
          <button className="btn btn-primary" onClick={fetchUsers}>
            <FaFilter /> Apply Filters
          </button>
          <button className="btn btn-secondary" onClick={() => setFilters({ department: '', role: '', status: '', search: '' })}>
            Clear
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-3">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-secondary py-3">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="d-flex align-center gap-2">
                        <div className="user-avatar">
                          {u.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-sm text-secondary">{u.email}</p>
                          <p className="text-xs text-tertiary">{u.employee_id}</p>
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
                      <span className={`badge badge-${u.status === 'ACTIVE' ? 'success' : u.status === 'INACTIVE' ? 'secondary' : 'warning'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>{u.joining_date ? moment(u.joining_date).format('DD/MM/YYYY') : '-'}</td>
                    <td>
                      <div className="d-flex gap-1">
                        <button 
                          className="btn-icon btn-secondary"
                          onClick={() => openEditModal(u)}
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="btn-icon btn-info"
                          onClick={() => openPasswordModal(u)}
                          title="Change Password"
                        >
                          <FaKey />
                        </button>
                        <button 
                          className={`btn-icon ${u.status === 'ACTIVE' ? 'btn-warning' : 'btn-success'}`}
                          onClick={() => handleStatusToggle(u._id, u.status)}
                          title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        >
                          {u.status === 'ACTIVE' ? <FaUserTimes /> : <FaUserCheck />}
                        </button>
                        {user?.role === 'SUPER_ADMIN' && u._id !== user.id && (
                          <button 
                            className="btn-icon btn-danger"
                            onClick={() => handleDelete(u._id)}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination mt-2">
            <button 
              className="pagination-item"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {pagination.page} of {totalPages}
            </span>
            <button 
              className="pagination-item"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit User Modal */}
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
                <h3>{selectedUser ? 'Edit User' : 'Create New User'}</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">Employee ID <span className="required">*</span></label>
                      <input
                        type="text"
                        className={`form-control ${errors.employee_id ? 'error' : ''}`}
                        value={formData.employee_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value.toUpperCase() }))}
                        disabled={!!selectedUser}
                      />
                      {errors.employee_id && <span className="form-error">{errors.employee_id}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Email <span className="required">*</span></label>
                      <input
                        type="email"
                        className={`form-control ${errors.email ? 'error' : ''}`}
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      />
                      {errors.email && <span className="form-error">{errors.email}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Full Name <span className="required">*</span></label>
                      <input
                        type="text"
                        className={`form-control ${errors.full_name ? 'error' : ''}`}
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      />
                      {errors.full_name && <span className="form-error">{errors.full_name}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Phone <span className="required">*</span></label>
                      <input
                        type="tel"
                        className={`form-control ${errors.phone ? 'error' : ''}`}
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                      {errors.phone && <span className="form-error">{errors.phone}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Department <span className="required">*</span></label>
                      <select
                        className={`form-control ${errors.department ? 'error' : ''}`}
                        value={formData.department}
                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      >
                        <option value="">Select Department</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                      {errors.department && <span className="form-error">{errors.department}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Designation</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.designation}
                        onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select
                        className="form-control"
                        value={formData.role}
                        onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                        disabled={user?.role !== 'SUPER_ADMIN' && formData.role === 'SUPER_ADMIN'}
                      >
                        {roles.map(r => {
                          if (r.name === 'SUPER_ADMIN' && user?.role !== 'SUPER_ADMIN') return null;
                          return <option key={r._id} value={r.name}>{r.name}</option>;
                        })}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select
                        className="form-control"
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      >
                        {statuses.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Manager</label>
                      <select
                        className="form-control"
                        value={formData.manager_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, manager_id: e.target.value }))}
                      >
                        <option value="">None</option>
                        {managers.map(m => (
                          <option key={m._id} value={m._id}>{m.full_name} ({m.role})</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Joining Date <span className="required">*</span></label>
                      <input
                        type="date"
                        className={`form-control ${errors.joining_date ? 'error' : ''}`}
                        value={formData.joining_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, joining_date: e.target.value }))}
                      />
                      {errors.joining_date && <span className="form-error">{errors.joining_date}</span>}
                    </div>
                    
                    {!selectedUser && (
                      <div className="form-group">
                        <label className="form-label">Password <span className="required">*</span></label>
                        <input
                          type="password"
                          className={`form-control ${errors.password ? 'error' : ''}`}
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Minimum 8 characters"
                        />
                        {errors.password && <span className="form-error">{errors.password}</span>}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {selectedUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Change Modal */}
      <AnimatePresence>
        {showPasswordModal && selectedUser && (
          <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <motion.div 
              className="modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Change Password - {selectedUser.full_name}</h3>
                <button className="modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
              </div>
              
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Reason for Change</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={passwordData.reason}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Please provide a reason for this password change..."
                  />
                </div>
                
                <div className="alert alert-warning">
                  <p>This action will be logged for audit purposes.</p>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-warning" onClick={handlePasswordChange}>
                  Change Password
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {showBulkUpload && (
          <div className="modal-overlay" onClick={() => setShowBulkUpload(false)}>
            <motion.div 
              className="modal modal-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Bulk Upload Users</h3>
                <button className="modal-close" onClick={() => setShowBulkUpload(false)}>×</button>
              </div>
              
              <div className="modal-body">
                <div className="file-upload mb-2">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleBulkUpload}
                    style={{ display: 'none' }}
                    id="bulk-upload"
                  />
                  <label htmlFor="bulk-upload" className="file-upload-label">
                    <FaUpload size={40} className="text-tertiary mb-2" />
                    <p>Click to upload Excel/CSV file</p>
                    <p className="text-sm text-tertiary">
                      Download template for correct format
                    </p>
                  </label>
                </div>
                
                {bulkPreview.length > 0 && (
                  <>
                    <h4 className="mb-1">Preview (First 5 rows)</h4>
                    <div className="table-container">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Employee ID</th>
                            <th>Email</th>
                            <th>Name</th>
                            <th>Department</th>
                            <th>Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkPreview.map((row, idx) => (
                            <tr key={idx}>
                              <td>{row.employee_id}</td>
                              <td>{row.email}</td>
                              <td>{row.full_name}</td>
                              <td>{row.department}</td>
                              <td>{row.role}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                
                <div className="alert alert-info mt-2">
                  <p><strong>Required columns:</strong> employee_id, email, phone, full_name, department, joining_date</p>
                  <p><strong>Optional columns:</strong> designation, role, manager_email, password</p>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkUpload(false)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={submitBulkUpload}
                  disabled={!bulkPreview.length}
                >
                  Upload Users
                </button>
              </div>
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
          flex-shrink: 0;
        }
        
        .btn-icon {
          width: 32px;
          height: 32px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }
        
        .search-bar {
          display: flex;
          align-items: center;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 8px;
          padding: 0 12px;
          min-width: 250px;
        }
        
        .search-bar input {
          flex: 1;
          padding: 10px 0 10px 10px;
          border: none;
          background: none;
          color: var(--text-primary);
        }
        
        .search-bar input:focus {
          outline: none;
        }
        
        .file-upload {
          border: 2px dashed var(--border-color);
          border-radius: 10px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .file-upload:hover {
          border-color: #667eea;
          background: color-mix(in srgb, #667eea 5%, transparent);
        }
        
        .file-upload-label {
          cursor: pointer;
          display: block;
        }
        
        .table-sm th,
        .table-sm td {
          padding: 8px 12px;
          font-size: 13px;
        }
        
        .text-xs {
          font-size: 11px;
        }
        
        .gap-1 {
          gap: 5px;
        }
        
        .required {
          color: var(--danger-color);
        }
        
        .pagination-info {
          padding: 0 15px;
          color: var(--text-secondary);
        }
        
        @media (max-width: 768px) {
          .search-bar {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default UserManagement;