// Data-only utilities for frontdesk (auth handled by AuthContext)
const KEYS = {
  reservations: 'fd_reservations_v1',
  walkins:      'fd_walkins_v1',
};

const DEFAULT_RESERVATIONS = [
  { id: '#4567', guest: 'Robert Chen',    room: '305 - Deluxe Ocean View',       dates: 'Jun 12 - Jun 18, 2023', status: 'confirmed'   },
  { id: '#4566', guest: 'Maria Garcia',   room: '412 - Family Suite',             dates: 'Jun 12 - Jun 15, 2023', status: 'checked-in'  },
  { id: '#4565', guest: 'James Wilson',   room: '208 - Standard Garden View',     dates: 'Jun 12 - Jun 14, 2023', status: 'pending'     },
  { id: '#4564', guest: 'Emma Thompson',  room: '-',                              dates: 'Jun 10 - Jun 12, 2023', status: 'cancelled'   },
  { id: '#4563', guest: 'David Kim',      room: '301 - Deluxe Ocean View',        dates: 'Jun 8 - Jun 11, 2023',  status: 'checked-out' },
];

const DEFAULT_WALKINS = [
  { id: 1, guest: 'Lisa Thompson', room: '207 - Standard Garden View', dates: 'Jun 12 - Jun 14, 2023', status: 'Checked In' },
  { id: 2, guest: 'John Smith',    room: '301 - Deluxe Ocean View',    dates: 'Jun 10 - Jun 15, 2023', status: 'Checked In' },
  { id: 3, guest: 'Emma Wilson',   room: 'Pending Assignment',         dates: 'Jun 15 - Jun 17, 2023', status: 'Pending'    },
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getReservations() {
  const rows = readJson(KEYS.reservations, null);
  if (rows) return rows;
  writeJson(KEYS.reservations, DEFAULT_RESERVATIONS);
  return DEFAULT_RESERVATIONS;
}

export function saveReservations(rows) { writeJson(KEYS.reservations, rows); }

export function removeReservationById(id) {
  const next = getReservations().filter((r) => r.id !== id);
  saveReservations(next);
  return next;
}

export function updateReservation(id, patch) {
  const next = getReservations().map((r) => (r.id === id ? { ...r, ...patch } : r));
  saveReservations(next);
  return next;
}

export function getWalkins() {
  const rows = readJson(KEYS.walkins, null);
  if (rows) return rows;
  writeJson(KEYS.walkins, DEFAULT_WALKINS);
  return DEFAULT_WALKINS;
}

export function saveWalkins(rows) { writeJson(KEYS.walkins, rows); }

export function addWalkin(entry) {
  const current = getWalkins();
  const next = [{ ...entry, id: Date.now() }, ...current];
  saveWalkins(next);
  return next;
}

export function updateWalkin(guestName, patch) {
  const next = getWalkins().map((w) => (w.guest === guestName ? { ...w, ...patch } : w));
  saveWalkins(next);
  return next;
}

export function addReservationFromWalkin({ guest, roomType, checkin, checkout }) {
  const current = getReservations();
  const idNum = Math.max(4600, ...current.map((r) => Number(String(r.id).replace('#', '')) || 0)) + 1;
  const next = [{ id: `#${idNum}`, guest, room: roomType, dates: `${checkin} - ${checkout}`, status: 'pending' }, ...current];
  saveReservations(next);
  return next;
}

export function getDashboardMetrics() {
  const reservations = getReservations();
  const walkins      = getWalkins();
  const occupied     = reservations.filter((r) => r.status === 'checked-in').length + walkins.filter((w) => w.status === 'Checked In').length;
  return {
    occupied,
    checkins:     reservations.filter((r) => r.status === 'checked-in').length,
    checkouts:    reservations.filter((r) => r.status === 'checked-out').length,
    transactions: reservations.length + walkins.length,
  };
}
