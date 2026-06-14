const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const Shift = require('../models/Shift');
const RegularizationRequest = require('../models/RegularizationRequest');
const PayrollLock = require('../models/PayrollLock');
const calculationEngine = require('../services/calculationEngine');
const reportService = require('../services/reportService');
const logger = require('../utils/logger');
const moment = require('moment');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// @desc    Generate daily attendance report
// @route   GET /api/reports/daily
// @access  Private (HR, Manager, Super Admin)
exports.getDailyReport = async (req, res, next) => {
  try {
    const { date, department, export_format } = req.query;
    const reportDate = date ? moment(date) : moment();
    const startOfDay = reportDate.startOf('day').toDate();
    const endOfDay = reportDate.endOf('day').toDate();
    
    // Build query
    const userQuery = { status: 'ACTIVE' };
    if (department) userQuery.department = department;
    
    // Get users based on role
    let users;
    if (req.user.role === 'MANAGER') {
      users = await User.findTeamMembers(req.user.id);
    } else {
      users = await User.find(userQuery).select('full_name employee_id department');
    }
    
    // Get attendance for the day
    const attendance = await AttendanceLog.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      user_id: { $in: users.map(u => u._id) }
    }).populate('shift_id', 'name start_time end_time');
    
    // Combine user and attendance data
    const reportData = users.map(user => {
      const userAttendance = attendance.find(a => 
        a.user_id.toString() === user._id.toString()
      );
      
      return {
        employee_id: user.employee_id,
        name: user.full_name,
        department: user.department,
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
        shift: userAttendance?.shift_id?.name || 'N/A'
      };
    });
    
    // Calculate summary
    const summary = {
      total_employees: reportData.length,
      present: reportData.filter(r => r.status === 'PRESENT').length,
      absent: reportData.filter(r => r.status === 'ABSENT').length,
      late: reportData.filter(r => r.status === 'LATE').length,
      half_day: reportData.filter(r => r.status === 'HALF_DAY').length,
      on_leave: reportData.filter(r => r.status === 'ON_LEAVE').length,
      total_work_hours: reportData.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0).toFixed(2),
      total_overtime: reportData.reduce((sum, r) => sum + parseFloat(r.overtime || 0), 0).toFixed(2)
    };
    
    // Handle export
    if (export_format === 'excel') {
      return exportToExcel(res, reportData, summary, `Daily_Attendance_${reportDate.format('YYYY-MM-DD')}`);
    } else if (export_format === 'pdf') {
      return exportToPDF(res, reportData, summary, `Daily_Attendance_${reportDate.format('YYYY-MM-DD')}`);
    }
    
    res.json({
      success: true,
      data: {
        date: reportDate.format('YYYY-MM-DD'),
        summary,
        attendance: reportData
      }
    });
    
  } catch (error) {
    logger.error('Get daily report error:', error);
    next(error);
  }
};

