import React, { useState, useEffect } from 'react';
import { 
  FaCog, FaPlus, FaEdit, FaTrash, FaCheck, FaCopy,
  FaSave, FaTimes, FaEye, FaHistory, FaCalendar
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';

const PolicyManagement = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_default: false,
    priority: 1,
    effective_from: moment().format('YYYY-MM-DD'),
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
        max_overtime_hours_per_day: 4
      },
      late_arrival: {
        grace_minutes: 15,
        deduction_per_minute: 0.5,
        max_deduction_minutes: 60,
        allowed_instances_per_month: 3
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
        consecutive_absences_threshold: 3
      },
      breaks: {
        auto_deduct_unpaid_after_minutes: 60,
        max_break_minutes_per_day: 120,
        mandatory_break_minutes: 30
      },
      regularization: {
        allowed_days_back: 7,
        require_proof_for_old_requests: true,
        max_requests_per_month: 5
      }
    }
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const response = await apiService.admin.getPolicies();
      setPolicies(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name) newErrors.name = 'Policy name is required';
    if (!formData.code) newErrors.code = 'Policy code is required';
    if (!formData.effective_from) newErrors.effective_from = 'Effective date is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      if (selectedPolicy) {
        await apiService.admin.updatePolicy(selectedPolicy._id, formData);
        toast.success('Policy updated successfully');
      } else {
        await apiService.admin.createPolicy(formData);
        toast.success('Policy created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchPolicies();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save policy');
    }
  };

  const handleApprove = async (policyId) => {
    try {
      await apiService.admin.approvePolicy(policyId);
      toast.success('Policy approved successfully');
      fetchPolicies();
    } catch (error) {
      toast.error('Failed to approve policy');
    }
  };

  const handleDuplicate = (policy) => {
    setFormData({
      ...policy,
      name: `${policy.name} (Copy)`,
      code: `${policy.code}-COPY`,
      version: 1,
      effective_from: moment().format('YYYY-MM-DD'),
      _id: undefined,
      is_default: false,
      approved_by: null,
      approved_at: null
    });
    setSelectedPolicy(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      is_default: false,
      priority: 1,
      effective_from: moment().format('YYYY-MM-DD'),
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
          max_overtime_hours_per_day: 4
        },
        late_arrival: {
          grace_minutes: 15,
          deduction_per_minute: 0.5,
          max_deduction_minutes: 60,
          allowed_instances_per_month: 3
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
          consecutive_absences_threshold: 3
        },
        breaks: {
          auto_deduct_unpaid_after_minutes: 60,
          max_break_minutes_per_day: 120,
          mandatory_break_minutes: 30
        },
        regularization: {
          allowed_days_back: 7,
          require_proof_for_old_requests: true,
          max_requests_per_month: 5
        }
      }
    });
    setSelectedPolicy(null);
    setErrors({});
  };

  const openEditModal = (policy) => {
    setSelectedPolicy(policy);
    setFormData({
      name: policy.name,
      code: policy.code,
      description: policy.description || '',
      is_default: policy.is_default,
      priority: policy.priority,
      effective_from: policy.effective_from ? moment(policy.effective_from).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD'),
      rules: policy.rules
    });
    setShowModal(true);
  };

  const openViewModal = (policy) => {
    setSelectedPolicy(policy);
    setShowViewModal(true);
  };

  const updateRule = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        [section]: {
          ...prev.rules[section],
          [field]: value
        }
      }
    }));
  };

  const updateNestedRule = (section, subsection, field, value) => {
    setFormData(prev => ({
      ...prev,
      rules: {
        ...prev.rules,
        [section]: {
          ...prev.rules[section],
          [subsection]: {
            ...prev.rules[section][subsection],
            [field]: value
          }
        }
      }
    }));
  };

  return (
    <div className="policy-management">
      <div className="d-flex justify-between align-center mb-2">
        <h3>Policy Management</h3>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FaPlus /> Create Policy
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Policy Name</th>
                <th>Code</th>
                <th>Version</th>
                <th>Effective From</th>
                <th>Status</th>
                <th>Default</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-3">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-secondary py-3">
                    No policies found
                  </td>
                </tr>
              ) : (
                policies.map(policy => (
                  <tr key={policy._id}>
                    <td>
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        <p className="text-sm text-secondary">{policy.description || 'No description'}</p>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{policy.code}</span>
                    </td>
                    <td>v{policy.version}</td>
                    <td>{moment(policy.effective_from).format('DD/MM/YYYY')}</td>
                    <td>
                      <span className={`badge badge-${policy.is_active ? 'success' : 'secondary'}`}>
                        {policy.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {!policy.approved_by && (
                        <span className="badge badge-warning ml-1">Pending</span>
                      )}
                    </td>
                    <td>
                      {policy.is_default && (
                        <FaCheck className="text-success" />
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button 
                          className="btn-icon btn-secondary"
                          onClick={() => openViewModal(policy)}
                          title="View"
                        >
                          <FaEye />
                        </button>
                        <button 
                          className="btn-icon btn-secondary"
                          onClick={() => openEditModal(policy)}
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="btn-icon btn-secondary"
                          onClick={() => handleDuplicate(policy)}
                          title="Duplicate"
                        >
                          <FaCopy />
                        </button>
                        {user?.role === 'SUPER_ADMIN' && !policy.approved_by && (
                          <button 
                            className="btn-icon btn-success"
                            onClick={() => handleApprove(policy._id)}
                            title="Approve"
                          >
                            <FaCheck />
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
      </div>

      {/* Create/Edit Policy Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <motion.div 
              className="modal modal-xl"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{selectedPolicy ? 'Edit Policy' : 'Create New Policy'}</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {/* Basic Info */}
                  <div className="grid grid-3 mb-3">
                    <div className="form-group">
                      <label className="form-label">Policy Name <span className="required">*</span></label>
                      <input
                        type="text"
                        className={`form-control ${errors.name ? 'error' : ''}`}
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                      {errors.name && <span className="form-error">{errors.name}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Policy Code <span className="required">*</span></label>
                      <input
                        type="text"
                        className={`form-control ${errors.code ? 'error' : ''}`}
                        value={formData.code}
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      />
                      {errors.code && <span className="form-error">{errors.code}</span>}
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
                  </div>
                  
                  <div className="grid grid-2 mb-3">
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.priority}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                        min="1"
                        max="100"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.is_default}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                      />
                      <span>Set as Default Policy</span>
                    </label>
                  </div>
                  
                  {/* Rules Sections */}
                  <div className="rules-sections">
                    <h4 className="section-title">Attendance Rules</h4>
                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-label">Min Work Hours for Present</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.attendance.min_work_hours_for_present}
                          onChange={(e) => updateRule('attendance', 'min_work_hours_for_present', parseInt(e.target.value))}
                          min="1"
                          max="12"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Location Accuracy Threshold (m)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.attendance.location_accuracy_threshold_meters}
                          onChange={(e) => updateRule('attendance', 'location_accuracy_threshold_meters', parseInt(e.target.value))}
                          min="10"
                          max="500"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-2">
                      <div className="form-group">
                        <label className="form-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.rules.attendance.auto_punch_out.enabled}
                            onChange={(e) => updateNestedRule('attendance', 'auto_punch_out', 'enabled', e.target.checked)}
                          />
                          <span>Auto Punch Out</span>
                        </label>
                        {formData.rules.attendance.auto_punch_out.enabled && (
                          <input
                            type="number"
                            className="form-control mt-1"
                            value={formData.rules.attendance.auto_punch_out.after_shift_end_hours}
                            onChange={(e) => updateNestedRule('attendance', 'auto_punch_out', 'after_shift_end_hours', parseInt(e.target.value))}
                            min="0"
                            max="24"
                          />
                        )}
                      </div>
                      
                      <div className="form-group">
                        <label className="form-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.rules.attendance.require_location_for_punch}
                            onChange={(e) => updateRule('attendance', 'require_location_for_punch', e.target.checked)}
                          />
                          <span>Require Location for Punch</span>
                        </label>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.rules.attendance.allow_weekend_punch}
                            onChange={(e) => updateRule('attendance', 'allow_weekend_punch', e.target.checked)}
                          />
                          <span>Allow Weekend Punch</span>
                        </label>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.rules.attendance.allow_holiday_punch}
                            onChange={(e) => updateRule('attendance', 'allow_holiday_punch', e.target.checked)}
                          />
                          <span>Allow Holiday Punch</span>
                        </label>
                      </div>
                    </div>
                    
                    <h4 className="section-title">Overtime Rules</h4>
                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.rules.overtime.enabled}
                            onChange={(e) => updateRule('overtime', 'enabled', e.target.checked)}
                          />
                          <span>Enable Overtime</span>
                        </label>
                      </div>
                      
                      {formData.rules.overtime.enabled && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Rate Multiplier</label>
                            <input
                              type="number"
                              className="form-control"
                              value={formData.rules.overtime.rate_multiplier}
                              onChange={(e) => updateRule('overtime', 'rate_multiplier', parseFloat(e.target.value))}
                              min="1"
                              max="3"
                              step="0.1"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label className="form-label">Threshold Hours</label>
                            <input
                              type="number"
                              className="form-control"
                              value={formData.rules.overtime.threshold_hours}
                              onChange={(e) => updateRule('overtime', 'threshold_hours', parseInt(e.target.value))}
                              min="1"
                              max="24"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label className="form-label">Double Rate After (hours)</label>
                            <input
                              type="number"
                              className="form-control"
                              value={formData.rules.overtime.double_rate_after_hours}
                              onChange={(e) => updateRule('overtime', 'double_rate_after_hours', parseInt(e.target.value))}
                              min="8"
                              max="24"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label className="form-label">Min Overtime (minutes)</label>
                            <input
                              type="number"
                              className="form-control"
                              value={formData.rules.overtime.min_overtime_minutes}
                              onChange={(e) => updateRule('overtime', 'min_overtime_minutes', parseInt(e.target.value))}
                              min="0"
                              max="60"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label className="form-label">Max Overtime/Day (hours)</label>
                            <input
                              type="number"
                              className="form-control"
                              value={formData.rules.overtime.max_overtime_hours_per_day}
                              onChange={(e) => updateRule('overtime', 'max_overtime_hours_per_day', parseInt(e.target.value))}
                              min="0"
                              max="12"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label className="form-checkbox">
                              <input
                                type="checkbox"
                                checked={formData.rules.overtime.approval_required}
                                onChange={(e) => updateRule('overtime', 'approval_required', e.target.checked)}
                              />
                              <span>Require Approval</span>
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <h4 className="section-title">Late Arrival Rules</h4>
                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-label">Grace Period (minutes)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.late_arrival.grace_minutes}
                          onChange={(e) => updateRule('late_arrival', 'grace_minutes', parseInt(e.target.value))}
                          min="0"
                          max="60"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Deduction per Minute</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.late_arrival.deduction_per_minute}
                          onChange={(e) => updateRule('late_arrival', 'deduction_per_minute', parseFloat(e.target.value))}
                          min="0"
                          max="10"
                          step="0.1"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Max Deduction (minutes)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.late_arrival.max_deduction_minutes}
                          onChange={(e) => updateRule('late_arrival', 'max_deduction_minutes', parseInt(e.target.value))}
                          min="0"
                          max="240"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Allowed Instances/Month</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.late_arrival.allowed_instances_per_month}
                          onChange={(e) => updateRule('late_arrival', 'allowed_instances_per_month', parseInt(e.target.value))}
                          min="0"
                          max="10"
                        />
                      </div>
                    </div>
                    
                    <h4 className="section-title">Early Exit Rules</h4>
                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-label">Grace Period (minutes)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.early_exit.grace_minutes}
                          onChange={(e) => updateRule('early_exit', 'grace_minutes', parseInt(e.target.value))}
                          min="0"
                          max="60"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Penalty per Minute</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.early_exit.penalty_per_minute}
                          onChange={(e) => updateRule('early_exit', 'penalty_per_minute', parseFloat(e.target.value))}
                          min="0"
                          max="10"
                          step="0.1"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Allowed Instances/Month</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.early_exit.allowed_instances_per_month}
                          onChange={(e) => updateRule('early_exit', 'allowed_instances_per_month', parseInt(e.target.value))}
                          min="0"
                          max="10"
                        />
                      </div>
                    </div>
                    
                    <h4 className="section-title">Break Rules</h4>
                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-label">Auto Deduct Unpaid After (min)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.breaks.auto_deduct_unpaid_after_minutes}
                          onChange={(e) => updateRule('breaks', 'auto_deduct_unpaid_after_minutes', parseInt(e.target.value))}
                          min="15"
                          max="180"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Max Break/Day (minutes)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.breaks.max_break_minutes_per_day}
                          onChange={(e) => updateRule('breaks', 'max_break_minutes_per_day', parseInt(e.target.value))}
                          min="30"
                          max="240"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Mandatory Break (minutes)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.breaks.mandatory_break_minutes}
                          onChange={(e) => updateRule('breaks', 'mandatory_break_minutes', parseInt(e.target.value))}
                          min="0"
                          max="60"
                        />
                      </div>
                    </div>
                    
                    <h4 className="section-title">Regularization Rules</h4>
                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-label">Allowed Days Back</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.regularization.allowed_days_back}
                          onChange={(e) => updateRule('regularization', 'allowed_days_back', parseInt(e.target.value))}
                          min="1"
                          max="30"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Max Requests/Month</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.rules.regularization.max_requests_per_month}
                          onChange={(e) => updateRule('regularization', 'max_requests_per_month', parseInt(e.target.value))}
                          min="1"
                          max="20"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.rules.regularization.require_proof_for_old_requests}
                            onChange={(e) => updateRule('regularization', 'require_proof_for_old_requests', e.target.checked)}
                          />
                          <span>Require Proof for Old Requests</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <FaSave /> {selectedPolicy ? 'Update Policy' : 'Create Policy'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Policy Modal */}
      <AnimatePresence>
        {showViewModal && selectedPolicy && (
          <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
            <motion.div 
              className="modal modal-xl"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Policy Details: {selectedPolicy.name}</h3>
                <button className="modal-close" onClick={() => setShowViewModal(false)}>×</button>
              </div>
              
              <div className="modal-body">
                <div className="policy-info mb-3">
                  <p><strong>Code:</strong> {selectedPolicy.code}</p>
                  <p><strong>Version:</strong> v{selectedPolicy.version}</p>
                  <p><strong>Effective From:</strong> {moment(selectedPolicy.effective_from).format('DD/MM/YYYY')}</p>
                  <p><strong>Description:</strong> {selectedPolicy.description || 'N/A'}</p>
                </div>
                
                <div className="policy-rules-preview">
                  <pre className="rules-json">
                    {JSON.stringify(selectedPolicy.rules, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .modal-xl {
          max-width: 900px;
        }
        
        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 20px 0 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--border-color);
          color: #667eea;
        }
        
        .rules-sections {
          max-height: 400px;
          overflow-y: auto;
          padding-right: 10px;
        }
        
        .policy-rules-preview {
          background: var(--bg-secondary);
          border-radius: 10px;
          padding: 15px;
          max-height: 500px;
          overflow: auto;
        }
        
        .rules-json {
          margin: 0;
          font-size: 12px;
          color: var(--text-primary);
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
        
        .form-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .gap-1 {
          gap: 5px;
        }
        
        .ml-1 {
          margin-left: 5px;
        }
        
        .mt-1 {
          margin-top: 10px;
        }
        
        .mb-3 {
          margin-bottom: 20px;
        }
        
        .required {
          color: var(--danger-color);
        }
        
        @media (max-width: 768px) {
          .grid-3 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default PolicyManagement;