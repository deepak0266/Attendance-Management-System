import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import { FaCheck, FaTimes, FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';

const RoleDeletionApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, reqRes] = await Promise.all([
        apiService.auth.getProfile(),
        apiService.roles.getDeletionRequests()
      ]);
      
      if (userRes.data?.success) {
        setCurrentUser(userRes.data.data);
      }
      if (reqRes.data?.success) {
        setRequests(reqRes.data.data);
      }
    } catch (error) {
      toast.error('Failed to load pending deletion requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, action) => {
    let reason = '';
    if (action === 'REJECT') {
      reason = window.prompt('Please provide a reason for rejecting this deletion:');
      if (reason === null) return; // User cancelled
      if (!reason.trim()) {
        toast.error('Reason is required to reject');
        return;
      }
    } else {
      if (!window.confirm('Are you sure you want to approve this role deletion? If majority approves, it will be permanently deleted.')) {
        return;
      }
    }

    try {
      const response = await apiService.roles.reviewDeletionRequest(id, { action, reason });
      if (response.data?.success) {
        toast.success(response.data.message);
        fetchData(); // Refresh the list
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (requests.length === 0) {
    return (
      <div className="empty-state p-5 mt-4">
        <FaShieldAlt className="empty-state-icon" style={{ opacity: 0.5 }} />
        <h4>No Pending Deletions</h4>
        <p>There are no role deletion requests awaiting your approval.</p>
      </div>
    );
  }

  return (
    <div className="role-deletion-approvals mt-4">
      <div className="d-flex align-center gap-2 mb-3">
        <FaExclamationTriangle className="text-warning" />
        <h4 className="m-0">Pending Role Deletions</h4>
      </div>
      <p className="text-secondary text-sm mb-4">
        These custom roles have been requested for deletion by a Super Admin. They require multi-admin approval to be permanently removed.
      </p>

      <div className="table-responsive">
        <table className="table card-table">
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Requested By</th>
              <th>Date Requested</th>
              <th>Approvals</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => {
              const hasApproved = req.approvals.some(a => a.super_admin_id === currentUser?._id);
              const hasRejected = req.rejections.some(r => r.super_admin_id === currentUser?._id);
              const hasReviewed = hasApproved || hasRejected;

              return (
                <tr key={req._id}>
                  <td><strong>{req.role_name}</strong></td>
                  <td>{req.requested_by?.full_name} <span className="text-sm text-secondary">({req.requested_by?.email})</span></td>
                  <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className="badge badge-info">{req.approvals.length} Approved</span>
                  </td>
                  <td>
                    {hasReviewed ? (
                      <span className={`badge ${hasApproved ? 'badge-success' : 'badge-danger'}`}>
                        {hasApproved ? 'You Approved' : 'You Rejected'}
                      </span>
                    ) : (
                      <div className="btn-group">
                        <button 
                          className="btn btn-sm btn-success d-flex align-center gap-1"
                          onClick={() => handleReview(req._id, 'APPROVE')}
                        >
                          <FaCheck /> Approve
                        </button>
                        <button 
                          className="btn btn-sm btn-danger d-flex align-center gap-1 ml-2"
                          onClick={() => handleReview(req._id, 'REJECT')}
                        >
                          <FaTimes /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RoleDeletionApprovals;
