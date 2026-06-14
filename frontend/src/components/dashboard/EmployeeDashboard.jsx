import React, { useState, useEffect } from 'react';
import { FaClock, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaCalendarAlt, FaInfoCircle } from 'react-icons/fa';
import { Line, Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { useAuth } from '../../services/auth';
import { attendanceService } from '../../services/attendance';
import { apiService } from '../../services/api';
import PunchInOut from '../attendance/PunchInOut';
import AttendanceChart from '../attendance/AttendanceChart';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatDate, formatDuration, getGreeting } from '../../utils/helpers';
import moment from 'moment';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today: null,
    monthly: null,
    pendingRequests: 0,
    recentAttendance: []
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  const isPunchInLate = () => {
    const shift = stats.today?.shift;
    if (!shift) return false;
    const [sh, sm] = shift.start_time.split(':').map(Number);
    const grace = shift.grace_period_minutes || 0;
    const shiftStart = new Date();
    shiftStart.setHours(sh, sm + grace, 0, 0);
    return currentTime > shiftStart;
  };

  useEffect(() => {
    fetchDashboardData();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [summary, status, pendingApprovals, recentHistory] = await Promise.all([
        attendanceService.getSummary(),
        attendanceService.getCurrentStatus(),
        apiService.approvals.getPending({ limit: 5 }),
        apiService.attendance.getHistory({ limit: 5 })
      ]);

      setStats({
        today: status,
        monthly: summary,
        pendingRequests: pendingApprovals.data?.pagination?.total || 0,
        recentAttendance: recentHistory.data?.data || []
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'NOT_PUNCHED': 'secondary',
      'PUNCHED_IN': 'success',
      'ON_BREAK': 'warning',
      'PUNCHED_OUT': 'danger',
      'PENDING_APPROVAL': 'info'
    };
    return colors[status] || 'secondary';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'NOT_PUNCHED': 'Not Punched In',
      'PUNCHED_IN': 'Working',
      'ON_BREAK': 'On Break',
      'PUNCHED_OUT': 'Completed',
      'PENDING_APPROVAL': 'Pending Approval'
    };
    return labels[status] || status;
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="employee-dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Section */}
      <motion.div className="welcome-card card" variants={itemVariants}>
        <div className="d-flex justify-between align-center">
          <div>
            <h2>{getGreeting()}, {user?.full_name?.split(' ')[0]}!</h2>
            <p className="text-secondary">
              {moment().format('dddd, MMMM D, YYYY')} | {currentTime.toLocaleTimeString()}
            </p>
          </div>
          <div className={`badge badge-${getStatusColor(stats.today?.state)} badge-lg`}>
            {getStatusLabel(stats.today?.state)}
          </div>
        </div>
      </motion.div>

      {/* Shift Details & Guidelines Section */}
      {stats.today?.shift && (
        <motion.div className="card shift-guidelines-horizontal-card mt-2" variants={itemVariants}>
          <div className="guidelines-flex-container">
            {/* Shift timings & status */}
            <div className="guidelines-shift-panel">
              <div className="section-title">
                <FaClock className="text-primary" />
                <span>Shift Schedule ({stats.today.shift.name})</span>
              </div>
              <div className="shift-time-bubble">
                {stats.today.shift.start_time} - {stats.today.shift.end_time}
              </div>
              <div className="shift-meta-text">
                Grace period: {stats.today.shift.grace_period_minutes || 0} mins | 
                Work Day: {stats.today.shift.is_working_day ? 'Yes' : 'No'}
              </div>

              {/* Late Warning */}
              {stats.today?.state === 'NOT_PUNCHED' && isPunchInLate() && (
                <div className="horizontal-alert alert-danger animate-pulse">
                  <FaExclamationTriangle className="text-danger" />
                  <span><strong>Late Punch-In:</strong> Current time is past grace threshold. Your status will be marked LATE.</span>
                </div>
              )}

              {stats.today?.attendance?.status === 'LATE' && (
                <div className="horizontal-alert alert-warning">
                  <FaExclamationTriangle className="text-warning" />
                  <span><strong>Punched Late:</strong> You punched in late. Submit a regularization request if needed.</span>
                </div>
              )}
            </div>

            {/* Directives */}
            <div className="guidelines-directives-panel">
              <div className="section-title">
                <FaInfoCircle className="text-info" />
                <span>Action Guidelines (Role: {user?.role})</span>
              </div>
              <ul className="horizontal-directives-list">
                {user?.role === 'SUPER_ADMIN' && (
                  <>
                    <li>• Verify and maintain core system settings and active attendance policies.</li>
                    <li>• Ensure Redis and session databases are running smoothly to handle concurrent requests.</li>
                    <li>• You have full override capabilities. Use the "Override Attendance" page for manual corrections.</li>
                  </>
                )}
                {user?.role === 'HR' && (
                  <>
                    <li>• Review and update organizational geofences (400m radius branches).</li>
                    <li>• Monitor company-wide punch exceptions (Late Punch-ins and Early Exits).</li>
                    <li>• Approve or reject pending regularization requests from employees.</li>
                  </>
                )}
                {user?.role === 'MANAGER' && (
                  <>
                    <li>• Review and approve regularization requests of your team members.</li>
                    <li>• Monitor team members who have punched in late or are currently on break.</li>
                    <li>• Check real-time department activity trends on the Manager Dashboard.</li>
                  </>
                )}
                {(user?.role === 'EMPLOYEE' || !['SUPER_ADMIN', 'HR', 'MANAGER'].includes(user?.role)) && (
                  <>
                    <li>• Keep Location enabled. Geolocation must be within 400m of the office branch.</li>
                    <li>• If you are punching in late, submit a regularization request under the "Regularize" tab.</li>
                    <li>• Maximum break duration is 60 minutes. Log breaks using the "Start Break" button.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-2 mt-2">
        {/* Punch In/Out Card */}
        <motion.div variants={itemVariants}>
          <PunchInOut />
        </motion.div>

        {/* Quick Stats */}
        <motion.div className="card" variants={itemVariants}>
          <h3>Today's Summary</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-icon bg-success-light">
                <FaClock className="text-success" />
              </div>
              <div className="stat-info">
                <h4>{stats.today?.attendance?.computed_data?.net_work_minutes 
                  ? formatDuration(stats.today.attendance.computed_data.net_work_minutes) 
                  : '0h 0m'}</h4>
                <p>Worked Today</p>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon bg-info-light">
                <FaCalendarAlt className="text-info" />
              </div>
              <div className="stat-info">
                <h4>{stats.monthly?.present_days || 0}</h4>
                <p>Days Present (MTD)</p>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon bg-warning-light">
                <FaExclamationTriangle className="text-warning" />
              </div>
              <div className="stat-info">
                <h4>{stats.monthly?.late_days || 0}</h4>
                <p>Late Days</p>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon bg-primary-light">
                <FaCheckCircle className="text-primary" />
              </div>
              <div className="stat-info">
                <h4>{stats.monthly?.attendance_percentage || '0'}%</h4>
                <p>Attendance Rate</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Attendance Chart */}
      <motion.div className="mt-2" variants={itemVariants}>
        <AttendanceChart />
      </motion.div>

      <div className="grid grid-2 mt-2">
        {/* Recent Attendance */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Recent Attendance</h3>
            <button className="btn-text" onClick={() => window.location.href = '/attendance'}>
              View All
            </button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Punch In</th>
                  <th>Punch Out</th>
                  <th>Status</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAttendance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-secondary">
                      No attendance records
                    </td>
                  </tr>
                ) : (
                  stats.recentAttendance.map((record) => (
                    <tr key={record._id}>
                      <td>{formatDate(record.date)}</td>
                      <td>{record.punch_in ? moment(record.punch_in.server_timestamp).format('HH:mm') : '-'}</td>
                      <td>{record.punch_out ? moment(record.punch_out.server_timestamp).format('HH:mm') : '-'}</td>
                      <td>
                        <span className={`badge badge-${attendanceService.formatStatus(record.status).color}`}>
                          {attendanceService.formatStatus(record.status).label}
                        </span>
                      </td>
                      <td>
                        {record.computed_data?.net_work_minutes 
                          ? formatDuration(record.computed_data.net_work_minutes) 
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Pending Requests */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Pending Requests</h3>
            <button className="btn-text" onClick={() => window.location.href = '/approvals'}>
              View All
            </button>
          </div>
          
          {stats.pendingRequests === 0 ? (
            <div className="empty-state">
              <FaCheckCircle size={40} className="text-success mb-2" />
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="pending-list">
              <div className="pending-item">
                <div className="d-flex align-center gap-2">
                  <FaClock className="text-warning" />
                  <div>
                    <p className="font-medium">Regularization Request</p>
                    <p className="text-sm text-secondary">Submitted 2 days ago</p>
                  </div>
                </div>
                <span className="badge badge-warning">Pending</span>
              </div>
            </div>
          )}
          
          <div className="mt-2">
            <button 
              className="btn btn-primary w-100"
              onClick={() => window.location.href = '/attendance/regularize'}
            >
              New Regularization Request
            </button>
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        .welcome-card {
          background: var(--primary-gradient);
          color: white;
        }
        
        .welcome-card h2,
        .welcome-card p {
          color: white;
        }
        
        .welcome-card .text-secondary {
          color: rgba(255, 255, 255, 0.8) !important;
        }
        
        .badge-lg {
          padding: 8px 20px;
          font-size: 16px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-top: 20px;
        }
        
        .stat-item {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .stat-icon {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        
        .bg-success-light {
          background: color-mix(in srgb, var(--success-color) 15%, transparent);
        }
        
        .bg-info-light {
          background: color-mix(in srgb, var(--info-color) 15%, transparent);
        }
        
        .bg-warning-light {
          background: color-mix(in srgb, var(--warning-color) 15%, transparent);
        }
        
        .bg-primary-light {
          background: color-mix(in srgb, #667eea 15%, transparent);
        }
        
        .stat-info h4 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        
        .stat-info p {
          color: var(--text-secondary);
          font-size: 13px;
        }
        
        .pending-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background: var(--bg-secondary);
          border-radius: 10px;
          margin-bottom: 10px;
        }
        
        .w-100 {
          width: 100%;
        }
        
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }

        .shift-guidelines-horizontal-card {
          padding: 20px;
          background: var(--card-bg);
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }

        .guidelines-flex-container {
          display: flex;
          gap: 30px;
        }

        .guidelines-shift-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-right: 1px solid var(--border-color);
          padding-right: 30px;
        }

        .guidelines-directives-panel {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-title {
          font-weight: 700;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
          margin-bottom: 5px;
        }

        .shift-time-bubble {
          font-size: 24px;
          font-weight: 700;
          color: var(--primary-color, #667eea);
          background: var(--bg-secondary);
          padding: 8px 16px;
          border-radius: 8px;
          display: inline-block;
          width: fit-content;
        }

        .shift-meta-text {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .horizontal-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.4;
          margin-top: 5px;
        }

        .horizontal-alert.alert-danger {
          background: color-mix(in srgb, var(--danger-color, #ef4444) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--danger-color, #ef4444) 25%, transparent);
        }

        .horizontal-alert.alert-warning {
          background: color-mix(in srgb, var(--warning-color, #f59e0b) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--warning-color, #f59e0b) 25%, transparent);
        }

        .horizontal-directives-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .horizontal-directives-list li {
          font-size: 13px;
          line-height: 1.4;
          color: var(--text-secondary);
        }

        @media (max-width: 992px) {
          .guidelines-flex-container {
            flex-direction: column;
            gap: 20px;
          }
          .guidelines-shift-panel {
            border-right: none;
            padding-right: 0;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
          }
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .8; }
        }
      `}</style>
    </motion.div>
  );
};

export default EmployeeDashboard;