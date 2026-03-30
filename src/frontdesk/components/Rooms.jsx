import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Layout/Sidebar';
import { getFdBookings, getFdRooms, updateHousekeeping } from '../../lib/frontdeskApi';
import Toast, { useToast } from '../../components/ui/Toast';
import NotificationBell from '../../components/ui/NotificationBell';
import BookingDetailModal from './BookingDetailModal';

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtTime(dt) {
  if (!dt) return '—';
  return new Date(dt.replace(' ', 'T')).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function countdown(ms) {
  if (ms <= 0) return null;
  const totalMins = Math.floor(ms / 60000);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0)              return `${hrs}h`;
  return `${mins}m`;
}

// Overnight bookings have check-out before 7AM (i.e., 6AM)
function isOvernightBooking(b) {
  const co = new Date(b.checkOut.replace(' ', 'T'));
  return co.getHours() < 7;
}

// ─── Day slot status ───────────────────────────────────────────────────────────
// Looks at today's bookings that check out by 5PM (day visits)
function getDayStatus(roomName, bookings) {
  const now     = new Date();
  const today   = todayStr();

  const dayBk = bookings.filter(b =>
    b.roomType === roomName &&
    b.checkIn?.slice(0, 10) === today &&
    b.status !== 'Cancelled' &&
    !isOvernightBooking(b)
  );

  for (const b of dayBk) {
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));

    if (now >= ci && now < co) {
      const ms = co - now;
      return {
        status:    'occupied',
        booking:   b,
        vacatesAt: b.checkOut,
        remaining: countdown(ms),
        urgency:   ms < 30 * 60000 ? 'soon' : 'normal',
      };
    }
    if (now < ci) {
      return {
        status:    b.status === 'Pending' ? 'pending' : 'incoming',
        booking:   b,
        arrivesAt: b.checkIn,
        eta:       countdown(ci - now),
      };
    }
  }

  return { status: 'vacant' };
}

// ─── Overnight slot status ─────────────────────────────────────────────────────
// Looks at tonight's overnight booking (6PM today → 6AM tomorrow)
// or a currently-in-progress overnight (started yesterday 6PM, ends 6AM today)
function getOvernightStatus(roomName, bookings) {
  const now   = new Date();
  const today = todayStr();

  const ovBk = bookings.filter(b => {
    if (b.roomType !== roomName || b.status === 'Cancelled') return false;
    if (!isOvernightBooking(b)) return false;
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));
    // Relevant if currently in progress OR check-in is today (tonight)
    return (now >= ci && now < co) || ci.toISOString().slice(0, 10) === today;
  });

  for (const b of ovBk) {
    const ci = new Date(b.checkIn.replace(' ', 'T'));
    const co = new Date(b.checkOut.replace(' ', 'T'));

    if (now >= ci && now < co) {
      const ms = co - now;
      return {
        status:    'occupied',
        booking:   b,
        vacatesAt: b.checkOut,
        remaining: countdown(ms),
        urgency:   ms < 30 * 60000 ? 'soon' : 'normal',
      };
    }
    if (now < ci) {
      return {
        status:    b.status === 'Pending' ? 'pending' : 'incoming',
        booking:   b,
        arrivesAt: b.checkIn,
        eta:       countdown(ci - now),
      };
    }
  }

  return { status: 'vacant' };
}

// ─── status card config ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  vacant:   { bg: 'bg-green-500',  border: 'border-green-600',  text: 'text-white',      label: 'VACANT',   icon: 'fa-check-circle'  },
  occupied: { bg: 'bg-red-500',    border: 'border-red-600',    text: 'text-white',      label: 'OCCUPIED', icon: 'fa-door-closed'   },
  incoming: { bg: 'bg-blue-500',   border: 'border-blue-600',   text: 'text-white',      label: 'ARRIVING', icon: 'fa-person-walking' },
  pending:  { bg: 'bg-yellow-400', border: 'border-yellow-500', text: 'text-gray-900',   label: 'PENDING',  icon: 'fa-clock'         },
};

