import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { getAdminBookings, getAnalyticsOverview } from "../../lib/adminApi.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH")}`;

const PIE_COLORS = [
  "rgba(59, 130, 246, 0.8)",
  "rgba(16, 185, 129, 0.8)",
  "rgba(251, 191, 36, 0.8)",
  "rgba(139, 92, 246, 0.8)",
  "rgba(236, 72, 153, 0.8)",
];

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
};

const ITEMS_PER_PAGE = 5;

const STATUS_PRIORITY = { Pending: 0, "Checked In": 1, Confirmed: 2, Cancelled: 3, Completed: 4 };

const STATUS_CLASSES = {
  Confirmed:   "bg-emerald-100 text-emerald-800",
  Completed:   "bg-blue-100 text-blue-800",
  Pending:     "bg-yellow-100 text-yellow-800",
  Cancelled:   "bg-red-100 text-red-800",
  "Checked In":"bg-teal-100 text-teal-800",
};

function buildPieData(bookings, key) {
  const counts = bookings.reduce((acc, b) => {
    const val = b[key] || "Unknown";
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  const labels = Object.keys(counts);
  return {
    labels,
    datasets: [{ data: labels.map((l) => counts[l]), backgroundColor: PIE_COLORS }],
  };
}

function exportCSV(rows) {
  const headers = ["Booking ID", "Check-in", "Guest", "Room Type", "Payment Method", "Discount (PHP)", "Amount (PHP)", "Status"];
  const lines = [
    headers.join(","),
    ...rows.map((b) => [
      b.id,
      (b.checkIn ?? "").slice(0, 10),
      `"${b.guest}"`,
      `"${b.roomType}"`,
      b.paymentMethod || "",
      b.discount || 0,
      b.total,
      b.status,
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function OwnerTransactions() {
  const navigate = useNavigate();
  const [allBookings, setAllBookings] = useState([]);
  const [overview,    setOverview]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  const [search,      setSearch]      = useState("");
  const [searchField, setSearchField] = useState("guest");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    Promise.all([getAdminBookings(), getAnalyticsOverview()])
      .then(([bRes, ovRes]) => {
        setAllBookings(bRes.data.data ?? []);
        setOverview(ovRes.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasFilters = search || dateFrom || dateTo;

  const filtered = useMemo(() => {
    const list = allBookings.filter((b) => {
      const val = search.toLowerCase();
      let matchesSearch = true;
      if (val) {
        if (searchField === "guest")   matchesSearch = (b.guest ?? "").toLowerCase().includes(val);
        if (searchField === "id")      matchesSearch = (b.id ?? "").toLowerCase().includes(val);
        if (searchField === "room")    matchesSearch = (b.roomType ?? "").toLowerCase().includes(val);
        if (searchField === "payment") matchesSearch = (b.paymentMethod ?? "").toLowerCase().includes(val);
      }
      let matchesDate = true;
      const checkIn = (b.checkIn ?? "").slice(0, 10);
      if (dateFrom) matchesDate = matchesDate && checkIn >= dateFrom;
      if (dateTo)   matchesDate = matchesDate && checkIn <= dateTo;
      return matchesSearch && matchesDate;
    });
    return list.sort(
      (a, b) => (STATUS_PRIORITY[a.status] ?? 5) - (STATUS_PRIORITY[b.status] ?? 5)
    );
  }, [allBookings, search, searchField, dateFrom, dateTo]);

  const totalPages   = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const indexOfFirst = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRows  = filtered.slice(indexOfFirst, indexOfFirst + ITEMS_PER_PAGE);

  const filteredRevenue = useMemo(() =>
    filtered.filter((b) => b.status !== "Cancelled").reduce((s, b) => s + Number(b.total || 0), 0),
    [filtered]
  );

  const nonCancelled = useMemo(() => allBookings.filter((b) => b.status !== "Cancelled"), [allBookings]);
  const totalRevenue = nonCancelled.reduce((s, b) => s + Number(b.total || 0), 0);
  const avgTx = nonCancelled.length ? totalRevenue / nonCancelled.length : 0;

  const statusPieData  = useMemo(() => buildPieData(allBookings, "status"),        [allBookings]);
  const paymentPieData = useMemo(() => buildPieData(allBookings, "paymentMethod"), [allBookings]);

  const clearFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); setCurrentPage(1); };
  const handleSearch = (v) => { setSearch(v);      setCurrentPage(1); };
  const handleField  = (v) => { setSearchField(v); setCurrentPage(1); };
  const handleFrom   = (v) => { setDateFrom(v);    setCurrentPage(1); };
  const handleTo     = (v) => { setDateTo(v);      setCurrentPage(1); };

  return (
    <div className="p-6 space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Bookings</p>
              <h3 className="text-2xl font-bold mt-1">{loading ? "—" : allBookings.length}</h3>
              <p className="text-xs text-green-500 mt-1">
                <i className="fas fa-arrow-up mr-1"></i>
                {loading ? "" : `${overview?.bookings_this_month ?? 0} this month`}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <i className="fas fa-exchange-alt text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Revenue</p>
              <h3 className="text-2xl font-bold mt-1">{loading ? "—" : fmt(totalRevenue)}</h3>
              <p className="text-xs text-green-500 mt-1">
                <i className="fas fa-arrow-up mr-1"></i>
                {loading ? "" : `${fmt(overview?.revenue_this_month ?? 0)} this month`}
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <i className="fas fa-money-bill-wave text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Avg. Transaction</p>
              <h3 className="text-2xl font-bold mt-1">{loading ? "—" : fmt(Math.round(avgTx))}</h3>
            </div>
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <i className="fas fa-calculator text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex flex-col md:flex-row md:items-end md:space-x-4 gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Transactions</label>
            <div className="flex gap-2">
              <select
                value={searchField}
                onChange={(e) => handleField(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="guest">Guest Name</option>
                <option value="id">Booking ID</option>
                <option value="room">Room Type</option>
                <option value="payment">Payment Method</option>
              </select>
              <div className="relative flex-1">
                <input
                  type="text" placeholder="Enter search term..."
                  value={search} onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                />
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range (Check-in)</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => handleFrom(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <span className="text-gray-400 text-sm">to</span>
              <input type="date" value={dateTo} onChange={(e) => handleTo(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </div>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition whitespace-nowrap"
            >
              <i className="fas fa-times text-xs"></i>
              Clear filters
            </button>
          )}
        </div>

        {hasFilters && (
          <p className="mt-3 text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{" "}
            <span className="font-semibold">{allBookings.length}</span> transactions
            {filtered.length !== allBookings.length && filtered.filter(b => b.status !== "Cancelled").length > 0 && (
              <> &mdash; filtered revenue: <span className="font-semibold text-slate-700">{fmt(filteredRevenue)}</span></>
            )}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#1e3a8a] border border-[#1e3a8a] rounded-lg hover:bg-blue-50 transition"
          >
            <i className="fas fa-download text-xs"></i>
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Booking ID</th>
                <th className="px-6 py-3 text-left">Check-in</th>
                <th className="px-6 py-3 text-left">Guest</th>
                <th className="px-6 py-3 text-left">Room</th>
                <th className="px-6 py-3 text-left">Payment</th>
                <th className="px-6 py-3 text-left">Discount</th>
                <th className="px-6 py-3 text-left">Amount</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">Loading...</td>
                </tr>
              ) : currentRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">No transactions found.</td>
                </tr>
              ) : currentRows.map((b) => (
                <tr key={b.booking_id} onClick={() => navigate("/admin/transactions")} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-6 py-4 font-medium text-slate-900">{b.id}</td>
                  <td className="px-6 py-4 text-slate-500">{(b.checkIn ?? "").slice(0, 10)}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{b.guest}</td>
                  <td className="px-6 py-4 text-slate-500">{b.roomType}</td>
                  <td className="px-6 py-4 text-slate-500">{b.paymentMethod || "—"}</td>
                  <td className="px-6 py-4">
                    {Number(b.discount) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <i className="fas fa-tag text-xs"></i>
                        {fmt(b.discount)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium">{fmt(b.total)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[b.status] || "bg-gray-100 text-gray-800"}`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && currentRows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 text-sm font-semibold">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-slate-700">
                    Page total ({currentRows.length} rows)
                  </td>
                  <td className="px-6 py-3 text-emerald-700 font-semibold">
                    {fmt(currentRows.filter(b => b.status !== "Cancelled").reduce((s, b) => s + Number(b.discount || 0), 0))}
                  </td>
                  <td className="px-6 py-3 text-slate-900">
                    {fmt(currentRows.filter(b => b.status !== "Cancelled").reduce((s, b) => s + b.total, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-slate-50 px-6 py-3 flex items-center justify-between border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Showing{" "}
            <span className="font-medium">{filtered.length === 0 ? 0 : indexOfFirst + 1}</span>
            {" "}–{" "}
            <span className="font-medium">{Math.min(indexOfFirst + ITEMS_PER_PAGE, filtered.length)}</span>
            {" "}of{" "}
            <span className="font-medium">{filtered.length}</span> results
          </p>
          <div className="inline-flex rounded-md shadow-sm gap-px">
            <button onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-l-md border border-slate-200 bg-white text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className="px-4 py-1.5 border-y border-slate-200 bg-[#1e3a8a] text-white text-sm font-medium">
              {currentPage} / {totalPages || 1}
            </span>
            <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-r-md border border-slate-200 bg-white text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Bookings by Status</h2>
          <div className="h-64">
            {!loading && allBookings.length > 0
              ? <Pie data={statusPieData} options={pieOptions} />
              : <p className="text-sm text-gray-400">{loading ? "Loading..." : "No data"}</p>}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Methods</h2>
          <div className="h-64">
            {!loading && allBookings.length > 0
              ? <Pie data={paymentPieData} options={pieOptions} />
              : <p className="text-sm text-gray-400">{loading ? "Loading..." : "No data"}</p>}
          </div>
        </div>
      </div>

    </div>
  );
}
