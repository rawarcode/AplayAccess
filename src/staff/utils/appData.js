const KEYS = {
  session: 'fd_session_v1',
  reservations: 'fd_reservations_v1',
  walkins: 'fd_walkins_v1'
};

const DEMO_USERS = [
  {
    email: 'frontdesk@aplayaccess.com',
    password: 'Aplaya123!',
    firstName: 'Frontdesk',
    lastName: 'Staff',
    role: 'frontdesk'
  },
  {
    email: 'admin@aplayaccess.com',
    password: 'Aplaya123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  },
  {
    email: 'owner@aplayaccess.com',
    password: 'Aplaya123!',
    firstName: 'Owner',
    lastName: 'User',
    role: 'owner'
  }
];

const DEFAULT_RESERVATIONS = [
  { id: '#4567', guest: 'Robert Chen', room: '305 - Deluxe Ocean View', dates: 'Jun 12 - Jun 18, 2023', status: 'confirmed' },
  { id: '#4566', guest: 'Maria Garcia', room: '412 - Family Suite', dates: 'Jun 12 - Jun 15, 2023', status: 'checked-in' },
  { id: '#4565', guest: 'James Wilson', room: '208 - Standard Garden View', dates: 'Jun 12 - Jun 14, 2023', status: 'pending' },
  { id: '#4564', guest: 'Emma Thompson', room: '-', dates: 'Jun 10 - Jun 12, 2023', status: 'cancelled' },
  { id: '#4563', guest: 'David Kim', room: '301 - Deluxe Ocean View', dates: 'Jun 8 - Jun 11, 2023', status: 'checked-out' }
];

const DEFAULT_WALKINS = [
  { id: 1, guest: 'Lisa Thompson', room: '207 - Standard Garden View', dates: 'Jun 12 - Jun 14, 2023', status: 'Checked In' },
  { id: 2, guest: 'John Smith', room: '301 - Deluxe Ocean View', dates: 'Jun 10 - Jun 15, 2023', status: 'Checked In' },
  { id: 3, guest: 'Emma Wilson', room: 'Pending Assignment', dates: 'Jun 15 - Jun 17, 2023', status: 'Pending' }
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loginUser(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const user = DEMO_USERS.find((u) => u.email === normalized && u.password === password);

  if (!user) {
    return { ok: false, error: 'Invalid credentials. Try frontdesk@aplayaccess.com / Aplaya123!' };
  }

  const sessionUser = {
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    role: user.role
  };

  return { ok: true, user: sessionUser };
}

export function setSession(user, keepSignedIn = false) {
  writeJson(KEYS.session, { ...user, keepSignedIn, loggedInAt: new Date().toISOString() });
}

export function getSession() {
  return readJson(KEYS.session, null);
}

export function clearSession() {
  localStorage.removeItem(KEYS.session);
}

export function isAuthenticated() {
  return !!getSession();
}

export function hasRole(allowedRoles = []) {
  if (!allowedRoles.length) return true;
  const session = getSession();
  return !!session && allowedRoles.includes(session.role);
}

export function getReservations() {
  const rows = readJson(KEYS.reservations, null);
  if (rows) return rows;
  writeJson(KEYS.reservations, DEFAULT_RESERVATIONS);
  return DEFAULT_RESERVATIONS;
}

export function saveReservations(rows) {
  writeJson(KEYS.reservations, rows);
}

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

export function saveWalkins(rows) {
  writeJson(KEYS.walkins, rows);
}

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
  const next = [
    {
      id: `#${idNum}`,
      guest,
      room: roomType,
      dates: `${checkin} - ${checkout}`,
      status: 'pending'
    },
    ...current
  ];
  saveReservations(next);
  return next;
}

export function getDashboardMetrics() {
  const reservations = getReservations();
  const walkins = getWalkins();

  const occupied = reservations.filter((r) => r.status === 'checked-in').length + walkins.filter((w) => w.status === 'Checked In').length;
  const checkins = reservations.filter((r) => r.status === 'checked-in').length;
  const checkouts = reservations.filter((r) => r.status === 'checked-out').length;
  const transactions = reservations.length + walkins.length;

  return { occupied, checkins, checkouts, transactions };
}
