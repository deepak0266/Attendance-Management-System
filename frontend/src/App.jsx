import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './services/auth';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';

const queryClient = new QueryClient();

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Reports = lazy(() => import('./pages/Reports'));
const Admin = lazy(() => import('./pages/Admin'));
const Profile = lazy(() => import('./pages/Profile'));
const Approval = lazy(() => import('./pages/Approval'));
const Notifications = lazy(() => import('./pages/Notifications'));

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public Route Component
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return children;
};

function AppContent() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  // backend/src/utils/validators.js
  // frontend/src/utils/helpers.js
  return (
    <div className="app" data-theme={theme}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)'
          },
          success: {
            iconTheme: {
              primary: 'var(--success-color)',
              secondary: 'white'
            }
          },
          error: {
            iconTheme: {
              primary: 'var(--danger-color)',
              secondary: 'white'
            }
          }
        }}
      />

      <Suspense fallback={
        <div className="loading-screen">
          <LoadingSpinner size="large" />
        </div>
      }>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />

          {/* Protected Routes */}
          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <Dashboard toggleTheme={toggleTheme} theme={theme} />
            </ProtectedRoute>
          } />

          <Route path="/attendance/*" element={
            <ProtectedRoute>
              <Attendance toggleTheme={toggleTheme} theme={theme} />
            </ProtectedRoute>
          } />

          <Route path="/approvals/*" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR', 'MANAGER']}>
              <Approval toggleTheme={toggleTheme} theme={theme} />
            </ProtectedRoute>
          } />

          <Route path="/reports/*" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR', 'MANAGER']}>
              <Reports toggleTheme={toggleTheme} theme={theme} />
            </ProtectedRoute>
          } />

          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR']}>
              <Admin toggleTheme={toggleTheme} theme={theme} />
            </ProtectedRoute>
          } />

          <Route path="/profile/*" element={
            <ProtectedRoute>
              <Profile toggleTheme={toggleTheme} theme={theme} />
            </ProtectedRoute>
          } />

          <Route path="/notifications" element={
            <ProtectedRoute>
              <Notifications toggleTheme={toggleTheme} theme={theme} />
            </ProtectedRoute>
          } />

          {/* Default Routes */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;