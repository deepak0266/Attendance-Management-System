import React, { useState, useEffect } from 'react';
import { FaCalendar, FaDownload, FaSearch, FaUsers, FaClock, FaChartBar } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';
import "react-datepicker/dist/react-datepicker.css";

const DailyReport = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    date: new Date(),
    department: ''
  });
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchDepartments();
    fetchReport();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await apiService.users.getStats();
      const depts = Object.keys(response.data.data?.by_department || {});
      setDepartments(depts);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        date: filters.date.toISOString(),
        department: filters.department || undefined
      };
      const response = await apiService.reports.getDaily(params);
      setReportData(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = 'excel') => {
    try {
      const params = {
        date: filters.date.toISOString(),
        department: filters.department || undefined,
        export_format: format
      };
      
      const response = await apiService.reports.exportDaily(params);
      
      const blob = new Blob([response.data], { 
        type: format === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'application/pdf'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daily_attendance_${moment(filters.date).format('YYYYMMDD')}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'PRESENT': 'success',
      'ABSENT': 'danger',
      'LATE': 'warning',
      'HALF_DAY': 'info',
      'EARLY_EXIT': 'warning',
      'HOLIDAY': 'info',
      'WEEKEND': 'secondary',
      'ON_LEAVE': 'info'
    };
    return colors[status] || 'secondary';
  };

  return (
    <div className="daily-report">
      {/* Filters */}
      <div className="card mb-2">
        <div className="d-flex flex-wrap gap-2 align-end">
          <div className="form-group">
            <label className="form-label">Select Date</label>
            <DatePicker
              selected={filters.date}
              onChange={(date) => setFilters(prev => ({ ...prev, date }))}
              className="form-control"
              dateFormat="dd/MM/yyyy"
              maxDate={new Date()}
            />
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
            <button className="btn btn-primary" onClick={fetchReport}>
              <FaSearch /> Generate
            </button>
            <button className="btn btn-secondary ml-1" onClick={() => handleExport('excel')}>
              <FaDownload /> Excel
            </button>
            <button className="btn btn-secondary ml-1" onClick={() => handleExport('pdf')}>
              <FaDownload /> PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="text-center py-4">
            <LoadingSpinner />
          </div>
        </div>
      ) : reportData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-4 mb-2">
            <div className="card stat-card">
              <FaUsers className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.total_employees}</h3>
                <p>Total Employees</p>
              </div>
            </div>
            
            <div className="card stat-card success">
              <FaClock className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.present}</h3>
                <p>Present</p>
                <small>{((reportData.summary.present / reportData.summary.total_employees) * 100).toFixed(1)}%</small>
              </div>
            </div>
            
            <div className="card stat-card warning">
              <FaClock className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.late}</h3>
                <p>Late</p>
              </div>
            </div>
            
            <div className="card stat-card danger">
              <FaClock className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.absent}</h3>
                <p>Absent</p>
              </div>
            </div>
          </div>

          <div className="grid grid-4 mb-2">
            <div className="card stat-card info">
              <FaClock className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.half_day}</h3>
                <p>Half Day</p>
              </div>
            </div>
            
            <div className="card stat-card">
              <FaChartBar className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.total_work_hours}h</h3>
                <p>Total Work Hours</p>
              </div>
            </div>
            
            <div className="card stat-card">
              <FaChartBar className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.total_overtime}h</h3>
                <p>Total Overtime</p>
              </div>
            </div>
            
            <div className="card stat-card">
              <FaChartBar className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.avg_work_hours}h</h3>
                <p>Avg Hours</p>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="card">
            <div className="card-header">
              <h3>Attendance Details - {moment(filters.date).format('DD/MM/YYYY')}</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Shift</th>
                    <th>Punch In</th>
                    <th>Punch Out</th>
                    <th>Work Hours</th>
                    <th>Overtime</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.attendance.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-3 text-secondary">
                        No attendance records found
                      </td>
                    </tr>
                  ) : (
                    reportData.attendance.map((record, idx) => (
                      <tr key={idx}>
                        <td>{record.employee_id}</td>
                        <td>{record.name}</td>
                        <td>{record.department}</td>
                        <td>{record.shift}</td>
                        <td>{record.punch_in ? moment(record.punch_in).format('HH:mm') : '-'}</td>
                        <td>{record.punch_out ? moment(record.punch_out).format('HH:mm') : '-'}</td>
                        <td>{record.work_hours}</td>
                        <td>{record.overtime}</td>
                        <td>
                          <span className={`badge badge-${getStatusColor(record.status)}`}>
                            {record.status}
                          </span>
                          {record.late_by > 0 && (
                            <span className="badge badge-warning ml-1">+{record.late_by}m</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="empty-state py-4">
            <FaCalendar size={50} className="text-tertiary mb-2" />
            <p>Select a date to generate the report</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .stat-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
        }
        
        .stat-icon {
          font-size: 30px;
          color: #667eea;
        }
        
        .stat-card.success .stat-icon {
          color: var(--success-color);
        }
        
        .stat-card.warning .stat-icon {
          color: var(--warning-color);
        }
        
        .stat-card.danger .stat-icon {
          color: var(--danger-color);
        }
        
        .stat-card.info .stat-icon {
          color: var(--info-color);
        }
        
        .stat-content h3 {
          font-size: 28px;
          font-weight: 700;
        }
        
        .stat-content p {
          color: var(--text-secondary);
          font-size: 14px;
        }
        
        .stat-content small {
          color: var(--success-color);
          font-size: 12px;
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

export default DailyReport;