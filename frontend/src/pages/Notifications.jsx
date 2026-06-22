import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { FaBell, FaCheckCircle, FaTimesCircle, FaCheckDouble } from 'react-icons/fa';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../services/auth';
import { apiService } from '../services/api';
import { formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Notifications = ({ toggleTheme, theme }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    fetchNotifications();
  }, [filter, page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (filter === 'unread') {
        params.unreadOnly = true;
      }
      
      const response = await apiService.notifications.getAll(params);
      if (response.data?.success) {
        setNotifications(response.data.data);
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await apiService.notifications.markAllAsRead();
      toast.success('All notifications marked as read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const markAsRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await apiService.notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification._id, notification.is_read);
    }
    
    if (notification.data && notification.data.redirectUrl) {
      navigate(notification.data.redirectUrl);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'SUCCESS': return <FaCheckCircle className="text-success" />;
      case 'WARNING': return <FaBell className="text-warning" />;
      case 'ERROR': return <FaTimesCircle className="text-danger" />;
      default: return <FaBell className="text-info" />;
    }
  };

  return (
    <>
      <Helmet>
        <title>Notifications - Attendance System</title>
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
            <div className="page-header d-flex justify-content-between align-center mb-4">
              <div>
                <h1>Notifications</h1>
                <p className="text-secondary">View all your system alerts and updates</p>
              </div>
              <button className="btn btn-secondary" onClick={markAllRead}>
                <FaCheckDouble className="mr-2" /> Mark All as Read
              </button>
            </div>

            <div className="card">
              <div className="card-header d-flex justify-content-between align-center">
                <div className="btn-group">
                  <button 
                    className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setFilter('all'); setPage(1); }}
                  >
                    All Notifications
                  </button>
                  <button 
                    className={`btn ${filter === 'unread' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setFilter('unread'); setPage(1); }}
                  >
                    Unread Only
                  </button>
                </div>
              </div>

              <div className="card-body p-0">
                {loading && notifications.length === 0 ? (
                  <div className="p-4 text-center"><LoadingSpinner /></div>
                ) : notifications.length === 0 ? (
                  <div className="empty-state p-5">
                    <FaBell className="empty-state-icon" />
                    <h4>No Notifications</h4>
                    <p>You're all caught up!</p>
                  </div>
                ) : (
                  <div className="notifications-list">
                    {notifications.map(notification => (
                      <div 
                        key={notification._id} 
                        className={`notification-row ${!notification.is_read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                        style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '15px', cursor: 'pointer', transition: 'background 0.2s', background: !notification.is_read ? 'color-mix(in srgb, #667eea 5%, transparent)' : 'transparent' }}
                      >
                        <div className="notification-icon" style={{ fontSize: '24px' }}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="notification-details" style={{ flex: 1 }}>
                          <h4 style={{ marginBottom: '5px' }}>{notification.title}</h4>
                          <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>{notification.message}</p>
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{formatDateTime(notification.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="card-footer d-flex justify-content-between align-center">
                  <p className="text-sm text-secondary">
                    Showing page {page} of {totalPages}
                  </p>
                  <div className="pagination">
                    <button 
                      className="btn btn-secondary btn-sm" 
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Previous
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm ml-2" 
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Notifications;
