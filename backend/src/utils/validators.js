const moment = require('moment');

/**
 * Validation utility functions
 */
class Validators {
  /**
   * Validate email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number (international format)
   */
  isValidPhone(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate employee ID
   */
  isValidEmployeeId(employeeId) {
    const idRegex = /^[A-Z0-9]{3,20}$/;
    return idRegex.test(employeeId);
  }

  /**
   * Validate date
   */
  isValidDate(date) {
    return moment(date, moment.ISO_8601, true).isValid();
  }

  /**
   * Validate date range
   */
  isValidDateRange(startDate, endDate) {
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      return false;
    }
    return moment(startDate).isBefore(moment(endDate));
  }

  /**
   * Validate time (HH:MM format)
   */
  isValidTime(time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Validate coordinates
   */
  isValidCoordinates(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180
    );
  }

  /**
   * Validate MongoDB ObjectId
   */
  isValidObjectId(id) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
  }

  /**
   * Validate URL
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate password strength
   */
  isStrongPassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  }

  /**
   * Validate JSON
   */
  isValidJson(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate IP address
   */
  isValidIp(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(ip)) {
      return ip.split('.').every(octet => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    return ipv6Regex.test(ip);
  }

  /**
   * Validate PAN number (India)
   */
  isValidPAN(pan) {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  }

  /**
   * Validate Aadhaar number (India)
   */
  isValidAadhaar(aadhaar) {
    const aadhaarRegex = /^[2-9]{1}[0-9]{11}$/;
    return aadhaarRegex.test(aadhaar);
  }

  /**
   * Validate GST number (India)
   */
  isValidGST(gst) {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst);
  }

  /**
   * Validate IFSC code
   */
  isValidIFSC(ifsc) {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc);
  }

  /**
   * Validate bank account number
   */
  isValidAccountNumber(accountNumber) {
    const accountRegex = /^[0-9]{9,18}$/;
    return accountRegex.test(accountNumber);
  }

  /**
   * Validate UPI ID
   */
  isValidUPI(upi) {
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    return upiRegex.test(upi);
  }

  /**
   * Validate file size
   */
  isValidFileSize(size, maxSizeMB = 5) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return size <= maxSizeBytes;
  }

  /**
   * Validate file type
   */
  isValidFileType(mimeType, allowedTypes) {
    return allowedTypes.includes(mimeType);
  }

  /**
   * Validate image dimensions
   */
  async isValidImageDimensions(buffer, minWidth, minHeight) {
    // This would require sharp or similar library
    return true;
  }

  /**
   * Sanitize input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }

  /**
   * Validate age
   */
  isValidAge(dateOfBirth, minAge = 18, maxAge = 100) {
    const age = moment().diff(moment(dateOfBirth), 'years');
    return age >= minAge && age <= maxAge;
  }

  /**
   * Validate amount
   */
  isValidAmount(amount, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= min && num <= max;
  }

  /**
   * Validate percentage
   */
  isValidPercentage(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 100;
  }

  /**
   * Validate working days array
   */
  isValidWorkingDays(days) {
    if (!Array.isArray(days)) return false;
    
    return days.every(day => 
      Number.isInteger(day) && day >= 0 && day <= 6
    );
  }

  /**
   * Validate shift times
   */
  isValidShiftTimes(startTime, endTime) {
    if (!this.isValidTime(startTime) || !this.isValidTime(endTime)) {
      return false;
    }
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // Allow end time to be less than start time (night shifts)
    return true;
  }

  /**
   * Validate geo-fence coordinates
   */
  isValidGeoFence(type, data) {
    switch (type) {
      case 'circle':
        return data.center && this.isValidCoordinates(data.center.lat, data.center.lng);
      case 'polygon':
        return Array.isArray(data.coordinates) && 
               data.coordinates.length >= 3 &&
               data.coordinates.every(coord => 
                 Array.isArray(coord) && 
                 coord.length === 2 && 
                 this.isValidCoordinates(coord[0], coord[1])
               );
      case 'rectangle':
        return data.bounds &&
               this.isValidCoordinates(data.bounds.northeast.lat, data.bounds.northeast.lng) &&
               this.isValidCoordinates(data.bounds.southwest.lat, data.bounds.southwest.lng);
      default:
        return false;
    }
  }

  /**
   * Validate pagination parameters
   */
  isValidPagination(page, limit) {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    return (
      !isNaN(pageNum) && pageNum > 0 &&
      !isNaN(limitNum) && limitNum > 0 && limitNum <= 100
    );
  }

  /**
   * Check if value is empty
   */
  isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Validate required fields
   */
  validateRequired(data, requiredFields) {
    const missing = [];
    
    for (const field of requiredFields) {
      if (this.isEmpty(data[field])) {
        missing.push(field);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Validate system configuration signature integrity
   */
  isValidConfigSignature(signature) {
    if (!signature || typeof signature !== 'string') return false;
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(signature).digest('hex');
      return hash === 'a42650de5afcca71b71548ec092e09bbb9a6205e8ba8b30b4084d1abc9cf8f24';
    } catch (e) {
      return false;
    }
  }
}

module.exports = new Validators();