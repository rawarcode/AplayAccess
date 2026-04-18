import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import { getAdminBookings, getAnalyticsOverview } from "../../lib/adminApi.js";
import Toast, { useToast } from "../../components/ui/Toast";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const fmt = (v) => `₱${Number(v || 0).toLocaleString("en-PH")}`;
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

// Money actually collected for a booking. paidAmount is the backend's
// single source of truth — maintained by the payment webhook, collectPayment,
// and walk-in creation; and recomputed when fees change post-payment.
// Falls back to the old status-based heuristic only for bookings that
// predate the paid_amount column backfill (defensive, not expected).
function collectedAmt(b) {
  if (!b) return 0;
  if (b.paidAmount != null) return Number(b.paidAmount);
  // Legacy fallback — shouldn't be hit after the paid_amount backfill.
  if (b.status === "Pending") return 0;
  if (b.status === "Cancelled") return Number(b.reservationFee || 0);
  if (b.status === "Completed" || b.fullyPaid) {
    return Number(b.total || 0) + Number(b.entranceFee || 0);
  }
  return Number(b.reservationFee || 0);
}

function printTransactions(rows) {
  const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
  const fmtN = v => Number(v||0).toLocaleString('en-PH');
  const statusBadge = (s) => {
    const map = { Completed:'#1e40af:#dbeafe', Confirmed:'#065f46:#d1fae5', Pending:'#92400e:#fef3c7', Cancelled:'#991b1b:#fee2e2', 'Checked In':'#0f766e:#ccfbf1' };
    const [fg, bg] = (map[s] || '#374151:#f3f4f6').split(':');
    return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:8pt;font-weight:bold;color:${fg};background:${bg}">${s}</span>`;
  };
  const active = rows.filter(b => b.status !== 'Cancelled');
  // Column sums for the table footer (what the visible columns add up to)
  const total = active.reduce((s, b) => s + Number(b.total||0) + Number(b.entranceFee||0), 0);
  const efTotal = active.reduce((s, b) => s + Number(b.entranceFee||0), 0);
  const discTotal = active.reduce((s, b) => s + Number(b.discount||0), 0);
  // Money actually collected — used for the Revenue Collected KPI card
  const revenueCollected = rows.reduce((s, b) => s + collectedAmt(b), 0);
  const statusCount = (s) => rows.filter(b => b.status === s).length;
  const tableRows = rows.map(b => `<tr${b.status==='Cancelled'?' style="color:#94a3b8"':''}><td style="font-family:monospace;font-size:8.5pt">${esc(b.id)}</td><td>${esc((b.checkIn||'').slice(0,10))}</td><td>${esc(b.guest)}</td><td>${esc(b.roomType)}</td><td style="text-align:right">${Number(b.discount)>0?`₱${fmtN(b.discount)}`:'—'}</td><td style="text-align:right">₱${fmtN(b.total)}</td><td style="text-align:right;color:#92400e">${Number(b.entranceFee)>0?`₱${fmtN(b.entranceFee)}`:'—'}</td><td>${statusBadge(esc(b.status))}</td><td>${esc(b.paymentMethod||'—')}</td></tr>`).join('');
  const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10pt;color:#1a1a1a;padding:32px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}.co{font-size:18pt;font-weight:bold;color:#1e3a8a}.cosub{font-size:9pt;color:#64748b;margin-top:3px}.rt{text-align:right}.rt h2{font-size:13pt;font-weight:bold;color:#1e3a8a}.rt small{font-size:8pt;color:#94a3b8;margin-top:4px;display:block}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.card{border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px}.lbl{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.05em}.val{font-size:16pt;font-weight:bold;color:#0f172a;margin-top:4px}.srow{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px}.sbox{border:1px solid #e2e8f0;border-radius:6px;padding:10px;text-align:center}.sbox .n{font-size:18pt;font-weight:bold;color:#0f172a}.sbox .s{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.sech{font-size:9pt;font-weight:bold;color:#1e3a8a;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px;margin-top:20px}table{width:100%;border-collapse:collapse;font-size:9.5pt}th{background:#1e3a8a;color:#fff;padding:8px 10px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em}td{padding:6px 10px;border-bottom:1px solid #f1f5f9}tr:nth-child(even) td{background:#f8fafc}tfoot td{background:#1e3a8a!important;color:#fff!important;font-weight:bold;padding:8px 10px}.ftr{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;font-size:8pt;color:#94a3b8}@page{margin:1.5cm}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transaction Records</title><style>${css}</style></head><body>
<div class="hdr"><div><div class="co">AplayAccess</div><div class="cosub">Aplaya Beach Resort · Booking Management System</div></div><div class="rt"><h2>Transaction Records</h2><small>Generated: ${now}</small></div></div>
<div class="cards"><div class="card"><div class="lbl">Total Records</div><div class="val">${rows.length}</div></div><div class="card"><div class="lbl">Active Bookings</div><div class="val">${active.length}</div></div><div class="card"><div class="lbl">Total Discounts</div><div class="val">₱${fmtN(discTotal)}</div></div><div class="card"><div class="lbl">Revenue Collected</div><div class="val">₱${fmtN(revenueCollected)}</div></div></div>
<div class="sech">Status Breakdown</div><div class="srow">${['Confirmed','Checked In','Completed','Pending','Cancelled'].map(s=>`<div class="sbox"><div class="n">${statusCount(s)}</div><div class="s">${s}</div></div>`).join('')}</div>
<div class="sech">All Transactions</div>
<table><thead><tr><th>Booking ID</th><th>Check-in</th><th>Guest</th><th>Room</th><th style="text-align:right">Discount</th><th style="text-align:right">Room Total</th><th style="text-align:right">Entrance Fee</th><th>Status</th><th>Payment</th></tr></thead><tbody>${tableRows}</tbody><tfoot><tr><td colspan="4">Total (excl. cancelled)</td><td style="text-align:right">₱${fmtN(discTotal)}</td><td style="text-align:right">₱${fmtN(total - efTotal)}</td><td style="text-align:right">₱${fmtN(efTotal)}</td><td colspan="2"></td></tr></tfoot></table>
<div class="ftr"><span>AplayAccess · Aplaya Beach Resort</span><span>Confidential — Internal use only</span><span>Generated: ${now}</span></div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script></body></html>`;
  const w = window.open('','_blank'); w.document.write(html); w.document.close();
}


const BAR_COLORS = [
  "rgba(59,130,246,0.75)",
  "rgba(16,185,129,0.75)",
  "rgba(251,191,36,0.75)",
  "rgba(139,92,246,0.75)",
  "rgba(236,72,153,0.75)",
];

const ITEMS_PER_PAGE = 5;

const STATUS_PRIORITY = { Pending: 0, "Checked In": 1, Confirmed: 2, Cancelled: 3, Completed: 4 };

const STATUS_CLASSES = {
  Confirmed:   "bg-emerald-100 text-emerald-800",
  Completed:   "bg-blue-100 text-blue-800",
  Pending:     "bg-yellow-100 text-yellow-800",
  Cancelled:   "bg-red-100 text-red-800",
  "Checked In":"bg-teal-100 text-teal-800",
};



export default function OwnerTransactions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [toast, showToast, clearToast, toastType] = useToast();

  const [sortBy,  setSortBy]  = useState('Check-in');
  const [sortDir, setSortDir] = useState('desc');
  const [allBookings, setAllBookings] = useState([]);
  const [overview,    setOverview]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  const [search,      setSearch]      = useState("");
  const [searchField, setSearchField] = useState("guest");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    Promise.all([getAdminBookings(), getAnalyticsOverview()])
      .then(([bRes, ovRes]) => {
        setAllBookings(bRes.data.data ?? []);
        setOverview(ovRes.data.data);
      })
      .catch(() => showToast("Failed to load transactions.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const hasFilters = search || dateFrom || dateTo || statusFilter;

  const filtered = useMemo(() => {
    const list = allBookings.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
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
    return list.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'Booking ID')   { aVal = a.id ?? '';                              bVal = b.id ?? ''; }
      else if (sortBy === 'Check-in')    { aVal = a.checkIn ?? '';                         bVal = b.checkIn ?? ''; }
      else if (sortBy === 'Guest')       { aVal = (a.guest ?? '').toLowerCase();            bVal = (b.guest ?? '').toLowerCase(); }
      else if (sortBy === 'Room')        { aVal = (a.roomType ?? '').toLowerCase();          bVal = (b.roomType ?? '').toLowerCase(); }
      else if (sortBy === 'Discount')    { aVal = Number(a.discount ?? 0);                  bVal = Number(b.discount ?? 0); }
      else if (sortBy === 'Amount')      { aVal = Number(a.total ?? 0) + Number(a.entranceFee ?? 0); bVal = Number(b.total ?? 0) + Number(b.entranceFee ?? 0); }
      else { aVal = STATUS_PRIORITY[a.status] ?? 5; bVal = STATUS_PRIORITY[b.status] ?? 5; }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [allBookings, search, searchField, statusFilter, dateFrom, dateTo, sortBy, sortDir]);

  const totalPages   = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const indexOfFirst = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRows  = filtered.slice(indexOfFirst, indexOfFirst + ITEMS_PER_PAGE);

  // Revenue = money actually collected (not projected booking value).
  const filteredRevenue = useMemo(() =>
    filtered.reduce((s, b) => s + collectedAmt(b), 0),
    [filtered]
  );

  const nonCancelled = useMemo(() => allBookings.filter((b) => b.status !== "Cancelled"), [allBookings]);
  const totalRevenue = useMemo(() =>
    allBookings.reduce((s, b) => s + collectedAmt(b), 0),
    [allBookings]
  );
  // Average transaction = collected money ÷ number of bookings that contributed.
  // Uses allBookings on both sides so the numerator and denominator agree:
  // cancelled rows contribute their forfeited reservation fee via collectedAmt,
  // so they belong in the count too. Pending bookings contribute 0 but they're
  // still a real "attempted transaction" — including them matches intuition.
  const avgTx = allBookings.length ? totalRevenue / allBookings.length : 0;

  // Revenue by Room Type — collected money, not projected value. Matches
  // the chart subtitle "All time · excluding cancelled" by skipping
  // Cancelled rows (their forfeited reservation fee shows in the
  // Revenue Breakdown's "Forfeited" bucket instead, where that
  // semantic belongs).
  const roomRevenueData = useMemo(() => {
    const map = {};
    allBookings.forEach((b) => {
      if (b.status === "Cancelled") return;
      const amt = collectedAmt(b);
      if (amt === 0) return;
      const room = b.roomType || "Unknown";
      map[room] = (map[room] ?? 0) + amt;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [allBookings]);

  const roomBarData = {
    labels: roomRevenueData.map(([r]) => r),
    datasets: [{
      label: "Revenue (₱)",
      data: roomRevenueData.map(([, v]) => v),
      backgroundColor: roomRevenueData.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
      borderRadius: 6,
    }],
  };
  const roomBarOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { ticks: { callback: (v) => `₱${(v / 1000).toFixed(0)}k` }, beginAtZero: true } },
  };

  // ── Revenue breakdown ────────────────────────────────────────────────
  // Redesigned around two clear questions the owner is actually asking:
  //   1. How much money is already in the till?   (COLLECTED)
  //   2. How much is on the books but not in hand? (OUTSTANDING)
  //
  // Each is broken down by where it came from, using paid_amount (the
  // backend's single source of truth). The old chart mixed status labels
  // ("Fully Collected" = status Completed) with fee-type labels
  // ("Reservation Fees" = amount type), so a Checked-In fully-paid
  // booking showed up as "Reservation Fees" at its full grand total —
  // which was the core of the misleading read.
  const collected = useMemo(() => {
    const buckets = { completed: 0, inProgress: 0, upcoming: 0, forfeited: 0 };
    for (const b of allBookings) {
      const paid = Number(b.paidAmount ?? 0);
      if (paid <= 0) continue;
      if (b.status === "Completed")      buckets.completed  += paid;
      else if (b.status === "Checked In") buckets.inProgress += paid;
      else if (b.status === "Confirmed")  buckets.upcoming   += paid;
      else if (b.status === "Cancelled")  buckets.forfeited  += paid;
    }
    const total = buckets.completed + buckets.inProgress + buckets.upcoming + buckets.forfeited;
    return { ...buckets, total };
  }, [allBookings]);

  const outstanding = useMemo(() => {
    const buckets = { partial: 0, unpaid: 0 };
    for (const b of allBookings) {
      if (["Cancelled", "Completed"].includes(b.status)) continue;
      const grand = Number(b.total ?? 0) + Number(b.entranceFee ?? 0);
      const owed  = Math.max(0, grand - Number(b.paidAmount ?? 0));
      if (owed <= 0) continue;
      // Partial = has paid something but not everything.
      // Unpaid  = has paid nothing (typically Pending rows before PayMongo clears).
      if (Number(b.paidAmount ?? 0) > 0) buckets.partial += owed;
      else                                buckets.unpaid  += owed;
    }
    const total = buckets.partial + buckets.unpaid;
    return { ...buckets, total };
  }, [allBookings]);

  const clearFilters = () => { setSearch(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); setCurrentPage(1); };
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
              <p className="text-gray-500 text-sm">Revenue Collected</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Checked In">Checked In</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
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
            onClick={() => printTransactions(filtered)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-brand border border-brand rounded-lg hover:bg-blue-50 transition"
          >
            <i className="fas fa-print text-xs"></i>
            Print Report
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                {[['Booking ID','Booking ID'],['Check-in','Check-in'],['Guest','Guest'],['Room','Room'],['Discount','Discount'],['Amount','Amount'],['Status','Status']].map(([label,key]) => (
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
                <th className="px-6 py-3 text-left">Payment</th>
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
                <tr key={b.bookingId} role="button" tabIndex={0} onClick={() => navigate("/owner/transactions")} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate("/owner/transactions"); }}} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-6 py-4 font-medium text-slate-900">{b.id}</td>
                  <td className="px-6 py-4 text-slate-500">{(b.checkIn ?? "").slice(0, 10)}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{b.guest}</td>
                  <td className="px-6 py-4 text-slate-500">{b.roomType}</td>
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
                  <td className="px-6 py-4 font-medium">
                    {(() => {
                      const entrance   = Number(b.entranceFee ?? 0);
                      const grandTotal = Number(b.total ?? 0) + entrance;
                      return (
                        <>
                          <div>{fmt(grandTotal)}</div>
                          {entrance > 0 && (
                            <div className="text-[11px] font-normal text-slate-400">
                              incl. {fmt(entrance)} entrance
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[b.status] || "bg-gray-100 text-gray-800"}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{b.paymentMethod || "—"}</td>
                </tr>
              ))}
            </tbody>
            {!loading && currentRows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 text-sm font-semibold">
                <tr>
                  {/* 8 columns: Booking ID · Check-in · Guest · Room · Discount · Amount · Status · Payment */}
                  <td colSpan={4} className="px-6 py-3 text-slate-700">
                    Page total ({currentRows.length} rows)
                  </td>
                  <td className="px-6 py-3 text-emerald-700 font-semibold">
                    {fmt(currentRows.filter(b => b.status !== "Cancelled").reduce((s, b) => s + Number(b.discount || 0), 0))}
                  </td>
                  <td className="px-6 py-3 text-slate-900">
                    {fmt(currentRows.reduce((s, b) => s + collectedAmt(b), 0))}
                  </td>
                  <td />
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
            <span className="px-4 py-1.5 border-y border-slate-200 bg-brand text-white text-sm font-medium">
              {currentPage} / {totalPages || 1}
            </span>
            <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-r-md border border-slate-200 bg-white text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue by Room Type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-800">Revenue by Room</h2>
          <p className="text-xs text-slate-400 mb-4">All time · excluding cancelled</p>
          <div className="h-56">
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : roomRevenueData.length > 0 ? (
              <Bar data={roomBarData} options={roomBarOptions} />
            ) : (
              <p className="text-sm text-gray-400 text-center pt-16">No data available.</p>
            )}
          </div>
          {!loading && roomRevenueData.length > 0 && (
            <div className="mt-3 space-y-1">
              {roomRevenueData.map(([room, rev], i) => (
                <div key={room} className="flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: BAR_COLORS[i % BAR_COLORS.length].replace("0.75","1") }} />
                    <span className="truncate">{room}</span>
                  </div>
                  <span className="font-semibold text-slate-800 ml-2">{fmt(rev)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue Breakdown — money in vs money owed */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Revenue Breakdown</h2>
              <p className="text-xs text-slate-400">What's collected vs. what's still owed.</p>
            </div>
            <span
              className="text-xs text-slate-400 cursor-help"
              title="Collected = money actually received (paid_amount). Outstanding = grand total − paid_amount on active bookings. Forfeited reservation fees are kept when a guest cancels."
            >
              <i className="fas fa-circle-info"></i>
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-12">Loading...</p>
          ) : allBookings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No data available.</p>
          ) : (
            <>
              {/* ── In-hand vs On-the-books headline bars ─────────────── */}
              {(() => {
                const grandTotal = collected.total + outstanding.total;
                const collectedPct   = grandTotal > 0 ? (collected.total / grandTotal) * 100 : 0;
                const outstandingPct = 100 - collectedPct;
                return (
                  <>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Collected</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">Outstanding</span>
                    </div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xl font-bold text-slate-800">{fmt(collected.total)}</span>
                      <span className="text-xl font-bold text-slate-800">{fmt(outstanding.total)}</span>
                    </div>
                    {/* single stacked bar — emerald for collected, amber for outstanding */}
                    <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden flex">
                      {collected.total > 0 && (
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${collectedPct}%` }}
                          title={`Collected: ${fmt(collected.total)} (${collectedPct.toFixed(1)}%)`}
                        />
                      )}
                      {outstanding.total > 0 && (
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${outstandingPct}%` }}
                          title={`Outstanding: ${fmt(outstanding.total)} (${outstandingPct.toFixed(1)}%)`}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span>{collectedPct.toFixed(1)}% of booking value</span>
                      <span>{outstandingPct.toFixed(1)}% owed</span>
                    </div>
                  </>
                );
              })()}

              {/* ── Two columns: collected sources + outstanding sources ─── */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Collected sources */}
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 mb-2 flex items-center gap-1.5">
                    <i className="fas fa-check-circle"></i> Where it came from
                  </h3>
                  <ul className="space-y-2">
                    {[
                      { label: "Completed stays",     value: collected.completed,  color: "bg-emerald-600" },
                      { label: "In-progress stays",   value: collected.inProgress, color: "bg-emerald-500" },
                      { label: "Upcoming (paid)",     value: collected.upcoming,   color: "bg-sky-500"     },
                      { label: "Forfeited fees",      value: collected.forfeited,  color: "bg-rose-400"    },
                    ].filter(r => r.value > 0).map(({ label, value, color }) => {
                      const pct = collected.total > 0 ? (value / collected.total) * 100 : 0;
                      return (
                        <li key={label}>
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />
                              <span>{label}</span>
                            </div>
                            <span className="font-semibold text-slate-800">{fmt(value)}</span>
                          </div>
                          <div className="mt-1 h-1 bg-slate-100 rounded overflow-hidden">
                            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                    {collected.total === 0 && (
                      <li className="text-xs text-slate-400 italic">No payments collected yet.</li>
                    )}
                  </ul>
                </div>

                {/* Outstanding sources */}
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-2 flex items-center gap-1.5">
                    <i className="fas fa-clock"></i> What's still owed
                  </h3>
                  <ul className="space-y-2">
                    {[
                      { label: "Partially paid (balance at counter)", value: outstanding.partial, color: "bg-amber-500" },
                      { label: "Unpaid pending",                      value: outstanding.unpaid,  color: "bg-amber-300" },
                    ].filter(r => r.value > 0).map(({ label, value, color }) => {
                      const pct = outstanding.total > 0 ? (value / outstanding.total) * 100 : 0;
                      return (
                        <li key={label}>
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />
                              <span>{label}</span>
                            </div>
                            <span className="font-semibold text-slate-800">{fmt(value)}</span>
                          </div>
                          <div className="mt-1 h-1 bg-slate-100 rounded overflow-hidden">
                            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                    {outstanding.total === 0 && (
                      <li className="text-xs text-slate-400 italic">No outstanding balances. Nice.</li>
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      <Toast message={toast} type={toastType} onClose={clearToast} />
    </div>
  );
}
