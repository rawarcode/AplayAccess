import React, { useState, useEffect } from 'react';
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
import { getBookingsChart } from '../../lib/ownerApi';

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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EMPTY_DATA = {
  labels: MONTH_NAMES,
  datasets: [{
    label: 'Revenue',
    data: Array(12).fill(0),
    borderColor: 'rgb(59, 130, 246)',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    tension: 0.4,
    fill: false,
    pointBackgroundColor: 'rgb(59, 130, 246)',
    pointBorderColor: 'rgb(59, 130, 246)',
    pointRadius: 4,
  }],
};

function buildChartData(rawData) {
  const byMonth = {};

  rawData.forEach((item) => {
    const d   = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    if (!byMonth[key]) {
      byMonth[key] = { label: MONTH_NAMES[d.getMonth()], revenue: 0, sort: key };
    }
    byMonth[key].revenue += parseFloat(item.revenue || 0);
  });

  const sorted = Object.values(byMonth).sort((a, b) => a.sort.localeCompare(b.sort));

  return {
    labels: sorted.map((m) => m.label),
    datasets: [{
      label: 'Revenue',
      data: sorted.map((m) => m.revenue),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: false,
      pointBackgroundColor: 'rgb(59, 130, 246)',
      pointBorderColor: 'rgb(59, 130, 246)',
      pointRadius: 4,
    }],
  };
}

const RevenueChart = () => {
  const [timeframe, setTimeframe] = useState('year');
  const [chartData, setChartData] = useState(EMPTY_DATA);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const days = timeframe === 'year' ? 365 : timeframe === 'last-year' ? 730 : 0;
    setLoading(true);

    getBookingsChart(days)
      .then((data) => setChartData(data.length ? buildChartData(data) : EMPTY_DATA))
      .catch(() => setChartData(EMPTY_DATA))
      .finally(() => setLoading(false));
  }, [timeframe]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => '₱' + ctx.parsed.y.toLocaleString(),
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => {
            if (value === 0) return '₱0K';
            return '₱' + (value / 1000).toFixed(0) + 'K';
          },
        },
      },
      x: {
        grid: { display: true, color: 'rgba(0,0,0,0.05)' },
      },
    },
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
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
            Loading chart...
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
    </div>
  );
};

export default RevenueChart;
