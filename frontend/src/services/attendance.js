import { apiService } from './api';
import toast from 'react-hot-toast';

class AttendanceService {
  /**
   * Submit punch (in/out/break)
   */
  async submitPunch(punchData) {
    try {
      const response = await apiService.attendance.punch(punchData);
      
      if (response.data.requires_approval) {
        toast.success('Punch recorded and sent for approval');
      } else {
        toast.success(`Successfully punched ${punchData.type}`);
      }
      
      return response.data;
    } catch (error) {
      const isRequireOverride = error.response?.data?.require_override_reason;
      const isUnregisteredDevice = error.response?.data?.error?.includes('Unregistered device');
      
      if (!isRequireOverride && !isUnregisteredDevice) {
        toast.error(error.response?.data?.error || 'Failed to record punch');
      }
      throw error;
    }
  }

  /**
   * Request device approval
   */
  async requestDeviceApproval(data) {
    try {
      const response = await apiService.attendance.requestDeviceApproval(data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current attendance status
   */
  async getCurrentStatus() {
    try {
      const response = await apiService.attendance.getStatus();
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch status:', error);
      throw error;
    }
  }

  /**
   * Get attendance history
   */
  async getAttendanceHistory(params = {}) {
    try {
      const response = await apiService.attendance.getHistory(params);
      return response.data;
    } catch (error) {
      toast.error('Failed to fetch attendance history');
      throw error;
    }
  }

  /**
   * Get chart data
   */
  async getChartData(params = {}) {
    try {
      const response = await apiService.attendance.getChartData(params);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      return [];
    }
  }

  /**
   * Get attendance summary
   */
  async getSummary() {
    try {
      const response = await apiService.attendance.getSummary();
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      return null;
    }
  }

  /**
   * Override attendance (admin only)
   */
  async overrideAttendance(attendanceId, data) {
    try {
      const response = await apiService.attendance.override(attendanceId, data);
      toast.success('Attendance overridden successfully');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to override attendance');
      throw error;
    }
  }

  /**
   * Get photo capture configuration
   */
  async getPhotoCaptureConfig() {
    try {
      const response = await apiService.attendance.getPhotoConfig();
      return response.data.data;
    } catch (error) {
      return { enabled: false, required: false };
    }
  }

  /**
   * Get status distribution for charts
   */
  async getStatusDistribution(userId, period = 'month') {
    try {
      const history = await this.getAttendanceHistory({ 
        userId, 
        period,
        limit: 100 
      });
      
      const distribution = {
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        earlyExit: 0
      };
      
      history.data?.forEach(log => {
        switch (log.status) {
          case 'PRESENT':
            distribution.present++;
            break;
          case 'LATE':
            distribution.late++;
            break;
          case 'ABSENT':
            distribution.absent++;
            break;
          case 'HALF_DAY':
            distribution.halfDay++;
            break;
          case 'EARLY_EXIT':
            distribution.earlyExit++;
            break;
        }
      });
      
      return distribution;
    } catch (error) {
      console.error('Failed to get status distribution:', error);
      return { present: 0, late: 0, absent: 0, halfDay: 0, earlyExit: 0 };
    }
  }

  /**
   * Calculate working hours summary
   */
  calculateWorkingHours(attendanceLogs) {
    let totalMinutes = 0;
    let totalOvertime = 0;
    let daysWorked = 0;
    
    attendanceLogs?.forEach(log => {
      if (log.computed_data) {
        totalMinutes += log.computed_data.net_work_minutes || 0;
        totalOvertime += log.computed_data.overtime_minutes || 0;
        if (log.status === 'PRESENT' || log.status === 'LATE') {
          daysWorked++;
        }
      }
    });
    
    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      totalOvertime: (totalOvertime / 60).toFixed(1),
      daysWorked,
      averageHoursPerDay: daysWorked > 0 
        ? (totalMinutes / 60 / daysWorked).toFixed(1) 
        : '0.0'
    };
  }

  /**
   * Format attendance status for display
   */
  formatStatus(status) {
    const statusMap = {
      'PRESENT': { label: 'Present', color: 'success' },
      'ABSENT': { label: 'Absent', color: 'danger' },
      'LATE': { label: 'Late', color: 'warning' },
      'HALF_DAY': { label: 'Half Day', color: 'info' },
      'EARLY_EXIT': { label: 'Early Exit', color: 'warning' },
      'HOLIDAY': { label: 'Holiday', color: 'info' },
      'WEEKEND': { label: 'Weekend', color: 'secondary' },
      'ON_LEAVE': { label: 'On Leave', color: 'info' },
      'PENDING_APPROVAL': { label: 'Pending', color: 'warning' }
    };
    
    return statusMap[status] || { label: status, color: 'secondary' };
  }

  /**
   * Check if user can punch
   */
  canPunch(currentState, action) {
    const validTransitions = {
      'NOT_PUNCHED': ['IN'],
      'PUNCHED_IN': ['OUT', 'BREAK_START'],
      'ON_BREAK': ['BREAK_END'],
      'PUNCHED_OUT': ['IN'],
      'PENDING_APPROVAL': []
    };
    
    return validTransitions[currentState]?.includes(action) || false;
  }

  /**
   * Get next expected action
   */
  getNextAction(currentState) {
    const nextActions = {
      'NOT_PUNCHED': 'IN',
      'PUNCHED_IN': 'OUT',
      'ON_BREAK': 'BREAK_END',
      'PUNCHED_OUT': 'IN'
    };
    
    return nextActions[currentState] || null;
  }
}

export const attendanceService = new AttendanceService();