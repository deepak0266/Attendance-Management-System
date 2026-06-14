import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const QRPresenter = () => {
  const [qrImage, setQrImage] = useState(null);
  const [type, setType] = useState('DYNAMIC');

  const fetchQR = async () => {
    try {
      const endpoint = type === 'DYNAMIC' ? '/attendance/qr/dynamic' : '/attendance/qr/static';
      const res = await api.get(endpoint);
      
      if (res.data.success) {
        // Generate QR code image URL using a public API or a local generator
        const token = res.data.data.token;
        const scanUrl = `${window.location.origin}/attendance/qr-punch?token=${token}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scanUrl)}`;
        setQrImage(qrUrl);
      }
    } catch (err) {
      toast.error('Failed to generate QR');
    }
  };

  useEffect(() => {
    fetchQR();
    if (type === 'DYNAMIC') {
      const interval = setInterval(fetchQR, 15000); // refresh every 15s
      return () => clearInterval(interval);
    }
  }, [type]);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Scan to Mark Attendance</h2>
      
      {qrImage ? (
        <div className="p-4 bg-white border-4 border-blue-500 rounded-xl shadow-inner">
          <img src={qrImage} alt="Attendance QR Code" className="w-64 h-64" />
        </div>
      ) : (
        <div className="w-64 h-64 flex items-center justify-center bg-gray-100 animate-pulse rounded-xl">
          Loading QR...
        </div>
      )}

      <div className="mt-8 text-center text-gray-500">
        <p>Please open the scanner in your mobile app to punch in/out.</p>
        {type === 'DYNAMIC' && (
          <p className="text-sm mt-2 text-blue-500">Auto-refreshing every 15s for security.</p>
        )}
      </div>

      {/* Admin toggles (can be hidden behind roles later) */}
      <div className="mt-8 flex space-x-4">
        <button 
          onClick={() => setType('DYNAMIC')}
          className={`px-4 py-2 rounded ${type === 'DYNAMIC' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Dynamic QR
        </button>
        <button 
          onClick={() => setType('STATIC')}
          className={`px-4 py-2 rounded ${type === 'STATIC' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Static QR
        </button>
      </div>
    </div>
  );
};

export default QRPresenter;
