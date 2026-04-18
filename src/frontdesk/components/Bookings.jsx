import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Layout/Sidebar';
import Toast, { useToast } from '../../components/ui/Toast';
import BookingDetailModal from './BookingDetailModal';
import { getFdBookings, getFdRooms, updateBookingStatus, checkInBooking, checkOutBooking, transferRoom, downloadStaffReceipt } from '../../lib/frontdeskApi';
import { fmtDateTime, fmtTime, fmtMoney } from '../../lib/format';


// ─── helpers ──────────────────────────────────────────────────────────────────

// Gate on the backend-attributed `source` — special_requests is user-
// controlled on online bookings, so a guest could craft "Walk-in: …" to
// forge identity/contact display here. `source` is derived server-side
// and can't be spoofed by payload.
function parseWalkIn(b) {
  if (b?.source !== 'walk-in') return null;
  if (!b.specialRequests?.startsWith('Walk-in:')) return null;
  const name  = (b.specialRequests.match(/^Walk-in:\s*([^,]+)/) || [])[1]?.trim() || b.guest;
  const phone = (b.specialRequests.match(/Phone:\s*([^,]+)/) || [])[1]?.trim() || '—';
  const email = (b.specialRequests.match(/Email:\s*([^,]+)/) || [])[1]?.trim() || '—';
  return { name, phone, email };
}

// A Pending booking with no payment and no active PayMongo session,
// older than 5 minutes, is effectively expired.
function isExpiredPending(b) {
  if (b.status !== 'Pending') return false;
  if (b.fullyPaid) return false;
  if (b.paymongoLinkId) return false;
  const created = new Date(b.createdAt);
  return Date.now() - created.getTime() > 5 * 60 * 1000;
}

// A Checked In booking whose scheduled checkout time has already passed
function isOverdueCheckout(b) {
  if (b.status !== 'Checked In' || !b.checkOut) return false;
  return new Date(String(b.checkOut).replace(' ', 'T')) < new Date();
}

function StatusBadge({ status, booking }) {
  if (status === 'Pending' && booking && isExpiredPending(booking)) {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-rose-100 text-rose-700 flex items-center gap-1 w-fit">
        <i className="fas fa-times-circle text-[10px]"></i>Expired
      </span>
    );
  }
  const cls = {
    Confirmed:    'bg-sky-100 text-sky-800',
    'Checked In': 'bg-violet-100 text-violet-800',
    Completed:    'bg-emerald-100 text-emerald-800',
    Cancelled:    'bg-rose-100 text-rose-800',
    Pending:      'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${cls[status] ?? 'bg-slate-100 text-slate-800'}`}>
      {status}
    </span>
  );
}

// Source pill — sits next to guest name. Encodes source via icon + text
// so the channel is readable without relying on colour alone.
function SourcePill({ source }) {
  if (source === 'walk-in') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
        <i className="fas fa-person-walking text-[9px]"></i>Walk-in
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800">
      <i className="fas fa-globe text-[9px]"></i>Online
    </span>
  );
}

