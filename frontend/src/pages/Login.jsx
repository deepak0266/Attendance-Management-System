import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaEnvelope, FaLock, FaSignInAlt, FaBuilding } from 'react-icons/fa';
import { useAuth } from '../services/auth';
import toast from 'react-hot-toast';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false
  });
  const [errors, setErrors] = useState({});

  const from = location.state?.from?.pathname || '/dashboard';

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email or Employee ID is required';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await login({
        email: formData.email,
        password: formData.password,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      });

      if (result.success) {
        toast.success('Login successful!');
        navigate(from, { replace: true });
      } else {
        setErrors({ general: result.error });
      }
    } catch (error) {
      setErrors({ general: 'Login failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <motion.div 
        className="login-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="login-header">
          <div className="login-logo">
            <FaBuilding size={40} />
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to Attendance Management System</p>
        </div>

        {errors.general && (
          <div className="alert alert-danger">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Email or Employee ID</label>
            <div className="input-with-icon">
              <FaEnvelope className="input-icon" />
              <input
                type="text"
                className={`form-control ${errors.email ? 'error' : ''}`}
                placeholder="Enter your email or employee ID"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                autoComplete="email"
              />
            </div>
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <FaLock className="input-icon" />
              <input
                type="password"
                className={`form-control ${errors.password ? 'error' : ''}`}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                autoComplete="current-password"
              />
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <div className="d-flex justify-between align-center mb-3">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.remember}
                onChange={(e) => setFormData(prev => ({ ...prev, remember: e.target.checked }))}
              />
              <span>Remember me</span>
            </label>
            
            <a href="/forgot-password" className="forgot-link">
              Forgot Password?
            </a>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? (
              <>Signing in...</>
            ) : (
              <><FaSignInAlt /> Sign In</>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="text-secondary">
            Need help? Contact your HR administrator
          </p>
          <p className="text-tertiary text-sm mt-2">
            © 2024 Attendance Management System. All rights reserved.
          </p>
        </div>
      </motion.div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--primary-gradient);
          padding: 20px;
        }

        .login-card {
          background: var(--card-bg);
          border-radius: 20px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .login-logo {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: white;
        }

        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .login-header h2 {
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 8px;
          color: var(--text-primary);
        }

        .login-header p {
          color: var(--text-secondary);
        }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
        }

        .input-with-icon .form-control {
          padding-left: 45px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: var(--text-secondary);
        }

        .forgot-link {
          color: #667eea;
          text-decoration: none;
          font-size: 14px;
        }

        .forgot-link:hover {
          text-decoration: underline;
        }

        .btn-block {
          width: 100%;
          padding: 14px;
          font-size: 16px;
          justify-content: center;
        }

        .login-footer {
          text-align: center;
          margin-top: 30px;
        }

        .mb-3 {
          margin-bottom: 20px;
        }

        .mt-2 {
          margin-top: 10px;
        }

        @media (max-width: 576px) {
          .login-card {
            padding: 30px 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;