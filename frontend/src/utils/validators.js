import { VALIDATION } from './constants';

/**
 * Validate email
 */
export const validateEmail = (email) => {
  if (!email) return 'Email is required';
  if (!VALIDATION.EMAIL_REGEX.test(email)) return 'Invalid email format';
  return '';
};

/**
 * Validate password
 */
export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return '';
};

/**
 * Validate phone number
 */
export const validatePhone = (phone) => {
  if (!phone) return 'Phone number is required';
  if (!VALIDATION.PHONE_REGEX.test(phone)) return 'Invalid phone number format';
  return '';
};

/**
 * Validate employee ID
 */
export const validateEmployeeId = (employeeId) => {
  if (!employeeId) return 'Employee ID is required';
  if (!VALIDATION.EMPLOYEE_ID_REGEX.test(employeeId)) {
    return 'Employee ID must be 3-20 characters, letters and numbers only';
  }
  return '';
};

/**
 * Validate required field
 */
export const validateRequired = (value, fieldName = 'This field') => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required`;
  }
  return '';
};

/**
 * Validate name
 */
export const validateName = (name, fieldName = 'Name') => {
  if (!name) return `${fieldName} is required`;
  if (name.length < 2) return `${fieldName} must be at least 2 characters`;
  if (name.length > 100) return `${fieldName} cannot exceed 100 characters`;
  return '';
};

/**
 * Validate date
 */
export const validateDate = (date, options = {}) => {
  const { required = true, minDate, maxDate, fieldName = 'Date' } = options;
  
  if (required && !date) return `${fieldName} is required`;
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  if (minDate && dateObj < new Date(minDate)) {
    return `${fieldName} cannot be before ${new Date(minDate).toLocaleDateString()}`;
  }
  
  if (maxDate && dateObj > new Date(maxDate)) {
    return `${fieldName} cannot be after ${new Date(maxDate).toLocaleDateString()}`;
  }
  
  return '';
};

/**
 * Validate time
 */
export const validateTime = (time, fieldName = 'Time') => {
  if (!time) return `${fieldName} is required`;
  
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) return 'Invalid time format (HH:MM)';
  
  return '';
};

/**
 * Validate number range
 */
export const validateNumberRange = (value, options = {}) => {
  const { min, max, fieldName = 'Value', required = true } = options;
  
  if (required && (value === null || value === undefined || value === '')) {
    return `${fieldName} is required`;
  }
  if (!required && !value) return '';
  
  const num = Number(value);
  if (isNaN(num)) return `${fieldName} must be a number`;
  
  if (min !== undefined && num < min) {
    return `${fieldName} must be at least ${min}`;
  }
  
  if (max !== undefined && num > max) {
    return `${fieldName} cannot exceed ${max}`;
  }
  
  return '';
};

/**
 * Validate coordinates
 */
export const validateCoordinates = (lat, lng) => {
  if (lat === null || lat === undefined) return 'Latitude is required';
  if (lng === null || lng === undefined) return 'Longitude is required';
  
  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return 'Latitude must be between -90 and 90';
  }
  
  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    return 'Longitude must be between -180 and 180';
  }
  
  return '';
};

/**
 * Validate URL
 */
export const validateUrl = (url, fieldName = 'URL') => {
  if (!url) return `${fieldName} is required`;
  
  try {
    new URL(url);
    return '';
  } catch {
    return 'Invalid URL format';
  }
};

/**
 * Validate file
 */
export const validateFile = (file, options = {}) => {
  const {
    required = true,
    maxSizeMB = 5,
    allowedTypes = [],
    fieldName = 'File'
  } = options;
  
  if (required && !file) return `${fieldName} is required`;
  if (!file) return '';
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return `${fieldName} size cannot exceed ${maxSizeMB}MB`;
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return `${fieldName} type must be: ${allowedTypes.join(', ')}`;
  }
  
  return '';
};

/**
 * Validate form fields
 */
export const validateForm = (values, rules) => {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const value = values[field];
    const fieldRules = rules[field];
    
    if (Array.isArray(fieldRules)) {
      for (const rule of fieldRules) {
        const error = rule(value, values);
        if (error) {
          errors[field] = error;
          break;
        }
      }
    } else if (typeof fieldRules === 'function') {
      const error = fieldRules(value, values);
      if (error) {
        errors[field] = error;
      }
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};