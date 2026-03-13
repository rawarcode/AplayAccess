import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RevenueChart = ({ data }) => {
  const [timeframe, setTimeframe] = useState('year');

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return '₱' + context.parsed.y.toLocaleString();
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1600000,
        ticks: {
          stepSize: 200000,
          callback: function(value) {
            if (value === 0) return '₱0K';
            return '₱' + (value / 1000) + 'K';
          }
        }
      },
      x: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        }
      }
    }
  };

  return (
    <div className="revenue-chart">
      <div className="revenue-chart-header">
        <h2 className="revenue-chart-title">Monthly Revenue Trend</h2>
        <select
          className="revenue-chart-select"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
        >
          <option value="year">This Year</option>
          <option value="last-year">Last Year</option>
          <option value="all">All Time</option>
        </select>
      </div>
      <div className="revenue-chart-container">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default RevenueChart;
