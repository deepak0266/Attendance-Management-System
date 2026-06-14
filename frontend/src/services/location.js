import toast from 'react-hot-toast';

class LocationService {
  constructor() {
    this.watchId = null;
    this.currentLocation = null;
    this.listeners = new Set();
  }

  /**
   * Get current location
   */
  async getCurrentLocation(options = {}) {
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    };
    
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by your browser');
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };
          
          this.currentLocation = location;
          this.notifyListeners(location);
          
          resolve(location);
        },
        (error) => {
          let message = 'Failed to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location permission denied. Please enable location access.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out.';
              break;
          }
          
          toast.error(message);
          reject(new Error(message));
        },
        { ...defaultOptions, ...options }
      );
    });
  }

  /**
   * Start watching location
   */
  startWatching(callback, options = {}) {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported');
      return null;
    }
    
    if (this.watchId) {
      this.stopWatching();
    }
    
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        
        this.currentLocation = location;
        this.notifyListeners(location);
        
        if (callback) {
          callback(location);
        }
      },
      (error) => {
        console.error('Location watch error:', error);
        if (callback) {
          callback(null, error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 10000,
        ...options
      }
    );
    
    return this.watchId;
  }

  /**
   * Stop watching location
   */
  stopWatching() {
    if (this.watchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Add location listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    if (this.currentLocation) {
      callback(this.currentLocation);
    }
  }

  /**
   * Remove location listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(location) {
    this.listeners.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Location listener error:', error);
      }
    });
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if location is accurate enough
   */
  isAccurateEnough(accuracy, threshold = 50) {
    return accuracy <= threshold;
  }

  /**
   * Format location for display
   */
  formatLocation(location) {
    if (!location) return 'Location unavailable';
    
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  /**
   * Get current location with retry
   */
  async getLocationWithRetry(maxRetries = 3, delay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const location = await this.getCurrentLocation();
        if (this.isAccurateEnough(location.accuracy)) {
          return location;
        }
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Failed to get accurate location');
  }

  /**
   * Check if location has changed significantly
   */
  hasSignificantChange(newLocation, oldLocation, threshold = 50) {
    if (!oldLocation) return true;
    
    const distance = this.calculateDistance(
      newLocation.latitude,
      newLocation.longitude,
      oldLocation.latitude,
      oldLocation.longitude
    );
    
    return distance > threshold;
  }
}

export const locationService = new LocationService();