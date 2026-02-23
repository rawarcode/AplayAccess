import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Pie } from 'react-chartjs-2';
import { transactionStats, transactions, transactionTypeData, paymentMethodData } from '../data/transactionData';

const Transactions = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  const handlePrint = (transactionId) => {
    console.log('Printing receipt for:', transactionId);
    alert(`Printing receipt for ${transactionId}`);
  };

  return (
    <MainLayout pageTitle="Transaction Records">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Transaction Records</h2>
          <div className="flex space-x-2">
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
              <i className="fas fa-download mr-2"></i> Export
            </button>
            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
              <i className="fas fa-filter mr-2"></i> Filter
            </button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Transactions</p>
                <h3 className="text-2xl font-bold">{transactionStats.totalTransactions}</h3>
              </div>
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-exchange-alt text-xl"></i>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xs text-green-500">
                <i className="fas fa-arrow-up mr-1"></i> {transactionStats.trends.transactions}
              </span>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <h3 className="text-2xl font-bold">{transactionStats.totalRevenue}</h3>
              </div>
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <i className="fas fa-money-bill-wave text-xl"></i>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xs text-green-500">
                <i className="fas fa-arrow-up mr-1"></i> {transactionStats.trends.revenue}
              </span>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg. Transaction</p>
                <h3 className="text-2xl font-bold">{transactionStats.avgTransaction}</h3>
              </div>
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <i className="fas fa-calculator text-xl"></i>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xs text-red-500">
                <i className="fas fa-arrow-down mr-1"></i> {transactionStats.trends.average}
              </span>
            </div>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Transactions</label>
              <div className="flex space-x-2">
                <select className="border border-gray-200 rounded px-3 py-2 w-full md:w-auto">
                  <option value="id">Transaction ID</option>
                  <option value="guest">Guest Name</option>
                  <option value="room">Room Number</option>
                  <option value="payment">Payment Method</option>
                </select>
                <input 
                  type="text" 
                  placeholder="Enter search term..." 
                  className="border border-gray-200 rounded px-3 py-2 flex-1"
                />
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                  <i className="fas fa-search mr-2"></i> Search
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <div className="flex space-x-2">
                <input type="date" className="border border-gray-200 rounded px-3 py-2" />
                <span className="flex items-center">to</span>
                <input type="date" className="border border-gray-200 rounded px-3 py-2" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Transactions Table */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{transaction.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{transaction.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.guest}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{transaction.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{transaction.paymentMethod}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.amount}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      transaction.status === 'Completed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button 
                      onClick={() => handlePrint(transaction.id)}
                      className="text-yellow-600 hover:text-yellow-900 print-receipt"
                    >
                      <i className="fas fa-receipt"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-medium">{Math.min(indexOfLastItem, transactions.length)}</span> of{' '}
              <span className="font-medium">{transactions.length}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button 
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-200 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <span className="z-10 bg-blue-50 border-blue-500 text-blue-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium">
                {currentPage}
              </span>
              <button 
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={indexOfLastItem >= transactions.length}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-200 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </nav>
          </div>
        </div>
        
        {/* Charts */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Transaction Types</h2>
              <select className="border border-gray-200 rounded px-3 py-1 text-sm">
                <option value="month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div className="h-64">
              <Pie data={transactionTypeData} options={pieOptions} />
            </div>
          </div>
          
          <div className="bg-white border-gray-200 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Payment Methods</h2>
              <select className="border border-gray-200 rounded px-3 py-1 text-sm">
                <option value="month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div className="h-64">
              <Pie data={paymentMethodData} options={pieOptions} />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Transactions;
