import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import PendingApprovals from '../components/approval/PendingApprovals';
import ApprovalHistory from '../components/approval/ApprovalHistory';
import { useAuth } from '../services/auth';
import { Helmet } from 'react-helmet-async';
import { FaClock, FaHistory } from 'react-icons/fa';

const Approval = ({ toggleTheme, theme }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      <Helmet>
        <title>Approvals - Attendance System</title>
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
              <h1>Approvals</h1>
              <p className="text-secondary">Manage attendance approval requests</p>
            </div>

            <div className="approval-tabs">
              <NavLink to="/approvals/pending" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <FaClock /> Pending
              </NavLink>
              <NavLink to="/approvals/history" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
                <FaHistory /> History
              </NavLink>
            </div>

            <div className="approval-content mt-2">
              <Routes>
                <Route path="/" element={<Navigate to="/approvals/pending" replace />} />
                <Route path="/pending" element={<PendingApprovals />} />
                <Route path="/history" element={<ApprovalHistory />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 25px; }
        .page-header h1 { font-size: 2rem; font-weight: 700; background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .approval-tabs { display: flex; border-bottom: 2px solid var(--border-color); margin-bottom: 20px; }
        .tab { display: flex; align-items: center; gap: 8px; padding: 12px 24px; color: var(--text-secondary); border-bottom: 2px solid transparent; margin-bottom: -2px; text-decoration: none; }
        .tab:hover { color: var(--text-primary); }
        .tab.active { color: #667eea; border-bottom-color: #667eea; }
        @media (max-width: 768px) { .approval-tabs { overflow-x: auto; } .tab { padding: 12px 16px; white-space: nowrap; } }
      `}</style>
    </>
  );
};

export default Approval;