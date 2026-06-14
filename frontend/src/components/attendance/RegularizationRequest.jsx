import React, { useState } from 'react';
import { FaCalendar, FaClock, FaUpload, FaPaperPlane, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import toast from 'react-hot-toast';
import moment from 'moment';
import "react-datepicker/dist/react-datepicker.css";

const RegularizationRequest = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    request_type: 'MISSED_PUNCH',
    date: new Date(),
    requested_in_time: '',
    requested_out_time: '',
    reason: '',
    priority: 'MEDIUM'
  });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});

  const requestTypes = [
    { value: 'MISSED_PUNCH', label: 'Missed Punch' },
    { value: 'INCORRECT_TIME', label: 'Incorrect Time' },
    { value: 'INVALID_LOCATION', label: 'Invalid Location' },
    { value: 'OFFLINE_SYNC', label: 'Offline Sync' },
    { value: 'OVERTIME', label: 'Overtime Request' }
  ];

  const priorityLevels = [
    { value: 'LOW', label: 'Low', color: 'secondary' },
    { value: 'MEDIUM', label: 'Medium', color: 'info' },
    { value: 'HIGH', label: 'High', color: 'warning' },
    { value: 'URGENT', label: 'Urgent', color: 'danger' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = moment(formData.date);
      const today = moment();
      const maxDaysBack = 7;
      
      if (selectedDate.isAfter(today, 'day')) {
        newErrors.date = 'Cannot request for future dates';
      } else if (today.diff(selectedDate, 'days') > maxDaysBack) {
        newErrors.date = `Cannot regularize attendance older than ${maxDaysBack} days`;
      }
    }

    if (formData.request_type === 'INCORRECT_TIME' || formData.request_type === 'MISSED_PUNCH') {
      if (!formData.requested_in_time && !formData.requested_out_time) {
        newErrors.time = 'Please provide at least one time';
      }
    }

    if (!formData.reason || formData.reason.trim().length < 10) {
      newErrors.reason = 'Please provide a detailed reason (minimum 10 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      
      if (!isValidType) {
        toast.error(`${file.name} is not a supported file type`);
      }
      if (!isValidSize) {
        toast.error(`${file.name} exceeds 5MB limit`);
      }
      
      return isValidType && isValidSize;
    });
    
    setFiles(prev => [...prev, ...validFiles].slice(0, 5));
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Upload files first
      const proofUrls = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await apiService.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (uploadResponse.data?.url) {
          proofUrls.push(uploadResponse.data.url);
        }
      }

      const requestData = {
        ...formData,
        date: formData.date.toISOString(),
        proof_urls: proofUrls
      };

      if (formData.requested_in_time) {
        const inDate = new Date(formData.date);
        const [hours, minutes] = formData.requested_in_time.split(':');
        inDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        requestData.requested_in_time = inDate.toISOString();
      } else {
        delete requestData.requested_in_time;
      }

      if (formData.requested_out_time) {
        const outDate = new Date(formData.date);
        const [hours, minutes] = formData.requested_out_time.split(':');
        outDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        requestData.requested_out_time = outDate.toISOString();
      } else {
        delete requestData.requested_out_time;
      }

      await apiService.approvals.createRegularization(requestData);
      
      toast.success('Regularization request submitted successfully');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className="regularization-request"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="card">
        <div className="card-header">
          <h3>Regularization Request</h3>
          {onCancel && (
            <button className="btn-icon" onClick={onCancel}>
              <FaTimes />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Request Type <span className="required">*</span></label>
            <select
              className={`form-control ${errors.request_type ? 'error' : ''}`}
              value={formData.request_type}
              onChange={(e) => setFormData(prev => ({ ...prev, request_type: e.target.value }))}
            >
              {requestTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Date <span className="required">*</span></label>
              <DatePicker
                selected={formData.date}
                onChange={(date) => setFormData(prev => ({ ...prev, date }))}
                className={`form-control ${errors.date ? 'error' : ''}`}
                dateFormat="dd/MM/yyyy"
                maxDate={new Date()}
                placeholderText="Select date"
              />
              {errors.date && <span className="form-error">{errors.date}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-control"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              >
                {priorityLevels.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {(formData.request_type === 'INCORRECT_TIME' || formData.request_type === 'MISSED_PUNCH') && (
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">
                  <FaClock className="mr-1" />
                  Requested In Time
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.requested_in_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, requested_in_time: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaClock className="mr-1" />
                  Requested Out Time
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.requested_out_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, requested_out_time: e.target.value }))}
                />
              </div>
            </div>
          )}
          
          {errors.time && <span className="form-error">{errors.time}</span>}

          <div className="form-group">
            <label className="form-label">Reason <span className="required">*</span></label>
            <textarea
              className={`form-control ${errors.reason ? 'error' : ''}`}
              rows="4"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Please provide a detailed reason for this regularization request..."
              maxLength={1000}
            />
            <div className="form-hint">
              {formData.reason.length}/1000 characters
            </div>
            {errors.reason && <span className="form-error">{errors.reason}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Supporting Documents (Optional)</label>
            <div className="file-upload">
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-upload" className="file-upload-label">
                <FaUpload size={30} className="text-tertiary mb-2" />
                <p>Click to upload or drag and drop</p>
                <p className="text-sm text-tertiary">Max 5 files, 5MB each (JPEG, PNG, PDF)</p>
              </label>
            </div>

            {files.length > 0 && (
              <div className="file-list mt-2">
                {files.map((file, index) => (
                  <div key={index} className="file-item">
                    <span>{file.name}</span>
                    <button 
                      type="button" 
                      className="btn-icon btn-sm text-danger"
                      onClick={() => removeFile(index)}
                    >
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="alert alert-info">
            <p>
              <strong>Note:</strong> Regularization requests are subject to manager approval. 
              Please ensure all information is accurate before submitting.
            </p>
          </div>

          <div className="modal-footer">
            {onCancel && (
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>Submitting...</>
              ) : (
                <><FaPaperPlane /> Submit Request</>
              )}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .file-upload {
          border: 2px dashed var(--border-color);
          border-radius: 10px;
          padding: 30px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .file-upload:hover {
          border-color: #667eea;
          background: color-mix(in srgb, #667eea 5%, transparent);
        }

        .file-upload-label {
          cursor: pointer;
          display: block;
        }

        .file-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 15px;
          background: var(--bg-secondary);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .mr-1 {
          margin-right: 5px;
        }

        .required {
          color: var(--danger-color);
        }
      `}</style>
    </motion.div>
  );
};

export default RegularizationRequest;