// frontend/src/components/reports/PayrollReport.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FaMoneyBillWave, FaDownload, FaSearch, FaLock, FaUnlock,
  FaUsers, FaClock, FaBuilding, FaCheckCircle, FaExclamationTriangle,
  FaFileExcel, FaFileCsv, FaFilter, FaTimes, FaChevronDown,
  FaChevronRight, FaUser, FaCalendarAlt, FaChartPie
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';

// Constants
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CURRENT_YEAR = moment().year();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

// Utility functions
const maskAccountNumber = (accountNumber) => {
  if (!accountNumber) return 'N/A';
  const lastFour = accountNumber.slice(-4);
  return `••••${lastFour}`;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const calculateTotals = (employees) => {
  return employees.reduce((acc, emp) => {
    acc.payableDays += parseFloat(emp.payable_days) || 0;
    acc.workHours += parseFloat(emp.total_work_hours) || 0;
    acc.overtimeHours += parseFloat(emp.overtime_hours) || 0;
    acc.presentDays += emp.present_days || 0;
    acc.absentDays += emp.absent_days || 0;
    return acc;
  }, { payableDays: 0, workHours: 0, overtimeHours: 0, presentDays: 0, absentDays: 0 });
};

// Sub-components
const StatCard = ({ title, value, icon: Icon, variant = 'default', suffix = '' }) => {
  const variantClasses = {
    default: 'stat-card',
    success: 'stat-card success',
    warning: 'stat-card warning',
    danger: 'stat-card danger',
    info: 'stat-card info'
  };

  return (
    <div className={variantClasses[variant] || 'stat-card'}>
      <div className="stat-icon-wrapper">
        <Icon className="stat-icon" />
      </div>
      <div className="stat-content">
        <h3>{value}{suffix}</h3>
        <p>{title}</p>
      </div>
    </div>
  );
};

const FilterBar = ({ filters, setFilters, departments, onGenerate, onExport, loading }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          <label className="filter-label">Month</label>
          <select
            className="filter-select"
            value={filters.month}
            onChange={(e) => setFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
          >
            {MONTHS.map((month, idx) => (
              <option key={idx + 1} value={idx + 1}>{month}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Year</label>
          <select
            className="filter-select"
            value={filters.year}
            onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
          >
            {YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Department</label>
          <select
            className="filter-select"
            value={filters.department}
            onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="filter-actions">
          <button 
            className="btn btn-primary"
            onClick={onGenerate}
            disabled={loading}
          >
            <FaSearch /> {loading ? 'Loading...' : 'Generate'}
          </button>
          
          <div className="dropdown">
            <button className="btn btn-secondary dropdown-toggle">
              <FaDownload /> Export
            </button>
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => onExport('excel')}>
                <FaFileExcel className="text-success" /> Excel
              </button>
              <button className="dropdown-item" onClick={() => onExport('csv')}>
                <FaFileCsv className="text-info" /> CSV
              </button>
            </div>
          </div>

          <button 
            className="btn btn-outline btn-icon"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <FaFilter />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div 
            className="advanced-filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="filter-row">
              <div className="filter-group">
                <label className="filter-label">Min Work Hours</label>
                <input
                  type="number"
                  className="filter-input"
                  placeholder="0"
                  min="0"
                  value={filters.minHours || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, minHours: e.target.value }))}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">Overtime Threshold</label>
                <input
                  type="number"
                  className="filter-input"
                  placeholder="0"
                  min="0"
                  value={filters.overtimeThreshold || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, overtimeThreshold: e.target.value }))}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">Status</label>
                <select
                  className="filter-select"
                  value={filters.status || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PayrollStatusAlert = ({ isLocked, onLock, onUnlock, canLock, isSuperAdmin }) => {
  if (isLocked) {
    return (
      <div className="alert alert-danger payroll-alert">
        <div className="alert-content">
          <div className="alert-icon">
            <FaLock />
          </div>
          <div className="alert-message">
            <h4>Payroll is Locked</h4>
            <p>Attendance records for this period cannot be modified.</p>
          </div>
        </div>
        {isSuperAdmin && (
          <button className="btn btn-warning btn-sm" onClick={onUnlock}>
            <FaUnlock /> Unlock Payroll
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="alert alert-success payroll-alert">
      <div className="alert-content">
        <div className="alert-icon">
          <FaUnlock />
        </div>
        <div className="alert-message">
          <h4>Payroll is Open</h4>
          <p>Attendance records can still be modified.</p>
        </div>
      </div>
      {canLock && (
        <button className="btn btn-danger btn-sm" onClick={onLock}>
          <FaLock /> Lock Payroll
        </button>
      )}
    </div>
  );
};

const EmployeeTable = ({ employees, expandedRows, toggleRow }) => {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>Employee</th>
            <th>Department</th>
            <th>Designation</th>
            <th>Working Days</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Late</th>
            <th>Payable Days</th>
            <th>Work Hours</th>
            <th>Overtime</th>
            <th>Bank Details</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, idx) => {
            const isExpanded = expandedRows.has(emp.employee_id);
            
            return (
              <React.Fragment key={emp.employee_id || idx}>
                <tr className={`employee-row ${isExpanded ? 'expanded' : ''}`}>
                  <td>
                    <button 
                      className="expand-btn"
                      onClick={() => toggleRow(emp.employee_id)}
                    >
                      {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                    </button>
                  </td>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-avatar">
                        {emp.name?.charAt(0) || '?'}
                      </div>
                      <div className="employee-info">
                        <p className="employee-name">{emp.name}</p>
                        <p className="employee-id">{emp.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td>{emp.department}</td>
                  <td>{emp.designation || '—'}</td>
                  <td className="text-center">{emp.working_days}</td>
                  <td className="text-success text-center">{emp.present_days}</td>
                  <td className="text-danger text-center">{emp.absent_days}</td>
                  <td className="text-warning text-center">{emp.late_days}</td>
                  <td className="font-bold text-center">{emp.payable_days}</td>
                  <td className="text-center">{emp.total_work_hours}h</td>
                  <td className={`text-center ${parseFloat(emp.overtime_hours) > 0 ? 'text-warning' : ''}`}>
                    {emp.overtime_hours}h
                  </td>
                  <td>
                    {emp.bank_details ? (
                      <div className="bank-info">
                        <span className="bank-name">{emp.bank_details.bank_name}</span>
                        <span className="bank-account">
                          {maskAccountNumber(emp.bank_details.account_number)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-tertiary">Not provided</span>
                    )}
                  </td>
                </tr>
                
                {isExpanded && (
                  <tr className="expanded-row">
                    <td colSpan="12">
                      <div className="expanded-content">
                        <div className="expanded-grid">
                          <div className="expanded-section">
                            <h5>Personal Details</h5>
                            <div className="detail-item">
                              <span className="label">Joining Date:</span>
                              <span className="value">{emp.joining_date || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="label">Manager:</span>
                              <span className="value">{emp.manager || '—'}</span>
                            </div>
                          </div>
                          
                          <div className="expanded-section">
                            <h5>Attendance Breakdown</h5>
                            <div className="detail-item">
                              <span className="label">Half Days:</span>
                              <span className="value">{emp.half_days || 0}</span>
                            </div>
                            <div className="detail-item">
                              <span className="label">Overtime Multiplier:</span>
                              <span className="value">{emp.overtime_multiplier || 1.0}x</span>
                            </div>
                          </div>
                          
                          <div className="expanded-section">
                            <h5>Bank Details</h5>
                            {emp.bank_details ? (
                              <>
                                <div className="detail-item">
                                  <span className="label">Account Holder:</span>
                                  <span className="value">{emp.bank_details.account_holder}</span>
                                </div>
                                <div className="detail-item">
                                  <span className="label">Account Number:</span>
                                  <span className="value">{emp.bank_details.account_number}</span>
                                </div>
                                <div className="detail-item">
                                  <span className="label">Bank:</span>
                                  <span className="value">{emp.bank_details.bank_name}</span>
                                </div>
                                <div className="detail-item">
                                  <span className="label">IFSC:</span>
                                  <span className="value">{emp.bank_details.ifsc_code}</span>
                                </div>
                              </>
                            ) : (
                              <p className="text-tertiary">No bank details provided</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const DepartmentSummary = ({ employees }) => {
  const departmentData = useMemo(() => {
    return employees.reduce((acc, emp) => {
      const dept = emp.department;
      if (!acc[dept]) {
        acc[dept] = {
          name: dept,
          count: 0,
          payableDays: 0,
          workHours: 0,
          overtime: 0,
          presentDays: 0,
          absentDays: 0
        };
      }
      acc[dept].count++;
      acc[dept].payableDays += parseFloat(emp.payable_days) || 0;
      acc[dept].workHours += parseFloat(emp.total_work_hours) || 0;
      acc[dept].overtime += parseFloat(emp.overtime_hours) || 0;
      acc[dept].presentDays += emp.present_days || 0;
      acc[dept].absentDays += emp.absent_days || 0;
      return acc;
    }, {});
  }, [employees]);

  const sortedDepartments = Object.values(departmentData).sort((a, b) => b.count - a.count);

  return (
    <div className="department-summary">
      <h4>
        <FaBuilding className="section-icon" />
        Department-wise Summary
      </h4>
      
      <div className="department-grid">
        {sortedDepartments.map(dept => (
          <div key={dept.name} className="department-card">
            <div className="dept-header">
              <h5>{dept.name}</h5>
              <span className="dept-count">{dept.count} employees</span>
            </div>
            
            <div className="dept-stats">
              <div className="dept-stat">
                <span className="stat-label">Payable Days</span>
                <span className="stat-value">{dept.payableDays.toFixed(1)}</span>
              </div>
              <div className="dept-stat">
                <span className="stat-label">Work Hours</span>
                <span className="stat-value">{dept.workHours.toFixed(1)}h</span>
              </div>
              <div className="dept-stat">
                <span className="stat-label">Overtime</span>
                <span className={`stat-value ${dept.overtime > 0 ? 'text-warning' : ''}`}>
                  {dept.overtime.toFixed(1)}h
                </span>
              </div>
              <div className="dept-stat">
                <span className="stat-label">Present Days</span>
                <span className="stat-value text-success">{dept.presentDays}</span>
              </div>
              <div className="dept-stat">
                <span className="stat-label">Absent Days</span>
                <span className="stat-value text-danger">{dept.absentDays}</span>
              </div>
            </div>
            
            <div className="dept-footer">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${dept.presentDays > 0 ? (dept.presentDays / (dept.presentDays + dept.absentDays)) * 100 : 0}%` 
                  }}
                />
              </div>
              <span className="progress-label">
                Attendance Rate: {dept.presentDays + dept.absentDays > 0 
                  ? ((dept.presentDays / (dept.presentDays + dept.absentDays)) * 100).toFixed(1) 
                  : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LockModal = ({ isOpen, onClose, onConfirm, period, type }) => {
  const [reason, setReason] = useState('');
  const [approver, setApprover] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    onConfirm({ reason, approver });
    setReason('');
    setApprover('');
  };

  const isUnlock = type === 'unlock';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <motion.div 
            className="modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                {isUnlock ? (
                  <><FaUnlock className="mr-2" /> Unlock Payroll</>
                ) : (
                  <><FaLock className="mr-2" /> Lock Payroll</>
                )}
              </h3>
              <button className="modal-close" onClick={onClose}>
                <FaTimes />
              </button>
            </div>
            
            <div className="modal-body">
              {isUnlock && (
                <div className="alert alert-danger">
                  <FaExclamationTriangle className="mr-2" />
                  <strong>Super Admin Action Required</strong>
                  <p>Unlocking payroll is a critical action that will be permanently logged.</p>
                </div>
              )}
              
              {!isUnlock && (
                <div className="alert alert-warning">
                  <FaExclamationTriangle className="mr-2" />
                  <strong>Warning</strong>
                  <p>Locking payroll will prevent any further attendance edits for this period.</p>
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Period</label>
                <input
                  type="text"
                  className="form-control"
                  value={period}
                  disabled
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  Reason <span className="required">*</span>
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Provide reason for ${isUnlock ? 'unlocking' : 'locking'} this payroll period...`}
                />
              </div>
              
              {isUnlock && (
                <div className="form-group">
                  <label className="form-label">Second Approver (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={approver}
                    onChange={(e) => setApprover(e.target.value)}
                    placeholder="Name of second approver"
                  />
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button 
                className={`btn ${isUnlock ? 'btn-warning' : 'btn-danger'}`}
                onClick={handleSubmit}
              >
                {isUnlock ? (
                  <><FaUnlock /> Confirm Unlock</>
                ) : (
                  <><FaLock /> Confirm Lock</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Main Component
const PayrollReport = () => {
  const { user, hasPermission } = useAuth();
  
  // State
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [modalState, setModalState] = useState({ isOpen: false, type: 'lock' });
  
  const [filters, setFilters] = useState({
    month: moment().month() + 1,
    year: CURRENT_YEAR,
    department: '',
    minHours: '',
    overtimeThreshold: '',
    status: ''
  });

  // Computed values
  const period = `${MONTHS[filters.month - 1]} ${filters.year}`;
  const canLockPayroll = hasPermission('lock_payroll');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  const totals = useMemo(() => {
    if (!reportData?.employees) return null;
    return calculateTotals(reportData.employees);
  }, [reportData]);

  // Effects
  useEffect(() => {
    fetchDepartments();
  }, []);

  // API Calls
  const fetchDepartments = async () => {
    try {
      const response = await apiService.users.getStats();
      const depts = Object.keys(response.data.data?.by_department || {});
      setDepartments(depts);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        month: filters.month,
        year: filters.year,
        department: filters.department || undefined
      };
      const response = await apiService.reports.getPayroll(params);
      setReportData(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch payroll report');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleExport = async (format) => {
    try {
      const params = {
        month: filters.month,
        year: filters.year,
        department: filters.department || undefined,
        export_format: format
      };
      
      const response = await apiService.reports.exportPayroll(params);
      
      const mimeTypes = {
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv'
      };
      
      const extensions = {
        excel: 'xlsx',
        csv: 'csv'
      };
      
      const blob = new Blob([response.data], { type: mimeTypes[format] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll_${filters.year}_${filters.month}.${extensions[format]}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const handleLockPayroll = async ({ reason }) => {
    try {
      await apiService.admin.lockPayroll({
        month: filters.month,
        year: filters.year,
        reason
      });
      toast.success('Payroll locked successfully');
      setModalState({ isOpen: false, type: 'lock' });
      fetchReport();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to lock payroll');
    }
  };

  const handleUnlockPayroll = async ({ reason, approver }) => {
    try {
      await apiService.admin.unlockPayroll({
        month: filters.month,
        year: filters.year,
        reason,
        approvedBy: approver || undefined
      });
      toast.success('Payroll unlocked successfully');
      setModalState({ isOpen: false, type: 'unlock' });
      fetchReport();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to unlock payroll');
    }
  };

  const toggleRow = (employeeId) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!reportData?.employees) return;
    const allIds = reportData.employees.map(e => e.employee_id);
    setExpandedRows(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  // Render
  if (loading && !reportData) {
    return (
      <div className="payroll-report">
        <div className="loading-container">
          <LoadingSpinner size="large" />
          <p>Loading payroll data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payroll-report">
      {/* Header */}
      <div className="report-header">
        <div className="header-title">
          <h2>
            <FaMoneyBillWave className="header-icon" />
            Payroll Report
          </h2>
          <p className="header-subtitle">
            Generate and export payroll data for salary processing
          </p>
        </div>
        
        <div className="header-actions">
          <button className="btn btn-outline" onClick={expandAll}>
            Expand All
          </button>
          <button className="btn btn-outline" onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {reportData && (
        <PayrollStatusAlert
          isLocked={reportData.payroll_locked}
          onLock={() => setModalState({ isOpen: true, type: 'lock' })}
          onUnlock={() => setModalState({ isOpen: true, type: 'unlock' })}
          canLock={canLockPayroll}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* Filters */}
      <div className="card filter-card">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          departments={departments}
          onGenerate={fetchReport}
          onExport={handleExport}
          loading={loading}
        />
      </div>

      {/* Report Content */}
      {reportData ? (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <StatCard
              title="Total Employees"
              value={reportData.summary.total_employees}
              icon={FaUsers}
              variant="default"
            />
            <StatCard
              title="Total Payable Days"
              value={reportData.summary.total_payable_days}
              icon={FaCheckCircle}
              variant="success"
            />
            <StatCard
              title="Total Work Hours"
              value={reportData.summary.total_work_hours}
              icon={FaClock}
              variant="info"
              suffix="h"
            />
            <StatCard
              title="Total Overtime"
              value={reportData.summary.total_overtime_hours}
              icon={FaClock}
              variant="warning"
              suffix="h"
            />
          </div>

          {/* Secondary Stats */}
          {totals && (
            <div className="secondary-stats">
              <div className="stat-chip">
                <FaUser className="chip-icon" />
                <span>Present Days: <strong>{totals.presentDays}</strong></span>
              </div>
              <div className="stat-chip danger">
                <FaUser className="chip-icon" />
                <span>Absent Days: <strong>{totals.absentDays}</strong></span>
              </div>
              <div className="stat-chip">
                <FaChartPie className="chip-icon" />
                <span>Avg Hours/Employee: <strong>{(totals.workHours / reportData.summary.total_employees).toFixed(1)}h</strong></span>
              </div>
            </div>
          )}

          {/* Employee Table */}
          <div className="card table-card">
            <div className="card-header">
              <h3>Employee Payroll Details</h3>
              <span className="period-badge">
                <FaCalendarAlt className="mr-1" />
                {period}
              </span>
            </div>
            
            <EmployeeTable
              employees={reportData.employees}
              expandedRows={expandedRows}
              toggleRow={toggleRow}
            />
          </div>

          {/* Department Summary */}
          <div className="card">
            <DepartmentSummary employees={reportData.employees} />
          </div>

          {/* Footer Summary */}
          <div className="report-footer">
            <div className="footer-info">
              <p>
                <strong>Generated On:</strong> {moment().format('DD/MM/YYYY HH:mm')}
              </p>
              <p>
                <strong>Generated By:</strong> {user?.full_name}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                <span className={reportData.payroll_locked ? 'text-danger' : 'text-success'}>
                  {reportData.payroll_locked ? 'LOCKED - Ready for processing' : 'DRAFT - Pending lock'}
                </span>
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="card empty-state-card">
          <div className="empty-state">
            <FaMoneyBillWave className="empty-icon" />
            <h3>No Payroll Data</h3>
            <p>Select filters and click Generate to view payroll report</p>
            <button className="btn btn-primary mt-2" onClick={fetchReport}>
              <FaSearch /> Generate Report
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <LockModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, type: 'lock' })}
        onConfirm={modalState.type === 'lock' ? handleLockPayroll : handleUnlockPayroll}
        period={period}
        type={modalState.type}
      />

      <style jsx>{`
        .payroll-report {
          animation: fadeIn 0.3s ease;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .header-title h2 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 6px;
          background: var(--primary-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header-icon {
          font-size: 2rem;
          color: #667eea;
          -webkit-text-fill-color: initial;
        }

        .header-subtitle {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        /* Filter Card */
        .filter-card {
          padding: 24px;
          margin-bottom: 24px;
        }

        .filter-bar {
          width: 100%;
        }

        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: flex-end;
        }

        .filter-group {
          flex: 1;
          min-width: 160px;
        }

        .filter-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }

        .filter-select,
        .filter-input {
          width: 100%;
          padding: 10px 14px;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 10px;
          color: var(--text-primary);
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .filter-select:focus,
        .filter-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .filter-actions {
          display: flex;
          gap: 10px;
        }

        .dropdown {
          position: relative;
        }

        .dropdown-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 5px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          box-shadow: var(--card-shadow);
          min-width: 150px;
          z-index: 100;
          overflow: hidden;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          width: 100%;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          transition: background 0.2s;
        }

        .dropdown-item:hover {
          background: var(--hover-bg);
        }

        .advanced-filters {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--border-color);
          overflow: hidden;
        }

        /* Payroll Alert */
        .payroll-alert {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          margin-bottom: 24px;
          border-radius: 12px;
        }

        .alert-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .alert-icon {
          font-size: 24px;
        }

        .alert-message h4 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .alert-message p {
          font-size: 0.9rem;
          opacity: 0.9;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 20px;
          background: var(--card-bg);
          border-radius: 16px;
          box-shadow: var(--card-shadow);
          border: 1px solid var(--border-color);
        }

        .stat-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon {
          font-size: 26px;
          color: white;
        }

        .stat-card.success .stat-icon-wrapper {
          background: var(--success-color);
        }

        .stat-card.warning .stat-icon-wrapper {
          background: var(--warning-color);
        }

        .stat-card.danger .stat-icon-wrapper {
          background: var(--danger-color);
        }

        .stat-card.info .stat-icon-wrapper {
          background: var(--info-color);
        }

        .stat-content h3 {
          font-size: 2rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .stat-content p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        /* Secondary Stats */
        .secondary-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--bg-secondary);
          border-radius: 30px;
          font-size: 0.9rem;
        }

        .stat-chip.danger {
          background: color-mix(in srgb, var(--danger-color) 10%, transparent);
          color: var(--danger-color);
        }

        .chip-icon {
          color: var(--text-secondary);
        }

        /* Table Card */
        .table-card {
          padding: 0;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
        }

        .card-header h3 {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .period-badge {
          display: flex;
          align-items: center;
          padding: 6px 14px;
          background: var(--bg-secondary);
          border-radius: 30px;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 14px 16px;
          text-align: left;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--bg-secondary);
          border-bottom: 2px solid var(--border-color);
          white-space: nowrap;
        }

        .data-table td {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .employee-row {
          transition: background 0.2s;
        }

        .employee-row:hover {
          background: var(--hover-bg);
        }

        .employee-row.expanded {
          background: var(--bg-secondary);
        }

        .expand-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .expand-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .employee-cell {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .employee-avatar {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .employee-name {
          font-weight: 500;
          margin-bottom: 2px;
        }

        .employee-id {
          font-size: 0.8rem;
          color: var(--text-tertiary);
        }

        .bank-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .bank-name {
          font-weight: 500;
          font-size: 0.9rem;
        }

        .bank-account {
          font-size: 0.8rem;
          color: var(--text-tertiary);
          font-family: monospace;
        }

        /* Expanded Row */
        .expanded-row {
          background: var(--bg-secondary);
        }

        .expanded-content {
          padding: 24px;
        }

        .expanded-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
        }

        .expanded-section h5 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
        }

        .detail-item {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px dashed var(--border-color);
        }

        .detail-item:last-child {
          border-bottom: none;
        }

        .detail-item .label {
          width: 120px;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .detail-item .value {
          flex: 1;
          font-weight: 500;
        }

        /* Department Summary */
        .department-summary {
          padding: 24px;
        }

        .department-summary h4 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 24px;
        }

        .section-icon {
          color: #667eea;
        }

        .department-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .department-card {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--border-color);
        }

        .dept-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .dept-header h5 {
          font-size: 1.1rem;
          font-weight: 600;
        }

        .dept-count {
          font-size: 0.8rem;
          padding: 4px 10px;
          background: var(--bg-tertiary);
          border-radius: 20px;
        }

        .dept-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .dept-stat {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .stat-value {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .dept-footer {
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .progress-bar {
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: var(--success-color);
          border-radius: 3px;
          transition: width 0.3s;
        }

        .progress-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        /* Report Footer */
        .report-footer {
          margin-top: 24px;
          padding: 20px;
          background: var(--bg-secondary);
          border-radius: 12px;
        }

        .footer-info {
          display: flex;
          flex-wrap: wrap;
          gap: 30px;
        }

        .footer-info p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .footer-info strong {
          color: var(--text-primary);
          margin-right: 6px;
        }

        /* Empty State */
        .empty-state-card {
          padding: 60px 20px;
        }

        .empty-state {
          text-align: center;
        }

        .empty-icon {
          font-size: 64px;
          color: var(--text-tertiary);
          margin-bottom: 20px;
          opacity: 0.5;
        }

        .empty-state h3 {
          font-size: 1.3rem;
          margin-bottom: 8px;
        }

        .empty-state p {
          color: var(--text-secondary);
          margin-bottom: 20px;
        }

        /* Loading */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .loading-container p {
          margin-top: 20px;
          color: var(--text-secondary);
        }

        /* Utilities */
        .text-center {
          text-align: center;
        }

        .text-success {
          color: var(--success-color) !important;
        }

        .text-danger {
          color: var(--danger-color) !important;
        }

        .text-warning {
          color: var(--warning-color) !important;
        }

        .text-info {
          color: var(--info-color) !important;
        }

        .text-tertiary {
          color: var(--text-tertiary) !important;
        }

        .font-bold {
          font-weight: 600;
        }

        .mr-1 {
          margin-right: 4px;
        }

        .mr-2 {
          margin-right: 8px;
        }

        .mt-2 {
          margin-top: 16px;
        }

        .btn-icon {
          padding: 10px;
        }

        .required {
          color: var(--danger-color);
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 992px) {
          .expanded-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .report-header {
            flex-direction: column;
            gap: 16px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .filter-row {
            flex-direction: column;
          }

          .filter-group {
            width: 100%;
          }

          .filter-actions {
            width: 100%;
            justify-content: stretch;
          }

          .filter-actions .btn {
            flex: 1;
          }

          .secondary-stats {
            flex-wrap: wrap;
          }

          .expanded-grid {
            grid-template-columns: 1fr;
          }

          .footer-info {
            flex-direction: column;
            gap: 10px;
          }
        }

        @media (max-width: 576px) {
          .stat-card {
            flex-direction: column;
            text-align: center;
          }

          .payroll-alert {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }

          .alert-content {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default PayrollReport;