import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Webcam from 'react-webcam';
import api, { apiService } from '../../services/api';
import { attendanceService } from '../../services/attendance';
import toast from 'react-hot-toast';
import { FaQrcode, FaCamera, FaCheckCircle, FaRedo, FaClock, FaSignInAlt, FaSignOutAlt, FaSpinner, FaMapMarkerAlt } from 'react-icons/fa';
import moment from 'moment';
import './QRScanner.css';

const QRScanner = () => {
  const [scannerReady, setScannerReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selfieSrc, setSelfieSrc] = useState(null);
  const [qrPayload, setQrPayload] = useState(null);
  const [location, setLocation] = useState(null);
  const [punchResult, setPunchResult] = useState(null);
  const [punchError, setPunchError] = useState(null);
  const [currentState, setCurrentState] = useState('NOT_PUNCHED');
  const [loading, setLoading] = useState(false);
  const [requireSelfie, setRequireSelfie] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const webcamRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const scannerContainerRef = useRef('qr-reader-container');

  // Fetch current attendance status and selfie config on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [status, photoConfig] = await Promise.all([
          attendanceService.getCurrentStatus(),
          attendanceService.getPhotoCaptureConfig()
        ]);
        setCurrentState(status.state || 'NOT_PUNCHED');
        setRequireSelfie(photoConfig.required || false);
      } catch (error) {
        console.error('Failed to initialize QR Punch:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => toast.error('Location is required for attendance')
      );
    }

    // Check URL parameters for token (scanned via 3rd party app)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setQrPayload(urlToken);
    }

    init();
  }, []);

  // Start QR scanner when user explicitly clicks the start button
  useEffect(() => {
    if (initialLoading || qrPayload || punchResult || !showScanner) return;

    startScanner();

    return () => {
      stopScanner();
    };
  }, [initialLoading, qrPayload, punchResult, showScanner]);

  // Auto-submit if we have URL token and selfie is not required
  useEffect(() => {
    if (qrPayload && !requireSelfie && !punchResult && !initialLoading && location) {
      submitPunch(qrPayload, null);
    }
  }, [qrPayload, requireSelfie, punchResult, initialLoading, location]);

  const startScanner = async () => {
    try {
      // Clean up any existing scanner
      await stopScanner();

      // Small delay to ensure DOM element exists
      await new Promise(resolve => setTimeout(resolve, 200));

      const containerEl = document.getElementById(scannerContainerRef.current);
      if (!containerEl) return;

      const html5QrCode = new Html5Qrcode(scannerContainerRef.current);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Extract token if it's a URL
          let finalToken = decodedText;
          try {
            if (decodedText.includes('token=')) {
              finalToken = new URL(decodedText).searchParams.get('token');
            }
          } catch (e) {
            // not a URL, use raw text
          }

          setQrPayload(finalToken);
          // Stop scanner after successful scan
          html5QrCode.stop().catch(() => {});
        },
        () => {
          // ignore scan errors (empty frames)
        }
      );
      setScannerReady(true);
      setScanning(true);
    } catch (error) {
      console.error('Failed to start QR scanner:', error);
      // Fallback: try front camera if environment fails
      try {
        const html5QrCode = html5QrCodeRef.current || new Html5Qrcode(scannerContainerRef.current);
        html5QrCodeRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'user' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            let finalToken = decodedText;
            try {
              if (decodedText.includes('token=')) {
                finalToken = new URL(decodedText).searchParams.get('token');
              }
            } catch (e) {}
            setQrPayload(finalToken);
            html5QrCode.stop().catch(() => {});
          },
          () => {}
        );
        setScannerReady(true);
        setScanning(true);
      } catch (fallbackError) {
        toast.error('Unable to access camera. Please check permissions.');
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        // State 2 = SCANNING, State 3 = PAUSED
        if (state === 2 || state === 3) {
          await html5QrCodeRef.current.stop();
        }
      } catch (e) {
        // ignore stop errors
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
    setScannerReady(false);
  };

  const captureSelfie = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setSelfieSrc(imageSrc);
    }
  }, [webcamRef]);

  const handleRetake = () => setSelfieSrc(null);

  const handleSubmit = () => {
    if (requireSelfie && !selfieSrc) {
      toast.error('Selfie is required');
      return;
    }
    submitPunch(qrPayload, selfieSrc);
  };

  const getNextPunchType = () => {
    switch (currentState) {
      case 'NOT_PUNCHED': return 'IN';
      case 'PUNCHED_IN': return 'OUT';
      case 'PUNCHED_OUT': return 'IN';
      default: return 'IN';
    }
  };

  const submitPunch = async (qrToken, photoUrl) => {
    if (!location) {
      toast.error('Location is missing. Please enable GPS.');
      return;
    }
    if (loading) return;

    setLoading(true);
    setPunchError(null);
    try {
      const punchType = getNextPunchType();
      const deviceId = localStorage.getItem('device_id') || generateDeviceId();
      const payload = {
        type: punchType,
        qr_token: qrToken,
        location,
        ...(photoUrl ? { photo: photoUrl } : {}),
        client_timestamp: new Date().toISOString(),
        source: 'WEB',
        punch_method: 'QR',
        device_info: { device_id: deviceId, userAgent: navigator.userAgent, platform: navigator.platform }
      };

      const response = await api.post('/attendance/punch', payload);
      if (response.data.success) {
        const result = {
          type: punchType,
          timestamp: new Date(),
          status: response.data.data?.currentState || (punchType === 'IN' ? 'PUNCHED_IN' : 'PUNCHED_OUT'),
          attendance: response.data.data?.attendance,
          selfie: photoUrl,
          requires_approval: response.data.data?.requires_approval
        };
        setPunchResult(result);
        // Update current state
        if (punchType === 'IN') {
          setCurrentState('PUNCHED_IN');
        } else if (punchType === 'OUT') {
          setCurrentState('PUNCHED_OUT');
        }
        toast.success(`Successfully punched ${punchType}!`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to submit punch';
      toast.error(errorMsg);
      setPunchError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const generateDeviceId = () => {
    const newId = 'dev_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', newId);
    return newId;
  };

  const retryGetLocation = () => {
    if (navigator.geolocation) {
      const toastId = toast.loading('Fetching location...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          toast.dismiss(toastId);
          setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
          toast.success('Location updated!');
        },
        (err) => {
          toast.dismiss(toastId);
          toast.error('Location access denied or timed out. Please enable GPS.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      toast.error('Geolocation is not supported by this browser');
    }
  };

  const requestDeviceApprovalFromScanner = async () => {
    try {
      setLoading(true);
      const deviceId = localStorage.getItem('device_id') || generateDeviceId();
      await apiService.device.request({
        device_id: deviceId,
        device_name: navigator.platform || 'Mobile Device',
        platform: navigator.platform
      });
      toast.success('Device approval request sent to your superiors!');
      handleScanAgain(); // Reset scanner
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to request device approval');
    } finally {
      setLoading(false);
    }
  };

  const handleScanAgain = () => {
    // Reset for next punch (e.g., punch out after punch in)
    setQrPayload(null);
    setSelfieSrc(null);
    setPunchResult(null);
    setPunchError(null);
  };

  // Loading state
  if (initialLoading) {
    return (
      <div className="qr-scanner-container">
        <div className="qr-loading">
          <FaSpinner className="fa-spin" size={30} />
          <p>Initializing QR Punch...</p>
        </div>
      </div>
    );
  }

  // Success state - show punch result
  if (punchResult) {
    return (
      <div className="qr-scanner-container">
        <div className="qr-success-card">
          <div className="success-icon-wrapper">
            <FaCheckCircle className="success-icon" />
          </div>
          <h2>Punched {punchResult.type === 'IN' ? 'In' : 'Out'} Successfully!</h2>
          
          <div className="punch-details">
            <div className="detail-row">
              <FaClock />
              <span>Time: {moment(punchResult.timestamp).format('hh:mm:ss A')}</span>
            </div>
            <div className="detail-row">
              {punchResult.type === 'IN' ? <FaSignInAlt /> : <FaSignOutAlt />}
              <span>Type: Punch {punchResult.type === 'IN' ? 'In' : 'Out'}</span>
            </div>
            {punchResult.requires_approval && (
              <div className="detail-row approval-notice">
                <FaClock />
                <span>Sent for manager approval</span>
              </div>
            )}
          </div>

          {punchResult.selfie && (
            <div className="selfie-preview-small">
              <img src={punchResult.selfie} alt="Punch selfie" />
            </div>
          )}

          {/* Show "Scan for Punch Out" if just punched in */}
          {punchResult.type === 'IN' && (
            <button 
              className="btn-scan-again punch-out-btn"
              onClick={handleScanAgain}
            >
              <FaQrcode /> Scan for Punch Out
            </button>
          )}

          {punchResult.type === 'OUT' && (
            <div className="completed-notice">
              <p>Your shift is complete. Great work today!</p>
            </div>
          )}

          <button 
            className="btn-scan-again secondary-btn"
            onClick={handleScanAgain}
          >
            <FaRedo /> Scan Again
          </button>
        </div>
      </div>
    );
  }

  // QR Scanning state
  return (
    <div className="qr-scanner-container">
      <div className="qr-scanner-header">
        <FaQrcode className="header-icon" />
        <h2>
          {currentState === 'PUNCHED_IN' ? 'Scan QR to Punch Out' : 'Scan QR to Punch In'}
        </h2>
        <p className="scan-hint">Point your camera at the attendance QR code</p>
      </div>

      {!qrPayload ? (
        <div className="scanner-wrapper">
          {!showScanner ? (
            <div className="start-scanner-prompt">
              <FaCamera className="camera-icon-large" />
              <p>Camera access is required to scan QR codes</p>
              <button 
                className="btn-start-camera"
                onClick={() => setShowScanner(true)}
              >
                Start Camera
              </button>
            </div>
          ) : (
            <>
              <div id={scannerContainerRef.current} className="qr-reader-box"></div>
              {!scannerReady && (
                <div className="scanner-placeholder">
                  <FaSpinner className="fa-spin" size={24} />
                  <p>Starting camera...</p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="qr-scanned-badge">
            <FaCheckCircle /> QR Scanned Successfully!
          </div>

          {/* Selfie capture section */}
          {requireSelfie && (
            <div className="selfie-section">
              {!selfieSrc ? (
                <>
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="selfie-webcam"
                    videoConstraints={{ facingMode: 'user' }}
                  />
                  <button 
                    onClick={captureSelfie}
                    className="btn-capture"
                  >
                    <FaCamera /> Capture Selfie
                  </button>
                </>
              ) : (
                <>
                  <img src={selfieSrc} alt="Selfie preview" className="selfie-preview" />
                  <div className="selfie-actions">
                    <button onClick={handleRetake} className="btn-retake">
                      <FaRedo /> Retake
                    </button>
                    <button onClick={handleSubmit} className="btn-submit" disabled={loading}>
                      {loading ? <FaSpinner className="fa-spin" /> : <FaCheckCircle />}
                      Submit Punch
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Auto-submitting or no selfie needed - show loading */}
          {!requireSelfie && !punchError && location && (
            <div className="auto-submit-notice">
              <FaSpinner className="fa-spin" size={24} />
              <p>Submitting punch...</p>
            </div>
          )}

          {!requireSelfie && !punchError && !location && (
            <div className="location-missing-notice" style={{ marginTop: '20px', textAlign: 'center' }}>
              <FaSpinner className="fa-spin" size={24} style={{ marginBottom: '10px' }} />
              <p className="text-warning" style={{ marginBottom: '15px', fontWeight: 'bold' }}>
                Waiting for GPS location...
              </p>
              <button 
                className="btn-scan-again secondary-btn"
                onClick={retryGetLocation}
                style={{ display: 'inline-flex', width: 'auto', margin: '0 auto' }}
              >
                <FaMapMarkerAlt /> Retry GPS Location
              </button>
            </div>
          )}

          {punchError && (
            <div className="punch-error-notice" style={{ marginTop: '20px', textAlign: 'center' }}>
              <p className="text-danger" style={{ marginBottom: '15px', fontWeight: 'bold' }}>{punchError}</p>
              
              {punchError.includes('Unregistered device') && (
                <button 
                  className="btn-scan-again primary-btn"
                  onClick={requestDeviceApprovalFromScanner}
                  disabled={loading}
                  style={{ marginBottom: '10px', display: 'inline-flex', width: 'auto', margin: '0 auto 10px auto' }}
                >
                  {loading ? <FaSpinner className="fa-spin" /> : 'Request Device Approval'}
                </button>
              )}

              <button 
                className="btn-scan-again secondary-btn"
                onClick={handleScanAgain}
              >
                <FaRedo /> Try Again
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QRScanner;
