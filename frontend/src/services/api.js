import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '/api').trim(),
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add CSRF token if available
    const csrfToken = localStorage.getItem('csrfToken');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Don't retry auth check endpoints or refresh itself
    const isAuthEndpoint = originalRequest.url?.includes('/auth/me') || 
                          originalRequest.url?.includes('/auth/refresh');
    
    // Handle token expiration (but not for auth endpoints)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      
      try {
        const response = await api.post('/auth/refresh');
        const { csrfToken } = response.data?.data;
        if (csrfToken) {
          localStorage.setItem('csrfToken', csrfToken);
        }
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('csrfToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other errors
    if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action');
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please try again later.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    }
    
    return Promise.reject(error);
  }
);

// API helper functions
export const apiService = {
  // Auth
  auth: {
    login: (credentials) => api.post('/auth/login', credentials),
    logout: () => api.post('/auth/logout'),
    refresh: () => api.post('/auth/refresh'),
    getProfile: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/profile', data),
    changePassword: (data) => api.post('/auth/change-password', data),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (token, password) => api.post(`/auth/reset-password/${token}`, { password })
  },
  
  // Attendance
  attendance: {
    punch: (data) => api.post('/attendance/punch', data),
    getStatus: () => api.get('/attendance/status'),
    getHistory: (params) => api.get('/attendance/history', { params }),
    getChartData: (params) => api.get('/attendance/chart', { params }),
    getSummary: () => api.get('/attendance/summary'),
    override: (attendanceId, data) => api.post(`/attendance/override/${attendanceId}`, data),
    getPhotoConfig: () => api.get('/attendance/photo-config')
  },
  
  // Users
  users: {
    getAll: (params) => api.get('/users', { params }),
    getById: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
    bulkUpload: (users) => api.post('/users/bulk', { users }),
    getTeam: () => api.get('/users/team'),
    getStats: () => api.get('/users/stats'),
    adminChangePassword: (id, data) => api.post(`/users/${id}/change-password`, data)
  },
  
  // Admin
  admin: {
    getDashboardStats: () => api.get('/admin/dashboard'),
    getAttendanceTrend: (params) => api.get('/admin/attendance-trend', { params }),
    getDepartmentDistribution: () => api.get('/admin/department-distribution'),
    
    // Permissions
    revokePermission: (data) => api.post('/admin/permissions/revoke', data),
    restorePermission: (revocationId) => api.post(`/admin/permissions/restore/${revocationId}`),
    
    // Logs
    getSystemLogs: (params) => api.get('/admin/logs', { params }),
    getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
    
    // Shifts
    getShifts: (params) => api.get('/admin/shifts', { params }),
    createShift: (data) => api.post('/admin/shifts', data),
    updateShift: (id, data) => api.put(`/admin/shifts/${id}`, data),
    deleteShift: (id) => api.delete(`/admin/shifts/${id}`),
    
    // Policies
    getPolicies: (params) => api.get('/admin/policies', { params }),
    createPolicy: (data) => api.post('/admin/policies', data),
    updatePolicy: (id, data) => api.put(`/admin/policies/${id}`, data),
    approvePolicy: (id) => api.post(`/admin/policies/${id}/approve`),
    
    // Geo-fence
    getGeoFences: (params) => api.get('/admin/geofence', { params }),
    createGeoFence: (data) => api.post('/admin/geofence', data),
    updateGeoFence: (id, data) => api.put(`/admin/geofence/${id}`, data),
    
    // Payroll
    getPayrollLocks: (params) => api.get('/admin/payroll/locks', { params }),
    lockPayroll: (data) => api.post('/admin/payroll/lock', data),
    unlockPayroll: (data) => api.post('/admin/payroll/unlock', data),
    
    // Config
    getSystemConfig: () => api.get('/admin/config'),
    updateSystemConfig: (data) => api.put('/admin/config', data)
  },
  
  // Reports
  reports: {
    getDaily: (params) => api.get('/reports/daily', { params }),
    getMonthly: (params) => api.get('/reports/monthly', { params }),
    getOvertime: (params) => api.get('/reports/overtime', { params }),
    getPayroll: (params) => api.get('/reports/payroll', { params }),
    getLateEarly: (params) => api.get('/reports/late-early', { params }),
    getAbsenteeism: (params) => api.get('/reports/absenteeism', { params }),
    getSummary: () => api.get('/reports/summary'),
    exportDaily: (params) => api.get('/reports/export/daily', { params, responseType: 'blob' }),
    exportMonthly: (params) => api.get('/reports/export/monthly', { params, responseType: 'blob' }),
    exportPayroll: (params) => api.get('/reports/export/payroll', { params, responseType: 'blob' })
  },
  
  // Approvals
  approvals: {
    getPending: (params) => api.get('/approvals/pending', { params }),
    getHistory: (params) => api.get('/approvals/history', { params }),
    getById: (id) => api.get(`/approvals/${id}`),
    getStats: () => api.get('/approvals/stats'),
    createRegularization: (data) => api.post('/approvals/regularization', data),
    approve: (id, data) => api.post(`/approvals/${id}/approve`, data),
    reject: (id, data) => api.post(`/approvals/${id}/reject`, data),
    escalate: (id, data) => api.post(`/approvals/${id}/escalate`, data),
    cancel: (id, data) => api.post(`/approvals/${id}/cancel`, data),
    bulkApprove: (data) => api.post('/approvals/bulk-approve', data)
  },
  
  // Notifications
  notifications: {
    getAll: (params) => api.get('/notifications', { params }),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put('/notifications/read-all')
  },
  
  // Roles
  roles: {
    getAll: () => api.get('/roles'),
    create: (data) => api.post('/roles', data),
    update: (id, data) => api.put(`/roles/${id}`, data),
    requestDeletion: (id) => api.post(`/roles/${id}/request-deletion`),
    getDeletionRequests: () => api.get('/roles/deletion-requests'),
    reviewDeletionRequest: (id, data) => api.post(`/roles/deletion-requests/${id}/review`, data)
  }
};

export default api;