// @desc    Generate monthly summary report
// @route   GET /api/reports/monthly
// @access  Private (HR, Manager, Super Admin)
exports.getMonthlyReport = async (req, res, next) => {
  try {
    const { month, year, department, user_id, export_format } = req.query;
    
    const reportMonth = month ? parseInt(month) : moment().month() + 1;
    const reportYear = year ? parseInt(year) : moment().year();
    
    const startDate = moment(`${reportYear}-${reportMonth}`, 'YYYY-M').startOf('month').toDate();
    const endDate = moment(startDate).endOf('month').toDate();
    
    // Build user query
    const userQuery = { status: 'ACTIVE' };
    if (department) userQuery.department = department;
    if (user_id) userQuery._id = user_id;
    
    // Get users based on role
    let users;
    if (req.user.role === 'MANAGER') {
      users = await User.findTeamMembers(req.user.id);
      if (user_id) {
        users = users.filter(u => u._id.toString() === user_id);
      }
    } else {
      users = await User.find(userQuery).select('full_name employee_id department manager_id')
        .populate('manager_id', 'full_name');
    }
    
    // Get attendance for the month
    const userIds = users.map(u => u._id);
    const attendance = await AttendanceLog.find({
      user_id: { $in: userIds },
      date: { $gte: startDate, $lte: endDate }
    });
    
    // Calculate summary for each user
    const reportData = await Promise.all(users.map(async user => {
      const userAttendance = attendance.filter(a => 
        a.user_id.toString() === user._id.toString()
      );
      
      const summary = await calculationEngine.calculateMonthlySummary(
        user._id,
        reportMonth,
        reportYear
      );
      
      return {
        employee_id: user.employee_id,
        name: user.full_name,
        department: user.department,
        manager: user.manager_id?.full_name || 'N/A',
        total_days: summary.total_days,
        present_days: summary.present_days,
        absent_days: summary.absent_days,
        half_days: summary.half_days,
        late_days: summary.late_days,
        total_work_hours: (summary.total_work_minutes / 60).toFixed(2),
        total_overtime_hours: (summary.total_overtime_minutes / 60).toFixed(2),
        average_hours_per_day: summary.average_hours_per_day,
        attendance_percentage: summary.total_days > 0 
          ? ((summary.present_days / summary.total_days) * 100).toFixed(2) 
          : '0.00'
      };
    }));
    
    // Calculate overall summary
    const overallSummary = {
      total_employees: reportData.length,
      total_present_days: reportData.reduce((sum, r) => sum + r.present_days, 0),
      total_absent_days: reportData.reduce((sum, r) => sum + r.absent_days, 0),
      total_half_days: reportData.reduce((sum, r) => sum + r.half_days, 0),
      total_late_days: reportData.reduce((sum, r) => sum + r.late_days, 0),
      total_work_hours: reportData.reduce((sum, r) => sum + parseFloat(r.total_work_hours || 0), 0).toFixed(2),
      total_overtime_hours: reportData.reduce((sum, r) => sum + parseFloat(r.total_overtime_hours || 0), 0).toFixed(2),
      average_attendance_percentage: reportData.length > 0
        ? (reportData.reduce((sum, r) => sum + parseFloat(r.attendance_percentage || 0), 0) / reportData.length).toFixed(2)
        : '0.00'
    };
    
    // Handle export
    if (export_format === 'excel') {
      return exportMonthlyToExcel(res, reportData, overallSummary, reportMonth, reportYear);
    }
    
    res.json({
      success: true,
      data: {
        month: reportMonth,
        year: reportYear,
        overall_summary: overallSummary,
        employees: reportData
      }
    });
    
  } catch (error) {
    logger.error('Get monthly report error:', error);
    next(error);
  }
};

// @desc    Generate overtime report
// @route   GET /api/reports/overtime
// @access  Private (HR, Manager, Super Admin)
exports.getOvertimeReport = async (req, res, next) => {
  try {
    const { month, year, department, min_hours } = req.query;
    
    const reportMonth = month ? parseInt(month) : moment().month() + 1;
    const reportYear = year ? parseInt(year) : moment().year();
    const minOvertimeHours = min_hours ? parseFloat(min_hours) : 0;
    
    const startDate = moment(`${reportYear}-${reportMonth}`, 'YYYY-M').startOf('month').toDate();
    const endDate = moment(startDate).endOf('month').toDate();
    
    // Build query
    const userQuery = { status: 'ACTIVE' };
    if (department) userQuery.department = department;
    
    const users = await User.find(userQuery).select('full_name employee_id department');
    
    // Get attendance with overtime
    const attendance = await AttendanceLog.find({
      user_id: { $in: users.map(u => u._id) },
      date: { $gte: startDate, $lte: endDate },
      'computed_data.overtime_minutes': { $gt: 0 }
    }).sort({ 'computed_data.overtime_minutes': -1 });
    
    // Group by user
    const userOvertime = {};
    attendance.forEach(log => {
      const userId = log.user_id.toString();
      if (!userOvertime[userId]) {
        userOvertime[userId] = {
          days: 0,
          total_minutes: 0
        };
      }
      userOvertime[userId].days++;
      userOvertime[userId].total_minutes += log.computed_data.overtime_minutes || 0;
    });
    
    // Prepare report data
    const reportData = users
      .map(user => {
        const overtime = userOvertime[user._id.toString()] || { days: 0, total_minutes: 0 };
        const totalHours = overtime.total_minutes / 60;
        
        if (totalHours < minOvertimeHours) return null;
        
        return {
          employee_id: user.employee_id,
          name: user.full_name,
          department: user.department,
          overtime_days: overtime.days,
          overtime_hours: totalHours.toFixed(2),
          average_hours_per_day: overtime.days > 0 
            ? (totalHours / overtime.days).toFixed(2) 
            : '0.00'
        };
      })
      .filter(Boolean)
      .sort((a, b) => parseFloat(b.overtime_hours) - parseFloat(a.overtime_hours));
    
    // Summary
    const summary = {
      total_employees_with_overtime: reportData.length,
      total_overtime_hours: reportData.reduce((sum, r) => sum + parseFloat(r.overtime_hours), 0).toFixed(2),
      average_overtime_per_employee: reportData.length > 0
        ? (reportData.reduce((sum, r) => sum + parseFloat(r.overtime_hours), 0) / reportData.length).toFixed(2)
        : '0.00',
      max_overtime_hours: reportData.length > 0 ? reportData[0].overtime_hours : '0.00'
    };
    
    res.json({
      success: true,
      data: {
        month: reportMonth,
        year: reportYear,
        summary,
        overtime_details: reportData
      }
    });
    
  } catch (error) {
    logger.error('Get overtime report error:', error);
    next(error);
  }
};

