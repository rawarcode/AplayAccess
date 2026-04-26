import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import Sidebar from './Layout/Sidebar';
import { getFdBookings, getFdRooms } from '../../lib/frontdeskApi';
import Toast, { useToast } from '../../components/ui/Toast';
import { fmtTime, localDateStr } from '../../lib/format';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ─── helpers ─────────────────────────────────────────────────────────────────
const todayStr = () => localDateStr();

function buildWeekChart(bookings) {
  const labels = [], counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    labels.push(d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }));
    counts.push(bookings.filter(b => b.checkIn?.slice(0, 10) === key).length);
  }
  return { labels, counts };
}

// ─── component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();

  const [bookings, setBookings]   = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, showToast, clearToast, toastType] = useToast();

  // ── load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    function load() {
      Promise.all([getFdBookings(), getFdRooms()])
        .then(([bData, rData]) => { setBookings(bData); setRooms(rData); })
        .catch(() => showToast('Failed to load dashboard data.', 'error'))
        .finally(() => setLoading(false));
    }
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  // ── derived metrics ─────────────────────────────────────────────────────────
  const today = todayStr();

  const { todayBookings, arriving, checkedIn, completed, walkIns, todayRevenue, overdueCheckouts } = useMemo(() => {
    // "Today" includes bookings checking in today AND any still-Checked-In
    // stays from earlier days — so an overnight guest who arrived at
    // 11:50 PM yesterday doesn't disappear from the dashboard at 12:01 AM.
    const now = new Date();
    const todayBookings = bookings.filter(b => {
      if (b.checkIn?.slice(0, 10) === today) return true;
      if (b.status === 'Checked In') return true;
      if (b.status === 'Completed' && b.checkedOutAt?.slice(0, 10) === today) return true;
      if (b.status === 'Confirmed' && b.checkOut) {
        const co = new Date(String(b.checkOut).replace(' ', 'T'));
        if (!isNaN(co.getTime()) && co > now) return true;
      }
      return false;
    });
    const arriving       = todayBookings.filter(b => b.status === 'Confirmed');
    const checkedIn      = todayBookings.filter(b => b.status === 'Checked In');
    const completed      = todayBookings.filter(b => b.status === 'Completed');
    // Removed allPending from the KPI row — pending bookings are auto-cleared
    // by the PayMongo webhook (≤5 min) or auto-cancelled by a backend job
    // (>5 min unpaid), so the count isn't actionable for front desk. The
    // card it used to populate now surfaces overdueCheckouts instead.
    const walkIns        = todayBookings.filter(b => b.source === 'walk-in' || b.source === 'walkin');

    // Today's revenue = SUM(paidAmount). paidAmount is the backend's single
    // source of truth for money actually collected — consistent with the
    // Billing page's revenueToday and the owner Revenue Collected KPI.
    const todayRevenue = todayBookings.reduce((sum, b) => sum + Number(b.paidAmount ?? 0), 0);

    // Overdue checkouts — checked in but checkout time has passed. This is
    // the KPI-actionable state front desk can actually do something about
    // (call the room, assess late fee, free it for the next guest).
    const overdueCheckouts = bookings.filter(b => {
      if (b.status !== 'Checked In' || !b.checkOut) return false;
      return new Date(b.checkOut.replace(' ', 'T')) < now;
    });

    return { todayBookings, arriving, checkedIn, completed, walkIns, todayRevenue, overdueCheckouts };
  }, [bookings, today]);

  // Occupancy. Exclude pseudo-room categories from both numerator and
  // denominator: 'admission' (qty=999, gate-only walk-in shell — not a
  // real bookable unit) and 'tent' (high seeded inventory that's
  // bring-your-own-pitch, not real room capacity). Without this filter
  // Available Rooms reads "1000+" because admission's qty=999 lands in
  // totalRooms unfiltered. Same exclusion contract as the FDRooms
  // board's isExcludedFromVacancy().
  const { totalRooms, occupiedRooms, availableRooms, occupancyPct } = useMemo(() => {
    const isPseudoRoom = (r) => r.category === 'admission' || r.category === 'tent';
    const realRoomIds  = new Set(rooms.filter(r => !isPseudoRoom(r)).map(r => r.id));
    const totalRooms     = rooms.filter(r => !isPseudoRoom(r))
                                .reduce((sum, r) => sum + Number(r.quantity ?? 1), 0);
    const occupiedRooms  = bookings.filter(b => b.status === 'Checked In' && realRoomIds.has(b.roomId)).length;
    const availableRooms = Math.max(0, totalRooms - occupiedRooms);
    const occupancyPct   = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    return { totalRooms, occupiedRooms, availableRooms, occupancyPct };
  }, [rooms, bookings]);

  const { labels, counts } = useMemo(() => buildWeekChart(bookings), [bookings]);
  const chartData = useMemo(() => ({
    labels,
    datasets: [{ label: 'Bookings', data: counts, backgroundColor: 'rgba(14,165,233,0.7)', borderRadius: 4 }],
  }), [labels, counts]);

  // ─── render ──────────────────────────────────────────────────────────────────
  // Use the standard Sidebar top bar (showTopBar default true) — drops
  // the duplicate custom header that previously rendered a second
  // "Dashboard" h1 + a copy of NotificationBell + a profile dropdown
  // identical to the one Sidebar already renders. The only unique bit
  // was a read-only "Account Settings" modal that just said "contact
  // admin to change your details" — minimal value for the maintenance
  // cost. Removed.
  //
  // Side benefit: hamburger now lives inline with the page title via
  // the standard top bar instead of floating absolute over the page
  // (the floating fallback was the only visual home it had when the
  // dashboard suppressed the top bar).
  return (
    <Sidebar>
      <Helmet><title>Dashboard — Frontdesk</title></Helmet>

      {/* ── Main Content ── */}
      <main className="p-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow p-5 flex items-center animate-pulse">
                <div className="h-12 w-12 rounded-xl bg-slate-200 mr-4"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-slate-200 rounded"></div>
                  <div className="h-6 w-12 bg-slate-200 rounded"></div>
                </div>
              </div>
            ))
          ) : (
            (() => {
              // Replaced Pending (All) — a non-actionable count of bookings
              // the PayMongo webhook / auto-cancel job already handles —
              // with Overdue Checkout. Staff CAN act on this one: call the
              // room, assess late fee, free the room for the next arrival.
              // Click targets /bookings?status=Overdue which is already a
              // valid filter on the consolidated Bookings page.
              const overdue      = overdueCheckouts.length;
              const overdueCard  = overdue > 0
                ? {
                    label:   'Overdue Checkout',
                    value:   overdue,
                    bg:      'bg-rose-100',
                    text:    'text-rose-600',
                    icon:    'fa-triangle-exclamation',
                    sub:     overdue === 1 ? 'Needs attention' : `${overdue} guests overdue — needs attention`,
                    href:    '/frontdesk/bookings?status=Overdue',
                    urgent:  true,
                  }
                : {
                    label:   'Overdue Checkout',
                    value:   0,
                    bg:      'bg-slate-100',
                    text:    'text-slate-500',
                    icon:    'fa-check',
                    sub:     'All on schedule',
                  };
              return [
                { label: 'Occupancy',          value: `${occupancyPct}%`,                    bg: 'bg-sky-100',     text: 'text-sky-600',     icon: 'fa-chart-pie',     sub: `${occupiedRooms} / ${totalRooms} rooms` },
                { label: 'Available Rooms',     value: availableRooms,                        bg: 'bg-emerald-100', text: 'text-emerald-600', icon: 'fa-door-open'      },
                { label: "Today's Revenue",     value: `₱${todayRevenue.toLocaleString()}`,   bg: 'bg-teal-100',    text: 'text-teal-600',    icon: 'fa-peso-sign'      },
                { label: 'Arriving Today',      value: arriving.length,                       bg: 'bg-indigo-100',  text: 'text-indigo-600',  icon: 'fa-plane-arrival',  sub: 'Confirmed' },
                { label: 'Walk-ins Today',      value: walkIns.length,                        bg: 'bg-amber-100',   text: 'text-amber-600',   icon: 'fa-walking'        },
                overdueCard,
              ];
            })().map(card => {
              const interactive = !!card.href;
              const cardCls = [
                'bg-white rounded-xl shadow p-5 flex items-center transition-colors',
                interactive ? 'cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1' : '',
                card.urgent ? 'ring-2 ring-rose-200' : '',
              ].join(' ');

              const body = (
                <>
                  <div className={`p-3 rounded-xl ${card.bg} ${card.text} mr-4`}>
                    <i className={`fas ${card.icon} text-xl`} aria-hidden="true"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-500 text-sm">{card.label}</p>
                    <h3 className={`text-2xl font-bold ${card.urgent ? 'text-rose-700' : ''}`}>{card.value}</h3>
                    {card.sub && (
                      <p className={`text-xs ${card.urgent ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                        {card.sub}
                      </p>
                    )}
                  </div>
                </>
              );

              return interactive ? (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => navigate(card.href)}
                  aria-label={`${card.label}: ${card.value}${card.sub ? `. ${card.sub}` : ''}. Open bookings list.`}
                  className={`${cardCls} text-left w-full`}
                >
                  {body}
                </button>
              ) : (
                <div key={card.label} className={cardCls}>{body}</div>
              );
            })
          )}
        </div>

        {/* Chart + Upcoming Arrivals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Bookings — Last 7 Days</h2>
            {loading ? (
              <div className="h-64 animate-pulse flex items-end gap-3 px-4 pb-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex-1 bg-slate-200 rounded-t" style={{ height: `${30 + Math.random() * 50}%` }}></div>
                ))}
              </div>
            ) : (
              <div className="h-64">
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                  }}
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Arriving Today</h2>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start border-b pb-3">
                    <div className="h-8 w-8 rounded-full bg-slate-200 mr-3 mt-1 shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-28 bg-slate-200 rounded"></div>
                      <div className="h-3 w-20 bg-slate-200 rounded"></div>
                      <div className="h-3 w-32 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : arriving.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <i className="fas fa-calendar-check text-3xl mb-2 block"></i>
                <p className="text-sm">No confirmed arrivals for today.</p>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-64">
                {[...arriving]
                  .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
                  .map(b => (
                    <div key={b.bookingId} className="flex items-start border-b pb-3">
                      <div className="bg-sky-100 text-sky-800 rounded-full h-8 w-8 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                        <i className="fas fa-user text-sm"></i>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{b.guest}</p>
                        <p className="text-xs text-slate-600">{b.roomType}</p>
                        <p className="text-xs text-sky-600">
                          {fmtTime(b.checkIn)} – {fmtTime(b.checkOut)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        {/* Overdue Checkouts — rose for severity consistency with the
            Overdue Checkout KPI card above (which is already rose) and
            the Rooms board's red OVERDUE chip. Amber would imply
            "warning, can wait" — overdue stays mean staff need to
            act now (call the room, free for the next arrival). */}
        {!loading && overdueCheckouts.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow p-6 border-l-4 border-rose-500">
            <h2 className="text-lg font-semibold text-rose-700 mb-3 flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i>
              Overdue Checkouts ({overdueCheckouts.length})
            </h2>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {overdueCheckouts.map(b => (
                <button
                  key={b.bookingId}
                  type="button"
                  onClick={() => navigate(`/frontdesk/bookings?booking=${b.bookingId}`)}
                  className="w-full flex items-center justify-between bg-rose-50 hover:bg-rose-100 rounded-lg px-4 py-2 text-left transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-rose-100 text-rose-700 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0 group-hover:bg-rose-200">
                      <i className="fas fa-user text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{b.guest}</p>
                      <p className="text-xs text-slate-500">{b.roomType} · Checkout was {fmtTime(b.checkOut)}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-rose-800 bg-rose-100 px-2 py-1 rounded-full">Overdue</span>
                    <i className="fas fa-chevron-right text-xs text-rose-500 group-hover:text-rose-700"></i>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
      <Toast message={toast} type={toastType} onClose={clearToast} />
    </Sidebar>
  );
}
