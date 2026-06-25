import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaStop, FaCoffee, FaCheck, FaCamera, FaMapMarkerAlt, FaSpinner, FaClock, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { attendanceService } from '../../services/attendance';
import { locationService } from '../../services/location';
import { useAuth } from '../../services/auth';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { formatTime, formatDuration } from '../../utils/helpers';
import { apiService } from '../../services/api';

const PunchInOut = ({ showGuidelines = false }) => {
  const { user } = useAuth();
  const [currentState, setCurrentState] = useState('NOT_PUNCHED');
  const [attendanceData, setAttendanceData] = useState(null);
  const [shift, setShift] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [photoCaptureEnabled, setPhotoCaptureEnabled] = useState(false);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overridePromptData, setOverridePromptData] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [deviceApprovalPrompt, setDeviceApprovalPrompt] = useState(false);
  const [pendingPunchType, setPendingPunchType] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isPunchingRef = useRef(false);

  useEffect(() => {
    initializePage();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (currentState === 'PUNCHED_IN' && attendanceData?.punch_in) {
        const elapsed = Math.floor((new Date() - new Date(attendanceData.punch_in.server_timestamp)) / 1000);
        setElapsedTime(elapsed);
      }
    }, 1000);
    
    return () => {
      clearInterval(timer);
      stopCamera();
    };
  }, [currentState, attendanceData]);

  const initializePage = async () => {
    await Promise.all([
      checkCurrentStatus(),
      getLocation(),
      checkPhotoCaptureConfig()
    ]);
  };

  const checkCurrentStatus = async () => {
    try {
      const status = await attendanceService.getCurrentStatus();
      setCurrentState(status.state);
      setAttendanceData(status.attendance);
      setShift(status.shift);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      toast.error('Failed to fetch attendance status');
    }
  };

  const getLocation = async () => {
    try {
      const loc = await locationService.getCurrentLocation();
      setLocation(loc);
    } catch (error) {
      toast.error('Unable to get location. Please enable GPS.');
    }
  };

  const checkPhotoCaptureConfig = async () => {
    try {
      const config = await attendanceService.getPhotoCaptureConfig();
      setPhotoCaptureEnabled(config.enabled);
      setPhotoRequired(config.required);
    } catch (error) {
      console.error('Failed to fetch photo config:', error);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoData);
      stopCamera();
      return photoData;
    }
    return null;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedPhoto(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePunch = async (type) => {
    if (isPunchingRef.current || loading) return;
    isPunchingRef.current = true;
    setLoading(true);

    try {
      if (!location) {
        toast.error('Location is required for attendance');
        await getLocation();
        return;
      }

      if (!locationService.isAccurateEnough(location.accuracy)) {
        toast.warning(`Low GPS accuracy (${Math.round(location.accuracy)}m). Retrying...`);
        try {
          const newLocation = await locationService.getLocationWithRetry(2, 1500);
          setLocation(newLocation);
        } catch (error) {
          toast.error('Could not get accurate location. Please try again.');
          return;
        }
      }

      let photoData = null;
      if ((photoCaptureEnabled || photoRequired) && type === 'IN') {
        if (!capturedPhoto && photoRequired) {
          toast.error('Photo capture is required for punch in');
          return;
        }
        photoData = capturedPhoto;
      }
      const idempotencyKey = `punch_${user.id}_${Date.now()}_${uuidv4()}`;

      const punchData = {
        type,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        },
        client_timestamp: new Date().toISOString(),
        ...(photoData ? { photo: photoData } : {}),
        idempotency_key: idempotencyKey,
        source: 'WEB',
        punch_method: overrideReason ? 'FIELD_WORK' : 'MANUAL',
        override_reason: overrideReason,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          device_id: localStorage.getItem('deviceId') || (() => {
            const id = uuidv4();
            localStorage.setItem('deviceId', id);
            return id;
          })()
        }
      };

      const response = await attendanceService.submitPunch(punchData);

      if (response.requires_approval) {
        toast.success('Punch recorded and sent for approval');
      }

      setCapturedPhoto(null);
      setOverrideReason('');
      setOverridePromptData(null);
      await checkCurrentStatus();
    } catch (error) {
      if (error.response?.data?.require_override_reason) {
        setOverridePromptData({
          distance: error.response.data.distance,
          error: error.response.data.error
        });
        setPendingPunchType(type);
      } else if (error.response?.data?.error?.includes('Unregistered device')) {
        setDeviceApprovalPrompt(true);
      } else {
        toast.error(error.response?.data?.error || 'Failed to record punch');
        await checkCurrentStatus(); // Sync UI in case state is mismatched
      }
    } finally {
      isPunchingRef.current = false;
      setLoading(false);
    }
  };

  const submitConfirmedPunch = () => {
    if (!overrideReason.trim()) {
      toast.error('Please enter a reason');
      return;
    }
    setOverridePromptData(null);
    handlePunch(pendingPunchType);
  };

  const requestDeviceApproval = async () => {
    try {
      setLoading(true);
      const deviceId = localStorage.getItem('deviceId') || 'unknown';
      await apiService.device.request({
        device_id: deviceId,
        device_name: navigator.platform || 'Web Browser',
        platform: navigator.platform
      });
      toast.success('Device approval request sent to your superiors!');
      setDeviceApprovalPrompt(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to request device approval');
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state) => {
    const colors = {
      'NOT_PUNCHED': 'secondary',
      'PUNCHED_IN': 'success',
      'ON_BREAK': 'warning',
      'PUNCHED_OUT': 'danger',
      'PENDING_APPROVAL': 'info'
    };
    return colors[state] || 'secondary';
  };

  const getStateLabel = (state) => {
    const labels = {
      'NOT_PUNCHED': 'Not Punched In',
      'PUNCHED_IN': 'Working',
      'ON_BREAK': 'On Break',
      'PUNCHED_OUT': 'Completed',
      'PENDING_APPROVAL': 'Pending Approval'
    };
    return labels[state] || state;
  };

  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isPunchInLate = () => {
    if (!shift) return false;
    const [sh, sm] = shift.start_time.split(':').map(Number);
    const grace = shift.grace_period_minutes || 0;
    const shiftStart = new Date();
    shiftStart.setHours(sh, sm + grace, 0, 0);
    return currentTime > shiftStart;
  };

  const getRoleDirectives = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
        return [
          { text: 'Verify and maintain core system settings and active attendance policies.' },
          { text: 'Ensure Redis and session databases are running smoothly to handle concurrent requests.' },
          { text: 'You have full override capabilities. Use the "Override Attendance" page for manual corrections.' }
        ];
      case 'HR':
        return [
          { text: 'Review and update organizational geofences (400m radius branches).' },
          { text: 'Monitor company-wide punch exceptions (Late Punch-ins and Early Exits).' },
          { text: 'Approve or reject pending regularization requests from employees.' }
        ];
      case 'MANAGER':
        return [
          { text: 'Review and approve regularization requests of your team members.' },
          { text: 'Monitor team members who have punched in late or are currently on break.' },
          { text: 'Check real-time department activity trends on the Manager Dashboard.' }
        ];
      case 'EMPLOYEE':
      default:
        return [
          { text: 'Keep Location enabled. Geolocation must be within 400m of the office branch.' },
          { text: 'If you are punching in late, submit a regularization request under the "Regularize" tab.' },
          { text: 'Maximum break duration is 60 minutes. Log breaks using the "Start Break" button.' }
        ];
    }
  };

  return (
    <>
      {showGuidelines && shift && (
        <motion.div 
          className="card shift-guidelines-horizontal-card mb-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="guidelines-flex-container">
            {/* Shift timings & status */}
            <div className="guidelines-shift-panel">
              <div className="section-title">
                <FaClock className="text-primary" />
                <span>Shift Schedule ({shift.name})</span>
              </div>
              <div className="shift-time-bubble">
                {shift.start_time} - {shift.end_time}
              </div>
              <div className="shift-meta-text">
                Grace period: {shift.grace_period_minutes || 0} mins | 
                Work Day: {shift.is_working_day !== false ? 'Yes' : 'No'}
              </div>

              {/* Late Warning */}
              {currentState === 'NOT_PUNCHED' && isPunchInLate() && (
                <div className="horizontal-alert alert-danger animate-pulse">
                  <FaExclamationTriangle className="text-danger" />
                  <span><strong>Late Punch-In:</strong> Current time is past grace threshold. Your status will be marked LATE.</span>
                </div>
              )}

              {attendanceData?.status === 'LATE' && (
                <div className="horizontal-alert alert-warning">
                  <FaExclamationTriangle className="text-warning" />
                  <span><strong>Punched Late:</strong> You punched in late. Submit a regularization request if needed.</span>
                </div>
              )}
            </div>

            {/* Directives */}
            <div className="guidelines-directives-panel">
              <div className="section-title">
                <FaInfoCircle className="text-info" />
                <span>Action Guidelines (Role: {user?.role})</span>
              </div>
              <ul className="horizontal-directives-list">
                {getRoleDirectives().map((directive, idx) => (
                  <li key={idx}>• {directive.text}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

    <div className="punch-card card">
      <div className="card-header">
        <div>
          <h3>Punch In/Out</h3>
        </div>
        <span className={`badge badge-${getStateColor(currentState)} badge-lg`}>
          {getStateLabel(currentState)}
        </span>
      </div>



      <div className="punch-time-display">
        {currentTime.toLocaleTimeString()}
      </div>

      {currentState === 'PUNCHED_IN' && (
        <div className="elapsed-time">
          <FaClock /> Working: {formatElapsedTime(elapsedTime)}
        </div>
      )}

      {currentState === 'PENDING_APPROVAL' && (
        <div className="elapsed-time" style={{ opacity: 0.6, flexDirection: 'column' }}>
          <div><FaClock /> Pending Approval</div>
          <small style={{ fontSize: '10px', marginTop: '5px' }}>attendance not marked until approved</small>
        </div>
      )}

      {location ? (
        <div className="location-info">
          <FaMapMarkerAlt className="text-success" />
          <span>
            Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
            {location.accuracy && (
              <span className={`accuracy ${location.accuracy <= 50 ? 'good' : 'poor'}`}>
                (±{Math.round(location.accuracy)}m)
              </span>
            )}
          </span>
        </div>
      ) : (
        <div className="location-info" style={{ color: 'var(--warning-color)' }}>
          <FaMapMarkerAlt /> 
          <span>Waiting for location... Please enable GPS.</span>
          <button className="btn btn-sm" style={{ marginLeft: '10px', padding: '2px 8px' }} onClick={getLocation}>
            Retry
          </button>
        </div>
      )}

      {(photoCaptureEnabled || photoRequired) && currentState === 'NOT_PUNCHED' && (
        <div className="photo-section">
          {!showCamera && !capturedPhoto && (
            <div className="photo-actions">
              <button className="btn btn-secondary" onClick={startCamera}>
                <FaCamera /> Take Photo
              </button>
              <label className="btn btn-secondary">
                <FaCamera /> Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}

          {showCamera && (
            <div className="camera-container">
              <video ref={videoRef} autoPlay playsInline className="camera-preview" />
              <div className="camera-controls">
                <button className="btn btn-primary" onClick={capturePhoto}>
                  <FaCamera /> Capture
                </button>
                <button className="btn btn-secondary" onClick={stopCamera}>
                  Cancel
                </button>
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          )}

          {capturedPhoto && (
            <div className="photo-preview-container">
              <img src={capturedPhoto} alt="Captured" className="photo-preview" />
              <button className="btn btn-secondary btn-sm" onClick={() => setCapturedPhoto(null)}>
                Retake
              </button>
            </div>
          )}

          {photoRequired && !capturedPhoto && (
            <p className="text-warning mt-1">
              <FaCamera /> Photo is required for punch in
            </p>
          )}
        </div>
      )}

      <div className="punch-buttons">
        <AnimatePresence mode="wait">
          {currentState === 'NOT_PUNCHED' && (
            <motion.button
              key="punch-in"
              className="btn btn-success btn-lg"
              onClick={() => handlePunch('IN')}
              disabled={loading || !location}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {loading ? <FaSpinner className="fa-spin" /> : <FaPlay />}
              Punch In
            </motion.button>
          )}

          {currentState === 'PUNCHED_IN' && (
            <motion.div
              key="punch-actions"
              className="d-flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                className="btn btn-warning"
                onClick={() => handlePunch('BREAK_START')}
                disabled={loading}
              >
                <FaCoffee /> Start Break
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handlePunch('OUT')}
                disabled={loading}
              >
                <FaStop /> Punch Out
              </button>
            </motion.div>
          )}

          {currentState === 'ON_BREAK' && (
            <motion.button
              key="break-end"
              className="btn btn-success"
              onClick={() => handlePunch('BREAK_END')}
              disabled={loading}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <FaCheck /> End Break
            </motion.button>
          )}

          {currentState === 'PUNCHED_OUT' && (
            <motion.div
              key="completed"
              className="completed-message"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <FaCheck className="text-success" size={40} />
              <p>You've completed your shift for today!</p>
              {attendanceData?.computed_data && (
                <p className="text-secondary">
                  Total Work: {formatDuration(attendanceData.computed_data.net_work_minutes)}
                  {attendanceData.computed_data.overtime_minutes > 0 && (
                    <span className="text-warning">
                      {' '}(+{formatDuration(attendanceData.computed_data.overtime_minutes)} OT)
                    </span>
                  )}
                </p>
              )}
            </motion.div>
          )}

          {currentState === 'PENDING_APPROVAL' && (
            <motion.div
              key="pending"
              className="d-flex flex-column gap-2 opacity-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              style={{ pointerEvents: 'none' }}
            >
              <button className="btn btn-secondary btn-lg" disabled style={{ filter: 'grayscale(100%)' }}>
                <FaSpinner className="fa-spin" /> Pending Manager Approval
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {attendanceData?.punch_in && (
        <div className="punch-history mt-2">
          <p className="text-sm text-secondary">
            Punched in at: {moment(attendanceData.punch_in.server_timestamp).format('HH:mm:ss')}
            {attendanceData.punch_out && (
              <> | Punched out at: {moment(attendanceData.punch_out.server_timestamp).format('HH:mm:ss')}</>
            )}
          </p>
        </div>
      )}

      {/* Override Prompt Modal */}
      {overridePromptData && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-xl font-bold mb-4">Out of Office</h3>
            <p className="mb-4 text-warning">
              <FaExclamationTriangle className="inline mr-2" />
              {overridePromptData.error}
            </p>
            <textarea
              className="form-input w-full mb-4"
              rows="3"
              placeholder="Enter your reason (e.g. At Client XYZ for marketing meeting)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            ></textarea>
            <div className="flex gap-4 justify-end">
              <button 
                className="btn btn-secondary" 
                onClick={() => setOverridePromptData(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={submitConfirmedPunch}
                disabled={loading}
              >
                {loading ? <FaSpinner className="animate-spin" /> : 'Send Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Approval Modal */}
      {deviceApprovalPrompt && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-xl font-bold mb-4">Unregistered Device</h3>
            <p className="mb-4 text-warning">
              <FaExclamationTriangle className="inline mr-2" />
              This device is not registered to your account. Would you like to request approval to use this device for attendance?
            </p>
            <div className="flex gap-4 justify-end">
              <button 
                className="btn btn-secondary" 
                onClick={() => setDeviceApprovalPrompt(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={requestDeviceApproval}
                disabled={loading}
              >
                {loading ? <FaSpinner className="animate-spin" /> : 'Request Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .punch-card {
          text-align: center;
          min-height: 480px;
          display: flex;
          flex-direction: column;
        }

        .punch-time-display {
          font-size: 3.5rem;
          font-weight: 700;
          margin: 20px 0;
          font-family: 'Courier New', monospace;
          background: var(--bg-secondary);
          padding: 20px;
          border-radius: 15px;
        }

        .elapsed-time {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--text-secondary);
          margin-bottom: 15px;
        }

        .location-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: var(--bg-secondary);
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 13px;
        }

        .accuracy {
          margin-left: 8px;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
        }

        .accuracy.good {
          background: color-mix(in srgb, var(--success-color) 15%, transparent);
          color: var(--success-color);
        }

        .accuracy.poor {
          background: color-mix(in srgb, var(--warning-color) 15%, transparent);
          color: var(--warning-color);
        }

        .photo-section {
          margin-bottom: 20px;
        }

        .photo-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .camera-container {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
        }

        .camera-preview {
          width: 100%;
          max-height: 300px;
          object-fit: cover;
          border-radius: 10px;
        }

        .camera-controls {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 10px;
        }

        .photo-preview-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .photo-preview {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--border-color);
        }

        .punch-buttons {
          display: flex;
          gap: 15px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 10px;
          flex-grow: 1;
          align-items: center;
        }

        .punch-buttons .btn {
          min-width: 150px;
          padding: 15px 30px;
          font-size: 16px;
        }

        .btn-lg {
          padding: 18px 40px;
          font-size: 18px;
        }

        .completed-message {
          padding: 30px;
        }

        .completed-message p {
          margin-top: 15px;
          font-size: 16px;
        }

        .fa-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .badge-lg {
          padding: 8px 20px;
          font-size: 14px;
        }



        @media (max-width: 576px) {
          .punch-time-display {
            font-size: 2.5rem;
          }

          .punch-buttons .btn {
            min-width: 120px;
            padding: 12px 20px;
          }
        }

        /* Added Shift Guidelines Styles */
        .shift-guidelines-horizontal-card {
          padding: 20px;
          background: var(--card-bg);
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }

        .guidelines-flex-container {
          display: flex;
          gap: 30px;
        }

        .guidelines-shift-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-right: 1px solid var(--border-color);
          padding-right: 30px;
        }

        .guidelines-directives-panel {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-title {
          font-weight: 700;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
          margin-bottom: 5px;
        }

        .shift-time-bubble {
          font-size: 24px;
          font-weight: 700;
          color: var(--primary-color, #667eea);
          background: var(--bg-secondary);
          padding: 8px 16px;
          border-radius: 8px;
          display: inline-block;
          width: fit-content;
        }

        .shift-meta-text {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .horizontal-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.4;
          margin-top: 5px;
        }

        .horizontal-alert.alert-danger {
          background: color-mix(in srgb, var(--danger-color, #ef4444) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--danger-color, #ef4444) 25%, transparent);
        }

        .horizontal-alert.alert-warning {
          background: color-mix(in srgb, var(--warning-color, #f59e0b) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--warning-color, #f59e0b) 25%, transparent);
        }

        .horizontal-directives-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          text-align: left;
        }

        .horizontal-directives-list li {
          font-size: 13px;
          line-height: 1.4;
          color: var(--text-secondary);
        }

        @media (max-width: 992px) {
          .guidelines-flex-container {
            flex-direction: column;
            gap: 20px;
          }
          .guidelines-shift-panel {
            border-right: none;
            padding-right: 0;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
          }
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .8; }
        }
        
        .mb-3 {
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
    </>
  );
};

export default PunchInOut;