// @desc    Generate payroll report
// @route   GET /api/reports/payroll
// @access  Private (HR, Super Admin)
exports.getPayrollReport = async (req, res, next) => {
  try {
    const { month, year, department, export_format } = req.query;
    
    const reportMonth = month ? parseInt(month) : moment().month() + 1;
    const reportYear = year ? parseInt(year) : moment().year();
    
    // Check if payroll is locked
    const isLocked = await PayrollLock.isLocked(reportMonth, reportYear);
    
    const startDate = moment(`${reportYear}-${reportMonth}`, 'YYYY-M').startOf('month').toDate();
    const endDate = moment(startDate).endOf('month').toDate();
    
    // Get all active users
    const userQuery = { status: 'ACTIVE' };
    if (department) userQuery.department = department;
    
    const users = await User.find(userQuery)
      .select('employee_id full_name department designation bank_details joining_date')
      .populate('manager_id', 'full_name');
    
    // Get attendance for the month
    const attendance = await AttendanceLog.find({
      user_id: { $in: users.map(u => u._id) },
      date: { $gte: startDate, $lte: endDate }
    });
    
    // Get policy for calculations
    const Policy = require('../models/Policy');
    const policy = await Policy.findActivePolicy();
    
    // Calculate payroll data for each user
    const payrollData = await Promise.all(users.map(async user => {
      const userAttendance = attendance.filter(a => 
        a.user_id.toString() === user._id.toString()
      );
      
      const summary = await calculationEngine.calculateMonthlySummary(
        user._id,
        reportMonth,
        reportYear
      );
      
      // Calculate payable days
      const workingDaysInMonth = policy?.rules?.payroll?.working_days_per_month || 22;
      const payableDays = summary.present_days + (summary.half_days * 0.5);
      
      // Calculate overtime pay (assuming daily rate based on 8 hours)
      const dailyWorkHours = policy?.rules?.payroll?.daily_work_hours || 8;
      const overtimeHours = summary.total_overtime_minutes / 60;
      const overtimeRate = policy?.rules?.overtime?.rate_multiplier || 1.5;
      
      return {
        employee_id: user.employee_id,
        name: user.full_name,
        department: user.department,
        designation: user.designation || 'N/A',
        joining_date: moment(user.joining_date).format('YYYY-MM-DD'),
        working_days: workingDaysInMonth,
        present_days: summary.present_days,
        absent_days: summary.absent_days,
        half_days: summary.half_days,
        late_days: summary.late_days,
        payable_days: payableDays.toFixed(1),
        total_work_hours: (summary.total_work_minutes / 60).toFixed(2),
        overtime_hours: overtimeHours.toFixed(2),
        overtime_multiplier: overtimeRate,
        bank_details: user.bank_details ? {
          account_holder: user.bank_details.account_holder,
          account_number: maskAccountNumber(user.bank_details.account_number),
          bank_name: user.bank_details.bank_name,
          ifsc_code: user.bank_details.ifsc_code
        } : null
      };
    }));
    
    // Summary
    const summary = {
      total_employees: payrollData.length,
      total_payable_days: payrollData.reduce((sum, p) => sum + parseFloat(p.payable_days), 0).toFixed(1),
      total_work_hours: payrollData.reduce((sum, p) => sum + parseFloat(p.total_work_hours), 0).toFixed(2),
      total_overtime_hours: payrollData.reduce((sum, p) => sum + parseFloat(p.overtime_hours), 0).toFixed(2),
      payroll_locked: isLocked
    };
    
    // Handle export
    if (export_format === 'excel') {
      return exportPayrollToExcel(res, payrollData, summary, reportMonth, reportYear);
    } else if (export_format === 'csv') {
      return exportPayrollToCSV(res, payrollData, reportMonth, reportYear);
    }
    
    res.json({
      success: true,
      data: {
        month: reportMonth,
        year: reportYear,
        payroll_locked: isLocked,
        summary,
        employees: payrollData
      }
    });
    
  } catch (error) {
    logger.error('Get payroll report error:', error);
    next(error);
  }
};

