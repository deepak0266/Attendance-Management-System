import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DeviceRegistration = () => {
  const [devices, setDevices] = useState([]);
  const [deviceName, setDeviceName] = useState('');

  const fetchMyDevices = async () => {
    try {
      const res = await api.get('/device/my-devices');
      if (res.data.success) {
        setDevices(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to fetch your devices');
    }
  };

  useEffect(() => {
    fetchMyDevices();
  }, []);

  const requestDevice = async (e) => {
    e.preventDefault();
    try {
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('device_id', deviceId);
      }

      const payload = {
        device_id: deviceId,
        device_name: deviceName,
        user_agent: navigator.userAgent
      };

      const res = await api.post('/device/request', payload);
      if (res.data.success) {
        toast.success('Device registration requested successfully!');
        setDeviceName('');
        fetchMyDevices();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to request device');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow mt-8">
      <h2 className="text-2xl font-bold mb-6">Device Management</h2>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
        <p className="text-blue-700">
          Your company requires you to register your device to mark attendance. 
          If you are on a new device, please submit a request below.
        </p>
      </div>

      <form onSubmit={requestDevice} className="mb-12 bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Request Current Device</h3>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Device Name (e.g. My Personal iPhone)" 
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className="flex-1 border p-2 rounded focus:ring-2 focus:ring-blue-500"
            required
          />
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-medium">
            Submit Request
          </button>
        </div>
      </form>

      <h3 className="text-lg font-semibold mb-4">Your Devices</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {devices.map(device => (
              <tr key={device._id}>
                <td className="px-6 py-4 whitespace-nowrap">{device.device_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${device.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                      device.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                      device.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' : 
                      'bg-red-100 text-red-800'}`}>
                    {device.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(device.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {device.last_used ? new Date(device.last_used).toLocaleString() : 'Never'}
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">No devices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeviceRegistration;
