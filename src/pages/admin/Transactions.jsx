import { useState, useEffect } from "react";
import { getAdminBookings } from "../../lib/adminApi";

const STATUS_PRIORITY = { Pending: 0, "Checked In": 1, Confirmed: 2, Cancelled: 3, Completed: 4 };

const STATUS_COLORS = {
  Completed:    "bg-emerald-100 text-emerald-800",
  Pending:      "bg-amber-100 text-amber-800",
  Confirmed:    "bg-blue-100 text-blue-800",
  "Checked In": "bg-sky-100 text-sky-800",
  Cancelled:    "bg-rose-100 text-rose-800",
};
const STATUS_DOT = {
  Completed:    "bg-emerald-500",
  Pending:      "bg-amber-500",
  Confirmed:    "bg-blue-500",
  "Checked In": "bg-sky-500",
  Cancelled:    "bg-rose-500",
};

export default function AdminTransactions() {
  const [bookings,      setBookings]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [filterStatus,  setFilterStatus]  = useState("");
  const [filterMethod,  setFilterMethod]  = useState("");
  const [searchTerm,    setSearchTerm]    = useState("");
  const [viewBooking,   setViewBooking]   = useState(null);
  const [sortBy,  setSortBy]  = useState('Date');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    function load() {
      getAdminBookings()
        .then(r => setBookings(r.data.data))
        .catch(() => setError("Failed to load transactions."))
        .finally(() => setLoading(false));
    }
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  const filtered = bookings
    .filter(b => {
      const matchSearch = b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.guest.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !filterStatus || b.status === filterStatus;
      const matchMethod = !filterMethod || b.paymentMethod === filterMethod;
      return matchSearch && matchStatus && matchMethod;
    })
    .sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'Booking ID') { aVal = a.id; bVal = b.id; }
      else if (sortBy === 'Guest') { aVal = a.guest; bVal = b.guest; }
      else if (sortBy === 'Room')  { aVal = a.roomType; bVal = b.roomType; }
      else if (sortBy === 'Amount') { aVal = Number(a.total); bVal = Number(b.total); }
      else if (sortBy === 'Status') { aVal = STATUS_PRIORITY[a.status] ?? 5; bVal = STATUS_PRIORITY[b.status] ?? 5; }
      else { aVal = a.checkIn ?? ''; bVal = b.checkIn ?? ''; } // Date
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  // Revenue per row: Completed = full total, Cancelled = forfeited reservation_fee,
  // Pending / Confirmed / Checked In = reservation_fee paid online (balance not yet collected)
  const totalAmount = filtered.reduce((s, b) => {
    if (b.status === "Completed") return s + Number(b.total ?? 0);
    return s + Number(b.reservation_fee ?? 0);
  }, 0);
  const completedCount  = filtered.filter(b => b.status === "Completed").length;

  // Unique payment methods for filter dropdown
  const methods = [...new Set(bookings.map(b => b.paymentMethod).filter(Boolean))];

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <p className="text-sm text-slate-500 mt-1">Track payments and booking settlement status.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Transactions", value: filtered.length,                      icon: "fa-credit-card", color: "bg-sky-100 text-sky-600" },
          { label: "Completed",          value: completedCount,                        icon: "fa-check-circle",color: "bg-emerald-100 text-emerald-600" },
          { label: "Total Amount",       value: `₱${totalAmount.toLocaleString()}`,   icon: "fa-peso-sign",   color: "bg-purple-100 text-purple-600" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${c.color}`}><i className={`fas ${c.icon} text-xl`}></i></div>
              <div>
                <p className="text-slate-500 text-sm">{c.label}</p>
                <p className="text-2xl font-semibold text-slate-900">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">{error}</div>}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div className="relative w-full md:w-64">
            <input type="text" placeholder="Search by ID or guest…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="min-w-36 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm">
              <option value="">All Statuses</option>
              {["Pending","Confirmed","Checked In","Completed","Cancelled"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
              className="min-w-36 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm">
              <option value="">All Methods</option>
              {methods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-6 py-10 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-400">No transactions found.</p>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  {[['Booking ID','Booking ID'],['Guest','Guest'],['Room','Room'],['Amount','Amount'],['Date','Date'],['Status','Status']].map(([label,key]) => (
                    <th key={key} className="px-6 py-3 text-left">
                      <button onClick={() => { if(sortBy===key) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(key);setSortDir('asc');} }}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors group">
                        {label}
                        <span className="text-slate-400 group-hover:text-blue-400">
                          {sortBy===key ? <i className={`fas fa-arrow-${sortDir==='asc'?'up':'down'} text-blue-500`}></i> : <i className="fas fa-sort opacity-40"></i>}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left">Method</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filtered.map(b => (
                  <tr
                    key={b.booking_id}
                    onClick={() => setViewBooking(b)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{b.id}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{b.guest}</p>
                      <p className="text-xs text-slate-400">{b.guest_email}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{b.roomType}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">₱{Number(b.total).toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{b.createdAt?.split(" ")[0]}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[b.status] || "bg-slate-100 text-slate-700"}`}>
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[b.status] || "bg-slate-400"}`} />
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{b.paymentMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* View Booking Detail Modal */}
      {viewBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Transaction — <span className="font-mono text-sm">{viewBooking.id}</span>
              </h3>
              <button onClick={() => setViewBooking(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Guest",          viewBooking.guest],
                  ["Email",          viewBooking.guest_email || "—"],
                  ["Room",           viewBooking.roomType],
                  ["Guests",         viewBooking.guests ? `${viewBooking.guests} pax` : "—"],
                  ["Check-in",       viewBooking.checkIn  || "—"],
                  ["Check-out",      viewBooking.checkOut || "—"],
                  ["Amount",         `₱${Number(viewBooking.total).toLocaleString()}`],
                  ["Payment Method", viewBooking.paymentMethod || "—"],
                  ["Date",           viewBooking.createdAt?.split(" ")[0] || "—"],
                ].map(([label, val]) => (
                  <div key={label} className={["Email", "Guest"].includes(label) ? "col-span-2" : ""}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className="font-semibold text-slate-900">{val}</p>
                  </div>
                ))}
                {viewBooking.promo_code && Number(viewBooking.discount) > 0 && (
                  <div className="col-span-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-tag text-green-600 text-sm"></i>
                      <div>
                        <p className="text-xs text-green-700 font-semibold">Promo Applied</p>
                        <p className="text-sm font-mono font-bold text-green-800">{viewBooking.promo_code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-green-700">Discount</p>
                      <p className="text-sm font-bold text-green-800">−₱{Number(viewBooking.discount).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs">Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[viewBooking.status] || "bg-slate-100 text-slate-700"}`}>
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[viewBooking.status] || "bg-slate-400"}`} />
                    {viewBooking.status}
                  </span>
                </div>
                {viewBooking.specialRequests && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs">Special Requests</p>
                    <p className="italic text-slate-700">{viewBooking.specialRequests}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <button onClick={() => setViewBooking(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