// @desc    Generate late/early report
// @route   GET /api/reports/late-early
// @access  Private (HR, Manager, Super Admin)
exports.getLateEarlyReport = async (req, res, next) => {
  try {
    const { month, year, department, threshold = 3 } = req.query;
    
    const reportMonth = month ? parseInt(month) : moment().month() + 1;
    const reportYear = year ? parseInt(year) : moment().year();
    const lateThreshold = parseInt(threshold);
    
    const startDate = moment(`${reportYear}-${reportMonth}`, 'YYYY-M').startOf('month').toDate();
    const endDate = moment(startDate).endOf('month').toDate();
    
    // Build user query
    const userQuery = { status: 'ACTIVE' };
    if (department) userQuery.department = department;
    
    let users;
    if (req.user.role === 'MANAGER') {
      users = await User.findTeamMembers(req.user.id);
    } else {
      users = await User.find(userQuery).select('full_name employee_id department manager_id')
        .populate('manager_id', 'full_name');
    }
    
    // Get attendance with late or early exit
    const attendance = await AttendanceLog.find({
      user_id: { $in: users.map(u => u._id) },
      date: { $gte: startDate, $lte: endDate },
      $or: [
        { status: 'LATE' },
        { status: 'EARLY_EXIT' },
        { 'computed_data.late_by_minutes': { $gt: 0 } },
        { 'computed_data.early_exit_by_minutes': { $gt: 0 } }
      ]
    }).sort({ date: 1 });
    
    // Group by user
    const userViolations = {};
    attendance.forEach(log => {
      const userId = log.user_id.toString();
      if (!userViolations[userId]) {
        userViolations[userId] = {
          late_days: [],
          early_exit_days: []
        };
      }
      
      if (log.status === 'LATE' || log.computed_data?.late_by_minutes > 0) {
        userViolations[userId].late_days.push({
          date: log.date,
          late_by: log.computed_data?.late_by_minutes || 0,
          punch_in: log.punch_in?.server_timestamp
        });
      }
      
      if (log.status === 'EARLY_EXIT' || log.computed_data?.early_exit_by_minutes > 0) {
        userViolations[userId].early_exit_days.push({
          date: log.date,
          early_by: log.computed_data?.early_exit_by_minutes || 0,
          punch_out: log.punch_out?.server_timestamp
        });
      }
    });
    
    // Prepare report data
    const reportData = users
      .map(user => {
        const violations = userViolations[user._id.toString()] || { 
          late_days: [], 
          early_exit_days: [] 
        };
        
        const totalLate = violations.late_days.length;
        const totalEarly = violations.early_exit_days.length;
        const totalViolations = totalLate + totalEarly;
        
        if (totalViolations < lateThreshold) return null;
        
        return {
          employee_id: user.employee_id,
          name: user.full_name,
          department: user.department,
          manager: user.manager_id?.full_name || 'N/A',
          late_count: totalLate,
          early_exit_count: totalEarly,
          total_violations: totalViolations,
          late_details: violations.late_days.map(d => ({
            date: moment(d.date).format('YYYY-MM-DD'),
            late_by_minutes: d.late_by,
            punch_in: d.punch_in
          })),
          early_exit_details: violations.early_exit_days.map(d => ({
            date: moment(d.date).format('YYYY-MM-DD'),
            early_by_minutes: d.early_by,
            punch_out: d.punch_out
          }))
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.total_violations - a.total_violations);
    
    // Summary
    const summary = {
      total_employees_with_violations: reportData.length,
      total_late_instances: reportData.reduce((sum, r) => sum + r.late_count, 0),
      total_early_exit_instances: reportData.reduce((sum, r) => sum + r.early_exit_count, 0),
      threshold_applied: lateThreshold
    };
    
    res.json({
      success: true,
      data: {
        month: reportMonth,
        year: reportYear,
        summary,
        violations: reportData
      }
    });
    
  } catch (error) {
    logger.error('Get late/early report error:', error);
    next(error);
  }
};

// @desc    Generate absenteeism report
// @route   GET /api/reports/absenteeism
// @access  Private (HR, Manager, Super Admin)
exports.getAbsenteeismReport = async (req, res, next) => {
  try {
    const { month, year, department } = req.query;
    
    const reportMonth = month ? parseInt(month) : moment().month() + 1;
    const reportYear = year ? parseInt(year) : moment().year();
    
    const startDate = moment(`${reportYear}-${reportMonth}`, 'YYYY-M').startOf('month').toDate();
    const endDate = moment(startDate).endOf('month').toDate();
    
    // Get users
    const userQuery = { status: 'ACTIVE' };
    if (department) userQuery.department = department;
    
    let users;
    if (req.user.role === 'MANAGER') {
      users = await User.findTeamMembers(req.user.id);
    } else {
      users = await User.find(userQuery);
    }
    
    // Get attendance
    const attendance = await AttendanceLog.find({
      user_id: { $in: users.map(u => u._id) },
      date: { $gte: startDate, $lte: endDate },
      status: 'ABSENT'
    });
    
    // Group by user
    const userAbsences = {};
    attendance.forEach(log => {
      const userId = log.user_id.toString();
      userAbsences[userId] = (userAbsences[userId] || 0) + 1;
    });
    
    // Working days in month (excluding weekends)
    const workingDays = getWorkingDaysInMonth(reportYear, reportMonth - 1);
    
    // Prepare report
    const reportData = users
      .map(user => {
        const absentDays = userAbsences[user._id.toString()] || 0;
        const attendanceRate = ((workingDays - absentDays) / workingDays) * 100;
        
        return {
          employee_id: user.employee_id,
          name: user.full_name,
          department: user.department,
          working_days: workingDays,
          absent_days: absentDays,
          attendance_rate: attendanceRate.toFixed(2),
          status: getAbsenteeismStatus(absentDays, workingDays)
        };
      })
      .sort((a, b) => b.absent_days - a.absent_days);
    
    // Summary
    const summary = {
      total_employees: reportData.length,
      working_days_in_month: workingDays,
      total_absent_days: reportData.reduce((sum, r) => sum + r.absent_days, 0),
      average_absent_days: (reportData.reduce((sum, r) => sum + r.absent_days, 0) / reportData.length).toFixed(2),
      average_attendance_rate: (reportData.reduce((sum, r) => sum + parseFloat(r.attendance_rate), 0) / reportData.length).toFixed(2),
      high_absenteeism_count: reportData.filter(r => r.status === 'HIGH').length,
      chronic_absenteeism_count: reportData.filter(r => r.status === 'CHRONIC').length
    };
    
    res.json({
      success: true,
      data: {
        month: reportMonth,
        year: reportYear,
        summary,
        employees: reportData
      }
    });
    
  } catch (error) {
    logger.error('Get absenteeism report error:', error);
    next(error);
  }
};

// Helper functions for export
async function exportToExcel(res, data, summary, filename) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Daily Attendance');
  
  // Add summary
  worksheet.addRow(['DAILY ATTENDANCE SUMMARY']);
  worksheet.addRow(['Date', filename.split('_').pop()]);
  worksheet.addRow(['Total Employees', summary.total_employees]);
  worksheet.addRow(['Present', summary.present]);
  worksheet.addRow(['Absent', summary.absent]);
  worksheet.addRow(['Late', summary.late]);
  worksheet.addRow(['Half Day', summary.half_day]);
  worksheet.addRow(['Total Work Hours', summary.total_work_hours]);
  worksheet.addRow(['Total Overtime', summary.total_overtime]);
  worksheet.addRow([]);
  
  // Add headers
  worksheet.addRow([
    'Employee ID', 'Name', 'Department', 'Status', 
    'Punch In', 'Punch Out', 'Work Hours', 
    'Late By (min)', 'Early Exit (min)', 'Overtime', 'Shift'
  ]);
  
  // Add data
  data.forEach(row => {
    worksheet.addRow([
      row.employee_id,
      row.name,
      row.department,
      row.status,
      row.punch_in ? moment(row.punch_in).format('HH:mm:ss') : '-',
      row.punch_out ? moment(row.punch_out).format('HH:mm:ss') : '-',
      row.work_hours,
      row.late_by,
      row.early_exit_by,
      row.overtime,
      row.shift
    ]);
  });
  
  // Style headers
  worksheet.getRow(10).font = { bold: true };
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
  
  await workbook.xlsx.write(res);
  res.end();
}

async function exportToPDF(res, data, summary, filename) {
  const doc = new PDFDocument();
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
  
  doc.pipe(res);
  
  // Title
  doc.fontSize(20).text('Daily Attendance Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Date: ${filename.split('_').pop()}`, { align: 'center' });
  doc.moveDown();
  
  // Summary
  doc.fontSize(14).text('Summary', { underline: true });
  doc.fontSize(10);
  doc.text(`Total Employees: ${summary.total_employees}`);
  doc.text(`Present: ${summary.present}`);
  doc.text(`Absent: ${summary.absent}`);
  doc.text(`Late: ${summary.late}`);
  doc.text(`Total Work Hours: ${summary.total_work_hours}`);
  doc.moveDown();
  
  // Table headers
  doc.fontSize(10);
  const headers = ['ID', 'Name', 'Status', 'Work Hours', 'Overtime'];
  const colWidths = [60, 120, 70, 70, 70];
  let y = doc.y;
  
  headers.forEach((header, i) => {
    doc.text(header, 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y);
  });
  
  y += 20;
  
  // Table rows
  data.slice(0, 30).forEach(row => {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    
    doc.text(row.employee_id || '', 50, y);
    doc.text(row.name || '', 110, y);
    doc.text(row.status || '', 230, y);
    doc.text(row.work_hours || '0', 300, y);
    doc.text(row.overtime || '0', 370, y);
    
    y += 20;
  });
  
  doc.end();
}

function maskAccountNumber(accountNumber) {
  if (!accountNumber) return null;
  const last4 = accountNumber.slice(-4);
  return 'X'.repeat(accountNumber.length - 4) + last4;
}

function getWorkingDaysInMonth(year, month) {
  let workingDays = 0;
  const daysInMonth = moment(`${year}-${month + 1}`, 'YYYY-M').daysInMonth();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = moment(`${year}-${month + 1}-${day}`, 'YYYY-M-D');
    const dayOfWeek = date.day();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
      workingDays++;
    }
  }
  
  return workingDays;
}

function getAbsenteeismStatus(absentDays, workingDays) {
  const percentage = (absentDays / workingDays) * 100;
  if (percentage >= 20) return 'CHRONIC';
  if (percentage >= 10) return 'HIGH';
  if (percentage >= 5) return 'MODERATE';
  return 'LOW';
}