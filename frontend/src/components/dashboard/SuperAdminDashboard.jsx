import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  FaUsers, FaClock, FaCheckCircle, FaChartLine, 
  FaExclamationTriangle, FaBuilding, FaShieldAlt, 
  FaHistory, FaUserShield, FaLock, FaUnlock
} from 'react-icons/fa';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { useAuth } from '../../services/auth';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import { getGreeting } from '../../utils/helpers';
import { socketClient } from '../../services/socket';
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

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Socket listener for live updates
    const handleDashboardUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceTrend', 'week'] });
    };

    const handleNewLog = () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminLogs'] });
    };

    socketClient.on('dashboard_update', handleDashboardUpdate);
    socketClient.on('new_super_admin_log', handleNewLog);

    return () => {
      clearInterval(timer);
      socketClient.off('dashboard_update', handleDashboardUpdate);
      socketClient.off('new_super_admin_log', handleNewLog);
    };
  }, [queryClient]);

  // 1. Dashboard Stats Query
  const { data: dashboardData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await apiService.admin.getDashboardStats();
      return res.data?.data || {};
    },
    staleTime: 5 * 60 * 1000 // 5 mins
  });

  // 2. User Stats Query
  const { data: userStatsData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['userStats'],
    queryFn: async () => {
      const res = await apiService.users.getStats();
      return res.data?.data || {};
    },
    staleTime: 10 * 60 * 1000 // 10 mins
  });

  // 3. System Config Query
  const { data: systemConfigData } = useQuery({
    queryKey: ['systemConfig'],
    queryFn: async () => {
      const res = await apiService.admin.getSystemConfig();
      return res.data?.data || {};
    },
    staleTime: 15 * 60 * 1000
  });

  // 4. Attendance Trend Query
  const { data: attendanceTrendData } = useQuery({
    queryKey: ['attendanceTrend', 'week'],
    queryFn: async () => {
      const res = await apiService.admin.getAttendanceTrend({ period: 'week' });
      return res.data?.data || { dates: [], present: [], late: [], absent: [] };
    },
    staleTime: 5 * 60 * 1000
  });

  // 5. Super Admin Logs Query
  const { data: superAdminLogs = [] } = useQuery({
    queryKey: ['superAdminLogs'],
    queryFn: async () => {
      const res = await apiService.admin.getSystemLogs({ isSuperAdminAction: true, limit: 20 });
      return res.data?.data || [];
    },
    staleTime: 60 * 1000 // 1 min
  });

  // 6. Payroll Locks Query
  const { data: payrollLocks = [] } = useQuery({
    queryKey: ['payrollLocks'],
    queryFn: async () => {
      const res = await apiService.admin.getPayrollLocks();
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Derived states
  const loading = isLoadingStats || isLoadingUsers;
  
  const stats = {
    totalEmployees: dashboardData?.employees?.total || 0,
    presentToday: dashboardData?.today?.present || 0,
    absentToday: dashboardData?.today?.absent || 0,
    lateToday: dashboardData?.today?.late || 0,
    totalAdmins: userStatsData?.by_role?.SUPER_ADMIN || 0,
    totalHR: userStatsData?.by_role?.HR || 0,
    totalManagers: userStatsData?.by_role?.MANAGER || 0,
    pendingApprovals: dashboardData?.pending?.approvals || 0,
    systemHealth: systemConfigData?.maintenance_mode ? 'maintenance' : 'healthy',
    activeSessions: 245,
    revokedPermissions: 3
  };

  const attendanceChart = attendanceTrendData ? {
    labels: attendanceTrendData.dates || [],
    datasets: [
      {
        label: 'Present',
        data: attendanceTrendData.present || [],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Late',
        data: attendanceTrendData.late || [],
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Absent',
        data: attendanceTrendData.absent || [],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  } : null;

  const roleDistributionChart = userStatsData ? {
    labels: ['Super Admin', 'HR', 'Manager', 'Employee'],
    datasets: [{
      data: [
        userStatsData.by_role?.SUPER_ADMIN || 0,
        userStatsData.by_role?.HR || 0,
        userStatsData.by_role?.MANAGER || 0,
        userStatsData.by_role?.EMPLOYEE || 0
      ],
      backgroundColor: [
        'rgba(239, 68, 68, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(16, 185, 129, 0.8)'
      ],
      borderWidth: 0
    }]
  } : null;



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

  return (
    <motion.div 
      className="super-admin-dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .skeleton-text {
          height: 32px;
          width: 60px;
          background-color: var(--border-color, #e2e8f0);
          border-radius: 4px;
          animation: skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          margin-bottom: 4px;
        }
      `}</style>
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
            <span className={`badge badge-${stats.systemHealth === 'healthy' ? 'success' : 'warning'} badge-lg`}>
              <FaShieldAlt /> System: {stats.systemHealth}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-4 mt-2">
        <motion.div 
          className="card stat-card" 
          variants={itemVariants} 
          onClick={() => navigate('/admin/users')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon bg-primary">
            <FaUsers />
          </div>
          <div className="stat-info">
            {loading ? <div className="skeleton-text" /> : <h3>{stats.totalEmployees}</h3>}
            <p>Total Employees</p>
          </div>
        </motion.div>

        <motion.div 
          className="card stat-card" 
          variants={itemVariants}
          onClick={() => navigate('/admin/users?role=SUPER_ADMIN')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon bg-danger">
            <FaUserShield />
          </div>
          <div className="stat-info">
            {loading ? <div className="skeleton-text" /> : <h3>{stats.totalAdmins}</h3>}
            <p>Super Admins</p>
          </div>
        </motion.div>

        <motion.div 
          className="card stat-card" 
          variants={itemVariants}
          onClick={() => navigate('/admin/users?role=HR')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon bg-info">
            <FaUsers />
          </div>
          <div className="stat-info">
            {loading ? <div className="skeleton-text" /> : <h3>{stats.totalHR}</h3>}
            <p>HR Admins</p>
          </div>
        </motion.div>

        <motion.div 
          className="card stat-card" 
          variants={itemVariants}
          onClick={() => navigate('/approvals')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon bg-warning">
            <FaExclamationTriangle />
          </div>
          <div className="stat-info">
            {loading ? <div className="skeleton-text" /> : <h3>{stats.pendingApprovals}</h3>}
            <p>Pending Approvals</p>
          </div>
        </motion.div>
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-4 mt-2">
        <motion.div 
          className="card stat-card" 
          variants={itemVariants}
          onClick={() => navigate('/attendance')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon bg-success">
            <FaCheckCircle />
          </div>
          <div className="stat-info">
            {loading ? <div className="skeleton-text" /> : <h3>{stats.presentToday}</h3>}
            <p>Present Today</p>
          </div>
        </motion.div>

        <motion.div 
          className="card stat-card" 
          variants={itemVariants}
          onClick={() => navigate('/attendance')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon bg-danger-light">
            <FaClock />
          </div>
          <div className="stat-info">
            {loading ? <div className="skeleton-text" /> : <h3>{stats.absentToday}</h3>}
            <p>Absent Today</p>
          </div>
        </motion.div>

        <motion.div 
          className="card stat-card" 
          variants={itemVariants}
          onClick={() => navigate('/attendance')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon bg-warning-light">
            <FaExclamationTriangle />
          </div>
          <div className="stat-info">
            {loading ? <div className="skeleton-text" /> : <h3>{stats.lateToday}</h3>}
            <p>Late Today</p>
          </div>
        </motion.div>

        <motion.div 
          className="card stat-card" 
          variants={itemVariants}
          onClick={() => navigate('/admin/access')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-icon bg-info-light">
            <FaShieldAlt />
          </div>
          <div className="stat-info">
            {loading ? <div className="skeleton-text" /> : <h3>{stats.revokedPermissions}</h3>}
            <p>Revoked Permissions</p>
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-2 mt-2">
        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Attendance Trend</h3>
          </div>
          <div className="chart-container-lg">
            {attendanceChart && <Line data={attendanceChart} options={chartOptions} />}
          </div>
        </motion.div>

        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Role Distribution</h3>
          </div>
          <div className="chart-container-lg">
            {roleDistributionChart && <Doughnut data={roleDistributionChart} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'right',
                  labels: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                  }
                }
              }
            }} />}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-2 mt-2">
        {/* Super Admin Actions Log */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Super Admin Actions</h3>
            <button className="btn-text" onClick={() => navigate('/admin/logs')}>
              View All
            </button>
          </div>
          <div className="activity-list">
            {superAdminLogs.length === 0 ? (
              <div className="empty-state p-3">
                <p className="text-secondary">No Super Admin actions</p>
              </div>
            ) : (
              superAdminLogs.slice(0, 8).map((log, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon bg-danger-light">
                    <FaHistory />
                  </div>
                  <div className="activity-content">
                    <div className="d-flex justify-between">
                      <p className="font-medium">{log.action_type}</p>
                      <span className="badge badge-danger">Super Admin</span>
                    </div>
                    <p className="text-sm text-secondary">
                      {log.actor_user_id?.full_name} • {moment(log.timestamp).fromNow()}
                    </p>
                    {log.reason && <p className="text-sm text-tertiary">{log.reason}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Payroll Locks */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Payroll Locks</h3>
            <button className="btn-text" onClick={() => window.location.href = '/admin/payroll'}>
              Manage
            </button>
          </div>
          <div className="payroll-list">
            {payrollLocks.length === 0 ? (
              <div className="empty-state p-3">
                <p className="text-secondary">No payroll locks</p>
              </div>
            ) : (
              payrollLocks.map((lock, index) => (
                <div key={index} className="payroll-item">
                  <div className="d-flex align-center gap-3">
                    {lock.is_locked ? (
                      <FaLock className="text-danger" />
                    ) : (
                      <FaUnlock className="text-success" />
                    )}
                    <div>
                      <p className="font-medium">
                        {moment().month(lock.month - 1).format('MMMM')} {lock.year}
                      </p>
                      <p className="text-sm text-secondary">
                        Locked by: {lock.locked_by?.full_name || 'System'}
                      </p>
                    </div>
                  </div>
                  <span className={`badge badge-${lock.is_locked ? 'danger' : 'success'}`}>
                    {lock.is_locked ? 'Locked' : 'Unlocked'}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div className="card mt-2" variants={itemVariants}>
        <h3 className="mb-2">Super Admin Actions</h3>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-danger" onClick={() => window.location.href = '/admin/permissions'}>
            <FaShieldAlt /> Manage Permissions
          </button>
          <button className="btn btn-primary" onClick={() => window.location.href = '/admin/users'}>
            <FaUsers /> Manage Users
          </button>
          <button className="btn btn-warning" onClick={() => window.location.href = '/admin/logs'}>
            <FaHistory /> View Audit Logs
          </button>
          <button className="btn btn-info" onClick={() => window.location.href = '/admin/config'}>
            <FaBuilding /> System Config
          </button>
          <button className="btn btn-success" onClick={() => window.location.href = '/admin/backup'}>
            <FaShieldAlt /> Backup System
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
        
        .badge-lg {
          padding: 8px 20px;
          font-size: 16px;
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
        
        .stat-icon.bg-danger {
          background: var(--danger-color);
        }
        
        .stat-icon.bg-success-light {
          background: color-mix(in srgb, var(--success-color) 15%, transparent);
          color: var(--success-color);
        }
        
        .stat-icon.bg-danger-light {
          background: color-mix(in srgb, var(--danger-color) 15%, transparent);
          color: var(--danger-color);
        }
        
        .stat-icon.bg-warning-light {
          background: color-mix(in srgb, var(--warning-color) 15%, transparent);
          color: var(--warning-color);
        }
        
        .stat-icon.bg-info-light {
          background: color-mix(in srgb, var(--info-color) 15%, transparent);
          color: var(--info-color);
        }
        
        .stat-info h3 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 5px;
        }
        
        .stat-info p {
          color: var(--text-secondary);
        }
        
        .chart-container-lg {
          height: 350px;
        }
        
        .activity-list {
          max-height: 350px;
          overflow-y: auto;
        }
        
        .activity-item {
          display: flex;
          gap: 15px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-color);
        }
        
        .activity-item:last-child {
          border-bottom: none;
        }
        
        .activity-icon {
          width: 35px;
          height: 35px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .activity-content {
          flex: 1;
        }
        
        .payroll-list {
          max-height: 350px;
          overflow-y: auto;
        }
        
        .payroll-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-color);
        }
        
        .payroll-item:last-child {
          border-bottom: none;
        }
        
        .gap-3 {
          gap: 15px;
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

export default SuperAdminDashboard;