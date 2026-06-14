const GeoFence = require('../models/GeoFence');
const logger = require('../utils/logger');
const axios = require('axios');

class LocationService {
  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100;
  }

  /**
   * Convert degrees to radians
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get geo-fences for a user
   */
  async getGeoFencesForUser(user) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const fences = await GeoFence.find({
      is_active: true,
      $or: [
        { applicable_users: user._id },
        { applicable_departments: user.department },
        { 
          applicable_users: { $size: 0 },
          applicable_departments: { $size: 0 },
          is_default: true
        }
      ]
    }).sort({ priority: -1 });
    
    // Filter by schedule
    return fences.filter(fence => {
      if (fence.schedule.always_active) return true;
      
      const dayMatch = fence.schedule.active_days.includes(currentDay);
      if (!dayMatch) return false;
      
      if (fence.schedule.active_hours.start && fence.schedule.active_hours.end) {
        return currentTime >= fence.schedule.active_hours.start &&
               currentTime <= fence.schedule.active_hours.end;
      }
      
      return true;
    });
  }

  /**
   * Validate location against geo-fence
   */
  async validateLocation(userLocation, geoFence) {
    try {
      const { latitude, longitude, accuracy } = userLocation;
      
      if (!latitude || !longitude) {
        return {
          valid: false,
          reason: 'Invalid coordinates',
          requiresApproval: true,
          distance: null,
          accuracy
        };
      }
      
      let distance;
      let isInside = false;
      
      // Calculate based on geo-fence type
      if (geoFence.type === 'circle') {
        distance = this.calculateDistance(
          latitude,
          longitude,
          geoFence.center.lat,
          geoFence.center.lng
        );
        
        const effectiveRadius = geoFence.radius_meters + (geoFence.buffer_meters || 0);
        isInside = distance <= effectiveRadius;
        
      } else if (geoFence.type === 'polygon') {
        isInside = this.isPointInPolygon(
          { lat: latitude, lng: longitude },
          geoFence.polygon_coordinates
        );
        distance = null;
        
      } else if (geoFence.type === 'rectangle') {
        isInside = this.isPointInRectangle(
          latitude, 
          longitude, 
          geoFence.bounds
        );
        distance = null;
      }
      
      // Check accuracy
      const accuracyThreshold = geoFence.validation_rules?.accuracy_threshold_meters || 50;
      const accuracyValid = accuracy <= accuracyThreshold;
      
      // Determine result
      if (isInside && accuracyValid) {
        return {
          valid: true,
          reason: null,
          requiresApproval: false,
          distance,
          accuracy,
          isInside
        };
      }
      
      if (isInside && !accuracyValid) {
        return {
          valid: false,
          reason: 'Low GPS accuracy',
          requiresApproval: true,
          distance,
          accuracy,
          isInside
        };
      }
      
      if (!isInside) {
        const maxDistance = geoFence.validation_rules?.max_distance_for_approval_meters || 500;
        const isNearby = geoFence.type === 'circle' && distance <= maxDistance;
        
        return {
          valid: false,
          reason: isNearby ? 'Near but outside geo-fence' : 'Outside geo-fence',
          requiresApproval: geoFence.validation_rules?.allow_manual_override && isNearby,
          distance,
          accuracy,
          isInside
        };
      }
      
    } catch (error) {
      logger.error('Location validation error:', error);
      return {
        valid: false,
        reason: 'Location validation failed',
        requiresApproval: true,
        distance: null,
        accuracy: userLocation.accuracy
      };
    }
  }

  /**
   * Check if point is inside polygon
   */
  isPointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;
    
    let inside = false;
    const x = point.lat;
    const y = point.lng;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }

  /**
   * Check if point is inside rectangle
   */
  isPointInRectangle(lat, lng, bounds) {
    if (!bounds) return false;
    
    const { northeast, southwest } = bounds;
    
    return lat >= southwest.lat && 
           lat <= northeast.lat &&
           lng >= southwest.lng && 
           lng <= northeast.lng;
  }

  /**
   * Get address from coordinates (reverse geocoding)
   */
  async getAddressFromCoordinates(latitude, longitude) {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        logger.warn('Google Maps API key not configured');
        return null;
      }
      
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            latlng: `${latitude},${longitude}`,
            key: apiKey
          },
          timeout: 5000
        }
      );
      
      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          formatted: result.formatted_address,
          components: this.parseAddressComponents(result.address_components)
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Parse address components
   */
  parseAddressComponents(components) {
    const result = {
      street_number: '',
      route: '',
      locality: '',
      administrative_area: '',
      country: '',
      postal_code: ''
    };
    
    for (const component of components) {
      const types = component.types;
      
      if (types.includes('street_number')) {
        result.street_number = component.long_name;
      } else if (types.includes('route')) {
        result.route = component.long_name;
      } else if (types.includes('locality')) {
        result.locality = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        result.administrative_area = component.long_name;
      } else if (types.includes('country')) {
        result.country = component.long_name;
      } else if (types.includes('postal_code')) {
        result.postal_code = component.long_name;
      }
    }
    
    return result;
  }

  /**
   * Geocode address to coordinates
   */
  async geocodeAddress(address) {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }
      
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            address,
            key: apiKey
          },
          timeout: 5000
        }
      );
      
      if (response.data.results && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng,
          formatted_address: response.data.results[0].formatted_address
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Geocoding error:', error);
      throw error;
    }
  }

  /**
   * Check if two locations are within distance
   */
  isWithinDistance(lat1, lon1, lat2, lon2, maxDistanceMeters) {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    return distance <= maxDistanceMeters;
  }

  /**
   * Get bounding box for a point and radius
   */
  getBoundingBox(lat, lng, radiusMeters) {
    const latChange = radiusMeters / 111320; // 1 degree latitude = ~111.32 km
    const lngChange = radiusMeters / (111320 * Math.cos(this.toRad(lat)));
    
    return {
      minLat: lat - latChange,
      maxLat: lat + latChange,
      minLng: lng - lngChange,
      maxLng: lng + lngChange
    };
  }

  /**
   * Calculate bearing between two points
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = this.toRad(lon2 - lon1);
    const lat1Rad = this.toRad(lat1);
    const lat2Rad = this.toRad(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x);
    bearing = bearing * (180 / Math.PI);
    bearing = (bearing + 360) % 360;
    
    return bearing;
  }

  /**
   * Get cardinal direction from bearing
   */
  bearingToCardinal(bearing) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  }

  /**
   * Calculate speed from two points and time difference
   */
  calculateSpeed(lat1, lon1, time1, lat2, lon2, time2) {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    const timeDiffHours = Math.abs(time2 - time1) / (1000 * 60 * 60);
    
    if (timeDiffHours === 0) return 0;
    
    return (distance / 1000) / timeDiffHours; // km/h
  }

  /**
   * Detect location spoofing attempts
   */
  detectSpoofing(currentLocation, previousLocation, options = {}) {
    const warnings = [];
    
    // Check for impossible travel speed (> 1000 km/h)
    if (previousLocation && currentLocation) {
      const timeDiff = Math.abs(
        new Date(currentLocation.timestamp) - new Date(previousLocation.timestamp)
      ) / (1000 * 60 * 60);
      
      if (timeDiff > 0) {
        const distance = this.calculateDistance(
          previousLocation.latitude,
          previousLocation.longitude,
          currentLocation.latitude,
          currentLocation.longitude
        );
        
        const speedKmh = (distance / 1000) / timeDiff;
        
        if (speedKmh > 1000) {
          warnings.push({
            type: 'IMPOSSIBLE_TRAVEL',
            message: `Suspicious travel speed: ${speedKmh.toFixed(0)} km/h`,
            speed: speedKmh
          });
        }
      }
    }
    
    // Check for mock location (if available on mobile)
    if (currentLocation.is_mock) {
      warnings.push({
        type: 'MOCK_LOCATION',
        message: 'Mock location detected'
      });
    }
    
    // Check for low accuracy
    if (currentLocation.accuracy > 100) {
      warnings.push({
        type: 'LOW_ACCURACY',
        message: `Very low GPS accuracy: ${currentLocation.accuracy}m`,
        accuracy: currentLocation.accuracy
      });
    }
    
    return {
      isSuspicious: warnings.length > 0,
      warnings,
      risk: this.calculateRiskScore(warnings)
    };
  }

  /**
   * Calculate risk score based on warnings
   */
  calculateRiskScore(warnings) {
    let score = 0;
    
    for (const warning of warnings) {
      switch (warning.type) {
        case 'IMPOSSIBLE_TRAVEL':
          score += 50;
          break;
        case 'MOCK_LOCATION':
          score += 40;
          break;
        case 'LOW_ACCURACY':
          score += 10;
          break;
        default:
          score += 5;
      }
    }
    
    return Math.min(score, 100);
  }
}

module.exports = new LocationService();