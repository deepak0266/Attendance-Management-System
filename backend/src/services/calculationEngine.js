const AttendanceLog = require('../models/AttendanceLog');
const Shift = require('../models/Shift');
const Policy = require('../models/Policy');
const BreakLog = require('../models/BreakLog');
const logger = require('../utils/logger');
const moment = require('moment');

class CalculationEngine {
  /**
   * Calculate daily attendance
   */
  async calculateDailyAttendance(attendanceLog, shift, policy) {
    try {
      const calculations = {
        total_work_minutes: 0,
        total_break_minutes: 0,
        net_work_minutes: 0,
        late_by_minutes: 0,
        early_exit_by_minutes: 0,
        overtime_minutes: 0,
        overtime_rate_applied: 1.0,
        expected_hours: 0,
        status: 'ABSENT'
      };
      
      if (!attendanceLog.punch_in) {
        return calculations;
      }
      
      const punchInTime = moment(attendanceLog.punch_in.server_timestamp);
      const punchOutTime = attendanceLog.punch_out 
        ? moment(attendanceLog.punch_out.server_timestamp)
        : moment();
      
      // Calculate shift times
      const shiftStartTime = this.parseTimeString(shift.start_time, attendanceLog.date);
      let shiftEndTime = this.parseTimeString(shift.end_time, attendanceLog.date);
      
      // Handle night shift (cross midnight)
      if (shift.type === 'Night' && shift.night_shift_config?.cross_midnight) {
        shiftEndTime.add(1, 'day');
      }
      
      const shiftDurationMinutes = shiftEndTime.diff(shiftStartTime, 'minutes');
      calculations.expected_hours = shiftDurationMinutes / 60;
      
      // Calculate total work duration
      const totalWorkMinutes = punchOutTime.diff(punchInTime, 'minutes');
      calculations.total_work_minutes = totalWorkMinutes;
      
      // Calculate break duration
      if (attendanceLog.breaks && attendanceLog.breaks.length > 0) {
        const breaks = await BreakLog.find({
          _id: { $in: attendanceLog.breaks },
          status: { $in: ['COMPLETED', 'AUTO_CLOSED'] }
        });
        
        calculations.total_break_minutes = breaks.reduce((total, br) => {
          return total + (br.actual_duration_minutes || 0);
        }, 0);
      }
      
      // Calculate net work minutes
      calculations.net_work_minutes = Math.max(0, 
        calculations.total_work_minutes - calculations.total_break_minutes
      );
      
      // Calculate late arrival
      const gracePeriod = shift.grace_period_minutes || policy?.rules?.late_arrival?.grace_minutes || 15;
      const lateThreshold = moment(shiftStartTime).add(gracePeriod, 'minutes');
      
      if (punchInTime.isAfter(lateThreshold)) {
        calculations.late_by_minutes = punchInTime.diff(lateThreshold, 'minutes');
      }
      
      // Calculate early exit (only if punched out)
      if (attendanceLog.punch_out) {
        const earlyExitThreshold = moment(shiftEndTime).subtract(gracePeriod, 'minutes');
        
        if (punchOutTime.isBefore(earlyExitThreshold)) {
          calculations.early_exit_by_minutes = earlyExitThreshold.diff(punchOutTime, 'minutes');
        }
      }
      
      // Calculate overtime
      if (calculations.net_work_minutes > shiftDurationMinutes) {
        calculations.overtime_minutes = calculations.net_work_minutes - shiftDurationMinutes;
        
        // Apply overtime rate
        if (policy?.rules?.overtime?.enabled) {
          const threshold = policy.rules.overtime.threshold_hours || 8;
          const doubleThreshold = policy.rules.overtime.double_rate_after_hours || 12;
          
          if (calculations.net_work_minutes / 60 > doubleThreshold) {
            calculations.overtime_rate_applied = 2.0;
          } else if (calculations.net_work_minutes / 60 > threshold) {
            calculations.overtime_rate_applied = policy.rules.overtime.rate_multiplier || 1.5;
          }
        }
      }
      
      // Determine status
      const Holiday = require('../models/Holiday');
      const isHoliday = await Holiday.findOne({
        date: {
          $gte: moment(attendanceLog.date).startOf('day').toDate(),
          $lt: moment(attendanceLog.date).endOf('day').toDate()
        },
        is_active: true
      });

      calculations.status = this.determineStatus(calculations, shift, policy, !!isHoliday);
      
      return calculations;
      
    } catch (error) {
      logger.error('Calculate daily attendance error:', error);
      throw error;
    }
  }

