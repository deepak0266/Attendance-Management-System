import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import toast from 'react-hot-toast';
import moment from 'moment';
import { FaMobileAlt, FaCheckCircle, FaTimesCircle, FaHistory, FaUser, FaDesktop, FaClock, FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';

const DeviceApprovals = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiService.device.getPending();
      if (res.data.success) {
        setRequests(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to fetch pending device requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id, action) => {
    try {
      setActionLoading(id);
      const res = action === 'approve' 
        ? await apiService.device.approve(id)
        : await apiService.device.reject(id);
      
      if (res.data.success) {
        toast.success(`Device ${action}d successfully! Employee has been notified.`);
        fetchRequests();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action} device`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      APPROVED: { bg: '#dcfce7', color: '#166534', icon: <FaCheckCircle /> },
      REJECTED: { bg: '#fce4ec', color: '#b71c1c', icon: <FaTimesCircle /> },
      INACTIVE: { bg: '#f3f4f6', color: '#6b7280', icon: <FaClock /> },
      PENDING: { bg: '#fef3c7', color: '#92400e', icon: <FaExclamationTriangle /> }
    };
    const style = styles[status] || styles.INACTIVE;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
        background: style.bg, color: style.color
      }}>
        {style.icon} {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div className="spinner" style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTop: '3px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            <FaMobileAlt style={{ marginRight: 8, color: '#667eea' }} />
            Device Approval Requests
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Review and manage device registration requests from your team
          </p>
        </div>
        <span style={{
          background: requests.length > 0 ? '#fef3c7' : '#dcfce7',
          color: requests.length > 0 ? '#92400e' : '#166534',
          padding: '6px 16px', borderRadius: '20px', fontWeight: 600, fontSize: '0.85rem'
        }}>
          {requests.length} Pending
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <FaCheckCircle size={48} style={{ color: '#10b981', marginBottom: 16 }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>All Clear!</h3>
          <p style={{ color: 'var(--text-secondary)' }}>No pending device approval requests at the moment.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {requests.map((req) => (
            <div className="card" key={req._id} style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              {/* Card Header */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea15, #764ba215)',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: '14px',
                    background: 'var(--primary-gradient)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: '1.2rem'
                  }}>
                    {req.user_id?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {req.user_id?.full_name}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {req.user_id?.employee_id} • {req.user_id?.email}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => handleAction(req._id, 'reject')}
                    disabled={actionLoading === req._id}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: '1px solid #ef4444',
                      background: 'transparent', color: '#ef4444', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem',
                      opacity: actionLoading === req._id ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <FaTimesCircle /> Reject
                  </button>
                  <button
                    onClick={() => handleAction(req._id, 'approve')}
                    disabled={actionLoading === req._id}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                      fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: '0.9rem', opacity: actionLoading === req._id ? 0.6 : 1,
                      transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <FaCheckCircle /> Approve
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '20px 24px' }}>
                {/* New Device Info */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px', marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FaDesktop style={{ color: '#667eea', fontSize: '1.1rem' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>New Device</p>
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>{req.device_name || 'Unknown'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FaClock style={{ color: '#f59e0b', fontSize: '1.1rem' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Requested On</p>
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {moment(req.created_at).format('DD MMM YYYY, hh:mm A')}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FaUser style={{ color: '#8b5cf6', fontSize: '1.1rem' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Reports To</p>
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {req.managerInfo?.full_name || 'N/A'} {req.managerInfo?.role ? `(${req.managerInfo.role})` : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FaShieldAlt style={{ color: '#06b6d4', fontSize: '1.1rem' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Device ID</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {req.device_id?.substring(0, 24)}...
                      </p>
                    </div>
                  </div>
                </div>

                {/* User Agent */}
                {req.user_agent && (
                  <div style={{
                    background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px',
                    fontSize: '0.8rem', color: 'var(--text-tertiary)', fontFamily: 'monospace',
                    marginBottom: '20px', wordBreak: 'break-all'
                  }}>
                    {req.user_agent}
                  </div>
                )}

                {/* Device History */}
                {req.history && req.history.length > 0 && (
                  <div>
                    <h4 style={{ 
                      display: 'flex', alignItems: 'center', gap: 8,
                      margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}>
                      <FaHistory style={{ color: '#667eea' }} /> Previous Devices ({req.history.length})
                    </h4>
                    <div style={{
                      border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Device</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Requested</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Approved By</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Approved On</th>
                          </tr>
                        </thead>
                        <tbody>
                          {req.history.map((h, idx) => (
                            <tr key={h._id || idx} style={{ borderTop: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>
                                {h.device_name || 'Unknown'}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {getStatusBadge(h.status)}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                                {h.created_at ? moment(h.created_at).format('DD MMM YY') : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                {h.approved_by?.full_name || '—'}
                                {h.approved_by?.role && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: 4 }}>
                                    ({h.approved_by.role})
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                                {h.approved_at ? moment(h.approved_at).format('DD MMM YY, hh:mm A') : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* No History */}
                {(!req.history || req.history.length === 0) && (
                  <div style={{
                    background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px',
                    textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem'
                  }}>
                    <FaMobileAlt style={{ marginBottom: 4 }} /><br />
                    This is the first device registration request from this user.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .card { margin: 0 -8px; }
        }
      `}</style>
    </div>
  );
};

export default DeviceApprovals;
