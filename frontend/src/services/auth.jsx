import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from './api';
import { socketClient } from './socket';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await apiService.auth.getProfile();
      const authenticatedUser = response.data?.data;

      if (!response.data?.success || !authenticatedUser?._id || !authenticatedUser?.role) {
        throw new Error('Invalid authentication response');
      }

      setUser(authenticatedUser);
      setIsAuthenticated(true);
      
      // Connect to socket
      socketClient.connect();
    } catch (error) {
      localStorage.removeItem('csrfToken');
      setUser(null);
      setIsAuthenticated(false);
      socketClient.disconnect();
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await apiService.auth.login(credentials);
      const { user, csrfToken } = response.data?.data || {};

      if (!response.data?.success || !user?._id || !user?.role) {
        throw new Error('Invalid login response');
      }
      
      if (csrfToken) localStorage.setItem('csrfToken', csrfToken);
      
      setUser(user);
      setIsAuthenticated(true);
      
      // Connect to socket
      socketClient.connect();
      
      toast.success('Login successful!');
      return { success: true, user };
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
      return { success: false, error: error.response?.data?.error };
    }
  };

  const logout = async () => {
    try {
      await apiService.auth.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('csrfToken');
      setUser(null);
      setIsAuthenticated(false);
      socketClient.disconnect();
      toast.success('Logged out successfully');
    }
  };

  const updateProfile = async (data) => {
    try {
      const response = await apiService.auth.updateProfile(data);
      setUser(response.data.data);
      toast.success('Profile updated successfully');
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
      return { success: false, error: error.response?.data?.error };
    }
  };

  const changePassword = async (data) => {
    try {
      await apiService.auth.changePassword(data);
      toast.success('Password changed successfully');
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to change password');
      return { success: false, error: error.response?.data?.error };
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    
    const rolePermissions = {
      'HR': [
        'override_attendance', 'upload_employees', 'lock_payroll',
        'define_policies', 'view_all_data', 'handle_escalations',
        'approve_requests', 'view_reports', 'manage_users'
      ],
      'MANAGER': [
        'view_team_data', 'approve_requests', 'view_reports'
      ],
      'EMPLOYEE': [
        'view_self_data', 'submit_requests'
      ]
    };
    
    const permissions = rolePermissions[user.role] || [];
    return permissions.includes(permission);
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateProfile,
    changePassword,
    hasPermission,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
