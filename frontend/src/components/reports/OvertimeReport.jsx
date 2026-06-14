import React, { useState, useEffect } from 'react';
import { 
  FaClock, FaDownload, FaSearch, FaChartBar, 
  FaExclamationTriangle, FaFilter, FaUser 
} from 'react-icons/fa';
import { Bar } from 'react-chartjs-2';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import moment from 'moment';

const OvertimeReport = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [filters, setFilters] = useState({
    month: moment().month() + 1,
    year: moment().year(),
    department: '',
    min_hours: 0
  });
  const [departments, setDepartments] = useState([]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => moment().year() - 2 + i);

  useEffect(() => {
    fetchDepartments();
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
        department: filters.department || undefined,
        min_hours: filters.min_hours
      };
      const response = await apiService.reports.getOvertime(params);
      setReportData(response.data.data);
      prepareChartData(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = (data) => {
    if (!data?.overtime_details) return;

    const topOvertime = data.overtime_details.slice(0, 10);

    setChartData({
      labels: topOvertime.map(e => e.name.split(' ')[0]),
      datasets: [{
        label: 'Overtime Hours',
        data: topOvertime.map(e => parseFloat(e.overtime_hours) || 0),
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
        borderColor: 'rgb(245, 158, 11)',
        borderWidth: 1
      }]
    });
  };

  const handleExport = async (format = 'excel') => {
    try {
      const params = {
        month: filters.month,
        year: filters.year,
        department: filters.department || undefined,
        min_hours: filters.min_hours,
        export_format: format
      };
      
      const response = await apiService.reports.getOvertime(params);
      
      // Create export data
      const exportData = response.data.data.overtime_details.map(emp => ({
        'Employee ID': emp.employee_id,
        'Name': emp.name,
        'Department': emp.department,
        'Overtime Days': emp.overtime_days,
        'Overtime Hours': emp.overtime_hours,
        'Average Hours/Day': emp.average_hours_per_day
      }));
      
      // Create and download CSV
      const csv = convertToCSV(exportData);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `overtime_report_${filters.year}_${filters.month}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const convertToCSV = (data) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]).join(','));
    return [headers.join(','), ...rows].join('\n');
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

  const getOvertimeClass = (hours) => {
    if (hours >= 20) return 'text-danger';
    if (hours >= 10) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="overtime-report">
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
            <label className="form-label">Min Overtime Hours</label>
            <input
              type="number"
              className="form-control"
              value={filters.min_hours}
              onChange={(e) => setFilters(prev => ({ ...prev, min_hours: parseFloat(e.target.value) || 0 }))}
              min="0"
              step="0.5"
              style={{ width: '100px' }}
            />
          </div>
          
          <div className="form-group">
            <button className="btn btn-primary" onClick={fetchReport}>
              <FaSearch /> Generate
            </button>
            <button className="btn btn-secondary ml-1" onClick={() => handleExport('csv')}>
              <FaDownload /> Export CSV
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
          {/* Summary Cards */}
          <div className="grid grid-3 mb-2">
            <div className="card stat-card">
              <FaUser className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.total_employees_with_overtime}</h3>
                <p>Employees with Overtime</p>
              </div>
            </div>
            
            <div className="card stat-card warning">
              <FaClock className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.total_overtime_hours}h</h3>
                <p>Total Overtime Hours</p>
              </div>
            </div>
            
            <div className="card stat-card info">
              <FaChartBar className="stat-icon" />
              <div className="stat-content">
                <h3>{reportData.summary.average_overtime}h</h3>
                <p>Average Overtime/Employee</p>
              </div>
            </div>
          </div>

          {/* Alert for high overtime */}
          {reportData.summary.max_overtime_hours > 20 && (
            <div className="alert alert-warning mb-2">
              <FaExclamationTriangle className="mr-2" />
              <strong>High Overtime Alert:</strong> Some employees have worked more than 20 hours of overtime this month.
            </div>
          )}

          {/* Chart */}
          {chartData && (
            <div className="card mb-2">
              <h3 className="mb-2">Top 10 Employees - Overtime Hours</h3>
              <div className="chart-container-lg">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          )}

          {/* Overtime Details Table */}
          <div className="card">
            <h3 className="mb-2">Overtime Details - {months[filters.month - 1]} {filters.year}</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Overtime Days</th>
                    <th>Overtime Hours</th>
                    <th>Avg Hours/Day</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.overtime_details.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-3 text-secondary">
                        No overtime records found
                      </td>
                    </tr>
                  ) : (
                    reportData.overtime_details.map((emp, idx) => {
                      const hours = parseFloat(emp.overtime_hours);
                      return (
                        <tr key={idx}>
                          <td>{emp.employee_id}</td>
                          <td>{emp.name}</td>
                          <td>{emp.department}</td>
                          <td>{emp.overtime_days}</td>
                          <td>
                            <span className={getOvertimeClass(hours)}>
                              {emp.overtime_hours}
                            </span>
                          </td>
                          <td>{emp.average_hours_per_day}</td>
                          <td>
                            {hours >= 20 ? (
                              <span className="badge badge-danger">High</span>
                            ) : hours >= 10 ? (
                              <span className="badge badge-warning">Medium</span>
                            ) : (
                              <span className="badge badge-success">Normal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed View Toggle */}
          {reportData.overtime_details.length > 0 && (
            <div className="card mt-2">
              <h4 className="mb-2">Day-wise Breakdown</h4>
              {reportData.overtime_details.slice(0, 5).map(emp => (
                <div key={emp.employee_id} className="breakdown-item mb-2">
                  <p className="font-medium">{emp.name} ({emp.employee_id})</p>
                  <div className="breakdown-days">
                    {emp.details?.slice(0, 10).map((day, i) => (
                      <span key={i} className="day-badge">
                        {moment(day.date).format('DD/MM')}: {Math.round(day.minutes / 60 * 10) / 10}h
                      </span>
                    ))}
                    {emp.details?.length > 10 && (
                      <span className="day-badge">+{emp.details.length - 10} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <div className="empty-state py-4">
            <FaClock size={50} className="text-tertiary mb-2" />
            <p>Select filters and click Generate to view overtime report</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .stat-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
        }
        
        .stat-icon {
          font-size: 36px;
          color: #667eea;
        }
        
        .stat-card.warning .stat-icon {
          color: var(--warning-color);
        }
        
        .stat-card.info .stat-icon {
          color: var(--info-color);
        }
        
        .stat-content h3 {
          font-size: 32px;
          font-weight: 700;
        }
        
        .stat-content p {
          color: var(--text-secondary);
        }
        
        .chart-container-lg {
          height: 350px;
        }
        
        .breakdown-item {
          padding: 15px;
          background: var(--bg-secondary);
          border-radius: 10px;
        }
        
        .breakdown-days {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        
        .day-badge {
          padding: 4px 10px;
          background: var(--bg-tertiary);
          border-radius: 5px;
          font-size: 12px;
        }
        
        .ml-1 {
          margin-left: 5px;
        }
        
        .mr-2 {
          margin-right: 8px;
        }
        
        .mb-2 {
          margin-bottom: 15px;
        }
        
        .mt-2 {
          margin-top: 15px;
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
      `}</style>
    </div>
  );
};

export default OvertimeReport;