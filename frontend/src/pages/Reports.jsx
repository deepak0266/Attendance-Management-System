import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import DailyReport from '../components/reports/DailyReport';
import MonthlyReport from '../components/reports/MonthlyReport';
import OvertimeReport from '../components/reports/OvertimeReport';
import PayrollReport from '../components/reports/PayrollReport';
import { useAuth } from '../services/auth';
import { Helmet } from 'react-helmet-async';
import { FaCalendarDay, FaCalendarAlt, FaClock, FaMoneyBill } from 'react-icons/fa';

const Reports = ({ toggleTheme, theme }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const reportTabs = [
    { path: '/reports/daily', icon: <FaCalendarDay />, label: 'Daily Report', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] },
    { path: '/reports/monthly', icon: <FaCalendarAlt />, label: 'Monthly Report', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] },
    { path: '/reports/overtime', icon: <FaClock />, label: 'Overtime Report', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] },
    { path: '/reports/payroll', icon: <FaMoneyBill />, label: 'Payroll Report', roles: ['SUPER_ADMIN', 'HR'] }
  ];

  const filteredTabs = reportTabs.filter(tab => tab.roles.includes(user?.role));

  return (
    <>
      <Helmet>
        <title>Reports - Attendance System</title>
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
              <h1>Reports & Analytics</h1>
              <p className="text-secondary">Generate and export attendance reports</p>
            </div>

            <div className="reports-tabs">
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

            <div className="reports-content mt-2">
              <Routes>
                <Route path="/" element={<Navigate to="/reports/daily" replace />} />
                <Route path="/daily" element={<DailyReport />} />
                <Route path="/monthly" element={<MonthlyReport />} />
                <Route path="/overtime" element={<OvertimeReport />} />
                {user?.role !== 'MANAGER' && (
                  <Route path="/payroll" element={<PayrollReport />} />
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

        .reports-tabs {
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
          .reports-tabs {
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

export default Reports;