// ─── component ────────────────────────────────────────────────────────────────
export default function Bookings() {
  const navigate                          = useNavigate();
  const [bookings, setBookings]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const [searchParams, setSearchParams]   = useSearchParams();
  const [sortBy, setSortBy]               = useState('Visit Time');
  const [sortDir, setSortDir]             = useState('asc');
  const [searchTerm, setSearchTerm]       = useState('');
  const VALID_STATUSES = ['Pending','Confirmed','Checked In','Completed','Cancelled','Overdue'];
  const VALID_SOURCES  = ['all','online','walkin'];
  const [filterStatus, setFilterStatus]   = useState(() => {
    const s = searchParams.get('status');
    return VALID_STATUSES.includes(s) ? s : 'All';
  });
  const [filterSource, setFilterSource]   = useState(() => {
    const s = searchParams.get('source');
    return VALID_SOURCES.includes(s) ? s : 'all';
  });

  // Re-sync filters when URL params change (e.g. clicking a notification while already on this page)
  useEffect(() => {
    const s = searchParams.get('status');
    setFilterStatus(VALID_STATUSES.includes(s) ? s : 'All');
    const src = searchParams.get('source');
    setFilterSource(VALID_SOURCES.includes(src) ? src : 'all');
  }, [searchParams]);

  const [viewBooking, setViewBooking]     = useState(null);
  const autoOpenedRef                     = useRef(null);

  useEffect(() => {
    const bookingParam = searchParams.get('booking');
    if (!bookingParam || bookings.length === 0) return;
    if (autoOpenedRef.current === bookingParam) return;
    const match = bookings.find(b => String(b.bookingId) === bookingParam || b.id === bookingParam);
    if (match) {
      autoOpenedRef.current = bookingParam;
      setViewBooking(match);
    }
  }, [searchParams, bookings]);

  const [confirmState, setConfirmState]   = useState(null);
  const [toast, showToast, clearToast, toastType] = useToast();

  const [rooms, setRooms]                 = useState([]);
  const [transferBooking, setTransferBooking] = useState(null);
  const [transferRoomId, setTransferRoomId]   = useState('');
  const [transferring, setTransferring]       = useState(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState(null);

  async function handleDownloadReceipt(b) {
    setReceiptLoadingId(b.bookingId);
    try {
      const blob = await downloadStaffReceipt(b.bookingId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${b.id}-receipt.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to download receipt.', 'error');
    } finally {
      setReceiptLoadingId(null);
    }
  }

  function load() {
    setLoading(true);
    Promise.all([getFdBookings(), getFdRooms()])
      .then(([bk, rm]) => { setBookings(bk); setRooms(rm); setError(''); })
      .catch(() => setError('Failed to load bookings.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  }

  // Write the source filter back to the URL so deep-links stick and the
  // notification redirects (?status=Pending&source=online) work predictably.
  function changeSource(src) {
    setFilterSource(src);
    const next = new URLSearchParams(searchParams);
    if (src === 'all') next.delete('source');
    else                next.set('source', src);
    setSearchParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    let list = bookings;

    // Source filter — online vs walk-in. Backend-attributed `source` field
    // is authoritative and cannot be spoofed by specialRequests.
    if (filterSource === 'online') list = list.filter(b => b.source !== 'walk-in');
    else if (filterSource === 'walkin') list = list.filter(b => b.source === 'walk-in');

    // Status filter
    if (filterStatus === 'Overdue') list = list.filter(isOverdueCheckout);
    else if (filterStatus !== 'All') list = list.filter(b => b.status === filterStatus);

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter(b => {
        const wi = parseWalkIn(b);
        const name = (wi ? wi.name : b.guest) ?? '';
        return (
          name.toLowerCase().includes(term) ||
          (b.id ?? '').toLowerCase().includes(term) ||
          (b.roomType ?? '').toLowerCase().includes(term)
        );
      });
    }
    return [...list].sort((a, b) => {
      let valA, valB;
      if (sortBy === 'ID') {
        valA = a.id ?? ''; valB = b.id ?? '';
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortBy === 'Guest') {
        const wiA = parseWalkIn(a), wiB = parseWalkIn(b);
        valA = ((wiA ? wiA.name : a.guest) ?? '').toLowerCase();
        valB = ((wiB ? wiB.name : b.guest) ?? '').toLowerCase();
      } else if (sortBy === 'Room') {
        valA = (a.roomType ?? '').toLowerCase();
        valB = (b.roomType ?? '').toLowerCase();
      } else if (sortBy === 'Visit Time') {
        valA = a.checkIn ?? ''; valB = b.checkIn ?? '';
      } else if (sortBy === 'Guests') {
        valA = Number(a.guests ?? 0); valB = Number(b.guests ?? 0);
        return sortDir === 'asc' ? valA - valB : valB - valA;
      } else if (sortBy === 'Total') {
        valA = Number(a.total ?? 0); valB = Number(b.total ?? 0);
        return sortDir === 'asc' ? valA - valB : valB - valA;
      } else if (sortBy === 'Status') {
        const ORDER = { Pending: 0, 'Checked In': 1, Confirmed: 2, Cancelled: 3, Completed: 4 };
        valA = ORDER[a.status] ?? 5; valB = ORDER[b.status] ?? 5;
        return sortDir === 'asc' ? valA - valB : valB - valA;
      } else {
        valA = ''; valB = '';
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [bookings, filterStatus, filterSource, searchTerm, sortBy, sortDir]);

  // Source-count badges for the segmented toggle
  const sourceCounts = useMemo(() => {
    let online = 0, walkin = 0;
    for (const b of bookings) {
      if (b.source === 'walk-in') walkin++; else online++;
    }
    return { all: bookings.length, online, walkin };
  }, [bookings]);

  function syncBooking(bookingId, updates) {
    setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, ...updates } : b));
  }

  async function execConfirm() {
    if (!confirmState) return;
    const { bookingId, action } = confirmState;
    setConfirmState(null);
    setActionLoading(bookingId);
    try {
      if (action === 'confirm') {
        await updateBookingStatus(bookingId, 'Confirmed');
        syncBooking(bookingId, { status: 'Confirmed' });
      } else if (action === 'checkin') {
        const res = await checkInBooking(bookingId);
        syncBooking(bookingId, { status: 'Checked In', checkedInAt: res.checkedInAt });
      } else if (action === 'checkout') {
        const res = await checkOutBooking(bookingId);
        syncBooking(bookingId, { status: 'Completed', checkedOutAt: res.checkedOutAt });
      } else if (action === 'cancel') {
        await updateBookingStatus(bookingId, 'Cancelled');
        syncBooking(bookingId, { status: 'Cancelled' });
      }
    } catch { showToast('Failed to update booking.'); }
    finally { setActionLoading(null); }
  }

  async function handleTransfer() {
    if (!transferBooking || !transferRoomId) return;
    setTransferring(true);
    try {
      const res = await transferRoom(transferBooking.bookingId, Number(transferRoomId));
      const newRoomName = rooms.find(r => String(r.id) === String(transferRoomId))?.name ?? res.room_name;
      syncBooking(transferBooking.bookingId, { roomType: newRoomName, roomId: Number(transferRoomId) });
      setTransferBooking(null);
      setTransferRoomId('');
      showToast(`Guest transferred to ${newRoomName}.`, 'success');
    } catch (err) {
      showToast(err?.response?.data?.message ?? 'Transfer failed. Room may be occupied.', 'error');
    } finally {
      setTransferring(false);
    }
  }

  const CONFIRM_CONFIG = {
    confirm:  { label: 'Confirm Booking', icon: 'fa-check',        color: 'sky',     desc: 'Mark this booking as confirmed?' },
    checkin:  { label: 'Check In Guest',  icon: 'fa-door-open',    color: 'violet',  desc: 'Check in the guest for this booking?' },
    checkout: { label: 'Check Out Guest', icon: 'fa-sign-out-alt', color: 'emerald', desc: 'Complete this booking and check out the guest?' },
    cancel:   { label: 'Cancel Booking',  icon: 'fa-ban',          color: 'rose',    desc: 'Cancel this booking? This cannot be undone.' },
  };
  const COLOR_BTN = { sky: 'bg-sky-600 hover:bg-sky-700', violet: 'bg-violet-600 hover:bg-violet-700', emerald: 'bg-emerald-600 hover:bg-emerald-700', rose: 'bg-rose-600 hover:bg-rose-700' };

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Sidebar>
      <Helmet><title>Bookings — Frontdesk</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} />
      {/* ── Quick-Action Confirmation Modal ── */}
      {confirmState && (() => {
        const cfg = CONFIRM_CONFIG[confirmState.action];
        const b   = confirmState.booking;
        const wi  = parseWalkIn(b);
        const guest = wi ? wi.name : b.guest;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Confirm action">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
              <div className={`rounded-t-2xl px-6 py-4 flex items-center gap-3 ${{confirm:'bg-sky-600',checkin:'bg-violet-600',checkout:'bg-emerald-600',cancel:'bg-rose-600'}[confirmState.action]}`}>
                <i className={`fas ${cfg.icon} text-white text-lg`}></i>
                <h3 className="text-white font-semibold text-base">{cfg.label}</h3>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-slate-600">{cfg.desc}</p>
                <div className="bg-slate-50 rounded-xl divide-y divide-slate-100 text-sm">
                  {[
                    ['Booking ID', b.id],
                    ['Guest',      guest],
                    ['Room',       b.roomType],
                    ['Total',      fmtMoney(b.total)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between px-4 py-2">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-800">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 pb-5 flex justify-end gap-3">
                <button onClick={() => setConfirmState(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={execConfirm}
                  className={`px-4 py-2 rounded-xl text-sm text-white font-medium ${COLOR_BTN[cfg.color]}`}>
                  {cfg.label}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Transfer Room Modal ── */}
      {transferBooking && (() => {
        const parseDT = (s) => new Date(String(s ?? '').replace(' ', 'T'));
        const transferStart = parseDT(transferBooking.checkIn);
        const transferEnd   = parseDT(transferBooking.checkOut);

        const overlapCounts = new Map();
        for (const b of bookings) {
          if (b.bookingId === transferBooking.bookingId) continue;
          if (['Cancelled', 'Completed'].includes(b.status)) continue;
          const s = parseDT(b.checkIn);
          const e = parseDT(b.checkOut);
          if (isNaN(s.getTime()) || isNaN(e.getTime())) continue;
          if (s < transferEnd && e > transferStart) {
            overlapCounts.set(b.roomId, (overlapCounts.get(b.roomId) ?? 0) + 1);
          }
        }

        const availableRooms = rooms.filter(r => {
          if (String(r.id) === String(transferBooking.roomId)) return false;
          const taken = overlapCounts.get(r.id) ?? 0;
          const qty   = Number(r.quantity ?? 1);
          return taken < qty;
        });
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Transfer room">
            <div className="bg-white rounded-lg w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Transfer Guest — {transferBooking.id}</h3>
                  <button onClick={() => { setTransferBooking(null); setTransferRoomId(''); }}
                    className="text-slate-500 hover:text-slate-700" aria-label="Close"><i className="fas fa-times"></i></button>
                </div>
                <div className="p-4 bg-slate-50 rounded mb-4 text-sm">
                  <p className="font-medium text-slate-800">{parseWalkIn(transferBooking)?.name ?? transferBooking.guest}</p>
                  <p className="text-slate-600">Currently in: <span className="font-semibold">{transferBooking.roomType}</span></p>
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Transfer to Room</label>
                  {availableRooms.length === 0 ? (
                    <p className="text-sm text-rose-600">No other rooms are available for this time slot.</p>
                  ) : (
                    <select value={transferRoomId} onChange={e => setTransferRoomId(e.target.value)}
                      aria-label="Transfer to room"
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                      <option value="">Select a room...</option>
                      {availableRooms.map(r => {
                        const qty   = Number(r.quantity ?? 1);
                        const taken = overlapCounts.get(r.id) ?? 0;
                        const free  = Math.max(0, qty - taken);
                        const suffix = qty > 1 ? ` — ${free} of ${qty} free` : '';
                        return (
                          <option key={r.id} value={r.id}>{r.name}{suffix}</option>
                        );
                      })}
                    </select>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setTransferBooking(null); setTransferRoomId(''); }}
                    className="px-4 py-2 border rounded text-sm text-slate-700">Cancel</button>
                  <button onClick={handleTransfer} disabled={!transferRoomId || transferring || availableRooms.length === 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-60">
                    <i className="fas fa-exchange-alt mr-1"></i>
                    {transferring ? 'Transferring...' : 'Transfer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── View Booking Modal ── */}
      {viewBooking && (
        <BookingDetailModal
          booking={viewBooking}
          onClose={() => {
            setViewBooking(null);
            if (searchParams.get('booking')) {
              const next = new URLSearchParams(searchParams);
              next.delete('booking');
              setSearchParams(next, { replace: true });
            }
          }}
          onUpdated={updated => {
            setViewBooking(updated);
            syncBooking(updated.bookingId, updated);
          }}
          showToast={showToast}
        />
      )}

      {/* ── Main ── */}
      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Title row + New Walk-in */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">Bookings</h1>
              <span className="text-sm text-slate-500">
                {filtered.length} of {bookings.length} shown
              </span>
            </div>
            <button
              onClick={() => navigate('/frontdesk/walkin')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold shadow-sm"
            >
              <i className="fas fa-plus"></i>New Walk-in
            </button>
          </div>

          {/* Source segmented toggle — primary slicer */}
          <div className="mb-4">
            <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {[
                { key: 'all',    label: 'All',     icon: null,                 active: 'bg-white shadow text-slate-900',    dot: 'bg-slate-400' },
                { key: 'online', label: 'Online',  icon: 'fa-globe',           active: 'bg-white shadow text-sky-700',       dot: 'bg-sky-500'    },
                { key: 'walkin', label: 'Walk-in', icon: 'fa-person-walking',  active: 'bg-white shadow text-amber-700',     dot: 'bg-amber-500'  },
              ].map(opt => {
                const isActive = filterSource === opt.key;
                const count    = sourceCounts[opt.key];
                return (
                  <button
                    key={opt.key}
                    onClick={() => changeSource(opt.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive ? opt.active : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.icon && <i className={`fas ${opt.icon} text-xs`}></i>}
                    <span>{opt.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? opt.dot + ' text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + status filter */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <input type="text" aria-label="Search bookings" placeholder="Search name, ID, room…"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 text-sm flex-1 min-w-[160px]" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border rounded px-3 py-2 text-sm">
              <option value="All">All Statuses</option>
              <option>Pending</option>
              <option>Confirmed</option>
              <option>Checked In</option>
              <option>Completed</option>
              <option>Cancelled</option>
              <option>Overdue</option>
            </select>
            <button onClick={load} className="flex items-center gap-2 text-sky-600 hover:text-sky-800 text-sm ml-auto">
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded text-sm">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Loading bookings...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {['ID', 'Guest', 'Room', 'Visit Time', 'Guests', 'Total', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <button onClick={() => handleSort(h)}
                          className="flex items-center gap-1 hover:text-sky-600 transition-colors group">
                          {h}
                          <span className="text-slate-400 group-hover:text-sky-400">
                            {sortBy === h
                              ? <i className={`fas fa-arrow-${sortDir === 'asc' ? 'up' : 'down'} text-sky-500`}></i>
                              : <i className="fas fa-sort opacity-40"></i>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No bookings found.</td></tr>
                  ) : filtered.map(b => {
                    const wi       = parseWalkIn(b);
                    const isWalkIn = b.source === 'walk-in';
                    const overdue  = isOverdueCheckout(b);

                    // Row color — overdue overrides source tint. Source tint
                    // is subtle (bg-*-50) so it does not compete with the
                    // status pill for the eye.
                    const rowCls = overdue
                      ? 'bg-rose-50 hover:bg-rose-100 border-l-4 border-rose-500'
                      : isWalkIn
                        ? 'bg-amber-50/60 hover:bg-amber-100/80 border-l-4 border-amber-400'
                        : 'bg-white hover:bg-slate-50 border-l-4 border-sky-200';

                    return (
                      <tr key={b.bookingId} role="button" tabIndex={0}
                          className={`cursor-pointer ${rowCls}`}
                          onClick={() => setViewBooking(b)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewBooking(b); }}}>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{b.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900">{wi ? wi.name : b.guest}</p>
                            <SourcePill source={b.source} />
                          </div>
                          <p className="text-xs text-slate-500">{wi ? wi.email : b.guestEmail}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{b.roomType}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {fmtDateTime(b.checkIn)}<br />
                          <span className="text-slate-400">→ {fmtTime(b.checkOut)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{b.guests}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{fmtMoney(b.total)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={b.status} booking={b} />
                            {overdue && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 flex items-center gap-1">
                                <i className="fas fa-exclamation-triangle text-[9px]"></i>Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setViewBooking(b)} title="View details"
                              className="text-sky-600 hover:text-sky-800">
                              <i className="fas fa-eye"></i>
                            </button>
                            {b.status === 'Pending' && Number(b.paidAmount ?? 0) > 0 && (
                              <button onClick={() => setConfirmState({ bookingId: b.bookingId, action: 'confirm', booking: b })}
                                disabled={actionLoading === b.bookingId}
                                title="Confirm" className="text-sky-600 hover:text-sky-800 disabled:opacity-40">
                                <i className="fas fa-check"></i>
                              </button>
                            )}
                            {b.status === 'Confirmed' && (
                              <button onClick={() => setConfirmState({ bookingId: b.bookingId, action: 'checkin', booking: b })}
                                disabled={actionLoading === b.bookingId}
                                title="Check In" className="text-purple-600 hover:text-purple-800 disabled:opacity-40">
                                <i className="fas fa-door-open"></i>
                              </button>
                            )}
                            {b.status === 'Checked In' && (
                              <>
                                <span title="Go to Billing to collect payment &amp; complete" className="text-emerald-500 cursor-default opacity-60">
                                  <i className="fas fa-file-invoice-dollar"></i>
                                </span>
                                <button
                                  onClick={() => { setTransferBooking(b); setTransferRoomId(''); }}
                                  disabled={actionLoading === b.bookingId}
                                  title="Transfer to another room"
                                  className="text-indigo-600 hover:text-indigo-800 disabled:opacity-40">
                                  <i className="fas fa-exchange-alt"></i>
                                </button>
                              </>
                            )}
                            {b.status === 'Pending' && (
                              <button onClick={() => setConfirmState({ bookingId: b.bookingId, action: 'cancel', booking: b })}
                                disabled={actionLoading === b.bookingId}
                                title="Cancel" className="text-rose-600 hover:text-rose-800 disabled:opacity-40">
                                <i className="fas fa-ban"></i>
                              </button>
                            )}
                            {b.status !== 'Pending' && (
                              <button onClick={() => handleDownloadReceipt(b)}
                                disabled={receiptLoadingId === b.bookingId}
                                title="Download receipt (PDF)"
                                className="text-slate-500 hover:text-slate-800 disabled:opacity-40">
                                {receiptLoadingId === b.bookingId
                                  ? <i className="fas fa-spinner fa-spin"></i>
                                  : <i className="fas fa-file-pdf"></i>}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1 h-4 bg-sky-300 rounded"></span>
              <i className="fas fa-globe text-sky-500 text-[10px]"></i> Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1 h-4 bg-amber-400 rounded"></span>
              <i className="fas fa-person-walking text-amber-500 text-[10px]"></i> Walk-in
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1 h-4 bg-rose-500 rounded"></span>
              <i className="fas fa-exclamation-triangle text-rose-500 text-[10px]"></i> Overdue checkout
            </span>
          </div>
        </div>
      </main>
    </Sidebar>
  );
}
