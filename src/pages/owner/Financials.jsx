import React from 'react';
import MainLayout from '../../components/layout/MainLayout';
import { Pie, Line } from 'react-chartjs-2';
import { financialSummary, financialRecords, revenueCategoryData, comparisonData } from '../../data/financialData';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const Financials = () => {
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      }
    }
  };

  return (
    <MainLayout pageTitle="Financial Reports">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Financial Reports</h2>
        
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Revenue Summary */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-blue-800">Revenue Summary</h3>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">This Month</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Room Revenue</span>
                <span className="text-sm font-medium">{financialSummary.revenue.roomRevenue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Food & Beverage</span>
                <span className="text-sm font-medium">{financialSummary.revenue.foodBeverage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Activities</span>
                <span className="text-sm font-medium">{financialSummary.revenue.activities}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Other Services</span>
                <span className="text-sm font-medium">{financialSummary.revenue.otherServices}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span className="font-medium">Total Revenue</span>
                <span className="font-bold">{financialSummary.revenue.total}</span>
              </div>
            </div>
          </div>
          
          {/* Expense Summary */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-green-800">Expense Summary</h3>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">This Month</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Payroll</span>
                <span className="text-sm font-medium">{financialSummary.expenses.payroll}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Food & Supplies</span>
                <span className="text-sm font-medium">{financialSummary.expenses.foodSupplies}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Utilities</span>
                <span className="text-sm font-medium">{financialSummary.expenses.utilities}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Maintenance</span>
                <span className="text-sm font-medium">{financialSummary.expenses.maintenance}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span className="font-medium">Total Expenses</span>
                <span className="font-bold">{financialSummary.expenses.total}</span>
              </div>
            </div>
          </div>
          
          {/* Profit Summary */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-purple-800">Profit Summary</h3>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">This Month</span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Gross Profit</span>
                  <span className="text-sm font-medium">{financialSummary.profit.gross}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Net Profit</span>
                  <span className="text-sm font-medium">{financialSummary.profit.net}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span className="font-medium">Profit Margin</span>
                <span className="font-bold text-green-600">{financialSummary.profit.margin}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Revenue by Category</h2>
              <select className="border rounded px-3 py-1 text-sm">
                <option value="month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div className="h-64">
              <Pie data={revenueCategoryData} options={pieOptions} />
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Monthly Comparison</h2>
              <select className="border rounded px-3 py-1 text-sm">
                <option value="2023-2022">2023 vs 2022</option>
                <option value="2022-2021">2022 vs 2021</option>
              </select>
            </div>
            <div className="h-64">
              <Line data={comparisonData} options={lineOptions} />
            </div>
          </div>
        </div>
        
        {/* Financial Records Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium">Detailed Financial Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {financialRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.type === 'Revenue' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {record.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Financials;
