import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  FaHome, 
  FaClock, 
  FaChartBar, 
  FaUsers, 
  FaUserCog, 
  FaCheckCircle,
  FaHistory,
  FaCog,
  FaShieldAlt,
  FaChevronDown,
  FaList,
  FaChartLine,
  FaPlus,
  FaCalendarDay,
  FaCalendarAlt,
  FaMoneyBill,
  FaMapMarkerAlt,
  FaUser,
  FaLock,
  FaBell
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../services/auth';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Check if a parent path is active (current URL starts with it)
  const isParentActive = (path) => location.pathname.startsWith(path);

  const menuItems = [
    {
      path: '/dashboard',
      icon: <FaHome />,
      label: 'Dashboard',
      roles: ['SUPER_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']
    },
    {
      key: 'attendance',
      path: '/attendance',
      icon: <FaClock />,
      label: 'Attendance',
      roles: ['SUPER_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'],
      children: [
        { path: '/attendance/punch', icon: <FaClock />, label: 'Punch In/Out' },
        { path: '/attendance/log', icon: <FaList />, label: 'Attendance Log' },
        { path: '/attendance/chart', icon: <FaChartLine />, label: 'Trends' },
        { path: '/attendance/regularize', icon: <FaPlus />, label: 'Regularize' },
        { path: '/attendance/my-requests', icon: <FaHistory />, label: 'My Requests' }
      ]
    },
    {
      key: 'approvals',
      path: '/approvals',
      icon: <FaCheckCircle />,
      label: 'Approvals',
      roles: ['SUPER_ADMIN', 'HR', 'MANAGER'],
      badge: user?.pendingApprovals || 0,
      children: [
        { path: '/approvals/pending', icon: <FaClock />, label: 'Pending' },
        { path: '/approvals/history', icon: <FaHistory />, label: 'History' }
      ]
    },
    {
      key: 'reports',
      path: '/reports',
      icon: <FaChartBar />,
      label: 'Reports',
      roles: ['SUPER_ADMIN', 'HR', 'MANAGER'],
      children: [
        { path: '/reports/daily', icon: <FaCalendarDay />, label: 'Daily Report', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] },
        { path: '/reports/monthly', icon: <FaCalendarAlt />, label: 'Monthly Report', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] },
        { path: '/reports/overtime', icon: <FaClock />, label: 'Overtime Report', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] },
        { path: '/reports/payroll', icon: <FaMoneyBill />, label: 'Payroll Report', roles: ['SUPER_ADMIN', 'HR'] }
      ]
    },
    {
      key: 'admin',
      path: '/admin',
      icon: <FaUsers />,
      label: 'Administration',
      roles: ['SUPER_ADMIN', 'HR'],
      children: [
        { path: '/admin/users', icon: <FaUsers />, label: 'Users', roles: ['SUPER_ADMIN', 'HR'] },
        { path: '/admin/roles', icon: <FaUserCog />, label: 'Roles', roles: ['SUPER_ADMIN'] },
        { path: '/admin/shifts', icon: <FaClock />, label: 'Shifts', roles: ['SUPER_ADMIN', 'HR'] },
        { path: '/admin/policies', icon: <FaCog />, label: 'Policies', roles: ['SUPER_ADMIN', 'HR'] },
        { path: '/admin/geofence', icon: <FaMapMarkerAlt />, label: 'Geo-fence', roles: ['SUPER_ADMIN', 'HR'] },
        { path: '/admin/permissions', icon: <FaShieldAlt />, label: 'Permissions', roles: ['SUPER_ADMIN'] },
        { path: '/admin/logs', icon: <FaHistory />, label: 'System Logs', roles: ['SUPER_ADMIN', 'HR'] },
        { path: '/admin/device-approvals', icon: <FaCheckCircle />, label: 'Device Approvals', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] },
        { path: '/admin/holiday-calendar', icon: <FaCalendarDay />, label: 'Holidays', roles: ['SUPER_ADMIN', 'HR'] },
        { path: '/admin/qr-presenter', icon: <FaMapMarkerAlt />, label: 'QR Presenter', roles: ['SUPER_ADMIN', 'HR', 'MANAGER'] }
      ]
    },
    {
      key: 'profile',
      path: '/profile',
      icon: <FaUserCog />,
      label: 'Profile',
      roles: ['SUPER_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'],
      children: [
        { path: '/profile?tab=profile', matchPath: '/profile', icon: <FaUser />, label: 'Profile' },
        { path: '/profile?tab=security', matchPath: '/profile', icon: <FaLock />, label: 'Security' },
        { path: '/profile?tab=preferences', matchPath: '/profile', icon: <FaBell />, label: 'Preferences' },
        { path: '/attendance/device-registration', icon: <FaMapMarkerAlt />, label: 'My Devices' }
      ]
    },
    {
      key: 'notifications',
      path: '/notifications',
      icon: <FaBell />,
      label: 'Notifications',
      roles: ['SUPER_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']
    }
  ];

  const filteredItems = menuItems.filter(item =>
    item.roles.includes(user?.role)
  );

  // Dropdown animation
  const dropdownVariants = {
    hidden: { 
      height: 0, 
      opacity: 0,
      transition: { duration: 0.2, ease: 'easeInOut' }
    },
    visible: { 
      height: 'auto', 
      opacity: 1,
      transition: { duration: 0.25, ease: 'easeInOut' }
    }
  };

  const renderMenuItem = (item, index) => {
    const hasChildren = item.children && item.children.length > 0;
    const parentActive = isParentActive(item.path);
    const isExpanded = expandedItems[item.key] ?? parentActive;

    // Filter children by role
    const visibleChildren = hasChildren
      ? item.children.filter(child => !child.roles || child.roles.includes(user?.role))
      : [];

    if (hasChildren) {
      return (
        <div key={item.key || index} className="sidebar-group">
          {/* Parent: clickable to navigate + toggle dropdown */}
          <div className="sidebar-parent-row">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link sidebar-parent-link ${isActive || parentActive ? 'active' : ''}`
              }
              onClick={onClose}
            >
              <span className="icon">{item.icon}</span>
              <span className="label">{item.label}</span>
              {item.badge > 0 && (
                <span className="badge badge-danger sidebar-badge">{item.badge}</span>
              )}
            </NavLink>
            <button
              className={`sidebar-expand-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleExpand(item.key);
              }}
              aria-label={`Toggle ${item.label} submenu`}
            >
              <FaChevronDown />
            </button>
          </div>

          {/* Children dropdown */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                className="sidebar-children"
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                style={{ overflow: 'hidden' }}
              >
                {visibleChildren.map((child, childIndex) => {
                  // Profile sub-items use query params
                  if (child.path.includes('?')) {
                    const searchParams = new URLSearchParams(child.path.split('?')[1]);
                    const tabValue = searchParams.get('tab');
                    const currentTab = new URLSearchParams(location.search).get('tab') || 'profile';
                    const isChildActive = location.pathname === '/profile' && currentTab === tabValue;

                    return (
                      <NavLink
                        key={childIndex}
                        to={child.path}
                        className={`sidebar-link sidebar-child-link ${isChildActive ? 'active' : ''}`}
                        onClick={onClose}
                      >
                        <span className="icon child-icon">{child.icon}</span>
                        <span className="label">{child.label}</span>
                      </NavLink>
                    );
                  }

                  return (
                    <NavLink
                      key={childIndex}
                      to={child.path}
                      className={({ isActive }) =>
                        `sidebar-link sidebar-child-link ${isActive ? 'active' : ''}`
                      }
                      onClick={onClose}
                    >
                      <span className="icon child-icon">{child.icon}</span>
                      <span className="label">{child.label}</span>
                    </NavLink>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Simple item (no children) - e.g. Dashboard
    return (
      <NavLink
        key={index}
        to={item.path}
        className={({ isActive }) =>
          `sidebar-link ${isActive ? 'active' : ''}`
        }
        onClick={onClose}
      >
        <span className="icon">{item.icon}</span>
        <span className="label">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <motion.h3
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            AMS
          </motion.h3>
          <p className="text-sm text-secondary">v1.0.0</p>
        </div>
        
        <nav className="sidebar-nav">
          {filteredItems.map((item, index) => renderMenuItem(item, index))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="user-details">
              <p className="font-semibold">{user?.full_name}</p>
              <p className="text-sm text-secondary">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
      
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      
      <style>{`
  .sidebar-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--primary-gradient);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 18px;
  }

  .user-details {
    flex: 1;
  }

  .ml-auto {
    margin-left: auto;
  }

  /* ─── Sidebar Group (parent + children) ─── */
  .sidebar-group {
    position: relative;
  }

  .sidebar-parent-row {
    display: flex;
    align-items: center;
  }

  .sidebar-parent-link {
    flex: 1;
    min-width: 0;
  }

  .sidebar-expand-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-right: 8px;
    font-size: 11px;
  }

  .sidebar-expand-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .sidebar-expand-btn svg {
    transition: transform 0.25s ease;
  }

  .sidebar-expand-btn.expanded svg {
    transform: rotate(180deg);
  }

  /* ─── Children sub-links ─── */
  .sidebar-children {
    padding-left: 12px;
    margin-left: 20px;
    border-left: 2px solid var(--border-color);
  }

  .sidebar-child-link {
    padding: 8px 12px 8px 12px !important;
    font-size: 13px !important;
    color: var(--text-tertiary) !important;
    border-radius: 6px;
    margin: 1px 0;
  }

  .sidebar-child-link:hover {
    color: var(--text-primary) !important;
    background: var(--bg-tertiary);
  }

  .sidebar-child-link.active {
    color: #667eea !important;
    background: rgba(102, 126, 234, 0.08);
  }

  .child-icon {
    font-size: 12px !important;
    width: 18px !important;
    min-width: 18px !important;
  }

  .sidebar-badge {
    margin-left: auto;
    font-size: 11px;
    padding: 2px 7px;
  }

  @media (max-width: 992px) {
    .sidebar-overlay {
      display: block;
    }
  }
`}</style>
    </>
  );
};

export default Sidebar;