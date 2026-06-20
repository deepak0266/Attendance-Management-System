import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Webcam from 'react-webcam';
import api from '../../services/api';
import { attendanceService } from '../../services/attendance';
import toast from 'react-hot-toast';
import { FaQrcode, FaCamera, FaCheckCircle, FaRedo, FaClock, FaSignInAlt, FaSignOutAlt, FaSpinner } from 'react-icons/fa';
import moment from 'moment';

const QRScanner = () => {
  const [scannerReady, setScannerReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selfieSrc, setSelfieSrc] = useState(null);
  const [qrPayload, setQrPayload] = useState(null);
  const [location, setLocation] = useState(null);
  const [punchResult, setPunchResult] = useState(null);
  const [currentState, setCurrentState] = useState('NOT_PUNCHED');
  const [loading, setLoading] = useState(false);
  const [requireSelfie, setRequireSelfie] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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

  // Start QR scanner when no token from URL and component is ready
  useEffect(() => {
    if (initialLoading || qrPayload || punchResult) return;

    startScanner();

    return () => {
      stopScanner();
    };
  }, [initialLoading, qrPayload, punchResult]);

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
      toast.error(error.response?.data?.error || 'Failed to submit punch');
    } finally {
      setLoading(false);
    }
  };

  const generateDeviceId = () => {
    const newId = 'dev_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', newId);
    return newId;
  };

  const handleScanAgain = () => {
    // Reset for next punch (e.g., punch out after punch in)
    setQrPayload(null);
    setSelfieSrc(null);
    setPunchResult(null);
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

        <style>{qrStyles}</style>
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
          <div id={scannerContainerRef.current} className="qr-reader-box"></div>
          {!scannerReady && (
            <div className="scanner-placeholder">
              <FaSpinner className="fa-spin" size={24} />
              <p>Starting camera...</p>
            </div>
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
          {!requireSelfie && (
            <div className="auto-submit-notice">
              <FaSpinner className="fa-spin" size={24} />
              <p>Submitting punch...</p>
            </div>
          )}
        </>
      )}

      <style>{qrStyles}</style>
    </div>
  );
};

const qrStyles = `
  .qr-scanner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    max-width: 500px;
    margin: 0 auto;
  }

  .qr-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    padding: 60px 20px;
    color: var(--text-secondary);
  }

  .qr-scanner-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .qr-scanner-header .header-icon {
    font-size: 36px;
    color: #667eea;
    margin-bottom: 10px;
  }

  .qr-scanner-header h2 {
    font-size: 1.4rem;
    font-weight: 700;
    margin-bottom: 5px;
    color: var(--text-primary);
  }

  .scan-hint {
    color: var(--text-secondary);
    font-size: 13px;
  }

  .scanner-wrapper {
    position: relative;
    width: 100%;
    max-width: 400px;
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-secondary);
    min-height: 300px;
  }

  .qr-reader-box {
    width: 100%;
  }

  /* Override html5-qrcode library styles to remove dropdown */
  #qr-reader-container {
    border: none !important;
  }

  #qr-reader-container video {
    border-radius: 12px;
  }

  #qr-reader-container__dashboard_section,
  #qr-reader-container__dashboard_section_csr,
  #qr-reader-container__dashboard_section_swaplink,
  #qr-reader-container__header_message,
  #qr-reader-container__status_span,
  #qr-reader-container select,
  #qr-reader-container__camera_selection {
    display: none !important;
  }

  .scanner-placeholder {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--text-secondary);
  }

  .qr-scanned-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: color-mix(in srgb, #22c55e 15%, transparent);
    color: #22c55e;
    border-radius: 10px;
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 20px;
  }

  .selfie-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 400px;
    gap: 15px;
  }

  .selfie-webcam {
    width: 100%;
    border-radius: 12px;
  }

  .selfie-preview {
    width: 100%;
    max-width: 300px;
    border-radius: 12px;
  }

  .selfie-actions {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .btn-capture, .btn-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 20px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-capture {
    background: #667eea;
    color: white;
  }

  .btn-capture:hover {
    background: #5a6fd6;
  }

  .btn-retake {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    background: var(--bg-secondary);
    color: var(--text-primary);
    transition: all 0.2s ease;
  }

  .btn-retake:hover {
    background: var(--border-color);
  }

  .btn-submit {
    flex: 1;
    background: #22c55e;
    color: white;
  }

  .btn-submit:hover {
    background: #16a34a;
  }

  .btn-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auto-submit-notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 30px;
    color: var(--text-secondary);
  }

  /* Success State */
  .qr-success-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 30px 20px;
    width: 100%;
    max-width: 450px;
  }

  .success-icon-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: color-mix(in srgb, #22c55e 15%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .success-icon {
    font-size: 40px;
    color: #22c55e;
  }

  .qr-success-card h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 20px;
    color: var(--text-primary);
  }

  .punch-details {
    width: 100%;
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    font-size: 14px;
    color: var(--text-primary);
  }

  .detail-row + .detail-row {
    border-top: 1px solid var(--border-color);
  }

  .detail-row svg {
    color: #667eea;
    min-width: 16px;
  }

  .approval-notice {
    color: var(--warning-color, #f59e0b) !important;
  }

  .approval-notice svg {
    color: var(--warning-color, #f59e0b) !important;
  }

  .selfie-preview-small {
    margin-bottom: 20px;
  }

  .selfie-preview-small img {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--border-color);
  }

  .btn-scan-again {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 24px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 10px;
  }

  .punch-out-btn {
    background: #ef4444;
    color: white;
  }

  .punch-out-btn:hover {
    background: #dc2626;
  }

  .secondary-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .secondary-btn:hover {
    background: var(--border-color);
  }

  .completed-notice {
    padding: 15px;
    background: color-mix(in srgb, #22c55e 10%, transparent);
    border-radius: 10px;
    margin-bottom: 15px;
    width: 100%;
  }

  .completed-notice p {
    color: #22c55e;
    font-weight: 500;
    font-size: 14px;
  }

  .fa-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 576px) {
    .qr-scanner-container {
      padding: 15px;
    }

    .qr-scanner-header h2 {
      font-size: 1.2rem;
    }
  }
`;

export default QRScanner;
