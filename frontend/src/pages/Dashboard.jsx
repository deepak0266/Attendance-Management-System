import React, { useState } from 'react';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard';
import SuperAdminDashboard from '../components/dashboard/SuperAdminDashboard';
import { useAuth } from '../services/auth';
import { Helmet } from 'react-helmet-async';

const Dashboard = ({ toggleTheme, theme }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const getDashboardComponent = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
        return <SuperAdminDashboard />;
      case 'HR':
        return <AdminDashboard />;
      case 'MANAGER':
        return <ManagerDashboard />;
      case 'EMPLOYEE':
        return <EmployeeDashboard />;
      default:
        return <EmployeeDashboard />;
    }
  };

  const getDashboardTitle = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
        return 'Super Admin Dashboard';
      case 'HR':
        return 'HR Dashboard';
      case 'MANAGER':
        return 'Manager Dashboard';
      case 'EMPLOYEE':
        return 'Employee Dashboard';
      default:
        return 'Dashboard';
    }
  };

  return (
    <>
      <Helmet>
        <title>{getDashboardTitle()} - Attendance System</title>
      </Helmet>

      <div className="layout">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        
        <div className="main-content">
          <Header 
            toggleTheme={toggleTheme} 
            theme={theme} 
            toggleSidebar={toggleSidebar}
          />
          
          <div className="dashboard-content fade-in">
            {getDashboardComponent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;