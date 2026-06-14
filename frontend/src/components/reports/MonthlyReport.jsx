import React, { useState, useEffect } from 'react';
import { 
  FaCalendar, FaDownload, FaSearch, FaUsers, FaClock, 
  FaChartBar, FaChartLine, FaCheckCircle, FaTimesCircle 
} from 'react-icons/fa';
import { Bar, Line } from 'react-chartjs-2';
import { apiService } from '../../services/api';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
);

const MonthlyReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [filters, setFilters] = useState({
    month: moment().month() + 1,
    year: moment().year(),
    department: ''
  });
  const [departments, setDepartments] = useState([]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => moment().year() - 2 + i);

  useEffect(() => {
    fetchDepartments();
    fetchReport();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await apiService.users.getStats();
      const depts = Object.keys(response.data.data?.by_department || {});
      setDepartments(depts);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        month: filters.month,
        year: filters.year,
        department: filters.department || undefined
      };
      const response = await apiService.reports.getMonthly(params);
      setReportData(response.data.data);
      prepareChartData(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = (data) => {
    if (!data?.employees) return;

    const topEmployees = data.employees
      .sort((a, b) => parseFloat(b.total_work_hours) - parseFloat(a.total_work_hours))
      .slice(0, 10);

    setChartData({
      labels: topEmployees.map(e => e.name.split(' ')[0]),
      datasets: [
        {
          label: 'Work Hours',
          data: topEmployees.map(e => parseFloat(e.total_work_hours) || 0),
          backgroundColor: 'rgba(102, 126, 234, 0.7)',
          borderColor: 'rgb(102, 126, 234)',
          borderWidth: 1
        },
        {
          label: 'Overtime Hours',
          data: topEmployees.map(e => parseFloat(e.total_overtime_hours) || 0),
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderColor: 'rgb(245, 158, 11)',
          borderWidth: 1
        }
      ]
    });
  };

  const handleExport = async (format = 'excel') => {
    try {
      const params = {
        month: filters.month,
        year: filters.year,
        department: filters.department || undefined,
        export_format: format
      };
      
      const response = await apiService.reports.exportMonthly(params);
      
      const blob = new Blob([response.data], { 
        type: format === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'application/pdf'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monthly_report_${filters.year}_${filters.month}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
        }
      },
      tooltip: {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg'),
        titleColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
        bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
      }
    },
    scales: {
      x: {
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
        },
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
        }
      },
      y: {
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
        },
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
        },
        title: {
          display: true,
          text: 'Hours',
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
        }
      }
    }
  };

  return (
    <div className="monthly-report">
      {/* Filters */}
      <div className="card mb-2">
        <div className="d-flex flex-wrap gap-2 align-end">
          <div className="form-group">
            <label className="form-label">Month</label>
            <select
              className="form-control"
              value={filters.month}
              onChange={(e) => setFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
            >
              {months.map((month, idx) => (
                <option key={idx + 1} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Year</label>
            <select
              className="form-control"
              value={filters.year}
              onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Department</label>
            <select
              className="form-control"
              value={filters.department}
              onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <button className="btn btn-primary" onClick={fetchReport}>
              <FaSearch /> Generate
            </button>
            <button className="btn btn-secondary ml-1" onClick={() => handleExport('excel')}>
              <FaDownload /> Excel
            </button>
            <button className="btn btn-secondary ml-1" onClick={() => handleExport('pdf')}>
              <FaDownload /> PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="text-center py-4">
            <LoadingSpinner />
          </div>
        </div>
      ) : reportData ? (
        <>
          {/* Overall Summary */}
          <div className="card mb-2">
            <h3 className="mb-2">Overall Summary - {months[filters.month - 1]} {filters.year}</h3>
            <div className="grid grid-4">
              <div className="stat-item">
                <FaUsers className="stat-icon" />
                <div>
                  <h4>{reportData.overall_summary.total_employees}</h4>
                  <p>Total Employees</p>
                </div>
              </div>
              
              <div className="stat-item">
                <FaCheckCircle className="stat-icon text-success" />
                <div>
                  <h4>{reportData.overall_summary.total_present_days}</h4>
                  <p>Total Present Days</p>
                </div>
              </div>
              
              <div className="stat-item">
                <FaTimesCircle className="stat-icon text-danger" />
                <div>
                  <h4>{reportData.overall_summary.total_absent_days}</h4>
                  <p>Total Absent Days</p>
                </div>
              </div>
              
              <div className="stat-item">
                <FaChartLine className="stat-icon text-info" />
                <div>
                  <h4>{reportData.overall_summary.average_attendance_percentage}%</h4>
                  <p>Avg Attendance Rate</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-4 mt-2">
              <div className="stat-item">
                <FaClock className="stat-icon" />
                <div>
                  <h4>{reportData.overall_summary.total_work_hours}h</h4>
                  <p>Total Work Hours</p>
                </div>
              </div>
              
              <div className="stat-item">
                <FaClock className="stat-icon text-warning" />
                <div>
                  <h4>{reportData.overall_summary.total_overtime_hours}h</h4>
                  <p>Total Overtime</p>
                </div>
              </div>
              
              <div className="stat-item">
                <FaClock className="stat-icon text-info" />
                <div>
                  <h4>{reportData.overall_summary.average_work_hours}h</h4>
                  <p>Avg Hours/Employee</p>
                </div>
              </div>
              
              <div className="stat-item">
                <FaChartBar className="stat-icon" />
                <div>
                  <h4>{reportData.overall_summary.total_late_days}</h4>
                  <p>Total Late Days</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          {chartData && (
            <div className="card mb-2">
              <h3 className="mb-2">Top 10 Employees - Work Hours</h3>
              <div className="chart-container-lg">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          )}

          {/* Employee Table */}
          <div className="card">
            <h3 className="mb-2">Employee Details</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Manager</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Half Days</th>
                    <th>Late</th>
                    <th>Work Hours</th>
                    <th>Overtime</th>
                    <th>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.employees.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="text-center py-3 text-secondary">
                        No data found
                      </td>
                    </tr>
                  ) : (
                    reportData.employees.map((emp, idx) => (
                      <tr key={idx}>
                        <td>{emp.employee_id}</td>
                        <td>{emp.name}</td>
                        <td>{emp.department}</td>
                        <td>{emp.manager}</td>
                        <td>{emp.present_days}</td>
                        <td>{emp.absent_days}</td>
                        <td>{emp.half_days}</td>
                        <td>{emp.late_days}</td>
                        <td>{emp.total_work_hours}</td>
                        <td>
                          <span className={parseFloat(emp.total_overtime_hours) > 0 ? 'text-warning' : ''}>
                            {emp.total_overtime_hours}
                          </span>
                        </td>
                        <td>
                          <span className={parseFloat(emp.attendance_percentage) >= 90 ? 'text-success' : parseFloat(emp.attendance_percentage) >= 75 ? 'text-warning' : 'text-danger'}>
                            {emp.attendance_percentage}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="empty-state py-4">
            <FaCalendar size={50} className="text-tertiary mb-2" />
            <p>Select month and year to generate the report</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .stat-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px;
          background: var(--bg-secondary);
          border-radius: 10px;
        }
        
        .stat-icon {
          font-size: 28px;
          color: #667eea;
        }
        
        .stat-item h4 {
          font-size: 24px;
          font-weight: 700;
        }
        
        .stat-item p {
          color: var(--text-secondary);
          font-size: 13px;
        }
        
        .chart-container-lg {
          height: 350px;
        }
        
        .ml-1 {
          margin-left: 5px;
        }
        
        .mt-2 {
          margin-top: 15px;
        }
        
        .mb-2 {
          margin-bottom: 15px;
        }
        
        .align-end {
          align-items: flex-end;
        }
        
        .text-success {
          color: var(--success-color);
        }
        
        .text-danger {
          color: var(--danger-color);
        }
        
        .text-warning {
          color: var(--warning-color);
        }
        
        .text-info {
          color: var(--info-color);
        }
      `}</style>
    </div>
  );
};

export default MonthlyReport;