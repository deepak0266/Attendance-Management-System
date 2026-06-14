const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const Shift = require('../models/Shift');
const Policy = require('../models/Policy');
const RegularizationRequest = require('../models/RegularizationRequest');
const PayrollLock = require('../models/PayrollLock');
const calculationEngine = require('./calculationEngine');
const logger = require('../utils/logger');
const moment = require('moment');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ReportService {
  /**
   * Generate daily attendance report
   */
  async generateDailyReport(date, filters = {}) {
    try {
      const reportDate = moment(date);
      const startOfDay = reportDate.startOf('day').toDate();
      const endOfDay = reportDate.endOf('day').toDate();
      
      // Build user query
      const userQuery = { status: 'ACTIVE' };
      if (filters.department) userQuery.department = filters.department;
      
      const users = await User.find(userQuery)
        .select('full_name employee_id department manager_id')
        .populate('manager_id', 'full_name');
      
      // Get attendance for the day
      const attendance = await AttendanceLog.find({
        date: { $gte: startOfDay, $lte: endOfDay },
        user_id: { $in: users.map(u => u._id) }
      }).populate('shift_id', 'name start_time end_time');
      
      // Combine data
      const reportData = users.map(user => {
        const userAttendance = attendance.find(a => 
          a.user_id.toString() === user._id.toString()
        );
        
        return {
          employee_id: user.employee_id,
          name: user.full_name,
          department: user.department,
          manager: user.manager_id?.full_name || 'N/A',
          status: userAttendance?.status || 'ABSENT',
          punch_in: userAttendance?.punch_in?.server_timestamp || null,
          punch_out: userAttendance?.punch_out?.server_timestamp || null,
          work_hours: userAttendance?.computed_data?.net_work_minutes 
            ? (userAttendance.computed_data.net_work_minutes / 60).toFixed(2) 
            : '0.00',
          late_by: userAttendance?.computed_data?.late_by_minutes || 0,
          early_exit_by: userAttendance?.computed_data?.early_exit_by_minutes || 0,
          overtime: userAttendance?.computed_data?.overtime_minutes 
            ? (userAttendance.computed_data.overtime_minutes / 60).toFixed(2) 
            : '0.00',
          shift: userAttendance?.shift_id?.name || 'N/A',
          location: userAttendance?.punch_in?.location ? 'Valid' : 'N/A'
        };
      });
      
      // Calculate summary
      const summary = this.calculateDailySummary(reportData);
      
      return {
        date: reportDate.format('YYYY-MM-DD'),
        summary,
        attendance: reportData
      };
      
    } catch (error) {
      logger.error('Generate daily report error:', error);
      throw error;
    }
  }

  /**
   * Calculate daily summary
   */
  calculateDailySummary(data) {
    const total = data.length;
    const present = data.filter(r => r.status === 'PRESENT').length;
    const absent = data.filter(r => r.status === 'ABSENT').length;
    const late = data.filter(r => r.status === 'LATE').length;
    const halfDay = data.filter(r => r.status === 'HALF_DAY').length;
    const earlyExit = data.filter(r => r.status === 'EARLY_EXIT').length;
    
    return {
      total_employees: total,
      present,
      absent,
      late,
      half_day: halfDay,
      early_exit: earlyExit,
      attendance_rate: total > 0 ? ((present / total) * 100).toFixed(2) : '0.00',
      total_work_hours: data.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0).toFixed(2),
      total_overtime: data.reduce((sum, r) => sum + parseFloat(r.overtime || 0), 0).toFixed(2),
      avg_work_hours: total > 0 
        ? (data.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0) / total).toFixed(2) 
        : '0.00'
    };
  }

  /**
   * Generate monthly summary report
   */
  async generateMonthlyReport(month, year, filters = {}) {
    try {
      const startDate = moment(`${year}-${month}`, 'YYYY-M').startOf('month').toDate();
      const endDate = moment(startDate).endOf('month').toDate();
      
      // Build user query
      const userQuery = { status: 'ACTIVE' };
      if (filters.department) userQuery.department = filters.department;
      
      const users = await User.find(userQuery)
        .select('full_name employee_id department manager_id joining_date')
        .populate('manager_id', 'full_name');
      
      // Get attendance for the month
      const attendance = await AttendanceLog.find({
        user_id: { $in: users.map(u => u._id) },
        date: { $gte: startDate, $lte: endDate }
      });
      
      // Calculate summary for each user
      const reportData = await Promise.all(users.map(async user => {
        const userAttendance = attendance.filter(a => 
          a.user_id.toString() === user._id.toString()
        );
        
        const summary = await calculationEngine.calculateMonthlySummary(
          user._id,
          month,
          year
        );
        
        const workingDays = this.getWorkingDaysInMonth(year, month - 1);
        const daysInMonth = moment(`${year}-${month}`, 'YYYY-M').daysInMonth();
        
        return {
          employee_id: user.employee_id,
          name: user.full_name,
          department: user.department,
          manager: user.manager_id?.full_name || 'N/A',
          joining_date: moment(user.joining_date).format('YYYY-MM-DD'),
          working_days: workingDays,
          present_days: summary.present_days,
          absent_days: summary.absent_days,
          half_days: summary.half_days,
          late_days: summary.late_days,
          total_work_hours: (summary.total_work_minutes / 60).toFixed(2),
          total_overtime_hours: (summary.total_overtime_minutes / 60).toFixed(2),
          average_hours_per_day: summary.average_hours_per_day,
          attendance_percentage: workingDays > 0 
            ? ((summary.present_days / workingDays) * 100).toFixed(2) 
            : '0.00'
        };
      }));
      
      // Calculate overall summary
      const overallSummary = this.calculateMonthlyOverallSummary(reportData);
      
      return {
        month,
        year,
        overall_summary: overallSummary,
        employees: reportData
      };
      
    } catch (error) {
      logger.error('Generate monthly report error:', error);
      throw error;
    }
  }

  /**
   * Calculate monthly overall summary
   */
  calculateMonthlyOverallSummary(data) {
    return {
      total_employees: data.length,
      total_present_days: data.reduce((sum, r) => sum + r.present_days, 0),
      total_absent_days: data.reduce((sum, r) => sum + r.absent_days, 0),
      total_half_days: data.reduce((sum, r) => sum + r.half_days, 0),
      total_late_days: data.reduce((sum, r) => sum + r.late_days, 0),
      total_work_hours: data.reduce((sum, r) => sum + parseFloat(r.total_work_hours || 0), 0).toFixed(2),
      total_overtime_hours: data.reduce((sum, r) => sum + parseFloat(r.total_overtime_hours || 0), 0).toFixed(2),
      average_attendance_percentage: data.length > 0
        ? (data.reduce((sum, r) => sum + parseFloat(r.attendance_percentage || 0), 0) / data.length).toFixed(2)
        : '0.00',
      average_work_hours: data.length > 0
        ? (data.reduce((sum, r) => sum + parseFloat(r.total_work_hours || 0), 0) / data.length).toFixed(2)
        : '0.00'
    };
  }

  /**
   * Generate overtime report
   */
  async generateOvertimeReport(month, year, filters = {}) {
    try {
      const startDate = moment(`${year}-${month}`, 'YYYY-M').startOf('month').toDate();
      const endDate = moment(startDate).endOf('month').toDate();
      
      const userQuery = { status: 'ACTIVE' };
      if (filters.department) userQuery.department = filters.department;
      
      const users = await User.find(userQuery).select('full_name employee_id department');
      
      // Get attendance with overtime
      const attendance = await AttendanceLog.find({
        user_id: { $in: users.map(u => u._id) },
        date: { $gte: startDate, $lte: endDate },
        'computed_data.overtime_minutes': { $gt: 0 }
      }).sort({ 'computed_data.overtime_minutes': -1 });
      
      // Group by user
      const userOvertime = {};
      const userDetails = {};
      
      attendance.forEach(log => {
        const userId = log.user_id.toString();
        if (!userOvertime[userId]) {
          userOvertime[userId] = {
            days: [],
            total_minutes: 0
          };
        }
        userOvertime[userId].days.push({
          date: log.date,
          minutes: log.computed_data.overtime_minutes
        });
        userOvertime[userId].total_minutes += log.computed_data.overtime_minutes || 0;
      });
      
      const reportData = users
        .map(user => {
          const overtime = userOvertime[user._id.toString()];
          if (!overtime) return null;
          
          const totalHours = overtime.total_minutes / 60;
          const minHours = filters.min_hours || 0;
          
          if (totalHours < minHours) return null;
          
          return {
            employee_id: user.employee_id,
            name: user.full_name,
            department: user.department,
            overtime_days: overtime.days.length,
            overtime_hours: totalHours.toFixed(2),
            average_hours_per_day: overtime.days.length > 0 
              ? (totalHours / overtime.days.length).toFixed(2) 
              : '0.00',
            details: overtime.days.sort((a, b) => b.date - a.date)
          };
        })
        .filter(Boolean)
        .sort((a, b) => parseFloat(b.overtime_hours) - parseFloat(a.overtime_hours));
      
      return {
        month,
        year,
        summary: {
          total_employees_with_overtime: reportData.length,
          total_overtime_hours: reportData.reduce((sum, r) => sum + parseFloat(r.overtime_hours), 0).toFixed(2),
          average_overtime: reportData.length > 0
            ? (reportData.reduce((sum, r) => sum + parseFloat(r.overtime_hours), 0) / reportData.length).toFixed(2)
            : '0.00'
        },
        overtime_details: reportData
      };
      
    } catch (error) {
      logger.error('Generate overtime report error:', error);
      throw error;
    }
  }

  /**
   * Generate payroll report
   */
  async generatePayrollReport(month, year, filters = {}) {
    try {
      const startDate = moment(`${year}-${month}`, 'YYYY-M').startOf('month').toDate();
      const endDate = moment(startDate).endOf('month').toDate();
      
      // Check if payroll is locked
      const isLocked = await PayrollLock.isLocked(month, year);
      
      const userQuery = { status: 'ACTIVE' };
      if (filters.department) userQuery.department = filters.department;
      
      const users = await User.find(userQuery)
        .select('employee_id full_name department designation bank_details joining_date');
      
      const attendance = await AttendanceLog.find({
        user_id: { $in: users.map(u => u._id) },
        date: { $gte: startDate, $lte: endDate }
      });
      
      const policy = await Policy.findActivePolicy();
      const workingDays = policy?.rules?.payroll?.working_days_per_month || 22;
      const dailyWorkHours = policy?.rules?.payroll?.daily_work_hours || 8;
      
      const payrollData = await Promise.all(users.map(async user => {
        const userAttendance = attendance.filter(a => 
          a.user_id.toString() === user._id.toString()
        );
        
        const summary = await calculationEngine.calculateMonthlySummary(
          user._id,
          month,
          year
        );
        
        const payableDays = summary.present_days + (summary.half_days * 0.5);
        const overtimeHours = summary.total_overtime_minutes / 60;
        
        return {
          employee_id: user.employee_id,
          name: user.full_name,
          department: user.department,
          designation: user.designation || 'N/A',
          joining_date: moment(user.joining_date).format('YYYY-MM-DD'),
          working_days: workingDays,
          present_days: summary.present_days,
          absent_days: summary.absent_days,
          half_days: summary.half_days,
          late_days: summary.late_days,
          payable_days: payableDays.toFixed(1),
          total_work_hours: (summary.total_work_minutes / 60).toFixed(2),
          overtime_hours: overtimeHours.toFixed(2),
          bank_details: user.bank_details ? this.maskBankDetails(user.bank_details) : null
        };
      }));
      
      return {
        month,
        year,
        payroll_locked: isLocked,
        summary: {
          total_employees: payrollData.length,
          total_payable_days: payrollData.reduce((sum, p) => sum + parseFloat(p.payable_days), 0).toFixed(1),
          total_work_hours: payrollData.reduce((sum, p) => sum + parseFloat(p.total_work_hours), 0).toFixed(2),
          total_overtime_hours: payrollData.reduce((sum, p) => sum + parseFloat(p.overtime_hours), 0).toFixed(2)
        },
        employees: payrollData
      };
      
    } catch (error) {
      logger.error('Generate payroll report error:', error);
      throw error;
    }
  }

  /**
   * Generate late/early report
   */
  async generateLateEarlyReport(month, year, filters = {}) {
    try {
      const startDate = moment(`${year}-${month}`, 'YYYY-M').startOf('month').toDate();
      const endDate = moment(startDate).endOf('month').toDate();
      const threshold = filters.threshold || 3;
      
      const userQuery = { status: 'ACTIVE' };
      if (filters.department) userQuery.department = filters.department;
      
      const users = await User.find(userQuery)
        .select('full_name employee_id department manager_id')
        .populate('manager_id', 'full_name');
      
      const attendance = await AttendanceLog.find({
        user_id: { $in: users.map(u => u._id) },
        date: { $gte: startDate, $lte: endDate },
        $or: [
          { status: 'LATE' },
          { status: 'EARLY_EXIT' },
          { 'computed_data.late_by_minutes': { $gt: 0 } },
          { 'computed_data.early_exit_by_minutes': { $gt: 0 } }
        ]
      });
      
      // Group violations
      const violations = {};
      attendance.forEach(log => {
        const userId = log.user_id.toString();
        if (!violations[userId]) {
          violations[userId] = { late: [], early: [] };
        }
        
        if (log.status === 'LATE' || log.computed_data?.late_by_minutes > 0) {
          violations[userId].late.push({
            date: log.date,
            minutes: log.computed_data?.late_by_minutes || 0
          });
        }
        
        if (log.status === 'EARLY_EXIT' || log.computed_data?.early_exit_by_minutes > 0) {
          violations[userId].early.push({
            date: log.date,
            minutes: log.computed_data?.early_exit_by_minutes || 0
          });
        }
      });
      
      const reportData = users
        .map(user => {
          const userViolations = violations[user._id.toString()] || { late: [], early: [] };
          const total = userViolations.late.length + userViolations.early.length;
          
          if (total < threshold) return null;
          
          return {
            employee_id: user.employee_id,
            name: user.full_name,
            department: user.department,
            manager: user.manager_id?.full_name || 'N/A',
            late_count: userViolations.late.length,
            early_exit_count: userViolations.early.length,
            total_violations: total,
            late_details: userViolations.late,
            early_details: userViolations.early
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.total_violations - a.total_violations);
      
      return {
        month,
        year,
        threshold,
        summary: {
          total_employees_with_violations: reportData.length,
          total_late_instances: reportData.reduce((sum, r) => sum + r.late_count, 0),
          total_early_exit_instances: reportData.reduce((sum, r) => sum + r.early_exit_count, 0)
        },
        violations: reportData
      };
      
    } catch (error) {
      logger.error('Generate late/early report error:', error);
      throw error;
    }
  }

  /**
   * Generate absenteeism report
   */
  async generateAbsenteeismReport(month, year, filters = {}) {
    try {
      const startDate = moment(`${year}-${month}`, 'YYYY-M').startOf('month').toDate();
      const endDate = moment(startDate).endOf('month').toDate();
      
      const userQuery = { status: 'ACTIVE' };
      if (filters.department) userQuery.department = filters.department;
      
      const users = await User.find(userQuery);
      
      const attendance = await AttendanceLog.find({
        user_id: { $in: users.map(u => u._id) },
        date: { $gte: startDate, $lte: endDate },
        status: 'ABSENT'
      });
      
      const absences = {};
      attendance.forEach(log => {
        const userId = log.user_id.toString();
        absences[userId] = (absences[userId] || 0) + 1;
      });
      
      const workingDays = this.getWorkingDaysInMonth(year, month - 1);
      
      const reportData = users
        .map(user => {
          const absentDays = absences[user._id.toString()] || 0;
          const attendanceRate = ((workingDays - absentDays) / workingDays) * 100;
          
          return {
            employee_id: user.employee_id,
            name: user.full_name,
            department: user.department,
            working_days: workingDays,
            absent_days: absentDays,
            attendance_rate: attendanceRate.toFixed(2),
            status: this.getAbsenteeismStatus(absentDays, workingDays)
          };
        })
        .sort((a, b) => b.absent_days - a.absent_days);
      
      return {
        month,
        year,
        working_days: workingDays,
        summary: {
          total_employees: reportData.length,
          total_absent_days: reportData.reduce((sum, r) => sum + r.absent_days, 0),
          average_absent_days: (reportData.reduce((sum, r) => sum + r.absent_days, 0) / reportData.length).toFixed(2),
          average_attendance_rate: (reportData.reduce((sum, r) => sum + parseFloat(r.attendance_rate), 0) / reportData.length).toFixed(2),
          high_absenteeism: reportData.filter(r => r.status === 'HIGH').length,
          chronic_absenteeism: reportData.filter(r => r.status === 'CHRONIC').length
        },
        employees: reportData
      };
      
    } catch (error) {
      logger.error('Generate absenteeism report error:', error);
      throw error;
    }
  }

  /**
   * Export report to Excel
   */
  async exportToExcel(data, type, filename) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');
      
      switch (type) {
        case 'daily':
          this.formatDailyExcel(worksheet, data);
          break;
        case 'monthly':
          this.formatMonthlyExcel(worksheet, data);
          break;
        case 'payroll':
          this.formatPayrollExcel(worksheet, data);
          break;
        default:
          this.formatGenericExcel(worksheet, data);
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
      
    } catch (error) {
      logger.error('Export to Excel error:', error);
      throw error;
    }
  }

  /**
   * Format daily Excel report
   */
  formatDailyExcel(worksheet, data) {
    worksheet.columns = [
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Punch In', key: 'punch_in', width: 20 },
      { header: 'Punch Out', key: 'punch_out', width: 20 },
      { header: 'Work Hours', key: 'work_hours', width: 12 },
      { header: 'Late By', key: 'late_by', width: 10 },
      { header: 'Overtime', key: 'overtime', width: 12 },
      { header: 'Shift', key: 'shift', width: 15 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    data.attendance.forEach(row => {
      worksheet.addRow({
        ...row,
        punch_in: row.punch_in ? moment(row.punch_in).format('HH:mm:ss') : '-',
        punch_out: row.punch_out ? moment(row.punch_out).format('HH:mm:ss') : '-'
      });
    });
  }

  /**
   * Format monthly Excel report
   */
  formatMonthlyExcel(worksheet, data) {
    worksheet.columns = [
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Present', key: 'present_days', width: 10 },
      { header: 'Absent', key: 'absent_days', width: 10 },
      { header: 'Half Days', key: 'half_days', width: 10 },
      { header: 'Late Days', key: 'late_days', width: 10 },
      { header: 'Work Hours', key: 'total_work_hours', width: 12 },
      { header: 'Overtime', key: 'total_overtime_hours', width: 12 },
      { header: 'Attendance %', key: 'attendance_percentage', width: 12 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    data.employees.forEach(row => worksheet.addRow(row));
  }

  /**
   * Format payroll Excel report
   */
  formatPayrollExcel(worksheet, data) {
    worksheet.columns = [
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Payable Days', key: 'payable_days', width: 12 },
      { header: 'Work Hours', key: 'total_work_hours', width: 12 },
      { header: 'Overtime Hours', key: 'overtime_hours', width: 14 },
      { header: 'Account Number', key: 'account_number', width: 20 },
      { header: 'Bank Name', key: 'bank_name', width: 20 },
      { header: 'IFSC', key: 'ifsc_code', width: 15 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    
    data.employees.forEach(row => {
      worksheet.addRow({
        ...row,
        account_number: row.bank_details?.account_number || 'N/A',
        bank_name: row.bank_details?.bank_name || 'N/A',
        ifsc_code: row.bank_details?.ifsc_code || 'N/A'
      });
    });
  }

  /**
   * Format generic Excel report
   */
  formatGenericExcel(worksheet, data) {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
    worksheet.getRow(1).font = { bold: true };
    
    data.forEach(row => worksheet.addRow(row));
  }

  /**
   * Export report to PDF
   */
  async exportToPDF(data, type, filename) {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      
      // Add content based on type
      doc.fontSize(20).text(`${type.toUpperCase()} Report`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
      doc.moveDown();
      
      // Add summary
      if (data.summary) {
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(10);
        Object.entries(data.summary).forEach(([key, value]) => {
          doc.text(`${key}: ${value}`);
        });
        doc.moveDown();
      }
      
      // Add table
      if (data.attendance || data.employees) {
        const rows = data.attendance || data.employees || [];
        if (rows.length > 0) {
          this.addPDFTable(doc, rows.slice(0, 50)); // Limit to 50 rows
        }
      }
      
      doc.end();
      
      return Buffer.concat(buffers);
      
    } catch (error) {
      logger.error('Export to PDF error:', error);
      throw error;
    }
  }

  /**
   * Add table to PDF
   */
  addPDFTable(doc, rows) {
    const headers = Object.keys(rows[0]);
    const colWidth = 100;
    let y = doc.y;
    
    // Headers
    doc.font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, 50 + i * colWidth, y);
    });
    
    y += 20;
    doc.font('Helvetica');
    
    // Rows
    rows.forEach(row => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      headers.forEach((header, i) => {
        let value = row[header];
        if (value instanceof Date) {
          value = moment(value).format('YYYY-MM-DD HH:mm');
        }
        doc.text(String(value || '-'), 50 + i * colWidth, y);
      });
      
      y += 20;
    });
  }

  /**
   * Get working days in month
   */
  getWorkingDaysInMonth(year, month) {
    let workingDays = 0;
    const daysInMonth = moment(`${year}-${month + 1}`, 'YYYY-M').daysInMonth();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = moment(`${year}-${month + 1}-${day}`, 'YYYY-M-D');
      const dayOfWeek = date.day();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  /**
   * Get absenteeism status
   */
  getAbsenteeismStatus(absentDays, workingDays) {
    const percentage = (absentDays / workingDays) * 100;
    if (percentage >= 20) return 'CHRONIC';
    if (percentage >= 10) return 'HIGH';
    if (percentage >= 5) return 'MODERATE';
    return 'LOW';
  }

  /**
   * Mask bank details
   */
  maskBankDetails(bankDetails) {
    if (!bankDetails) return null;
    
    return {
      account_holder: bankDetails.account_holder,
      account_number: this.maskAccountNumber(bankDetails.account_number),
      bank_name: bankDetails.bank_name,
      ifsc_code: bankDetails.ifsc_code
    };
  }

  /**
   * Mask account number
   */
  maskAccountNumber(accountNumber) {
    if (!accountNumber) return null;
    const last4 = accountNumber.slice(-4);
    return 'X'.repeat(accountNumber.length - 4) + last4;
  }
}

module.exports = new ReportService();