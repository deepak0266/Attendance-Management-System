import React, { useState, useEffect } from 'react';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../services/auth';
import { apiService } from '../services/api';
import { Helmet } from 'react-helmet-async';
import { 
  FaUser, FaEnvelope, FaPhone, FaBuilding, 
  FaCalendar, FaMapMarkerAlt, FaSave, FaLock,
  FaBell, FaMoon, FaSun
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import moment from 'moment';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Profile = ({ toggleTheme, theme }) => {
  const { user, updateProfile, changePassword } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    emergency_contact: user?.emergency_contact || { name: '', relationship: '', phone: '' },
    address: user?.address || { street: '', city: '', state: '', country: '', postal_code: '' },
    preferences: user?.preferences || { theme: 'light', language: 'en', notifications: { email: true, sms: false, push: true } }
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfileData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setProfileData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePreferenceChange = (key, value) => {
    setProfileData(prev => ({
      ...prev,
      preferences: { ...prev.preferences, [key]: value }
    }));
  };

  const handleNotificationChange = (channel) => {
    setProfileData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        notifications: {
          ...prev.preferences.notifications,
          [channel]: !prev.preferences.notifications[channel]
        }
      }
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateProfile(profileData);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = () => {
    const errors = {};
    
    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    
    if (!passwordData.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(passwordData.newPassword)) {
      errors.newPassword = 'Password must contain an uppercase letter';
    } else if (!/[a-z]/.test(passwordData.newPassword)) {
      errors.newPassword = 'Password must contain a lowercase letter';
    } else if (!/[0-9]/.test(passwordData.newPassword)) {
      errors.newPassword = 'Password must contain a number';
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!validatePassword()) {
      return;
    }

    setLoading(true);

    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed successfully');
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Profile - Attendance System</title>
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
              <h1>My Profile</h1>
              <p className="text-secondary">Manage your account settings and preferences</p>
            </div>

            <div className="profile-tabs">
              <button 
                className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <FaUser /> Profile
              </button>
              <button 
                className={`tab ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <FaLock /> Security
              </button>
              <button 
                className={`tab ${activeTab === 'preferences' ? 'active' : ''}`}
                onClick={() => setActiveTab('preferences')}
              >
                <FaBell /> Preferences
              </button>
            </div>

            <div className="profile-content mt-2">
              {activeTab === 'profile' && (
                <div className="card">
                  <div className="card-header">
                    <h3>Profile Information</h3>
                  </div>
                  
                  <form onSubmit={handleProfileSubmit}>
                    <div className="profile-avatar-section">
                      <div className="profile-avatar">
                        {user?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4>{user?.full_name}</h4>
                        <p className="text-secondary">{user?.email}</p>
                        <p className="text-tertiary">Employee ID: {user?.employee_id}</p>
                      </div>
                    </div>

                    <div className="grid grid-2 mt-3">
                      <div className="form-group">
                        <label className="form-label">
                          <FaUser className="mr-1" /> Full Name
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="full_name"
                          value={profileData.full_name}
                          onChange={handleProfileChange}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          <FaPhone className="mr-1" /> Phone Number
                        </label>
                        <input
                          type="tel"
                          className="form-control"
                          name="phone"
                          value={profileData.phone}
                          onChange={handleProfileChange}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          <FaBuilding className="mr-1" /> Department
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={user?.department || ''}
                          disabled
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          <FaCalendar className="mr-1" /> Joining Date
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={user?.joining_date ? moment(user.joining_date).format('DD/MM/YYYY') : ''}
                          disabled
                        />
                      </div>
                    </div>

                    <h4 className="mt-3 mb-2">Emergency Contact</h4>
                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          name="emergency_contact.name"
                          value={profileData.emergency_contact.name}
                          onChange={handleProfileChange}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Relationship</label>
                        <input
                          type="text"
                          className="form-control"
                          name="emergency_contact.relationship"
                          value={profileData.emergency_contact.relationship}
                          onChange={handleProfileChange}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                          type="tel"
                          className="form-control"
                          name="emergency_contact.phone"
                          value={profileData.emergency_contact.phone}
                          onChange={handleProfileChange}
                        />
                      </div>
                    </div>

                    <h4 className="mt-3 mb-2">Address</h4>
                    <div className="form-group">
                      <label className="form-label">Street</label>
                      <input
                        type="text"
                        className="form-control"
                        name="address.street"
                        value={profileData.address.street}
                        onChange={handleProfileChange}
                      />
                    </div>

                    <div className="grid grid-2">
                      <div className="form-group">
                        <label className="form-label">City</label>
                        <input
                          type="text"
                          className="form-control"
                          name="address.city"
                          value={profileData.address.city}
                          onChange={handleProfileChange}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">State</label>
                        <input
                          type="text"
                          className="form-control"
                          name="address.state"
                          value={profileData.address.state}
                          onChange={handleProfileChange}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Country</label>
                        <input
                          type="text"
                          className="form-control"
                          name="address.country"
                          value={profileData.address.country}
                          onChange={handleProfileChange}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Postal Code</label>
                        <input
                          type="text"
                          className="form-control"
                          name="address.postal_code"
                          value={profileData.address.postal_code}
                          onChange={handleProfileChange}
                        />
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <LoadingSpinner size="small" /> : <><FaSave /> Save Changes</>}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="card">
                  <div className="card-header">
                    <h3>Change Password</h3>
                  </div>
                  
                  <form onSubmit={handlePasswordSubmit}>
                    <div className="form-group">
                      <label className="form-label">Current Password</label>
                      <input
                        type="password"
                        className={`form-control ${passwordErrors.currentPassword ? 'error' : ''}`}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      />
                      {passwordErrors.currentPassword && (
                        <span className="form-error">{passwordErrors.currentPassword}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <input
                        type="password"
                        className={`form-control ${passwordErrors.newPassword ? 'error' : ''}`}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      />
                      {passwordErrors.newPassword && (
                        <span className="form-error">{passwordErrors.newPassword}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input
                        type="password"
                        className={`form-control ${passwordErrors.confirmPassword ? 'error' : ''}`}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      />
                      {passwordErrors.confirmPassword && (
                        <span className="form-error">{passwordErrors.confirmPassword}</span>
                      )}
                    </div>

                    <div className="alert alert-info">
                      <p>Password must be at least 8 characters and contain uppercase, lowercase, and numbers.</p>
                    </div>

                    <div className="modal-footer">
                      <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <LoadingSpinner size="small" /> : <><FaLock /> Change Password</>}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="card">
                  <div className="card-header">
                    <h3>Preferences</h3>
                  </div>
                  
                  <div className="settings-section">
                    <h4 className="settings-title">Appearance</h4>
                    
                    <div className="settings-item">
                      <div>
                        <p className="font-medium">Theme</p>
                        <p className="text-sm text-secondary">Choose your preferred theme</p>
                      </div>
                      <div className="d-flex gap-2">
                        <button 
                          className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleTheme()}
                        >
                          <FaSun className="mr-1" /> Light
                        </button>
                        <button 
                          className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleTheme()}
                        >
                          <FaMoon className="mr-1" /> Dark
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-section">
                    <h4 className="settings-title">Notifications</h4>
                    
                    <div className="settings-item">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-secondary">Receive notifications via email</p>
                      </div>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={profileData.preferences.notifications.email}
                          onChange={() => handleNotificationChange('email')}
                          style={{ display: 'none' }}
                        />
                        <span className={`toggle-slider ${profileData.preferences.notifications.email ? 'active' : ''}`}></span>
                      </label>
                    </div>

                    <div className="settings-item">
                      <div>
                        <p className="font-medium">SMS Notifications</p>
                        <p className="text-sm text-secondary">Receive notifications via SMS</p>
                      </div>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={profileData.preferences.notifications.sms}
                          onChange={() => handleNotificationChange('sms')}
                          style={{ display: 'none' }}
                        />
                        <span className={`toggle-slider ${profileData.preferences.notifications.sms ? 'active' : ''}`}></span>
                      </label>
                    </div>

                    <div className="settings-item">
                      <div>
                        <p className="font-medium">Push Notifications</p>
                        <p className="text-sm text-secondary">Receive push notifications</p>
                      </div>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={profileData.preferences.notifications.push}
                          onChange={() => handleNotificationChange('push')}
                          style={{ display: 'none' }}
                        />
                        <span className={`toggle-slider ${profileData.preferences.notifications.push ? 'active' : ''}`}></span>
                      </label>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button className="btn btn-primary" onClick={handleProfileSubmit} disabled={loading}>
                      {loading ? <LoadingSpinner size="small" /> : <><FaSave /> Save Preferences</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
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

        .profile-tabs {
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
        }

        .tab:hover {
          color: var(--text-primary);
        }

        .tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
        }

        .profile-avatar-section {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: var(--bg-secondary);
          border-radius: 15px;
          margin-bottom: 20px;
        }

        .profile-avatar {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 32px;
          font-weight: 600;
        }

        .settings-section {
          margin-bottom: 30px;
        }

        .settings-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border-color);
        }

        .settings-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .settings-item:last-child {
          border-bottom: none;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 26px;
          background: var(--bg-tertiary);
          border-radius: 13px;
          cursor: pointer;
        }

        .toggle-slider {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.3s;
        }

        .toggle-slider.active {
          transform: translateX(24px);
          background: #667eea;
        }

        .mr-1 {
          margin-right: 5px;
        }

        .mt-3 {
          margin-top: 30px;
        }

        .mb-2 {
          margin-bottom: 15px;
        }

        @media (max-width: 768px) {
          .profile-tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .tab {
            padding: 12px 16px;
            white-space: nowrap;
          }

          .profile-avatar-section {
            flex-direction: column;
            text-align: center;
          }

          .page-header h1 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </>
  );
};

export default Profile;