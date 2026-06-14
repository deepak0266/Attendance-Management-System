import React, { useState, useEffect } from 'react';
import { 
  FaUsers, FaClock, FaCheckCircle, FaTimesCircle, 
  FaExclamationTriangle, FaChartLine, FaUserCheck 
} from 'react-icons/fa';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { useAuth } from '../../services/auth';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatDuration, formatDate, getGreeting } from '../../utils/helpers';
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

const ManagerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    teamSize: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    pendingApprovals: 0,
    teamAttendance: [],
    recentActivity: []
  });
  const [chartData, setChartData] = useState(null);
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
        teamMembers,
        todayAttendance,
        pendingApprovals,
        attendanceTrend,
        recentActivity
      ] = await Promise.all([
        apiService.users.getTeam(),
        apiService.attendance.getHistory({ 
          startDate: moment().startOf('day').toISOString(),
          endDate: moment().endOf('day').toISOString()
        }),
        apiService.approvals.getPending(),
        apiService.admin.getAttendanceTrend({ period: 'week' }),
        apiService.admin.getSystemLogs({ limit: 10 })
      ]);

      const teamData = teamMembers.data || [];
      const todayData = todayAttendance.data?.data || [];
      
      setStats({
        teamSize: teamData.length,
        presentToday: todayData.filter(a => a.status === 'PRESENT').length,
        absentToday: todayData.filter(a => a.status === 'ABSENT').length,
        lateToday: todayData.filter(a => a.status === 'LATE').length,
        pendingApprovals: pendingApprovals.data?.pagination?.total || 0,
        teamAttendance: teamData,
        recentActivity: recentActivity.data?.data || []
      });

      // Prepare chart data
      const trendData = attendanceTrend.data?.data || { dates: [], present: [], late: [], absent: [] };
      
      setChartData({
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
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
        },
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
        }
      },
      y: {
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
        },
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
        }
      }
    }
  };

  return (
    <motion.div 
      className="manager-dashboard"
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
              <FaChartLine /> View Reports
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
            <h3>{stats.teamSize}</h3>
            <p>Team Members</p>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-success">
            <FaUserCheck />
          </div>
          <div className="stat-info">
            <h3>{stats.presentToday}</h3>
            <p>Present Today</p>
            <span className="stat-trend up">
              {stats.teamSize > 0 
                ? `${((stats.presentToday / stats.teamSize) * 100).toFixed(1)}%` 
                : '0%'}
            </span>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-warning">
            <FaExclamationTriangle />
          </div>
          <div className="stat-info">
            <h3>{stats.lateToday}</h3>
            <p>Late Today</p>
          </div>
        </motion.div>

        <motion.div className="card stat-card" variants={itemVariants}>
          <div className="stat-icon bg-danger">
            <FaClock />
          </div>
          <div className="stat-info">
            <h3>{stats.pendingApprovals}</h3>
            <p>Pending Approvals</p>
          </div>
        </motion.div>
      </div>

      {/* Attendance Trend Chart */}
      <motion.div className="card mt-2" variants={itemVariants}>
        <div className="card-header">
          <h3>Team Attendance Trend</h3>
          <button className="btn-text" onClick={() => window.location.href = '/reports'}>
            View Details
          </button>
        </div>
        <div className="chart-container-lg">
          {chartData && <Line data={chartData} options={chartOptions} />}
        </div>
      </motion.div>

      <div className="grid grid-2 mt-2">
        {/* Team Overview */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Team Overview</h3>
            <button className="btn-text" onClick={() => window.location.href = '/users/team'}>
              View All
            </button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Today</th>
                </tr>
              </thead>
              <tbody>
                {stats.teamAttendance.slice(0, 5).map((member) => (
                  <tr key={member._id}>
                    <td>
                      <div className="d-flex align-center gap-2">
                        <div className="user-avatar-sm">
                          {member.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-sm text-secondary">{member.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td>{member.department}</td>
                    <td>
                      <span className={`badge badge-${member.status === 'ACTIVE' ? 'success' : 'secondary'}`}>
                        {member.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${member.today_status === 'PRESENT' ? 'success' : member.today_status === 'LATE' ? 'warning' : 'secondary'}`}>
                        {member.today_status || 'NOT_PUNCHED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div className="card" variants={itemVariants}>
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-list">
            {stats.recentActivity.length === 0 ? (
              <div className="empty-state p-3">
                <p className="text-secondary">No recent activity</p>
              </div>
            ) : (
              stats.recentActivity.slice(0, 8).map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    <FaClock />
                  </div>
                  <div className="activity-content">
                    <p className="font-medium">{activity.action_type}</p>
                    <p className="text-sm text-secondary">
                      {activity.actor_user_id?.full_name} • {moment(activity.timestamp).fromNow()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div className="card mt-2" variants={itemVariants}>
        <h3 className="mb-2">Quick Actions</h3>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-primary" onClick={() => window.location.href = '/approvals'}>
            <FaCheckCircle /> Review Approvals
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/reports/daily'}>
            <FaChartLine /> Daily Report
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/users/team'}>
            <FaUsers /> Manage Team
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
        
        .stat-icon.bg-danger {
          background: var(--danger-color);
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
        
        .user-avatar-sm {
          width: 35px;
          height: 35px;
          border-radius: 8px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 14px;
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
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }
        
        .activity-content {
          flex: 1;
        }
        
        .chart-container-lg {
          height: 350px;
        }
        
        @media (max-width: 768px) {
          .grid-4 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </motion.div>
  );
};

export default ManagerDashboard;