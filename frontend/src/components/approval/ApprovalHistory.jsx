import React, { useState, useEffect } from 'react';
import { 
  FaHistory, FaCheckCircle, FaTimesCircle, FaClock,
  FaUser, FaCalendar, FaSearch, FaFilter, FaEye
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import DatePicker from 'react-datepicker';
import toast from 'react-hot-toast';
import moment from 'moment';
import "react-datepicker/dist/react-datepicker.css";

const ApprovalHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    startDate: moment().startOf('month').toDate(),
    endDate: new Date()
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [filters, pagination.page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        page: pagination.page,
        limit: pagination.limit
      };
      const response = await apiService.approvals.getHistory(params);
      setRequests(response.data.data || []);
      setPagination(prev => ({ ...prev, total: response.data.pagination?.total || 0 }));
    } catch (error) {
      toast.error('Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'APPROVED': { color: 'success', icon: FaCheckCircle, label: 'Approved' },
      'REJECTED': { color: 'danger', icon: FaTimesCircle, label: 'Rejected' },
      'PENDING_MANAGER': { color: 'warning', icon: FaClock, label: 'Pending Manager' },
      'PENDING_HR': { color: 'warning', icon: FaClock, label: 'Pending HR' },
      'ESCALATED': { color: 'info', icon: FaClock, label: 'Escalated' },
      'CANCELLED': { color: 'secondary', icon: FaTimesCircle, label: 'Cancelled' }
    };
    return badges[status] || { color: 'secondary', icon: FaClock, label: status };
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="approval-history">
      <div className="d-flex justify-between align-center mb-2">
        <h3>Approval History</h3>
      </div>

      {/* Filters */}
      <div className="card mb-2">
        <div className="d-flex flex-wrap gap-2 align-end">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <DatePicker
              selected={filters.startDate}
              onChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
              className="form-control"
              dateFormat="dd/MM/yyyy"
              maxDate={filters.endDate}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">End Date</label>
            <DatePicker
              selected={filters.endDate}
              onChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              className="form-control"
              dateFormat="dd/MM/yyyy"
              minDate={filters.startDate}
              maxDate={new Date()}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-control"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Status</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PENDING_MANAGER">Pending Manager</option>
              <option value="PENDING_HR">Pending HR</option>
              <option value="ESCALATED">Escalated</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          
          <div className="form-group">
            <button className="btn btn-primary" onClick={fetchHistory}>
              <FaFilter /> Apply
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                {user?.role !== 'EMPLOYEE' && <th>Employee</th>}
                <th>Type</th>
                <th>Request Date</th>
                <th>Status</th>
                <th>Decision By</th>
                <th>Decision Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-3">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-3 text-secondary">
                    No history found
                  </td>
                </tr>
              ) : (
                requests.map(request => {
                  const statusBadge = getStatusBadge(request.status);
                  const StatusIcon = statusBadge.icon;
                  
                  return (
                    <tr key={request._id}>
                      <td>{moment(request.created_at).format('DD/MM/YYYY HH:mm')}</td>
                      {user?.role !== 'EMPLOYEE' && (
                        <td>
                          <div className="d-flex align-center gap-2">
                            <div className="user-avatar-sm">
                              {request.user_id?.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-medium">{request.user_id?.full_name}</p>
                              <p className="text-sm text-secondary">{request.user_id?.employee_id}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      <td>{request.request_type}</td>
                      <td>{moment(request.date).format('DD/MM/YYYY')}</td>
                      <td>
                        <span className={`badge badge-${statusBadge.color}`}>
                          <StatusIcon className="mr-1" />
                          {statusBadge.label}
                        </span>
                      </td>
                      <td>{request.final_decision_by?.full_name || '-'}</td>
                      <td>
                        {request.final_decision_at 
                          ? moment(request.final_decision_at).format('DD/MM/YYYY HH:mm')
                          : '-'}
                      </td>
                      <td>
                        <button 
                          className="btn-icon btn-secondary"
                          onClick={() => { setSelectedRequest(request); setShowModal(true); }}
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
      </div>

      {/* Details Modal */}
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
                <h3>Request Details</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              
              <div className="modal-body">
                <div className="detail-section">
                  <h4>Request Information</h4>
                  <div className="detail-row">
                    <span className="label">Type:</span>
                    <span className="value">{selectedRequest.request_type}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Date:</span>
                    <span className="value">{moment(selectedRequest.date).format('DD/MM/YYYY')}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Priority:</span>
                    <span className="value">{selectedRequest.priority}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Reason:</span>
                    <span className="value">{selectedRequest.reason}</span>
                  </div>
                </div>
                
                <div className="detail-section">
                  <h4>Decision Information</h4>
                  <div className="detail-row">
                    <span className="label">Status:</span>
                    <span className={`badge badge-${getStatusBadge(selectedRequest.status).color}`}>
                      {getStatusBadge(selectedRequest.status).label}
                    </span>
                  </div>
                  {selectedRequest.manager_comment && (
                    <div className="detail-row">
                      <span className="label">Manager Comment:</span>
                      <span className="value">{selectedRequest.manager_comment}</span>
                    </div>
                  )}
                  {selectedRequest.hr_comment && (
                    <div className="detail-row">
                      <span className="label">HR Comment:</span>
                      <span className="value">{selectedRequest.hr_comment}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="label">Final Decision By:</span>
                    <span className="value">{selectedRequest.final_decision_by?.full_name || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Decision Date:</span>
                    <span className="value">
                      {selectedRequest.final_decision_at 
                        ? moment(selectedRequest.final_decision_at).format('DD/MM/YYYY HH:mm')
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .user-avatar-sm {
          width: 35px;
          height: 35px;
          border-radius: 8px;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 14px;
        }
        
        .btn-icon {
          width: 32px;
          height: 32px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }
        
        .detail-section {
          margin-bottom: 20px;
        }
        
        .detail-section h4 {
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color);
          color: #667eea;
        }
        
        .detail-row {
          display: flex;
          padding: 8px 0;
        }
        
        .detail-row .label {
          width: 130px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        
        .detail-row .value {
          flex: 1;
          color: var(--text-primary);
        }
        
        .pagination-info {
          padding: 0 15px;
          color: var(--text-secondary);
        }
        
        .mr-1 {
          margin-right: 5px;
        }
        
        .gap-2 {
          gap: 10px;
        }
        
        .align-end {
          align-items: flex-end;
        }
      `}</style>
    </div>
  );
};

export default ApprovalHistory;