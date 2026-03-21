import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Layout/Sidebar';
import Chart from 'chart.js/auto';

const Reports = () => {
  const [fullReportModalOpen, setFullReportModalOpen] = useState(false);
  const [allTransactionsModalOpen, setAllTransactionsModalOpen] = useState(false);
  
  const dailyChartRef = useRef(null);
  const dailyChartInstance = useRef(null);
  const fullChartRef = useRef(null);
  const fullChartInstance = useRef(null);

  useEffect(() => {
    if (dailyChartRef.current) {
      if (dailyChartInstance.current) {
        dailyChartInstance.current.destroy();
      }
      
      dailyChartInstance.current = new Chart(dailyChartRef.current, {
        type: 'bar',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Occupancy %',
            data: [65, 59, 80, 81, 56, 95, 100],
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              max: 100
            }
          }
        }
      });
    }
  }, []);

  useEffect(() => {
    // Initialize full report chart when modal opens
    if (fullReportModalOpen && fullChartRef.current) {
      if (fullChartInstance.current) {
        fullChartInstance.current.destroy();
      }
      
      fullChartInstance.current = new Chart(fullChartRef.current, {
        type: 'line',
        data: {
          labels: ['Jul 17', 'Jul 18', 'Jul 19', 'Jul 20', 'Jul 21', 'Jul 22', 'Jul 23'],
          datasets: [{
            label: 'Occupancy %',
            data: [65, 59, 80, 81, 56, 95, 100],
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              max: 100
            }
          }
        }
      });
    }
  }, [fullReportModalOpen]);

  const openFullReportModal = () => setFullReportModalOpen(true);
  const closeFullReportModal = () => setFullReportModalOpen(false);
  const openAllTransactionsModal = () => setAllTransactionsModalOpen(true);
  const closeAllTransactionsModal = () => setAllTransactionsModalOpen(false);

  // Close modals when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fullReportModalOpen && event.target === document.querySelector('.modal')) {
        closeFullReportModal();
      }
      if (allTransactionsModalOpen && event.target === document.querySelector('.modal')) {
        closeAllTransactionsModal();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [fullReportModalOpen, allTransactionsModalOpen]);

  return (
    <Sidebar>
      {/* Full Report Modal */}
      {fullReportModalOpen && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-4/5 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Full Occupancy Report</h3>
              <button onClick={closeFullReportModal} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <div>
                  <label htmlFor="reportDateRange" className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <select id="reportDateRange" className="border rounded p-2">
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                    <option>This month</option>
                    <option>Last month</option>
                    <option>Custom range</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <select id="reportType" className="border rounded p-2">
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="h-96 mb-4">
              <canvas ref={fullChartRef}></canvas>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Date</th>
                    <th className="text-right py-2">Occupancy %</th>
                    <th className="text-right py-2">Total Rooms</th>
                    <th className="text-right py-2">Occupied</th>
                    <th className="text-right py-2">Available</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3">Mon, Jul 17</td>
                    <td className="py-3 text-right">65%</td>
                    <td className="py-3 text-right">50</td>
                    <td className="py-3 text-right">32</td>
                    <td className="py-3 text-right">18</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">Tue, Jul 18</td>
                    <td className="py-3 text-right">59%</td>
                    <td className="py-3 text-right">50</td>
                    <td className="py-3 text-right">29</td>
                    <td className="py-3 text-right">21</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">Wed, Jul 19</td>
                    <td className="py-3 text-right">80%</td>
                    <td className="py-3 text-right">50</td>
                    <td className="py-3 text-right">40</td>
                    <td className="py-3 text-right">10</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">Thu, Jul 20</td>
                    <td className="py-3 text-right">81%</td>
                    <td className="py-3 text-right">50</td>
                    <td className="py-3 text-right">40</td>
                    <td className="py-3 text-right">9</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Export Report</button>
            </div>
          </div>
        </div>
      )}

      {/* All Transactions Modal */}
      {allTransactionsModalOpen && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white p-6 rounded-lg w-4/5 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">All Guest Transactions</h3>
              <button onClick={closeAllTransactionsModal} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <div>
                  <label htmlFor="transactionsDate" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" id="transactionsDate" className="border rounded p-2" defaultValue="2023-07-20" />
                </div>
                <div>
                  <label htmlFor="transactionsFilter" className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
                  <select id="transactionsFilter" className="border rounded p-2">
                    <option>All Transactions</option>
                    <option>Check-ins Only</option>
                    <option>Check-outs Only</option>
                    <option>Reservations Only</option>
                    <option>Extensions Only</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Room/Cottage</th>
                    <th className="text-left py-2">Guest Name</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Staff</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3">9:00 AM</td>
                    <td className="py-3">Cottage 2</td>
                    <td className="py-3">Maria Santos</td>
                    <td className="py-3">Check-out</td>
                    <td className="py-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Completed</span></td>
                    <td className="py-3">Sarah J.</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">11:00 AM</td>
                    <td className="py-3">Room 205</td>
                    <td className="py-3">Robert Johnson</td>
                    <td className="py-3">Extension</td>
                    <td className="py-3"><span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Extended</span></td>
                    <td className="py-3">Mark T.</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">1:30 PM</td>
                    <td className="py-3">Room 107</td>
                    <td className="py-3">Lisa Ray</td>
                    <td className="py-3">Reservation</td>
                    <td className="py-3"><span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">New</span></td>
                    <td className="py-3">Sarah J.</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">2:00 PM</td>
                    <td className="py-3">Room 101</td>
                    <td className="py-3">Juan Dela Cruz</td>
                    <td className="py-3">Check-in</td>
                    <td className="py-3"><span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span></td>
                    <td className="py-3">Sarah J.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-600">Showing 1 to 5 of 12 entries</span>
              </div>
              <div className="flex space-x-2">
                <button className="border px-3 py-1 rounded">Previous</button>
                <button className="bg-blue-600 text-white px-3 py-1 rounded">1</button>
                <button className="border px-3 py-1 rounded">2</button>
                <button className="border px-3 py-1 rounded">3</button>
                <button className="border px-3 py-1 rounded">Next</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6">Reports</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-medium mb-4">Daily Occupancy</h3>
              <div className="h-48">
                <canvas ref={dailyChartRef}></canvas>
              </div>
              <div className="mt-4">
                <button onClick={openFullReportModal} className="text-blue-600 hover:text-blue-800 text-sm">View Full Report →</button>
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-medium mb-4">Today's Guest Transactions</h3>
              <div className="h-48 overflow-y-auto">
                <ul className="space-y-3">
                  <li className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">Room 101</p>
                      <p className="text-sm text-gray-500">Check-in: 2:00 PM</p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
                  </li>
                  <li className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">Room 205</p>
                      <p className="text-sm text-gray-500">Check-out: 11:00 AM</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Completed</span>
                  </li>
                  <li className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">Cottage 3</p>
                      <p className="text-sm text-gray-500">Extended stay</p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Extended</span>
                  </li>
                  <li className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">Room 107</p>
                      <p className="text-sm text-gray-500">New reservation</p>
                    </div>
                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">New</span>
                  </li>
                </ul>
              </div>
              <div className="mt-4">
                <button onClick={openAllTransactionsModal} className="text-blue-600 hover:text-blue-800 text-sm">View All Transactions →</button>
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg md:col-span-2">
              <h3 className="font-medium mb-4">Today's Activity Summary</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Room/Cottage</th>
                      <th className="text-left py-2">Guest Name</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Check-in Time</th>
                      <th className="text-left py-2">Check-out Time</th>
                      <th className="text-left py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3">Room 101</td>
                      <td className="py-3">Juan Dela Cruz</td>
                      <td className="py-3"><span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Checked-in</span></td>
                      <td className="py-3">2:00 PM</td>
                      <td className="py-3">11:00 AM (next day)</td>
                      <td className="py-3">21 hours</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3">Cottage 2</td>
                      <td className="py-3">Maria Santos</td>
                      <td className="py-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Checked-out</span></td>
                      <td className="py-3">9:00 AM</td>
                      <td className="py-3">5:00 PM</td>
                      <td className="py-3">8 hours</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3">Room 205</td>
                      <td className="py-3">Robert Johnson</td>
                      <td className="py-3"><span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Extended</span></td>
                      <td className="py-3">3:00 PM</td>
                      <td className="py-3">3:00 PM (next day)</td>
                      <td className="py-3">24 hours</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Sidebar>
  );
};

export default Reports;