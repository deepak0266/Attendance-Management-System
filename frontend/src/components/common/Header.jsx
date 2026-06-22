import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  FaBell, 
  FaUserCircle, 
  FaSignOutAlt, 
  FaCog, 
  FaUser,
  FaCheckCircle,
  FaTimesCircle,
  FaBars
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../services/auth';
import ThemeToggle from './ThemeToggle';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../utils/helpers';
import { apiService } from '../../services/api';

const Header = ({ toggleTheme, theme, toggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, location.pathname]); // Refresh on navigation
  
  const fetchNotifications = async () => {
    try {
      const response = await apiService.notifications.getAll({ limit: 5 });
      if (response.data?.success) {
        setNotifications(response.data.data);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  const markAllRead = async () => {
    try {
      await apiService.notifications.markAllAsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      toast.error('Failed to mark notifications as read');
    }
  };

  const markAsRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await apiService.notifications.markAsRead(id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification._id, notification.is_read);
    }
    
    setShowNotifications(false);
    
    if (notification.data && notification.data.redirectUrl) {
      navigate(notification.data.redirectUrl);
    }
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };
  
  const getRoleBadge = (role) => {
    const badges = {
      'SUPER_ADMIN': { text: 'Super Admin', class: 'badge-danger' },
      'HR': { text: 'HR Admin', class: 'badge-info' },
      'MANAGER': { text: 'Manager', class: 'badge-warning' },
      'EMPLOYEE': { text: 'Employee', class: 'badge-success' }
    };
    return badges[role] || { text: role, class: 'badge-secondary' };
  };
  
  const roleBadge = getRoleBadge(user?.role);
  
  const getNotificationIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'SUCCESS': return <FaCheckCircle className="text-success" />;
      case 'WARNING': return <FaBell className="text-warning" />;
      case 'ERROR': return <FaTimesCircle className="text-danger" />;
      default: return <FaBell className="text-info" />;
    }
  };
  
  return (
    <header className="header">
      <div className="d-flex align-center gap-2">
        <button className="menu-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <FaBars />
        </button>
        
        <h2 className="header-title">Attendance Management System</h2>
        <h2 className="header-title-short">AMS</h2>
        
        {user && (
          <span className={`badge ${roleBadge.class} hide-mobile-sm`}>
            {roleBadge.text}
          </span>
        )}
      </div>
      
      <div className="d-flex align-center gap-2">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        
        {/* Notifications */}
        <div className="notification-wrapper">
          <button 
            className="btn btn-secondary btn-icon"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <FaBell />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>
          
          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                className="notification-dropdown"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="notification-header">
                  <h4>Notifications</h4>
                  {unreadCount > 0 && (
                    <button className="btn-text" onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
                
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="empty-state p-2">
                      <p className="text-secondary">No notifications</p>
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div 
                        key={notification._id} 
                        className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="notification-icon">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="notification-content">
                          <p className="notification-title">{notification.title}</p>
                          <p className="notification-message">{notification.message}</p>
                          <span className="notification-time">{formatDateTime(notification.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="notification-footer">
                  <Link to="/notifications" onClick={() => setShowNotifications(false)}>
                    View All
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Profile Dropdown */}
        <div className="profile-wrapper">
          <button 
            className="btn btn-secondary profile-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <FaUserCircle />
            <span className="profile-name">{user?.full_name?.split(' ')[0] || 'User'}</span>
          </button>
          
          <AnimatePresence>
            {showDropdown && (
              <motion.div 
                className="dropdown-menu"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="dropdown-header">
                  <p className="font-semibold">{user?.full_name}</p>
                  <p className="text-sm text-secondary">{user?.email}</p>
                </div>
                
                <div className="dropdown-divider"></div>
                
                <Link to="/profile" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                  <FaUser /> Profile
                </Link>
                
                <Link to="/settings" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                  <FaCog /> Settings
                </Link>
                
                <div className="dropdown-divider"></div>
                
                <button className="dropdown-item text-danger" onClick={handleLogout}>
                  <FaSignOutAlt /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <style jsx>{`
        .header-title {
          display: block;
        }
        .header-title-short {
          display: none;
        }

        .notification-wrapper,
        .profile-wrapper {
          position: relative;
        }
        
        .notification-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: var(--danger-color);
          color: white;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 600;
        }
        
        .notification-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 10px;
          width: 360px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: var(--card-shadow);
          z-index: 1000;
          overflow: hidden;
        }
        
        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .notification-header h4 {
          font-size: 16px;
          font-weight: 600;
        }
        
        .btn-text {
          background: none;
          border: none;
          color: #667eea;
          cursor: pointer;
          font-size: 13px;
        }
        
        .notification-list {
          max-height: 400px;
          overflow-y: auto;
        }
        
        .notification-item {
          display: flex;
          gap: 12px;
          padding: 15px 20px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .notification-item:hover {
          background: var(--hover-bg);
        }
        
        .notification-item.unread {
          background: color-mix(in srgb, #667eea 5%, transparent);
        }
        
        .notification-icon {
          font-size: 18px;
          flex-shrink: 0;
        }
        
        .notification-content {
          flex: 1;
          min-width: 0;
        }
        
        .notification-title {
          font-weight: 500;
          margin-bottom: 3px;
        }
        
        .notification-message {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        
        .notification-time {
          font-size: 11px;
          color: var(--text-tertiary);
        }
        
        .notification-footer {
          padding: 12px 20px;
          text-align: center;
          border-top: 1px solid var(--border-color);
        }
        
        .notification-footer a {
          color: #667eea;
          text-decoration: none;
          font-weight: 500;
        }
        
        .dropdown-header {
          padding: 15px 20px;
        }
        
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          color: var(--text-primary);
          text-decoration: none;
          transition: background 0.2s;
        }
        
        .dropdown-item:hover {
          background: var(--hover-bg);
        }

        .profile-btn {
          gap: 6px;
        }

        .profile-name {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hide-mobile-sm {
          display: inline-flex;
        }
        
        @media (max-width: 768px) {
          .header-title {
            display: none;
          }
          .header-title-short {
            display: block;
            font-size: 1.2rem !important;
          }

          .notification-dropdown {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            border-radius: 16px 16px 0 0;
            margin-top: 0;
            max-height: 70vh;
          }

          .notification-list {
            max-height: 50vh;
          }
          
          .profile-name {
            display: none;
          }

          .hide-mobile-sm {
            display: none;
          }

          .dropdown-menu {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            min-width: 100%;
            border-radius: 16px 16px 0 0;
            margin-top: 0;
          }
        }

        @media (max-width: 576px) {
          .notification-dropdown {
            max-height: 80vh;
          }

          .notification-item {
            padding: 12px 14px;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;