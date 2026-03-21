import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import { Pie } from 'react-chartjs-2';
import { getRecentBookings, getOverview } from '../../lib/ownerApi';

const fmt = (v) => `₱${Number(v || 0).toLocaleString('en-PH')}`;

const PIE_COLORS = [
  'rgba(59, 130, 246, 0.8)',
  'rgba(16, 185, 129, 0.8)',
  'rgba(251, 191, 36, 0.8)',
  'rgba(139, 92, 246, 0.8)',
  'rgba(236, 72, 153, 0.8)',
];

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
};

const Transactions = () => {
  const [bookings, setBookings]   = useState([]);
  const [overview, setOverview]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch]       = useState('');
  const [searchField, setSearchField] = useState('guest');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');

  const itemsPerPage = 5;

  useEffect(() => {
    Promise.all([getRecentBookings(), getOverview()])
      .then(([b, o]) => { setBookings(b); setOverview(o); })
      .catch(() => setError('Failed to load transaction data.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = bookings.filter((b) => {
    const val = search.toLowerCase();
    let matchesSearch = true;
    if (val) {
      if (searchField === 'guest')   matchesSearch = b.guest?.toLowerCase().includes(val);
      if (searchField === 'id')      matchesSearch = `res-${String(b.booking_id).padStart(6,'0')}`.includes(val);
      if (searchField === 'room')    matchesSearch = b.roomType?.toLowerCase().includes(val);
      if (searchField === 'payment') matchesSearch = b.paymentMethod?.toLowerCase().includes(val);
    }
    let matchesDate = true;
    if (dateFrom) matchesDate = matchesDate && new Date(b.checkIn) >= new Date(dateFrom);
    if (dateTo)   matchesDate = matchesDate && new Date(b.checkIn) <= new Date(dateTo + 'T23:59:59');
    return matchesSearch && matchesDate;
  });

  const totalPages   = Math.ceil(filtered.length / itemsPerPage);
  const indexOfFirst = (currentPage - 1) * itemsPerPage;
  const currentRows  = filtered.slice(indexOfFirst, indexOfFirst + itemsPerPage);

  const statusCounts = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});
  const statusLabels = Object.keys(statusCounts);
  const statusChartData = {
    labels: statusLabels,
    datasets: [{ data: statusLabels.map(l => statusCounts[l]), backgroundColor: PIE_COLORS }],
  };

  const paymentCounts = bookings.reduce((acc, b) => {
    const m = b.paymentMethod || 'Unknown';
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});
  const paymentLabels = Object.keys(paymentCounts);
  const paymentChartData = {
    labels: paymentLabels,
    datasets: [{ data: paymentLabels.map(l => paymentCounts[l]), backgroundColor: PIE_COLORS }],
  };

  const nonCancelled = bookings.filter(b => b.status !== 'Cancelled');
  const totalRevenue = nonCancelled.reduce((s, b) => s + Number(b.total || 0), 0);
  const avgTx        = nonCancelled.length ? totalRevenue / nonCancelled.length : 0;

  if (loading) return <MainLayout pageTitle="Transaction Records"><div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Loading...</div></MainLayout>;
  if (error)   return <MainLayout pageTitle="Transaction Records"><div style={{ textAlign: 'center', padding: '3rem', color: '#e53e3e' }}>{error}</div></MainLayout>;

  return (
    <MainLayout pageTitle="Transaction Records">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Transaction Records</h2>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Bookings</p>
                <h3 className="text-2xl font-bold">{bookings.length}</h3>
              </div>
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-exchange-alt text-xl"></i>
              </div>
            </div>
            {overview && (
              <div className="mt-2">
                <span className="text-xs text-green-500">
                  <i className="fas fa-arrow-up mr-1"></i>
                  {overview.bookings_this_month} this month
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <h3 className="text-2xl font-bold">{fmt(totalRevenue)}</h3>
              </div>
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <i className="fas fa-money-bill-wave text-xl"></i>
              </div>
            </div>
            {overview && (
              <div className="mt-2">
                <span className="text-xs text-green-500">
                  <i className="fas fa-arrow-up mr-1"></i>
                  {fmt(overview.revenue_this_month)} this month
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg. Transaction</p>
                <h3 className="text-2xl font-bold">{fmt(Math.round(avgTx))}</h3>
              </div>
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <i className="fas fa-calculator text-xl"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Transactions</label>
              <div className="flex space-x-2">
                <select
                  value={searchField}
                  onChange={e => { setSearchField(e.target.value); setCurrentPage(1); }}
                  className="border border-gray-200 rounded px-3 py-2"
                >
                  <option value="guest">Guest Name</option>
                  <option value="id">Booking ID</option>
                  <option value="room">Room Type</option>
                  <option value="payment">Payment Method</option>
                </select>
                <input
                  type="text"
                  placeholder="Enter search term..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="border border-gray-200 rounded px-3 py-2 flex-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range (Check-in)</label>
              <div className="flex space-x-2">
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }} className="border border-gray-200 rounded px-3 py-2" />
                <span className="flex items-center">to</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }} className="border border-gray-200 rounded px-3 py-2" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">No transactions found.</td>
                </tr>
              ) : currentRows.map((b) => {
                const statusColor =
                  b.status === 'Confirmed'  ? 'bg-green-100 text-green-800' :
                  b.status === 'Completed'  ? 'bg-blue-100 text-blue-800'  :
                  b.status === 'Cancelled'  ? 'bg-red-100 text-red-800'    :
                                              'bg-yellow-100 text-yellow-800';
                return (
                  <tr key={b.booking_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      RES-{String(b.booking_id).padStart(6, '0')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{b.checkIn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.guest}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{b.roomType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{b.paymentMethod || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmt(b.total)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{filtered.length === 0 ? 0 : indexOfFirst + 1}</span> to{' '}
            <span className="font-medium">{Math.min(indexOfFirst + itemsPerPage, filtered.length)}</span> of{' '}
            <span className="font-medium">{filtered.length}</span> results
          </p>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-200 bg-white text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className="z-10 bg-blue-50 border-blue-500 text-blue-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium">
              {currentPage} / {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-200 bg-white text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </nav>
        </div>

        {/* Charts */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Bookings by Status</h2>
            <div className="h-64">
              {statusLabels.length > 0
                ? <Pie data={statusChartData} options={pieOptions} />
                : <p className="text-gray-400 text-center pt-20">No data yet.</p>
              }
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Methods</h2>
            <div className="h-64">
              {paymentLabels.length > 0
                ? <Pie data={paymentChartData} options={pieOptions} />
                : <p className="text-gray-400 text-center pt-20">No payment data yet.</p>
              }
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Transactions;