// ─── Housekeeping badge ───────────────────────────────────────────────────────
const HK_CONFIG = {
  clean:   { label: 'Clean',    bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'fa-check'         },
  dirty:   { label: 'Dirty',    bg: 'bg-orange-100',  text: 'text-orange-700',  icon: 'fa-broom'         },
  cleaning:{ label: 'Cleaning', bg: 'bg-sky-100',     text: 'text-sky-700',     icon: 'fa-soap'          },
};
const HK_NEXT = { clean: 'dirty', dirty: 'cleaning', cleaning: 'clean' };

// ─── HousekeepingModal — shown when card has no active booking (vacant) ───────
function HousekeepingModal({ room, onClose, onHousekeepingChange, onWalkIn }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
         onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="bg-green-500 rounded-t-xl p-5 flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-2 py-1 rounded-full bg-black bg-opacity-25 text-white mb-2">
              <i className="fas fa-check-circle text-xs"></i> VACANT
            </span>
            <h2 className="text-xl font-bold text-white leading-tight">{room.name}</h2>
            {room.type && <p className="text-sm opacity-80 text-white mt-0.5">{room.type}</p>}
          </div>
          <button onClick={onClose} className="text-white opacity-70 hover:opacity-100 text-xl font-bold">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="p-5">
          {/* Walk-in button */}
          <button
            onClick={onWalkIn}
            className="w-full mb-4 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <i className="fas fa-person-walking"></i>
            Walk-in Booking for {room.name}
          </button>

          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Housekeeping Status</p>
          <div className="flex gap-2">
            {['clean', 'dirty', 'cleaning'].map(status => {
              const hk = HK_CONFIG[status];
              const active = (room.housekeeping_status ?? 'clean') === status;
              return (
                <button
                  key={status}
                  onClick={() => { onHousekeepingChange(room.id, status); onClose(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border-2 transition-all
                    ${active ? `${hk.bg} ${hk.text} border-current` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
                >
                  <i className={`fas ${hk.icon}`}></i>{hk.label}
                  {active && <i className="fas fa-check text-[10px]"></i>}
                </button>
              );
            })}
          </div>
          <button onClick={onClose} className="mt-4 w-full py-2 border rounded text-sm text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function guestName(booking) {
  if (!booking) return null;
  const match = booking.specialRequests?.match(/^Walk-in:\s*([^,]+)/);
  return match?.[1]?.trim() || booking.guest || null;
}

// ─── RoomCard ─────────────────────────────────────────────────────────────────
function RoomCard({ room, info, onHousekeepingChange, onClick }) {
  const config = STATUS_CONFIG[info.status];
  const hk     = HK_CONFIG[room.housekeeping_status ?? 'clean'];
  const guest  = guestName(info.booking);

  return (
    <div
      onClick={onClick}
      className={`
        ${config.bg} ${config.border} ${config.text}
        border-2 rounded-xl p-4 flex flex-col justify-between
        min-h-[160px] shadow-md transition-all duration-300 cursor-pointer
        hover:opacity-90 hover:scale-[1.02]
        ${info.status === 'occupied' && info.urgency === 'soon' ? 'animate-pulse' : ''}
      `}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`
          flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase
          px-2 py-1 rounded-full
          ${info.status === 'pending' ? 'bg-yellow-500 text-gray-900' : 'bg-black bg-opacity-25 text-white'}
        `}>
          <i className={`fas ${config.icon} text-xs`}></i>
          {config.label}
        </span>
        {info.status === 'occupied' && info.urgency === 'soon' && (
          <span className="text-xs font-bold bg-white bg-opacity-30 px-2 py-0.5 rounded-full">⚡ Soon</span>
        )}
      </div>

      {/* Room name */}
      <div>
        <p className="text-base font-bold leading-tight">{room.name}</p>
        {room.type && (
          <p className={`text-xs mt-0.5 ${info.status === 'pending' ? 'text-gray-700' : 'opacity-80'}`}>
            {room.type}
          </p>
        )}
        {guest && (
          <p className={`text-xs mt-1 font-semibold truncate ${info.status === 'pending' ? 'text-gray-800' : 'text-white opacity-90'}`}>
            <i className="fas fa-user mr-1 opacity-70"></i>{guest}
          </p>
        )}
      </div>

      {/* Housekeeping badge — tap to cycle */}
      <button
        onClick={e => { e.stopPropagation(); onHousekeepingChange(room.id, HK_NEXT[room.housekeeping_status ?? 'clean']); }}
        className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${hk.bg} ${hk.text} hover:opacity-80 transition-opacity`}
        title="Click to update housekeeping status"
      >
        <i className={`fas ${hk.icon} text-xs`}></i>{hk.label}
      </button>

      {/* Status detail */}
      <div className="mt-2">
        {info.status === 'vacant' && (
          <p className="text-sm font-medium opacity-90">
            <i className="fas fa-circle-check mr-1"></i>Ready for guests
          </p>
        )}
        {info.status === 'occupied' && (
          <div>
            <p className="text-sm font-semibold">
              <i className="fas fa-clock mr-1 opacity-80"></i>Vacates at {fmtTime(info.vacatesAt)}
            </p>
            {info.remaining && (
              <p className={`text-xs mt-0.5 font-bold ${info.urgency === 'soon' ? 'text-yellow-200' : 'opacity-75'}`}>
                {info.remaining} remaining
              </p>
            )}
          </div>
        )}
        {info.status === 'incoming' && (
          <div>
            <p className="text-sm font-semibold">
              <i className="fas fa-arrow-right mr-1 opacity-80"></i>Arrives at {fmtTime(info.arrivesAt)}
            </p>
            {info.eta && <p className="text-xs mt-0.5 opacity-75 font-medium">in {info.eta}</p>}
          </div>
        )}
        {info.status === 'pending' && (
          <div>
            <p className="text-sm font-semibold text-gray-800">
              <i className="fas fa-exclamation-circle mr-1"></i>Awaiting confirmation
            </p>
            {info.booking && (
              <p className="text-xs mt-0.5 text-gray-700">Scheduled {fmtTime(info.booking.checkIn)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────
export default function FDRooms() {
  const navigate = useNavigate();
  const [rooms, setRooms]       = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter]     = useState('all');
  const [selectedSlot, setSelectedSlot] = useState(null); // { room, info }
  const [toast, showToast, clearToast, toastType] = useToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getFdRooms(), getFdBookings()])
      .then(([rm, bk]) => { setRooms(rm); setBookings(bk); setError(''); setLastRefresh(new Date()); })
      .catch(() => setError('Failed to load room data.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleHousekeeping(roomId, newStatus) {
    // Optimistic update
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, housekeeping_status: newStatus } : r));
    try {
      await updateHousekeeping(roomId, newStatus);
    } catch {
      // Revert on failure
      load();
      showToast('Failed to update housekeeping status.');
    }
  }

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  // Compute day and overnight info for every room
  const roomInfos = useMemo(() => rooms.map(r => ({
    room:      r,
    dayInfo:   getDayStatus(r.name, bookings),
    nightInfo: getOvernightStatus(r.name, bookings),
  })), [rooms, bookings]);

  // Summary counts (day + overnight combined)
  const counts = useMemo(() => {
    const c = { vacant: 0, occupied: 0, incoming: 0, pending: 0 };
    roomInfos.forEach(({ dayInfo, nightInfo }) => {
      c[dayInfo.status]   = (c[dayInfo.status]   || 0) + 1;
      c[nightInfo.status] = (c[nightInfo.status] || 0) + 1;
    });
    return c;
  }, [roomInfos]);

  // Filter applies to both sections (show only rooms where at least one slot matches)
  const filteredInfos = useMemo(() => {
    if (filter === 'all') return roomInfos;
    return roomInfos.filter(({ dayInfo, nightInfo }) =>
      dayInfo.status === filter || nightInfo.status === filter
    );
  }, [roomInfos, filter]);

  const FILTERS = [
    { key: 'all',      label: 'All Rooms',  color: 'bg-gray-700 text-white'       },
    { key: 'vacant',   label: 'Vacant',     color: 'bg-green-500 text-white'      },
    { key: 'occupied', label: 'Occupied',   color: 'bg-red-500 text-white'        },
    { key: 'incoming', label: 'Arriving',   color: 'bg-blue-500 text-white'       },
    { key: 'pending',  label: 'Pending',    color: 'bg-yellow-400 text-gray-900'  },
  ];

  return (
    <Sidebar>
      <Toast message={toast} type={toastType} onClose={clearToast} />
      {selectedSlot && (
        selectedSlot.info.booking ? (
          <BookingDetailModal
            booking={selectedSlot.info.booking}
            onClose={() => setSelectedSlot(null)}
            onUpdated={() => load()}
            showToast={showToast}
          />
        ) : (
          <HousekeepingModal
            room={selectedSlot.room}
            onClose={() => setSelectedSlot(null)}
            onHousekeepingChange={handleHousekeeping}
            onWalkIn={() => navigate('/frontdesk/walkin', { state: { preselectedRoom: selectedSlot.room } })}
          />
        )
      )}
      {/* ── Header ── */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Room Status</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated: {lastRefresh.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}
              <span className="ml-2 text-gray-300">· Auto-refreshes every 60s</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {/* ── Summary bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Vacant',   count: counts.vacant,   bg: 'bg-green-500',             icon: 'fa-check-circle'   },
            { label: 'Occupied', count: counts.occupied,  bg: 'bg-red-500',               icon: 'fa-door-closed'    },
            { label: 'Arriving', count: counts.incoming,  bg: 'bg-blue-500',              icon: 'fa-person-walking' },
            { label: 'Pending',  count: counts.pending,   bg: 'bg-yellow-400 text-gray-900', icon: 'fa-clock'       },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3 text-white shadow`}>
              <i className={`fas ${s.icon} text-2xl opacity-80`}></i>
              <div>
                <p className="text-3xl font-extrabold leading-none">{loading ? '—' : s.count}</p>
                <p className="text-xs font-medium opacity-90 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border-2 ${
                filter === f.key
                  ? `${f.color} border-transparent shadow`
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <i className="fas fa-spinner fa-spin text-3xl mb-3 block"></i>Loading room status...
          </div>
        ) : filteredInfos.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <i className="fas fa-door-open text-3xl mb-3 block"></i>No rooms match this filter.
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Day Section ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <i className="fas fa-sun text-amber-500"></i>
                  <span className="font-semibold text-amber-800 text-sm">Day Visit</span>
                  <span className="text-xs text-amber-600">7:00 AM – 5:00 PM · ₱1,500</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredInfos
                  .filter(({ dayInfo }) => filter === 'all' || dayInfo.status === filter)
                  .map(({ room, dayInfo }) => (
                    <RoomCard key={`day-${room.id}`} room={room} info={dayInfo} onHousekeepingChange={handleHousekeeping}
                      onClick={() => setSelectedSlot({ room, info: dayInfo })} />
                  ))
                }
              </div>
              {filteredInfos.filter(({ dayInfo }) => filter === 'all' || dayInfo.status === filter).length === 0 && (
                <p className="text-gray-400 text-sm py-4">No day rooms match this filter.</p>
              )}
            </div>

            {/* ── Overnight Section ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
                  <i className="fas fa-moon text-indigo-500"></i>
                  <span className="font-semibold text-indigo-800 text-sm">Overnight Stay</span>
                  <span className="text-xs text-indigo-600">6:00 PM – 6:00 AM · ₱2,000</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredInfos
                  .filter(({ nightInfo }) => filter === 'all' || nightInfo.status === filter)
                  .map(({ room, nightInfo }) => (
                    <RoomCard key={`night-${room.id}`} room={room} info={nightInfo} onHousekeepingChange={handleHousekeeping}
                      onClick={() => setSelectedSlot({ room, info: nightInfo })} />
                  ))
                }
              </div>
              {filteredInfos.filter(({ nightInfo }) => filter === 'all' || nightInfo.status === filter).length === 0 && (
                <p className="text-gray-400 text-sm py-4">No overnight rooms match this filter.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="mt-8 space-y-2">
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Vacant — ready for guests</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Occupied — shows time until vacant</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Arriving — confirmed, not yet checked in</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span> Pending — booking not yet confirmed</span>
            <span className="flex items-center gap-1.5"><span className="text-base">⚡</span> Soon — vacating within 30 minutes</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="font-medium text-gray-400">Housekeeping badge (tap to update):</span>
            <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">Clean</span></span>
            <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">Dirty</span></span>
            <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs">Cleaning</span></span>
          </div>
        </div>
      </main>
    </Sidebar>
  );
}
