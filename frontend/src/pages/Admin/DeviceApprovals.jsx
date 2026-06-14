import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DeviceApprovals = () => {
  const [requests, setRequests] = useState([]);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/device/pending');
      if (res.data.success) {
        setRequests(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to fetch pending device requests');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id, action) => {
    try {
      const endpoint = action === 'approve' ? `/device/${id}/approve` : `/device/${id}/reject`;
      const res = await api.post(endpoint);
      if (res.data.success) {
        toast.success(`Device ${action}d successfully`);
        fetchRequests();
      }
    } catch (err) {
      toast.error(`Failed to ${action} device`);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Pending Device Approvals</h2>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {requests.map((req) => (
            <li key={req._id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">{req.user_id?.full_name} ({req.user_id?.employee_id})</span>
                <span className="text-sm text-gray-500">Device: {req.device_name}</span>
                <span className="text-xs text-gray-400 mt-1">Requested: {new Date(req.created_at).toLocaleString()}</span>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleAction(req._id, 'reject')}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 text-sm font-medium transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction(req._id, 'approve')}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
                >
                  Approve
                </button>
              </div>
            </li>
          ))}
          {requests.length === 0 && (
            <li className="p-8 text-center text-gray-500">No pending device requests.</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default DeviceApprovals;
