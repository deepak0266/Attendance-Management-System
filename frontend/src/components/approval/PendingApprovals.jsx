import React, { useState, useEffect } from 'react';
import { 
  FaCheckCircle, FaTimesCircle, FaClock, FaUser, 
  FaCalendar, FaMapMarkerAlt, FaCheck, FaTimes,
  FaExclamationTriangle, FaFilter, FaSearch
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';

const PendingApprovals = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({ type: '', priority: '' });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchPendingRequests();
  }, [filters, pagination.page]);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };
      const response = await apiService.approvals.getPending(params);
      setRequests(response.data.data || []);
      setPagination(prev => ({ ...prev, total: response.data.pagination?.total || 0 }));
    } catch (error) {
      toast.error('Failed to fetch pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId, comment = '') => {
    try {
      await apiService.approvals.approve(requestId, { comment });
      toast.success('Request approved successfully');
      fetchPendingRequests();
      setShowModal(false);
      setApprovalComment('');
      setSelectedRequest(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve request');
    }
  };

  const handleReject = async (requestId, comment = '') => {
    if (!comment) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    try {
      await apiService.approvals.reject(requestId, { comment });
      toast.success('Request rejected');
      fetchPendingRequests();
      setShowModal(false);
      setApprovalComment('');
      setSelectedRequest(null);
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const handleEscalate = async (requestId, reason) => {
    try {
      await apiService.approvals.escalate(requestId, { reason });
      toast.success('Request escalated to HR');
      fetchPendingRequests();
    } catch (error) {
      toast.error('Failed to escalate request');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) {
      toast.error('No requests selected');
      return;
    }
    
    try {
      await apiService.approvals.bulkApprove({ requestIds: selectedIds });
      toast.success(`Approved ${selectedIds.length} requests`);
      setSelectedIds([]);
      setBulkMode(false);
      fetchPendingRequests();
    } catch (error) {
      toast.error('Bulk approval failed');
    }
  };

  const toggleSelect = (requestId) => {
    setSelectedIds(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === requests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(requests.map(r => r._id));
    }
  };

  const openApproveModal = (request) => {
    setSelectedRequest(request);
    setApprovalComment('');
    setShowModal(true);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'LOW': 'secondary',
      'MEDIUM': 'info',
      'HIGH': 'warning',
      'URGENT': 'danger'
    };
    return colors[priority] || 'secondary';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'MISSED_PUNCH': FaClock,
      'INCORRECT_TIME': FaClock,
      'INVALID_LOCATION': FaMapMarkerAlt,
      'OFFLINE_SYNC': FaExclamationTriangle,
      'OVERTIME': FaClock,
      'LEAVE_ADJUSTMENT': FaCalendar
    };
    return icons[type] || FaClock;
  };

  const getTypeLabel = (type) => {
    const labels = {
      'MISSED_PUNCH': 'Missed Punch',
      'INCORRECT_TIME': 'Incorrect Time',
      'INVALID_LOCATION': 'Invalid Location',
      'OFFLINE_SYNC': 'Offline Sync',
      'OVERTIME': 'Overtime',
      'LEAVE_ADJUSTMENT': 'Leave Adjustment'
    };
    return labels[type] || type;
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="pending-approvals">
      <div className="d-flex justify-between align-center mb-2">
        <h3>Pending Approvals</h3>
        <div className="d-flex gap-2">
          {user?.role !== 'EMPLOYEE' && (
            <>
              <button 
                className={`btn ${bulkMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setBulkMode(!bulkMode); setSelectedIds([]); }}
              >
                {bulkMode ? 'Cancel Bulk' : 'Bulk Approve'}
              </button>
              {bulkMode && selectedIds.length > 0 && (
                <button className="btn btn-success" onClick={handleBulkApprove}>
                  <FaCheck /> Approve Selected ({selectedIds.length})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-2">
        <div className="d-flex flex-wrap gap-2">
          <div className="form-group">
            <select
              className="form-control"
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="">All Types</option>
              <option value="MISSED_PUNCH">Missed Punch</option>
              <option value="INCORRECT_TIME">Incorrect Time</option>
              <option value="INVALID_LOCATION">Invalid Location</option>
              <option value="OFFLINE_SYNC">Offline Sync</option>
              <option value="OVERTIME">Overtime</option>
            </select>
          </div>
          
          <div className="form-group">
            <select
              className="form-control"
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          
          <button className="btn btn-primary" onClick={fetchPendingRequests}>
            <FaFilter /> Apply
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="requests-list">
        {loading ? (
          <div className="card">
            <div className="text-center py-4">
              <LoadingSpinner />
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="card empty-state py-4">
            <FaCheckCircle size={50} className="text-success mb-2" />
            <h4>No Pending Requests</h4>
            <p className="text-secondary">All caught up!</p>
          </div>
        ) : (
          requests.map(request => (
            <motion.div 
              key={request._id}
              className={`card approval-card ${request.sla_breached ? 'sla-breached' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              layout
            >
              {bulkMode && (
                <div className="bulk-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(request._id)}
                    onChange={() => toggleSelect(request._id)}
                  />
                </div>
              )}
              
              <div className="approval-header">
                <div className="approval-user">
                  <div className="user-avatar">
                    {request.user_id?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h4>{request.user_id?.full_name}</h4>
                    <p className="text-secondary">{request.user_id?.employee_id} • {request.user_id?.department}</p>
                  </div>
                </div>
                <div className="approval-meta">
                  <span className={`badge badge-${getPriorityColor(request.priority)}`}>
                    {request.priority}
                  </span>
                  {request.sla_breached && (
                    <span className="badge badge-danger ml-1">SLA Breached</span>
                  )}
                </div>
              </div>
              
              <div className="approval-body">
                <div className="request-info">
                  <div className="info-item">
                    {React.createElement(getTypeIcon(request.request_type), { className: 'text-tertiary' })}
                    <span className="label">Type:</span>
                    <span className="value">{getTypeLabel(request.request_type)}</span>
                  </div>
                  
                  <div className="info-item">
                    <FaCalendar className="text-tertiary" />
                    <span className="label">Date:</span>
                    <span className="value">{moment(request.date).format('DD/MM/YYYY')}</span>
                  </div>
                  
                  {request.requested_in_time && (
                    <div className="info-item">
                      <FaClock className="text-tertiary" />
                      <span className="label">Requested In:</span>
                      <span className="value">{moment(request.requested_in_time).format('HH:mm')}</span>
                    </div>
                  )}
                  
                  {request.requested_out_time && (
                    <div className="info-item">
                      <FaClock className="text-tertiary" />
                      <span className="label">Requested Out:</span>
                      <span className="value">{moment(request.requested_out_time).format('HH:mm')}</span>
                    </div>
                  )}
                </div>
                
                <div className="request-reason">
                  <p><strong>Reason:</strong> {request.reason}</p>
                </div>
                
                {request.proof_urls && request.proof_urls.length > 0 && (
                  <div className="request-attachments">
                    <p><strong>Attachments:</strong></p>
                    <div className="attachment-list">
                      {request.proof_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="attachment-link">
                          Attachment {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {!bulkMode && (
                <div className="approval-actions">
                  {user?.role === 'MANAGER' && request.status === 'PENDING_MANAGER' && (
                    <button 
                      className="btn btn-warning"
                      onClick={() => handleEscalate(request._id, 'Needs HR review')}
                    >
                      Escalate to HR
                    </button>
                  )}
                  
                  <button 
                    className="btn btn-danger"
                    onClick={() => openApproveModal(request)}
                  >
                    <FaTimes /> Reject
                  </button>
                  
                  <button 
                    className="btn btn-success"
                    onClick={() => handleApprove(request._id)}
                  >
                    <FaCheck /> Approve
                  </button>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination mt-2">
          <button 
            className="pagination-item"
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {totalPages}
          </span>
          <button 
            className="pagination-item"
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Reject/Approve with Comment Modal */}
      <AnimatePresence>
        {showModal && selectedRequest && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <motion.div 
              className="modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Process Request</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Comment (Optional for approval, required for rejection)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Enter your comment..."
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger"
                  onClick={() => handleReject(selectedRequest._id, approvalComment)}
                >
                  <FaTimes /> Reject
                </button>
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={() => handleApprove(selectedRequest._id, approvalComment)}
                >
                  <FaCheck /> Approve
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .approval-card {
          margin-bottom: 20px;
          position: relative;
        }
        
        .approval-card.sla-breached {
          border-left: 4px solid var(--danger-color);
        }
        
        .bulk-checkbox {
          position: absolute;
          top: 20px;
          left: 20px;
        }
        
        .bulk-checkbox input {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }
        
        .approval-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .approval-user {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .user-avatar {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 20px;
        }
        
        .approval-user h4 {
          margin-bottom: 3px;
        }
        
        .approval-meta {
          display: flex;
          gap: 8px;
        }
        
        .approval-body {
          margin-bottom: 20px;
        }
        
        .request-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .info-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .info-item .label {
          color: var(--text-secondary);
          min-width: 50px;
        }
        
        .info-item .value {
          font-weight: 500;
        }
        
        .request-reason {
          background: var(--bg-secondary);
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 15px;
        }
        
        .attachment-list {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        
        .attachment-link {
          padding: 5px 12px;
          background: var(--bg-tertiary);
          border-radius: 5px;
          color: var(--text-primary);
          text-decoration: none;
          font-size: 13px;
        }
        
        .attachment-link:hover {
          background: #667eea;
          color: white;
        }
        
        .approval-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding-top: 15px;
          border-top: 1px solid var(--border-color);
        }
        
        .pagination-info {
          padding: 0 15px;
          color: var(--text-secondary);
        }
        
        .ml-1 {
          margin-left: 5px;
        }
      `}</style>
    </div>
  );
};

export default PendingApprovals;