  /**
   * Determine attendance status
   */
  determineStatus(calculations, shift, policy, isHoliday = false) {
    const netHours = calculations.net_work_minutes / 60;
    const halfDayThreshold = shift.half_day_threshold_hours || 
      policy?.rules?.half_day?.threshold_hours_worked || 4;
    
    if (netHours === 0) {
      return isHoliday ? 'HOLIDAY' : 'ABSENT';
    }
    
    if (netHours < halfDayThreshold) {
      return 'HALF_DAY';
    }
    
    if (calculations.late_by_minutes > (shift.late_threshold_minutes || 30)) {
      return 'LATE';
    }
    
    if (calculations.early_exit_by_minutes > 0) {
      return 'EARLY_EXIT';
    }
    
    return 'PRESENT';
  }

  /**
   * Parse time string to moment
   */
  parseTimeString(timeStr, baseDate) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return moment(baseDate).set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
  }

  /**
   * Calculate monthly summary
   */
  async calculateMonthlySummary(userId, month, year) {
    try {
      const startDate = moment(`${year}-${month}`, 'YYYY-M').startOf('month').toDate();
      const endDate = moment(startDate).endOf('month').toDate();
      
      const attendanceLogs = await AttendanceLog.find({
        user_id: userId,
        date: { $gte: startDate, $lte: endDate }
      });
      
      const summary = {
        total_days: attendanceLogs.length,
        present_days: 0,
        absent_days: 0,
        half_days: 0,
        late_days: 0,
        early_exit_days: 0,
        total_work_minutes: 0,
        total_overtime_minutes: 0,
        total_break_minutes: 0,
        average_hours_per_day: 0
      };
      
      attendanceLogs.forEach(log => {
        switch (log.status) {
          case 'PRESENT':
            summary.present_days++;
            break;
          case 'ABSENT':
            summary.absent_days++;
            break;
          case 'HALF_DAY':
            summary.half_days++;
            break;
          case 'LATE':
            summary.late_days++;
            break;
          case 'EARLY_EXIT':
            summary.early_exit_days++;
            break;
        }
        
        if (log.computed_data) {
          summary.total_work_minutes += log.computed_data.net_work_minutes || 0;
          summary.total_overtime_minutes += log.computed_data.overtime_minutes || 0;
          summary.total_break_minutes += log.computed_data.total_break_minutes || 0;
        }
      });
      
      // Calculate average hours per day
      const daysWithAttendance = summary.present_days + summary.half_days + summary.late_days;
      if (daysWithAttendance > 0) {
        summary.average_hours_per_day = (summary.total_work_minutes / 60 / daysWithAttendance).toFixed(2);
      }
      
      return summary;
      
    } catch (error) {
      logger.error('Calculate monthly summary error:', error);
      throw error;
    }
  }

  /**
   * Calculate overtime pay
   */
  calculateOvertimePay(overtimeMinutes, baseRate, policy) {
    const overtimeHours = overtimeMinutes / 60;
    let totalPay = 0;
    
    if (!policy?.rules?.overtime?.enabled) {
      return totalPay;
    }
    
    const regularRate = baseRate;
    const overtimeRate = regularRate * (policy.rules.overtime.rate_multiplier || 1.5);
    const doubleRate = regularRate * 2.0;
    
    const threshold = policy.rules.overtime.threshold_hours || 8;
    const doubleThreshold = policy.rules.overtime.double_rate_after_hours || 12;
    
    if (overtimeHours > 0) {
      const regularOvertime = Math.min(overtimeHours, doubleThreshold - threshold);
      totalPay += regularOvertime * overtimeRate;
      
      if (overtimeHours > doubleThreshold - threshold) {
        const doubleOvertime = overtimeHours - (doubleThreshold - threshold);
        totalPay += doubleOvertime * doubleRate;
      }
    }
    
    return totalPay;
  }

  /**
   * Calculate late deduction
   */
  calculateLateDeduction(lateMinutes, baseRate, policy) {
    if (!policy?.rules?.late_arrival) {
      return 0;
    }
    
    const rules = policy.rules.late_arrival;
    const graceMinutes = rules.grace_minutes || 15;
    
    if (lateMinutes <= graceMinutes) {
      return 0;
    }
    
    const deductibleMinutes = Math.min(
      lateMinutes - graceMinutes,
      rules.max_deduction_minutes || 60
    );
    
    const minuteRate = baseRate / (8 * 60); // Assuming 8 hour day
    const deduction = deductibleMinutes * minuteRate * (rules.deduction_per_minute || 0.5);
    
    return deduction;
  }

  /**
   * Calculate early exit deduction
   */
  calculateEarlyExitDeduction(earlyMinutes, baseRate, policy) {
    if (!policy?.rules?.early_exit) {
      return 0;
    }
    
    const rules = policy.rules.early_exit;
    const graceMinutes = rules.grace_minutes || 15;
    
    if (earlyMinutes <= graceMinutes) {
      return 0;
    }
    
    const minuteRate = baseRate / (8 * 60);
    const deduction = (earlyMinutes - graceMinutes) * minuteRate * (rules.penalty_per_minute || 1);
    
    return deduction;
  }

  /**
   * Calculate total payable hours
   */
  calculatePayableHours(attendanceLog, shift, policy) {
    const calculations = attendanceLog.computed_data || {};
    
    let payableHours = calculations.net_work_minutes / 60;
    
    // Add overtime
    if (calculations.overtime_minutes > 0) {
      const overtimeRate = calculations.overtime_rate_applied || 1.0;
      payableHours += (calculations.overtime_minutes / 60) * overtimeRate;
    }
    
    // Subtract late deductions
    if (calculations.late_by_minutes > 0) {
      const deduction = this.calculateLateDeduction(
        calculations.late_by_minutes,
        1, // Base rate of 1 hour for calculation
        policy
      );
      payableHours -= deduction;
    }
    
    // Subtract early exit deductions
    if (calculations.early_exit_by_minutes > 0) {
      const deduction = this.calculateEarlyExitDeduction(
        calculations.early_exit_by_minutes,
        1,
        policy
      );
      payableHours -= deduction;
    }
    
    return Math.max(0, payableHours);
  }

  /**
   * Calculate weekly summary
   */
  async calculateWeeklySummary(userId, weekStart) {
    try {
      const startDate = moment(weekStart).startOf('week').toDate();
      const endDate = moment(weekStart).endOf('week').toDate();
      
      const attendanceLogs = await AttendanceLog.find({
        user_id: userId,
        date: { $gte: startDate, $lte: endDate }
      });
      
      const dailySummaries = [];
      let totalWorkMinutes = 0;
      let totalOvertimeMinutes = 0;
      
      for (let i = 0; i < 7; i++) {
        const date = moment(startDate).add(i, 'days');
        const log = attendanceLogs.find(l => 
          moment(l.date).isSame(date, 'day')
        );
        
        dailySummaries.push({
          date: date.format('YYYY-MM-DD'),
          day: date.format('dddd'),
          status: log?.status || 'WEEKEND',
          work_hours: log?.computed_data?.net_work_minutes 
            ? (log.computed_data.net_work_minutes / 60).toFixed(2) 
            : '0.00',
          overtime: log?.computed_data?.overtime_minutes 
            ? (log.computed_data.overtime_minutes / 60).toFixed(2) 
            : '0.00'
        });
        
        if (log?.computed_data) {
          totalWorkMinutes += log.computed_data.net_work_minutes || 0;
          totalOvertimeMinutes += log.computed_data.overtime_minutes || 0;
        }
      }
      
      return {
        week_start: moment(startDate).format('YYYY-MM-DD'),
        week_end: moment(endDate).format('YYYY-MM-DD'),
        daily: dailySummaries,
        summary: {
          total_work_hours: (totalWorkMinutes / 60).toFixed(2),
          total_overtime_hours: (totalOvertimeMinutes / 60).toFixed(2),
          present_days: attendanceLogs.filter(l => l.status === 'PRESENT').length,
          absent_days: attendanceLogs.filter(l => l.status === 'ABSENT').length,
          late_days: attendanceLogs.filter(l => l.status === 'LATE').length
        }
      };
      
    } catch (error) {
      logger.error('Calculate weekly summary error:', error);
      throw error;
    }
  }

  /**
   * Calculate attendance percentage
   */
  calculateAttendancePercentage(presentDays, workingDays) {
    if (workingDays === 0) return 0;
    return (presentDays / workingDays) * 100;
  }

  /**
   * Check if day is working day
   */
  isWorkingDay(date, shift) {
    if (!shift?.working_days) return true;
    
    const dayOfWeek = moment(date).day();
    return shift.working_days.includes(dayOfWeek);
  }

  /**
   * Calculate shift duration
   */
  calculateShiftDuration(shift) {
    const [startHour, startMin] = shift.start_time.split(':').map(Number);
    const [endHour, endMin] = shift.end_time.split(':').map(Number);
    
    let hours = endHour - startHour;
    let minutes = endMin - startMin;
    
    if (shift.type === 'Night' && shift.night_shift_config?.cross_midnight) {
      hours += 24;
    }
    
    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }
    
    return hours + (minutes / 60);
  }

  /**
   * Calculate grace period end time
   */
  calculateGraceEndTime(shiftStartTime, graceMinutes) {
    return moment(shiftStartTime).add(graceMinutes, 'minutes');
  }

  /**
   * Calculate overtime threshold
   */
  calculateOvertimeThreshold(shiftDuration, policy) {
    return policy?.rules?.overtime?.threshold_hours || shiftDuration;
  }
}

module.exports = new CalculationEngine();