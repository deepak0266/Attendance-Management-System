import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { attendanceService } from '../../services/attendance';
import { FaChartLine, FaChartBar } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
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

const AttendanceChart = ({ userId, period: initialPeriod = 'month' }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('line');
  const [period, setPeriod] = useState(initialPeriod);
  const [stats, setStats] = useState({
    averageHours: 0,
    totalHours: 0,
    totalOvertime: 0,
    attendanceRate: 0
  });

  useEffect(() => {
    fetchChartData();
  }, [userId, period]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const data = await attendanceService.getChartData({ userId, period });
      
      const labels = data.map(d => moment(d.date).format('DD/MM'));
      const hours = data.map(d => d.hours_worked || 0);
      const expectedHours = data.map(d => d.expected_hours || 8);
      const overtime = data.map(d => d.overtime_minutes / 60 || 0);
      
      setChartData({
        labels,
        datasets: [
          {
            label: 'Hours Worked',
            data: hours,
            borderColor: 'rgb(102, 126, 234)',
            backgroundColor: chartType === 'line' 
              ? 'rgba(102, 126, 234, 0.1)' 
              : 'rgba(102, 126, 234, 0.7)',
            fill: chartType === 'line',
            tension: 0.4
          },
          {
            label: 'Expected Hours',
            data: expectedHours,
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderDash: [5, 5],
            tension: 0.4
          },
          ...(chartType === 'line' ? [{
            label: 'Overtime',
            data: overtime,
            borderColor: 'rgb(245, 158, 11)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.4
          }] : [])
        ]
      });

      // Calculate stats
      const totalHours = hours.reduce((a, b) => a + b, 0);
      const totalOvertime = overtime.reduce((a, b) => a + b, 0);
      const avgHours = hours.length > 0 ? totalHours / hours.length : 0;
      const presentDays = data.filter(d => d.status === 'PRESENT').length;
      const attendanceRate = data.length > 0 ? (presentDays / data.length) * 100 : 0;

      setStats({
        averageHours: avgHours.toFixed(1),
        totalHours: totalHours.toFixed(1),
        totalOvertime: totalOvertime.toFixed(1),
        attendanceRate: attendanceRate.toFixed(1)
      });
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg'),
        titleColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
        bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color'),
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--border-color'),
          drawBorder: false
        },
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
        }
      },
      y: {
        grid: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--border-color'),
          drawBorder: false
        },
        ticks: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
        },
        title: {
          display: true,
          text: 'Hours',
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
        },
        beginAtZero: true
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="d-flex justify-center align-center" style={{ height: '300px' }}>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="attendance-chart card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="card-header">
        <h3>Attendance Trend</h3>
        <div className="chart-controls">
          <div className="period-selector">
            <button 
              className={`btn-sm ${period === 'week' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod('week')}
            >
              Week
            </button>
            <button 
              className={`btn-sm ${period === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod('month')}
            >
              Month
            </button>
          </div>
          
          <div className="chart-type-selector">
            <button 
              className={`btn-icon ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
              title="Line Chart"
            >
              <FaChartLine />
            </button>
            <button 
              className={`btn-icon ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
              title="Bar Chart"
            >
              <FaChartBar />
            </button>
          </div>
        </div>
      </div>

      <div className="chart-container-lg">
        {chartData && (
          chartType === 'line' 
            ? <Line data={chartData} options={options} />
            : <Bar data={chartData} options={options} />
        )}
      </div>

      <div className="chart-stats">
        <div className="stat-item">
          <p className="stat-label">Average Hours/Day</p>
          <h4>{stats.averageHours}h</h4>
        </div>
        <div className="stat-item">
          <p className="stat-label">Total Hours</p>
          <h4>{stats.totalHours}h</h4>
        </div>
        <div className="stat-item">
          <p className="stat-label">Total Overtime</p>
          <h4 className="text-warning">{stats.totalOvertime}h</h4>
        </div>
        <div className="stat-item">
          <p className="stat-label">Attendance Rate</p>
          <h4 className="text-success">{stats.attendanceRate}%</h4>
        </div>
      </div>

      <style jsx>{`
        .chart-controls {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .period-selector {
          display: flex;
          gap: 5px;
        }

        .chart-type-selector {
          display: flex;
          gap: 5px;
        }

        .btn-icon {
          width: 36px;
          height: 36px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }

        .btn-icon.active {
          background: var(--primary-gradient);
          color: white;
          border-color: transparent;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .chart-container-lg {
          height: 300px;
          margin-top: 10px;
        }

        .chart-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--border-color);
        }

        .stat-item {
          text-align: center;
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 13px;
          margin-bottom: 5px;
        }

        .stat-item h4 {
          font-size: 24px;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .card-header {
            flex-direction: column;
            gap: 15px;
          }

          .chart-controls {
            width: 100%;
            justify-content: space-between;
          }

          .chart-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 576px) {
          .chart-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default AttendanceChart;