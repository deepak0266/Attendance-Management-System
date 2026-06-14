import React, { useState, useEffect } from 'react';
import { FaCalendar, FaSearch, FaDownload, FaEye, FaEdit } from 'react-icons/fa';
import { motion } from 'framer-motion';
import DatePicker from 'react-datepicker';
import { attendanceService } from '../../services/attendance';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatDate, formatTime, formatDuration } from '../../utils/helpers';
import moment from 'moment';
import toast from 'react-hot-toast';
import "react-datepicker/dist/react-datepicker.css";

const AttendanceLog = ({ userId }) => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    startDate: moment().startOf('month').toDate(),
    endDate: moment().endOf('month').toDate(),
    status: ''
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideData, setOverrideData] = useState({ punch_in: '', punch_out: '', reason: '' });

  useEffect(() => {
    fetchAttendanceLogs();
  }, [filters, pagination.page, userId]);

  const fetchAttendanceLogs = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        status: filters.status || undefined,
        page: pagination.page,
        limit: pagination.limit
      };

      const response = userId 
        ? await apiService.attendance.getHistory({ ...params, userId })
        : await attendanceService.getAttendanceHistory(params);

      setAttendanceLogs(response.data || []);
      setSummary(response.summary);
      setPagination(prev => ({ ...prev, total: response.pagination?.total || 0 }));
    } catch (error) {
      toast.error('Failed to fetch attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  const handleOverride = (log) => {
    setSelectedLog(log);
    setOverrideData({
      punch_in: log.punch_in ? moment(log.punch_in.server_timestamp).format('YYYY-MM-DDTHH:mm') : '',
      punch_out: log.punch_out ? moment(log.punch_out.server_timestamp).format('YYYY-MM-DDTHH:mm') : '',
      reason: ''
    });
    setShowOverrideModal(true);
  };

  const submitOverride = async () => {
    if (!overrideData.reason) {
      toast.error('Please provide a reason for override');
      return;
    }

    try {
      await attendanceService.overrideAttendance(selectedLog._id, overrideData);
      toast.success('Attendance overridden successfully');
      setShowOverrideModal(false);
      fetchAttendanceLogs();
    } catch (error) {
      toast.error('Failed to override attendance');
    }
  };

  const handleExport = async () => {
    try {
      const params = {
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        export_format: 'excel'
      };
      
      const response = await apiService.reports.exportDaily(params);
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${moment().format('YYYYMMDD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Export started');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (loading && attendanceLogs.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="attendance-log">
      {/* Filters */}
      <div className="card mb-2">
        <div className="d-flex flex-wrap gap-2 align-end">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <DatePicker
              selected={filters.startDate}
              onChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
              className="form-control"
              dateFormat="dd/MM/yyyy"
              maxDate={filters.endDate}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">End Date</label>
            <DatePicker
              selected={filters.endDate}
              onChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              className="form-control"
              dateFormat="dd/MM/yyyy"
              minDate={filters.startDate}
              maxDate={new Date()}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Status</label>
            <select 
              className="form-control"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="EARLY_EXIT">Early Exit</option>
            </select>
          </div>
          
          <div className="form-group">
            <button className="btn btn-primary" onClick={fetchAttendanceLogs}>
              <FaSearch /> Search
            </button>
            <button className="btn btn-secondary ml-1" onClick={handleExport}>
              <FaDownload /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-4 mb-2">
          <div className="card stat-card-sm">
            <p className="text-secondary">Total Days</p>
            <h4>{summary.total_days}</h4>
          </div>
          <div className="card stat-card-sm">
            <p className="text-secondary">Present</p>
            <h4 className="text-success">{summary.PRESENT || 0}</h4>
          </div>
          <div className="card stat-card-sm">
            <p className="text-secondary">Absent</p>
            <h4 className="text-danger">{summary.ABSENT || 0}</h4>
          </div>
          <div className="card stat-card-sm">
            <p className="text-secondary">Total Hours</p>
            <h4 className="text-primary">{summary.total_work_hours}h</h4>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shift</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Work Hours</th>
                <th>Overtime</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-secondary py-3">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                attendanceLogs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      <div className="d-flex align-center gap-2">
                        <FaCalendar className="text-tertiary" />
                        {formatDate(log.date)}
                      </div>
                    </td>
                    <td>{log.shift_id?.name || 'N/A'}</td>
                    <td>{log.punch_in ? formatTime(log.punch_in.server_timestamp) : '-'}</td>
                    <td>{log.punch_out ? formatTime(log.punch_out.server_timestamp) : '-'}</td>
                    <td>
                      {log.computed_data?.net_work_minutes 
                        ? formatDuration(log.computed_data.net_work_minutes) 
                        : '-'}
                    </td>
                    <td>
                      {log.computed_data?.overtime_minutes > 0 
                        ? <span className="text-warning">{formatDuration(log.computed_data.overtime_minutes)}</span>
                        : '-'}
                    </td>
                    <td>
                      <span className={`badge badge-${attendanceService.formatStatus(log.status).color}`}>
                        {attendanceService.formatStatus(log.status).label}
                      </span>
                      {log.location_invalid && (
                        <span className="badge badge-warning ml-1">Location</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn-icon btn-secondary mr-1"
                        onClick={() => handleViewDetails(log)}
                        title="View Details"
                      >
                        <FaEye />
                      </button>
                      {hasPermission('override_attendance') && (
                        <button 
                          className="btn-icon btn-warning"
                          onClick={() => handleOverride(log)}
                          title="Override"
                        >
                          <FaEdit />
                        </button>
                      )}
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
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </button>
            
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  className={`pagination-item ${pagination.page === pageNum ? 'active' : ''}`}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button 
              className="pagination-item"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showModal && selectedLog && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <motion.div 
            className="modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Attendance Details</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-row">
                <span className="label">Date:</span>
                <span className="value">{formatDate(selectedLog.date)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Shift:</span>
                <span className="value">{selectedLog.shift_id?.name || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Status:</span>
                <span className={`badge badge-${attendanceService.formatStatus(selectedLog.status).color}`}>
                  {attendanceService.formatStatus(selectedLog.status).label}
                </span>
              </div>
              
              {selectedLog.punch_in && (
                <>
                  <h4 className="mt-2 mb-1">Punch In</h4>
                  <div className="detail-row">
                    <span className="label">Time:</span>
                    <span className="value">{formatTime(selectedLog.punch_in.server_timestamp)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Location:</span>
                    <span className="value">
                      {selectedLog.punch_in.location?.latitude.toFixed(6)}, 
                      {selectedLog.punch_in.location?.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Valid:</span>
                    <span className={`value ${selectedLog.punch_in.is_valid ? 'text-success' : 'text-danger'}`}>
                      {selectedLog.punch_in.is_valid ? 'Yes' : 'No'}
                    </span>
                  </div>
                </>
              )}
              
              {selectedLog.punch_out && (
                <>
                  <h4 className="mt-2 mb-1">Punch Out</h4>
                  <div className="detail-row">
                    <span className="label">Time:</span>
                    <span className="value">{formatTime(selectedLog.punch_out.server_timestamp)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Location:</span>
                    <span className="value">
                      {selectedLog.punch_out.location?.latitude.toFixed(6)}, 
                      {selectedLog.punch_out.location?.longitude.toFixed(6)}
                    </span>
                  </div>
                </>
              )}
              
              {selectedLog.computed_data && (
                <>
                  <h4 className="mt-2 mb-1">Calculations</h4>
                  <div className="detail-row">
                    <span className="label">Work Duration:</span>
                    <span className="value">{formatDuration(selectedLog.computed_data.net_work_minutes)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Break Duration:</span>
                    <span className="value">{formatDuration(selectedLog.computed_data.total_break_minutes)}</span>
                  </div>
                  {selectedLog.computed_data.late_by_minutes > 0 && (
                    <div className="detail-row">
                      <span className="label">Late by:</span>
                      <span className="value text-warning">{selectedLog.computed_data.late_by_minutes} minutes</span>
                    </div>
                  )}
                  {selectedLog.computed_data.overtime_minutes > 0 && (
                    <div className="detail-row">
                      <span className="label">Overtime:</span>
                      <span className="value text-success">{formatDuration(selectedLog.computed_data.overtime_minutes)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && selectedLog && (
        <div className="modal-overlay" onClick={() => setShowOverrideModal(false)}>
          <motion.div 
            className="modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Override Attendance</h3>
              <button className="modal-close" onClick={() => setShowOverrideModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="alert alert-warning">
                <p>You are about to override attendance for {formatDate(selectedLog.date)}.</p>
                <p>This action will be logged for audit purposes.</p>
              </div>
              
              <div className="form-group">
                <label className="form-label">Punch In Time</label>
                <input 
                  type="datetime-local"
                  className="form-control"
                  value={overrideData.punch_in}
                  onChange={(e) => setOverrideData(prev => ({ ...prev, punch_in: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Punch Out Time</label>
                <input 
                  type="datetime-local"
                  className="form-control"
                  value={overrideData.punch_out}
                  onChange={(e) => setOverrideData(prev => ({ ...prev, punch_out: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Reason for Override <span className="required">*</span></label>
                <textarea 
                  className="form-control"
                  rows="3"
                  value={overrideData.reason}
                  onChange={(e) => setOverrideData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please provide a valid reason for this override..."
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowOverrideModal(false)}>
                Cancel
              </button>
              <button className="btn btn-warning" onClick={submitOverride}>
                Confirm Override
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <style jsx>{`
        .stat-card-sm {
          padding: 15px;
          text-align: center;
        }
        
        .stat-card-sm h4 {
          font-size: 24px;
          margin-top: 5px;
        }
        
        .detail-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color);
        }
        
        .detail-row .label {
          width: 120px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        
        .detail-row .value {
          flex: 1;
        }
        
        .btn-icon {
          width: 32px;
          height: 32px;
          padding: 0;
          border-radius: 6px;
        }
        
        .mr-1 {
          margin-right: 5px;
        }
        
        .ml-1 {
          margin-left: 5px;
        }
        
        .align-end {
          align-items: flex-end;
        }
      `}</style>
    </div>
  );
};

export default AttendanceLog;