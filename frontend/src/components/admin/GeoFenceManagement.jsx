import React, { useState, useEffect } from 'react';
import { 
  FaMapMarkerAlt, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff,
  FaSave, FaTimes, FaMap, FaCircle, FaDrawPolygon
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

const GeoFenceManagement = () => {
  const [loading, setLoading] = useState(true);
  const [fences, setFences] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedFence, setSelectedFence] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'circle',
    description: '',
    center: { lat: 28.6139, lng: 77.2090 },
    radius_meters: 100,
    buffer_meters: 20,
    polygon_coordinates: [],
    validation_rules: {
      strict_mode: true,
      accuracy_threshold_meters: 50,
      allow_manual_override: true,
      max_distance_for_approval_meters: 500
    },
    is_active: true,
    is_default: false,
    priority: 1
  });
  const [errors, setErrors] = useState({});
  const [mapMode, setMapMode] = useState('center'); // 'center', 'polygon'

  useEffect(() => {
    fetchFences();
  }, []);

  const fetchFences = async () => {
    setLoading(true);
    try {
      const response = await apiService.admin.getGeoFences();
      setFences(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch geo-fences');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name) newErrors.name = 'Fence name is required';
    if (!formData.code) newErrors.code = 'Fence code is required';
    
    if (formData.type === 'circle') {
      if (!formData.center.lat || !formData.center.lng) {
        newErrors.center = 'Center coordinates are required';
      }
      if (!formData.radius_meters || formData.radius_meters < 10) {
        newErrors.radius = 'Radius must be at least 10 meters';
      }
    }
    
    if (formData.type === 'polygon' && formData.polygon_coordinates.length < 3) {
      newErrors.polygon = 'Polygon must have at least 3 points';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      if (selectedFence) {
        await apiService.admin.updateGeoFence(selectedFence._id, formData);
        toast.success('Geo-fence updated successfully');
      } else {
        await apiService.admin.createGeoFence(formData);
        toast.success('Geo-fence created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchFences();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save geo-fence');
    }
  };

  const handleDelete = async (fenceId) => {
    if (!window.confirm('Are you sure you want to delete this geo-fence?')) return;
    
    try {
      await apiService.admin.updateGeoFence(fenceId, { is_active: false });
      toast.success('Geo-fence deleted successfully');
      fetchFences();
    } catch (error) {
      toast.error('Failed to delete geo-fence');
    }
  };

  const handleToggleActive = async (fence) => {
    try {
      await apiService.admin.updateGeoFence(fence._id, { is_active: !fence.is_active });
      toast.success(`Geo-fence ${fence.is_active ? 'deactivated' : 'activated'}`);
      fetchFences();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'circle',
      description: '',
      center: { lat: 28.6139, lng: 77.2090 },
      radius_meters: 100,
      buffer_meters: 20,
      polygon_coordinates: [],
      validation_rules: {
        strict_mode: true,
        accuracy_threshold_meters: 50,
        allow_manual_override: true,
        max_distance_for_approval_meters: 500
      },
      is_active: true,
      is_default: false,
      priority: 1
    });
    setSelectedFence(null);
    setErrors({});
    setMapMode('center');
  };

  const openEditModal = (fence) => {
    setSelectedFence(fence);
    setFormData({
      name: fence.name,
      code: fence.code,
      type: fence.type,
      description: fence.description || '',
      center: fence.center || { lat: 28.6139, lng: 77.2090 },
      radius_meters: fence.radius_meters || 100,
      buffer_meters: fence.buffer_meters || 20,
      polygon_coordinates: fence.polygon_coordinates || [],
      validation_rules: fence.validation_rules || {
        strict_mode: true,
        accuracy_threshold_meters: 50,
        allow_manual_override: true,
        max_distance_for_approval_meters: 500
      },
      is_active: fence.is_active,
      is_default: fence.is_default,
      priority: fence.priority || 1
    });
    setMapMode(fence.type === 'circle' ? 'center' : 'polygon');
    setShowModal(true);
  };

  const addPolygonPoint = () => {
    setFormData(prev => ({
      ...prev,
      polygon_coordinates: [...prev.polygon_coordinates, [prev.center.lat, prev.center.lng]]
    }));
  };

  const removePolygonPoint = (index) => {
    setFormData(prev => ({
      ...prev,
      polygon_coordinates: prev.polygon_coordinates.filter((_, i) => i !== index)
    }));
  };

  const updatePolygonPoint = (index, lat, lng) => {
    setFormData(prev => ({
      ...prev,
      polygon_coordinates: prev.polygon_coordinates.map((point, i) => 
        i === index ? [lat, lng] : point
      )
    }));
  };

  return (
    <div className="geofence-management">
      <div className="d-flex justify-between align-center mb-2">
        <h3>Geo-fence Management</h3>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FaPlus /> Create Geo-fence
        </button>
      </div>

      <div className="grid grid-3">
        {loading ? (
          <div className="col-span-3 text-center py-3">
            <LoadingSpinner />
          </div>
        ) : fences.length === 0 ? (
          <div className="col-span-3 empty-state">
            <FaMapMarkerAlt size={50} className="text-tertiary mb-2" />
            <p>No geo-fences found</p>
            <button className="btn btn-primary mt-2" onClick={() => setShowModal(true)}>
              Create Your First Geo-fence
            </button>
          </div>
        ) : (
          fences.map(fence => (
            <motion.div 
              key={fence._id}
              className="card fence-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
            >
              <div className="fence-header">
                <div className="d-flex align-center gap-2">
                  <FaMapMarkerAlt className={fence.is_active ? 'text-success' : 'text-tertiary'} />
                  <div>
                    <h4>{fence.name}</h4>
                    <span className="badge badge-info">{fence.code}</span>
                  </div>
                </div>
                <div className={`status-badge ${fence.is_active ? 'active' : 'inactive'}`}>
                  {fence.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <div className="fence-body">
                <div className="fence-type">
                  <span className="label">Type:</span>
                  <span className="value">
                    {fence.type === 'circle' ? <FaCircle className="text-info mr-1" /> : <FaDrawPolygon className="text-info mr-1" />}
                    {fence.type}
                  </span>
                </div>
                
                {fence.type === 'circle' && (
                  <>
                    <div className="fence-detail">
                      <span className="label">Center:</span>
                      <span className="value">{fence.center?.lat.toFixed(6)}, {fence.center?.lng.toFixed(6)}</span>
                    </div>
                    <div className="fence-detail">
                      <span className="label">Radius:</span>
                      <span className="value">{fence.radius_meters}m</span>
                    </div>
                  </>
                )}
                
                {fence.type === 'polygon' && (
                  <div className="fence-detail">
                    <span className="label">Points:</span>
                    <span className="value">{fence.polygon_coordinates?.length || 0}</span>
                  </div>
                )}
                
                <div className="fence-detail">
                  <span className="label">Buffer:</span>
                  <span className="value">{fence.buffer_meters}m</span>
                </div>
                
                <div className="fence-detail">
                  <span className="label">Priority:</span>
                  <span className="value">{fence.priority}</span>
                </div>
                
                {fence.is_default && (
                  <span className="badge badge-success mt-2">Default</span>
                )}
              </div>
              
              <div className="fence-footer">
                <button 
                  className="btn-icon btn-secondary"
                  onClick={() => openEditModal(fence)}
                  title="Edit"
                >
                  <FaEdit />
                </button>
                <button 
                  className={`btn-icon ${fence.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleActive(fence)}
                  title={fence.is_active ? 'Deactivate' : 'Activate'}
                >
                  {fence.is_active ? <FaToggleOff /> : <FaToggleOn />}
                </button>
                <button 
                  className="btn-icon btn-danger"
                  onClick={() => handleDelete(fence._id)}
                  title="Delete"
                >
                  <FaTrash />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <motion.div 
              className="modal modal-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{selectedFence ? 'Edit Geo-fence' : 'Create New Geo-fence'}</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">Fence Name <span className="required">*</span></label>
                      <input
                        type="text"
                        className={`form-control ${errors.name ? 'error' : ''}`}
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                      {errors.name && <span className="form-error">{errors.name}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Fence Code <span className="required">*</span></label>
                      <input
                        type="text"
                        className={`form-control ${errors.code ? 'error' : ''}`}
                        value={formData.code}
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      />
                      {errors.code && <span className="form-error">{errors.code}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Type</label>
                      <select
                        className="form-control"
                        value={formData.type}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, type: e.target.value }));
                          setMapMode(e.target.value === 'circle' ? 'center' : 'polygon');
                        }}
                      >
                        <option value="circle">Circle</option>
                        <option value="polygon">Polygon</option>
                        <option value="rectangle">Rectangle</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.priority}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                        min="1"
                        max="100"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  
                  {formData.type === 'circle' && (
                    <>
                      <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Latitude</label>
                          <input
                            type="number"
                            className={`form-control ${errors.center ? 'error' : ''}`}
                            value={formData.center.lat}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              center: { ...prev.center, lat: parseFloat(e.target.value) }
                            }))}
                            step="0.000001"
                            min="-90"
                            max="90"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">Longitude</label>
                          <input
                            type="number"
                            className={`form-control ${errors.center ? 'error' : ''}`}
                            value={formData.center.lng}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              center: { ...prev.center, lng: parseFloat(e.target.value) }
                            }))}
                            step="0.000001"
                            min="-180"
                            max="180"
                          />
                        </div>
                      </div>
                      {errors.center && <span className="form-error">{errors.center}</span>}
                      
                      <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Radius (meters)</label>
                          <input
                            type="number"
                            className={`form-control ${errors.radius ? 'error' : ''}`}
                            value={formData.radius_meters}
                            onChange={(e) => setFormData(prev => ({ ...prev, radius_meters: parseInt(e.target.value) }))}
                            min="10"
                            max="10000"
                          />
                          {errors.radius && <span className="form-error">{errors.radius}</span>}
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">Buffer (meters)</label>
                          <input
                            type="number"
                            className="form-control"
                            value={formData.buffer_meters}
                            onChange={(e) => setFormData(prev => ({ ...prev, buffer_meters: parseInt(e.target.value) }))}
                            min="0"
                            max="500"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  
                  {formData.type === 'polygon' && (
                    <div className="form-group">
                      <label className="form-label">Polygon Points</label>
                      <div className="polygon-points">
                        {formData.polygon_coordinates.map((point, index) => (
                          <div key={index} className="polygon-point">
                            <input
                              type="number"
                              value={point[0]}
                              onChange={(e) => updatePolygonPoint(index, parseFloat(e.target.value), point[1])}
                              placeholder="Lat"
                              step="0.000001"
                            />
                            <input
                              type="number"
                              value={point[1]}
                              onChange={(e) => updatePolygonPoint(index, point[0], parseFloat(e.target.value))}
                              placeholder="Lng"
                              step="0.000001"
                            />
                            <button 
                              type="button" 
                              className="btn-icon btn-danger btn-sm"
                              onClick={() => removePolygonPoint(index)}
                            >
                              <FaTimes />
                            </button>
                          </div>
                        ))}
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          onClick={addPolygonPoint}
                        >
                          <FaPlus /> Add Point
                        </button>
                      </div>
                      {errors.polygon && <span className="form-error">{errors.polygon}</span>}
                    </div>
                  )}
                  
                  <h4 className="section-title">Validation Rules</h4>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">Accuracy Threshold (meters)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.validation_rules.accuracy_threshold_meters}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          validation_rules: {
                            ...prev.validation_rules,
                            accuracy_threshold_meters: parseInt(e.target.value)
                          }
                        }))}
                        min="10"
                        max="500"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Max Distance for Approval (meters)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.validation_rules.max_distance_for_approval_meters}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          validation_rules: {
                            ...prev.validation_rules,
                            max_distance_for_approval_meters: parseInt(e.target.value)
                          }
                        }))}
                        min="100"
                        max="5000"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.validation_rules.strict_mode}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            validation_rules: {
                              ...prev.validation_rules,
                              strict_mode: e.target.checked
                            }
                          }))}
                        />
                        <span>Strict Mode</span>
                      </label>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.validation_rules.allow_manual_override}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            validation_rules: {
                              ...prev.validation_rules,
                              allow_manual_override: e.target.checked
                            }
                          }))}
                        />
                        <span>Allow Manual Override</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        />
                        <span>Active</span>
                      </label>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.is_default}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                        />
                        <span>Set as Default</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <FaSave /> {selectedFence ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .col-span-3 {
          grid-column: span 3;
        }
        
        .fence-card {
          padding: 0;
          overflow: hidden;
        }
        
        .fence-header {
          padding: 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        
        .fence-header h4 {
          margin-bottom: 5px;
        }
        
        .status-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }
        
        .status-badge.active {
          background: color-mix(in srgb, var(--success-color) 15%, transparent);
          color: var(--success-color);
        }
        
        .status-badge.inactive {
          background: color-mix(in srgb, var(--danger-color) 15%, transparent);
          color: var(--danger-color);
        }
        
        .fence-body {
          padding: 20px;
        }
        
        .fence-type {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
          font-size: 16px;
        }
        
        .fence-detail {
          display: flex;
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .fence-detail .label {
          width: 80px;
          color: var(--text-secondary);
        }
        
        .fence-detail .value {
          color: var(--text-primary);
        }
        
        .fence-footer {
          padding: 15px 20px;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          background: var(--bg-secondary);
        }
        
        .btn-icon {
          width: 36px;
          height: 36px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }
        
        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }
        
        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 20px 0 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--border-color);
          color: #667eea;
        }
        
        .polygon-points {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .polygon-point {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        .polygon-point input {
          flex: 1;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--input-bg);
          color: var(--text-primary);
        }
        
        .form-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .gap-2 {
          gap: 10px;
        }
        
        .mr-1 {
          margin-right: 5px;
        }
        
        .mt-2 {
          margin-top: 10px;
        }
        
        .required {
          color: var(--danger-color);
        }
        
        @media (max-width: 992px) {
          .grid-3 {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .col-span-3 {
            grid-column: span 2;
          }
        }
        
        @media (max-width: 576px) {
          .grid-3 {
            grid-template-columns: 1fr;
          }
          
          .col-span-3 {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
};

export default GeoFenceManagement;