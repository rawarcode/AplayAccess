import { useState } from "react";

export default function AdminTransactions() {
  const [transactions] = useState([
    {
      id: "TRX001",
      reservationId: "RES123",
      guestName: "John Doe",
      amount: 4500,
      method: "Credit Card",
      status: "Completed",
      date: "2024-01-15",
    },
    {
      id: "TRX002",
      reservationId: "RES124",
      guestName: "Jane Smith",
      amount: 3200,
      method: "Bank Transfer",
      status: "Pending",
      date: "2024-01-16",
    },
    {
      id: "TRX003",
      reservationId: "RES125",
      guestName: "Bob Johnson",
      amount: 5600,
      method: "GCash",
      status: "Completed",
      date: "2024-01-17",
    },
  ]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = transactions.filter((t) => {
    const matches =
      t.reservationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.guestName.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = !filterStatus || t.status === filterStatus;
    const methodMatch = !filterMethod || t.method === filterMethod;
    return matches && statusMatch && methodMatch;
  });

  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Transactions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track payments and keep an eye on settlement status.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="bg-sky-100 rounded-full p-3">
              <i className="fas fa-credit-card text-sky-600 text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Total Transactions</p>
              <p className="text-2xl font-semibold text-slate-900">{transactions.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 rounded-full p-3">
              <i className="fas fa-check-circle text-emerald-600 text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Completed</p>
              <p className="text-2xl font-semibold text-slate-900">
                {transactions.filter((t) => t.status === "Completed").length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 rounded-full p-3">
              <i className="fas fa-peso-sign text-purple-600 text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Total Amount</p>
              <p className="text-2xl font-semibold text-slate-900">₱{totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search by ID or guest..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="min-w-40 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">Filter by Status</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="min-w-40 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">Filter by Method</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="GCash">GCash</option>
              <option value="PayPal">PayPal</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">Transaction ID</th>
                <th className="px-6 py-3 text-left">Reservation</th>
                <th className="px-6 py-3 text-left">Guest Name</th>
                <th className="px-6 py-3 text-left">Amount</th>
                <th className="px-6 py-3 text-left">Method</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{transaction.id}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{transaction.reservationId}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{transaction.guestName}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">₱{transaction.amount}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{transaction.method}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                        transaction.status === "Completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : transaction.status === "Pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      <span
                        className={
                          transaction.status === "Completed"
                            ? "h-2.5 w-2.5 rounded-full bg-emerald-500"
                            : transaction.status === "Pending"
                            ? "h-2.5 w-2.5 rounded-full bg-amber-500"
                            : "h-2.5 w-2.5 rounded-full bg-rose-500"
                        }
                      />
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{transaction.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
