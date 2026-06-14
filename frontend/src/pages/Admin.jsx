import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import UserManagement from '../components/admin/UserManagement';
import ShiftManagement from '../components/admin/ShiftManagement';
import PolicyManagement from '../components/admin/PolicyManagement';
import GeoFenceManagement from '../components/admin/GeoFenceManagement';
import AccessRevocation from '../components/admin/AccessRevocation';
import SystemLogs from '../components/admin/SystemLogs';
import RolesPage from '../components/admin/RolesPage';
import DeviceApprovals from './Admin/DeviceApprovals';
import HolidayCalendar from './Admin/HolidayCalendar';
import QRPresenter from '../components/attendance/QRPresenter';
import { useAuth } from '../services/auth';
import { Helmet } from 'react-helmet-async';
import { 
  FaUsers, FaClock, FaCog, FaMapMarkerAlt, 
  FaShieldAlt, FaHistory, FaCheckCircle, FaCalendarDay
} from 'react-icons/fa';

const Admin = ({ toggleTheme, theme }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const adminTabs = [
    { path: '/admin/users', icon: <FaUsers />, label: 'Users', roles: ['SUPER_ADMIN', 'HR'] },
    { path: '/admin/shifts', icon: <FaClock />, label: 'Shifts', roles: ['SUPER_ADMIN', 'HR'] },
    { path: '/admin/policies', icon: <FaCog />, label: 'Policies', roles: ['SUPER_ADMIN', 'HR'] },
    { path: '/admin/geofence', icon: <FaMapMarkerAlt />, label: 'Geo-fence', roles: ['SUPER_ADMIN', 'HR'] },
    { path: '/admin/roles', icon: <FaShieldAlt />, label: 'Roles', roles: ['SUPER_ADMIN'] },
    { path: '/admin/permissions', icon: <FaShieldAlt />, label: 'Permissions', roles: ['SUPER_ADMIN'] },
    { path: '/admin/logs', icon: <FaHistory />, label: 'System Logs', roles: ['SUPER_ADMIN', 'HR'] },
    { path: '/admin/device-approvals', icon: <FaCheckCircle />, label: 'Device Approvals', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] },
    { path: '/admin/holiday-calendar', icon: <FaCalendarDay />, label: 'Holidays', roles: ['SUPER_ADMIN', 'HR'] },
    { path: '/admin/qr-presenter', icon: <FaMapMarkerAlt />, label: 'QR Presenter', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] }
  ];

  const filteredTabs = adminTabs.filter(tab => tab.roles.includes(user?.role));

  return (
    <>
      <Helmet>
        <title>Administration - Attendance System</title>
      </Helmet>

      <div className="layout">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        
        <div className="main-content">
          <Header 
            toggleTheme={toggleTheme} 
            theme={theme} 
            toggleSidebar={toggleSidebar}
          />
          
          <div className="page-content fade-in">
            <div className="page-header">
              <h1>Administration</h1>
              <p className="text-secondary">Manage system settings and configurations</p>
            </div>

            <div className="admin-tabs">
              {filteredTabs.map(tab => (
                <NavLink 
                  key={tab.path}
                  to={tab.path} 
                  className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
                >
                  {tab.icon} {tab.label}
                </NavLink>
              ))}
            </div>

            <div className="admin-content mt-2">
              <Routes>
                <Route path="/" element={<Navigate to="/admin/users" replace />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/shifts" element={<ShiftManagement />} />
                <Route path="/policies" element={<PolicyManagement />} />
                <Route path="/geofence" element={<GeoFenceManagement />} />
                {user?.role === 'SUPER_ADMIN' && (
                  <>
                    <Route path="/permissions" element={<AccessRevocation />} />
                    <Route path="/roles" element={<RolesPage />} />
                  </>
                )}
                <Route path="/logs" element={<SystemLogs />} />
                <Route path="/device-approvals" element={<DeviceApprovals />} />
                <Route path="/holiday-calendar" element={<HolidayCalendar />} />
                <Route path="/qr-presenter" element={<QRPresenter />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>

      <style>{`
  .page-header {
    margin-bottom: 25px;
  }
  .page-header h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 5px;
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .admin-tabs {
    display: flex;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    text-decoration: none;
  }
  .tab:hover {
    color: var(--text-primary);
  }
  .tab.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }
  @media (max-width: 768px) {
    .admin-tabs {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
    }
    .tab {
      padding: 12px 16px;
      white-space: nowrap;
    }
    .page-header h1 {
      font-size: 1.5rem;
    }
  }
`}</style>
    </>
  );
};

export default Admin;