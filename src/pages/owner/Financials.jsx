import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import { Line } from 'react-chartjs-2';
import { getOverview, getBookingsChart } from '../../lib/ownerApi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' } },
};

const Financials = () => {
  const [overview, setOverview]   = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [chartDays, setChartDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([getOverview(), getBookingsChart(chartDays)])
      .then(([o, c]) => { setOverview(o); setChartData(c); })
      .catch(() => setError('Failed to load financial data.'))
      .finally(() => setLoading(false));
  }, [chartDays]);

  if (loading) return <MainLayout pageTitle="Financial Reports"><div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Loading...</div></MainLayout>;
  if (error)   return <MainLayout pageTitle="Financial Reports"><div style={{ textAlign: 'center', padding: '3rem', color: '#e53e3e' }}>{error}</div></MainLayout>;

  const revenuePct = overview.revenue_last_month
    ? Math.round(((overview.revenue_this_month - overview.revenue_last_month) / overview.revenue_last_month) * 100)
    : null;
  const bookingsDiff = overview.bookings_this_month - overview.bookings_last_month;

  const revenueLineData = {
    labels: chartData.map(d => d.date),
    datasets: [{
      label: 'Revenue (₱)',
      data: chartData.map(d => Number(d.revenue || 0)),
      borderColor: 'rgba(59, 130, 246, 0.8)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3,
      fill: true,
    }],
  };

  const bookingsLineData = {
    labels: chartData.map(d => d.date),
    datasets: [{
      label: 'Bookings',
      data: chartData.map(d => Number(d.bookings || 0)),
      borderColor: 'rgba(16, 185, 129, 0.8)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.3,
      fill: true,
    }],
  };

  return (
    <MainLayout pageTitle="Financial Reports">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Financial Reports</h2>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-blue-800">Revenue Summary</h3>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">This Month</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">This Month</span>
                <span className="text-sm font-medium">{fmt(overview.revenue_this_month)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Last Month</span>
                <span className="text-sm font-medium">{fmt(overview.revenue_last_month)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span className="font-medium">Change</span>
                <span className={`font-bold ${revenuePct === null ? 'text-gray-500' : revenuePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {revenuePct === null ? 'N/A' : `${revenuePct >= 0 ? '+' : ''}${revenuePct}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-green-800">Bookings Summary</h3>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">This Month</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">This Month</span>
                <span className="text-sm font-medium">{overview.bookings_this_month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Last Month</span>
                <span className="text-sm font-medium">{overview.bookings_last_month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Confirmed</span>
                <span className="text-sm font-medium">{overview.confirmed_bookings}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span className="font-medium">Change</span>
                <span className={`font-bold ${bookingsDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {bookingsDiff >= 0 ? '+' : ''}{bookingsDiff}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-purple-800">Guest Summary</h3>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">All Time</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Total Guests</span>
                <span className="text-sm font-medium">{overview.total_guests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Pending Bookings</span>
                <span className="text-sm font-medium">{overview.pending_bookings}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span className="font-medium">Total Bookings</span>
                <span className="font-bold text-purple-700">{overview.total_bookings}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex justify-end mb-4">
          <select
            value={chartDays}
            onChange={e => setChartDays(Number(e.target.value))}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Daily Revenue</h2>
            <div className="h-64">
              {chartData.length > 0
                ? <Line data={revenueLineData} options={lineOptions} />
                : <p className="text-gray-400 text-center pt-20">No revenue data for this period.</p>
              }
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Daily Bookings</h2>
            <div className="h-64">
              {chartData.length > 0
                ? <Line data={bookingsLineData} options={lineOptions} />
                : <p className="text-gray-400 text-center pt-20">No booking data for this period.</p>
              }
            </div>
          </div>
        </div>

        {/* Daily Breakdown Table */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium">Daily Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[...chartData].reverse().map((row, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.bookings}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{fmt(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Financials;
