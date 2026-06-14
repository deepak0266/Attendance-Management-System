import React, { useState, useEffect } from 'react';
import { 
  FaClock, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff,
  FaCalendar, FaCopy, FaSave, FaTimes
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';

const ShiftManagement = () => {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'Fixed',
    description: '',
    start_time: '09:00',
    end_time: '18:00',
    grace_period_minutes: 15,
    late_threshold_minutes: 30,
    half_day_threshold_hours: 4,
    break_duration_minutes: 60,
    break_is_paid: false,
    working_days: [1, 2, 3, 4, 5],
    applicable_departments: [],
    is_active: true,
    effective_from: moment().format('YYYY-MM-DD')
  });
  const [errors, setErrors] = useState({});

  const shiftTypes = [
    { value: 'Fixed', label: 'Fixed Shift' },
    { value: 'Flexible', label: 'Flexible Shift' },
    { value: 'Rotational', label: 'Rotational Shift' },
    { value: 'Night', label: 'Night Shift' }
  ];

  const weekDays = [
    { value: 0, label: 'Sun', full: 'Sunday' },
    { value: 1, label: 'Mon', full: 'Monday' },
    { value: 2, label: 'Tue', full: 'Tuesday' },
    { value: 3, label: 'Wed', full: 'Wednesday' },
    { value: 4, label: 'Thu', full: 'Thursday' },
    { value: 5, label: 'Fri', full: 'Friday' },
    { value: 6, label: 'Sat', full: 'Saturday' }
  ];

  const departments = [
    'Management', 'Human Resources', 'Engineering', 'Sales',
    'Marketing', 'Finance', 'Operations', 'Customer Support',
    'IT', 'Administration'
  ];

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const response = await apiService.admin.getShifts();
      setShifts(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch shifts');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name) newErrors.name = 'Shift name is required';
    if (!formData.code) newErrors.code = 'Shift code is required';
    if (!formData.start_time) newErrors.start_time = 'Start time is required';
    if (!formData.end_time) newErrors.end_time = 'End time is required';
    if (!formData.effective_from) newErrors.effective_from = 'Effective date is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      if (selectedShift) {
        await apiService.admin.updateShift(selectedShift._id, formData);
        toast.success('Shift updated successfully');
      } else {
        await apiService.admin.createShift(formData);
        toast.success('Shift created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchShifts();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save shift');
    }
  };

  const handleDelete = async (shiftId) => {
    if (!window.confirm('Are you sure you want to delete this shift?')) return;
    
    try {
      await apiService.admin.deleteShift(shiftId);
      toast.success('Shift deleted successfully');
      fetchShifts();
    } catch (error) {
      toast.error('Failed to delete shift');
    }
  };

  const handleToggleActive = async (shift) => {
    try {
      await apiService.admin.updateShift(shift._id, { is_active: !shift.is_active });
      toast.success(`Shift ${shift.is_active ? 'deactivated' : 'activated'}`);
      fetchShifts();
    } catch (error) {
      toast.error('Failed to update shift status');
    }
  };

  const handleDuplicate = (shift) => {
    setFormData({
      ...shift,
      name: `${shift.name} (Copy)`,
      code: `${shift.code}-COPY`,
      version: 1,
      effective_from: moment().format('YYYY-MM-DD'),
      _id: undefined
    });
    setSelectedShift(null);
    setShowModal(true);
  };

  const toggleWorkingDay = (day) => {
    setFormData(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day]
    }));
  };

  const toggleDepartment = (dept) => {
    setFormData(prev => ({
      ...prev,
      applicable_departments: prev.applicable_departments.includes(dept)
        ? prev.applicable_departments.filter(d => d !== dept)
        : [...prev.applicable_departments, dept]
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'Fixed',
      description: '',
      start_time: '09:00',
      end_time: '18:00',
      grace_period_minutes: 15,
      late_threshold_minutes: 30,
      half_day_threshold_hours: 4,
      break_duration_minutes: 60,
      break_is_paid: false,
      working_days: [1, 2, 3, 4, 5],
      applicable_departments: [],
      is_active: true,
      effective_from: moment().format('YYYY-MM-DD')
    });
    setSelectedShift(null);
    setErrors({});
  };

  const openEditModal = (shift) => {
    setSelectedShift(shift);
    setFormData({
      name: shift.name,
      code: shift.code,
      type: shift.type,
      description: shift.description || '',
      start_time: shift.start_time,
      end_time: shift.end_time,
      grace_period_minutes: shift.grace_period_minutes,
      late_threshold_minutes: shift.late_threshold_minutes,
      half_day_threshold_hours: shift.half_day_threshold_hours,
      break_duration_minutes: shift.break_duration_minutes,
      break_is_paid: shift.break_is_paid,
      working_days: shift.working_days,
      applicable_departments: shift.applicable_departments || [],
      is_active: shift.is_active,
      effective_from: shift.effective_from ? moment(shift.effective_from).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD')
    });
    setShowModal(true);
  };

  const calculateDuration = (start, end) => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    let hours = endHour - startHour;
    let minutes = endMin - startMin;
    
    if (formData.type === 'Night') {
      hours += 24;
    }
    
    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="shift-management">
      <div className="d-flex justify-between align-center mb-2">
        <h3>Shift Management</h3>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FaPlus /> Create Shift
        </button>
      </div>

      <div className="grid grid-3">
        {loading ? (
          <div className="col-span-3 text-center py-3">
            <LoadingSpinner />
          </div>
        ) : shifts.length === 0 ? (
          <div className="col-span-3 empty-state">
            <FaClock size={50} className="text-tertiary mb-2" />
            <p>No shifts found</p>
            <button className="btn btn-primary mt-2" onClick={() => setShowModal(true)}>
              Create Your First Shift
            </button>
          </div>
        ) : (
          shifts.map(shift => (
            <motion.div 
              key={shift._id}
              className="card shift-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
            >
              <div className="shift-header">
                <div>
                  <h4>{shift.name}</h4>
                  <span className="badge badge-info">{shift.code}</span>
                </div>
                <div className={`status-badge ${shift.is_active ? 'active' : 'inactive'}`}>
                  {shift.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <div className="shift-body">
                <div className="shift-time">
                  <FaClock className="text-tertiary" />
                  <span>{shift.start_time} - {shift.end_time}</span>
                </div>
                
                <div className="shift-details">
                  <div className="detail-item">
                    <span className="label">Type:</span>
                    <span className="value">{shift.type}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Grace Period:</span>
                    <span className="value">{shift.grace_period_minutes} min</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Working Days:</span>
                    <span className="value">
                      {shift.working_days?.map(d => weekDays.find(w => w.value === d)?.label).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="shift-footer">
                <button 
                  className="btn-icon btn-secondary"
                  onClick={() => openEditModal(shift)}
                  title="Edit"
                >
                  <FaEdit />
                </button>
                <button 
                  className="btn-icon btn-secondary"
                  onClick={() => handleDuplicate(shift)}
                  title="Duplicate"
                >
                  <FaCopy />
                </button>
                <button 
                  className={`btn-icon ${shift.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleActive(shift)}
                  title={shift.is_active ? 'Deactivate' : 'Activate'}
                >
                  {shift.is_active ? <FaToggleOff /> : <FaToggleOn />}
                </button>
                <button 
                  className="btn-icon btn-danger"
                  onClick={() => handleDelete(shift._id)}
                  title="Delete"
                >
                  <FaTrash />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create/Edit Shift Modal */}
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
                <h3>{selectedShift ? 'Edit Shift' : 'Create New Shift'}</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">Shift Name <span className="required">*</span></label>
                      <input
                        type="text"
                        className={`form-control ${errors.name ? 'error' : ''}`}
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                      {errors.name && <span className="form-error">{errors.name}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Shift Code <span className="required">*</span></label>
                      <input
                        type="text"
                        className={`form-control ${errors.code ? 'error' : ''}`}
                        value={formData.code}
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      />
                      {errors.code && <span className="form-error">{errors.code}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Shift Type</label>
                      <select
                        className="form-control"
                        value={formData.type}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      >
                        {shiftTypes.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Start Time <span className="required">*</span></label>
                      <input
                        type="time"
                        className={`form-control ${errors.start_time ? 'error' : ''}`}
                        value={formData.start_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      />
                      {errors.start_time && <span className="form-error">{errors.start_time}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">End Time <span className="required">*</span></label>
                      <input
                        type="time"
                        className={`form-control ${errors.end_time ? 'error' : ''}`}
                        value={formData.end_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      />
                      {errors.end_time && <span className="form-error">{errors.end_time}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Duration</label>
                      <input
                        type="text"
                        className="form-control"
                        value={calculateDuration(formData.start_time, formData.end_time)}
                        disabled
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Effective From <span className="required">*</span></label>
                      <input
                        type="date"
                        className={`form-control ${errors.effective_from ? 'error' : ''}`}
                        value={formData.effective_from}
                        onChange={(e) => setFormData(prev => ({ ...prev, effective_from: e.target.value }))}
                      />
                      {errors.effective_from && <span className="form-error">{errors.effective_from}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Grace Period (minutes)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.grace_period_minutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, grace_period_minutes: parseInt(e.target.value) }))}
                        min="0"
                        max="60"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Late Threshold (minutes)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.late_threshold_minutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, late_threshold_minutes: parseInt(e.target.value) }))}
                        min="1"
                        max="120"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Half Day Threshold (hours)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.half_day_threshold_hours}
                        onChange={(e) => setFormData(prev => ({ ...prev, half_day_threshold_hours: parseInt(e.target.value) }))}
                        min="1"
                        max="8"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Break Duration (minutes)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.break_duration_minutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, break_duration_minutes: parseInt(e.target.value) }))}
                        min="0"
                        max="180"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.break_is_paid}
                        onChange={(e) => setFormData(prev => ({ ...prev, break_is_paid: e.target.checked }))}
                      />
                      <span>Break is paid</span>
                    </label>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Working Days</label>
                    <div className="weekday-selector">
                      {weekDays.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          className={`weekday-btn ${formData.working_days.includes(day.value) ? 'active' : ''}`}
                          onClick={() => toggleWorkingDay(day.value)}
                          title={day.full}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Applicable Departments</label>
                    <div className="department-selector">
                      {departments.map(dept => (
                        <label key={dept} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={formData.applicable_departments.includes(dept)}
                            onChange={() => toggleDepartment(dept)}
                          />
                          <span>{dept}</span>
                        </label>
                      ))}
                    </div>
                    <p className="form-hint">Leave empty to apply to all departments</p>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <FaSave /> {selectedShift ? 'Update Shift' : 'Create Shift'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .col-span-3 {
          grid-column: span 3;
        }
        
        .shift-card {
          padding: 0;
          overflow: hidden;
        }
        
        .shift-header {
          padding: 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        
        .shift-header h4 {
          margin-bottom: 5px;
        }
        
        .status-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }
        
        .status-badge.active {
          background: color-mix(in srgb, var(--success-color) 15%, transparent);
          color: var(--success-color);
        }
        
        .status-badge.inactive {
          background: color-mix(in srgb, var(--danger-color) 15%, transparent);
          color: var(--danger-color);
        }
        
        .shift-body {
          padding: 20px;
        }
        
        .shift-time {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
        }
        
        .shift-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .detail-item {
          display: flex;
          font-size: 14px;
        }
        
        .detail-item .label {
          width: 100px;
          color: var(--text-secondary);
        }
        
        .detail-item .value {
          color: var(--text-primary);
        }
        
        .shift-footer {
          padding: 15px 20px;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          background: var(--bg-secondary);
        }
        
        .btn-icon {
          width: 36px;
          height: 36px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }
        
        .weekday-selector {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .weekday-btn {
          width: 45px;
          height: 45px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }
        
        .weekday-btn:hover {
          background: var(--bg-secondary);
        }
        
        .weekday-btn.active {
          background: var(--primary-gradient);
          color: white;
          border-color: transparent;
        }
        
        .department-selector {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          max-height: 200px;
          overflow-y: auto;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .form-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .required {
          color: var(--danger-color);
        }
        
        @media (max-width: 992px) {
          .grid-3 {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .col-span-3 {
            grid-column: span 2;
          }
        }
        
        @media (max-width: 576px) {
          .grid-3 {
            grid-template-columns: 1fr;
          }
          
          .col-span-3 {
            grid-column: span 1;
          }
          
          .department-selector {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default ShiftManagement;