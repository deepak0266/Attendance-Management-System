import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import PunchInOut from '../components/attendance/PunchInOut';
import AttendanceLog from '../components/attendance/AttendanceLog';
import AttendanceChart from '../components/attendance/AttendanceChart';
import RegularizationRequest from '../components/attendance/RegularizationRequest';
import ApprovalHistory from '../components/approval/ApprovalHistory';
import QRScanner from '../components/attendance/QRScanner';
import DeviceRegistration from './Attendance/DeviceRegistration';
import { useAuth } from '../services/auth';
import { Helmet } from 'react-helmet-async';
import { FaClock, FaList, FaChartLine, FaPlus, FaHistory } from 'react-icons/fa';

const Attendance = ({ toggleTheme, theme }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      <Helmet>
        <title>Attendance - Attendance System</title>
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
              <h1>Attendance Management</h1>
              <p className="text-secondary">Track and manage your attendance records</p>
            </div>

            {/* Attendance Tabs */}
            <div className="attendance-tabs">
              <NavLink to="/attendance/punch" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <FaClock /> Punch In/Out
              </NavLink>
              <NavLink to="/attendance/qr-punch" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <FaClock /> QR Punch
              </NavLink>
              <NavLink to="/attendance/log" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <FaList /> Attendance Log
              </NavLink>
              <NavLink to="/attendance/chart" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <FaChartLine /> Trends
              </NavLink>
              <NavLink to="/attendance/regularize" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <FaPlus /> Regularize
              </NavLink>
              <NavLink to="/attendance/my-requests" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <FaHistory /> My Requests
              </NavLink>
            </div>

            <div className="attendance-content mt-2">
              <Routes>
                <Route path="/" element={<Navigate to="/attendance/punch" replace />} />
                <Route path="/punch" element={<PunchInOut showGuidelines={true} />} />
                <Route path="/qr-punch" element={<QRScanner />} />
                <Route path="/device-registration" element={<DeviceRegistration />} />
                <Route path="/log" element={<AttendanceLog />} />
                <Route path="/chart" element={<AttendanceChart />} />
                <Route path="/regularize" element={
                  <RegularizationRequest 
                    onSuccess={() => window.location.href = '/attendance/my-requests'}
                  />
                } />
                <Route path="/my-requests" element={<ApprovalHistory />} />
                {user?.role !== 'EMPLOYEE' && (
                  <Route path="/user/:userId" element={<AttendanceLog />} />
                )}
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

  .attendance-tabs {
    display: flex;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 20px;
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
    .attendance-tabs {
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

export default Attendance;