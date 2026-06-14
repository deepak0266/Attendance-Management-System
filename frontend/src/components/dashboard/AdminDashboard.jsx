import React, { useState, useEffect } from 'react';
import { 
  FaUsers, FaClock, FaCheckCircle, FaChartLine, 
  FaExclamationTriangle, FaBuilding, FaUserClock, FaCalendarCheck 
} from 'react-icons/fa';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { useAuth } from '../../services/auth';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import { getGreeting } from '../../utils/helpers';
import moment from 'moment';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    onLeave: 0,
    pendingApprovals: 0,
    monthlyHours: 0,
    monthlyOvertime: 0
  });
  const [attendanceChart, setAttendanceChart] = useState(null);
  const [departmentChart, setDepartmentChart] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [
        dashboardStats,
        attendanceTrend,
        deptDistribution,
        recentLogs,
        pendingApprovals
      ] = await Promise.all([
        apiService.admin.getDashboardStats(),
        apiService.admin.getAttendanceTrend({ period: 'week' }),
        apiService.admin.getDepartmentDistribution(),
        apiService.admin.getSystemLogs({ limit: 10 }),
        apiService.approvals.getPending({ limit: 100 })
      ]);

      const statsData = dashboardStats.data?.data || {};
      
      setStats({
        totalEmployees: statsData.employees?.total || 0,
        presentToday: statsData.today?.present || 0,
        absentToday: statsData.today?.absent || 0,
        lateToday: statsData.today?.late || 0,
        onLeave: statsData.employees?.on_leave || 0,
        pendingApprovals: pendingApprovals.data?.pagination?.total || 0,
        monthlyHours: statsData.monthly?.total_work_hours?.toFixed(0) || 0,
        monthlyOvertime: statsData.monthly?.total_overtime_hours?.toFixed(0) || 0
      });

      // Attendance trend chart
      const trendData = attendanceTrend.data?.data || { dates: [], present: [], late: [], absent: [] };
      setAttendanceChart({
        labels: trendData.dates || [],
        datasets: [
          {
            label: 'Present',
            data: trendData.present || [],
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Late',
            data: trendData.late || [],
            borderColor: 'rgb(245, 158, 11)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Absent',
            data: trendData.absent || [],
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      });

      // Department distribution chart
      const deptData = deptDistribution.data?.data || { labels: [], values: [] };
      setDepartmentChart({
        labels: deptData.labels || [],
        datasets: [{
          data: deptData.values || [],
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)'
          ],
          borderWidth: 0
        }]
      });

      setRecentActivity(recentLogs.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
        }
      }
    },
    scales: {
      x: {
        grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') },
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') }
      },
      y: {
        grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') },
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
          padding: 20
        }
      }
    }
  };

  return (
    <motion.div 
      className="admin-dashboard"
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
          <div className="d-flex gap-2">
            <button className="btn btn-primary" onClick={() => window.location.href = '/reports'}>
              <FaChartLine /> Generate Report
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-4 mt-2">
        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-primary">
            <FaUsers />
          </div>
          <div className="stat-info">
            <h3>{stats.totalEmployees}</h3>
            <p>Total Employees</p>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-success">
            <FaCalendarCheck />
          </div>
          <div className="stat-info">
            <h3>{stats.presentToday}</h3>
            <p>Present Today</p>
            <span className="stat-trend up">
              {stats.totalEmployees > 0 
                ? `${((stats.presentToday / stats.totalEmployees) * 100).toFixed(1)}%` 
                : '0%'}
            </span>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-warning">
            <FaExclamationTriangle />
          </div>
          <div className="stat-info">
            <h3>{stats.pendingApprovals}</h3>
            <p>Pending Approvals</p>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-info">
            <FaBuilding />
          </div>
          <div className="stat-info">
            <h3>{stats.onLeave}</h3>
            <p>On Leave</p>
          </div>
        </motion.div>
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-4 mt-2">
        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-success-light">
            <FaUserClock />
          </div>
          <div className="stat-info">
            <h3>{stats.lateToday}</h3>
            <p>Late Today</p>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-danger-light">
            <FaClock />
          </div>
          <div className="stat-info">
            <h3>{stats.absentToday}</h3>
            <p>Absent Today</p>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-primary-light">
            <FaChartLine />
          </div>
          <div className="stat-info">
            <h3>{stats.monthlyHours}h</h3>
            <p>Monthly Hours</p>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-warning-light">
            <FaClock />
          </div>
          <div className="stat-info">
            <h3>{stats.monthlyOvertime}h</h3>
            <p>Monthly Overtime</p>
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-2 mt-2">
        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Attendance Trend</h3>
            <button className="btn-text" onClick={() => window.location.href = '/reports'}>
              View Report
            </button>
          </div>
          <div className="chart-container-lg">
            {attendanceChart && <Line data={attendanceChart} options={chartOptions} />}
          </div>
        </motion.div>

        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Department Distribution</h3>
          </div>
          <div className="chart-container-lg">
            {departmentChart && <Doughnut data={departmentChart} options={doughnutOptions} />}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div className="card mt-2" variants={itemVariants}>
        <div className="card-header">
          <h3>Recent System Activity</h3>
          <button className="btn-text" onClick={() => window.location.href = '/admin/logs'}>
            View All Logs
          </button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-secondary">
                    No recent activity
                  </td>
                </tr>
              ) : (
                recentActivity.slice(0, 10).map((activity, index) => (
                  <tr key={index}>
                    <td>{moment(activity.timestamp).format('HH:mm:ss')}</td>
                    <td>
                      <div className="d-flex align-center gap-2">
                        <div className="user-avatar-xs">
                          {activity.actor_user_id?.full_name?.charAt(0) || 'S'}
                        </div>
                        <span>{activity.actor_user_id?.full_name || 'System'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${activity.is_super_admin_action ? 'danger' : 'info'}`}>
                        {activity.action_type}
                      </span>
                    </td>
                    <td>{activity.reason || '-'}</td>
                    <td>{activity.ip_address}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div className="card mt-2" variants={itemVariants}>
        <h3 className="mb-2">Quick Actions</h3>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-primary" onClick={() => window.location.href = '/admin/users'}>
            <FaUsers /> Manage Users
          </button>
          <button className="btn btn-success" onClick={() => window.location.href = '/admin/shifts'}>
            <FaClock /> Manage Shifts
          </button>
          <button className="btn btn-info" onClick={() => window.location.href = '/approvals'}>
            <FaCheckCircle /> Review Approvals
          </button>
          <button className="btn btn-warning" onClick={() => window.location.href = '/admin/payroll'}>
            <FaChartLine /> Payroll
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/reports'}>
            <FaChartLine /> Reports
          </button>
        </div>
      </motion.div>

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
        
        .stat-card {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        
        .stat-icon {
          width: 60px;
          height: 60px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
        }
        
        .stat-icon.bg-primary {
          background: var(--primary-gradient);
        }
        
        .stat-icon.bg-success {
          background: var(--success-color);
        }
        
        .stat-icon.bg-warning {
          background: var(--warning-color);
        }
        
        .stat-icon.bg-info {
          background: var(--info-color);
        }
        
        .stat-icon.bg-success-light {
          background: color-mix(in srgb, var(--success-color) 15%, transparent);
          color: var(--success-color);
        }
        
        .stat-icon.bg-danger-light {
          background: color-mix(in srgb, var(--danger-color) 15%, transparent);
          color: var(--danger-color);
        }
        
        .stat-icon.bg-primary-light {
          background: color-mix(in srgb, #667eea 15%, transparent);
          color: #667eea;
        }
        
        .stat-icon.bg-warning-light {
          background: color-mix(in srgb, var(--warning-color) 15%, transparent);
          color: var(--warning-color);
        }
        
        .stat-info h3 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 5px;
        }
        
        .stat-info p {
          color: var(--text-secondary);
        }
        
        .stat-trend {
          font-size: 12px;
          margin-top: 5px;
        }
        
        .stat-trend.up {
          color: var(--success-color);
        }
        
        .user-avatar-xs {
          width: 25px;
          height: 25px;
          border-radius: 6px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 11px;
        }
        
        .chart-container-lg {
          height: 350px;
        }
        
        @media (max-width: 1200px) {
          .grid-4 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 768px) {
          .grid-4 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default AdminDashboard;