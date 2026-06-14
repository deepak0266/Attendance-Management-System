import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Webcam from 'react-webcam';
import api from '../../services/api';
import toast from 'react-hot-toast';

const QRScanner = ({ onScanSuccess, requireSelfie = false }) => {
  const [scanner, setScanner] = useState(null);
  const [selfieSrc, setSelfieSrc] = useState(null);
  const [qrPayload, setQrPayload] = useState(null);
  const [location, setLocation] = useState(null);
  const webcamRef = React.useRef(null);

  useEffect(() => {
    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => toast.error('Location is required for attendance')
      );
    }

    // Check URL parameters for token (scanned via 3rd party app)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    let html5QrcodeScanner = null;

    if (urlToken) {
      setQrPayload(urlToken);
      if (!requireSelfie) {
        // Wait briefly to ensure location is set
        setTimeout(() => submitPunch(urlToken, null), 1000);
      }
    } else {
      // Setup HTML5 scanner if no token in URL
      html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: {width: 250, height: 250} },
        false
      );
      
      html5QrcodeScanner.render((decodedText) => {
        // Extract token if it's a URL
        let finalToken = decodedText;
        if (decodedText.includes('token=')) {
          finalToken = new URL(decodedText).searchParams.get('token');
        }

        setQrPayload(finalToken);
        html5QrcodeScanner.clear();
        if (!requireSelfie) {
          submitPunch(finalToken, null);
        }
      }, (error) => {
        // ignore empty scans
      });

      setScanner(html5QrcodeScanner);
    }

    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
      }
    };
  }, [requireSelfie]);

  const captureSelfie = React.useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setSelfieSrc(imageSrc);
  }, [webcamRef]);

  const handleRetake = () => setSelfieSrc(null);

  const handleSubmit = () => {
    if (requireSelfie && !selfieSrc) {
      toast.error('Selfie is required');
      return;
    }
    submitPunch(qrPayload, selfieSrc);
  };

  const submitPunch = async (qrToken, photoUrl) => {
    if (!location) {
      toast.error('Location is missing. Please enable GPS.');
      return;
    }
    try {
      const deviceId = localStorage.getItem('device_id') || generateDeviceId();
      const payload = {
        type: 'IN', // Could be dynamic based on current status
        qr_token: qrToken,
        location,
        photo: photoUrl,
        client_timestamp: new Date().toISOString(),
        device_info: { device_id: deviceId }
      };

      const response = await api.post('/attendance/punch', payload);
      if (response.data.success) {
        toast.success('Punched successfully!');
        if (onScanSuccess) onScanSuccess(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit punch');
    }
  };

  const generateDeviceId = () => {
    const newId = 'dev_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', newId);
    return newId;
  };

  return (
    <div className="flex flex-col items-center p-4">
      <h2 className="text-xl font-bold mb-4">Scan QR to Punch</h2>
      
      {!qrPayload ? (
        <div id="qr-reader" className="w-full max-w-sm mb-4"></div>
      ) : (
        <div className="text-green-600 font-semibold mb-4">QR Scanned Successfully!</div>
      )}

      {requireSelfie && qrPayload && (
        <div className="flex flex-col items-center w-full max-w-sm">
          {!selfieSrc ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full mb-4 rounded"
                videoConstraints={{ facingMode: "user" }}
              />
              <button 
                onClick={captureSelfie}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
              >
                Capture Selfie
              </button>
            </>
          ) : (
            <>
              <img src={selfieSrc} alt="Selfie preview" className="w-full mb-4 rounded" />
              <div className="flex space-x-2 w-full">
                <button 
                  onClick={handleRetake}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 w-1/2"
                >
                  Retake
                </button>
                <button 
                  onClick={handleSubmit}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-1/2"
                >
                  Submit Punch
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default QRScanner;
