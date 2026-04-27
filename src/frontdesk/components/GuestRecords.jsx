import { useState, useEffect, useMemo, Fragment } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from './Layout/Sidebar';
import { getFdBookings } from '../../lib/frontdeskApi';
import Toast, { useToast } from '../../components/ui/Toast';
import { fmtDate, fmtMoney, fmtGuestEmail } from '../../lib/format';

// ─── helpers ──────────────────────────────────────────────────────────────────
function initials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Parse real guest info from the walk-in metadata blob that
// WalkInController builds into special_requests at creation time.
//
// Gate on the backend-attributed `source` field first — special_requests
// is user-controlled on online bookings, so a guest could craft
// "Walk-in: Forged Name, Phone: 555, Email: …" and trick this UI into
// displaying their chosen identity and grouping their visits under the
// wrong person. `source` is derived server-side from reservation_fee +
// paymongo_link_id and can't be forged by booking payload.
function parseWalkIn(b) {
  if (b?.source !== 'walk-in') return null;
  if (!b.specialRequests?.startsWith('Walk-in:')) return null;
  const name  = (b.specialRequests.match(/^Walk-in:\s*([^,]+)/) || [])[1]?.trim() || b.guest;
  const phone = (b.specialRequests.match(/Phone:\s*([^,]+)/) || [])[1]?.trim() || '—';
  const email = (b.specialRequests.match(/Email:\s*([^,]+)/) || [])[1]?.trim() || '—';
  return { name, phone, email };
}

// ─── component ────────────────────────────────────────────────────────────────
// `embedded` prop: see Bookings.jsx for the rationale — when true,
// the front-desk Sidebar + top bar are skipped so an outer shell
// (AdminShell) can wrap the page body instead.
export default function GuestRecords({ embedded = false }) {
  const Shell = embedded ? Fragment : Sidebar;
  const [sortBy,  setSortBy]  = useState('Last Visit');
  const [sortDir, setSortDir] = useState('desc');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, showToast, clearToast, toastType] = useToast();
  const [search, setSearch]     = useState('');
  const [viewGuest, setViewGuest] = useState(null);

  useEffect(() => {
    getFdBookings()
      .then(data => { setBookings(data); })
      .catch(() => showToast('Failed to load guest records.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Group bookings by guest identity.
  //  - user_id is the strongest identifier for AUTHED bookings — stable
  //    and non-spoofable. Walk-ins that enter the same email as an
  //    existing authed user never merge into that user's row.
  //  - For walk-ins / guest-token bookings (no user_id), email is the
  //    best identifier we have.
  //  - If no email, fall back to name+phone so distinct guests with the
  //    same name don't merge (as long as phones differ).
  //  - If both email and phone are missing, use the booking ID so each
  //    truly-anonymous record stays its own row.
  const guests = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      const wi    = parseWalkIn(b);
      const email = wi ? wi.email : (b.guestEmail || '—');
      const phone = wi ? wi.phone : (b.guestPhone || '—');
      // Guard: b.guest can be null on bookings with missing user data
      // (legacy records, malformed walk-ins). Without a fallback, the
      // search-filter predicate below calls .toLowerCase() on undefined
      // and throws — Array.filter propagates the error, useMemo throws,
      // React keeps the last-successful filtered list (everyone, from
      // when search was empty), and the user sees "search doesn't
      // filter." Falling back to a literal here keeps both filter and
      // sort comparator safe and renders cleanly in every name slot.
      const name  = (wi ? wi.name : b.guest) || 'Guest';
      let key;
      // Authed bookings: group by user_id. Walk-ins entering the same
      // email never collide with this key because their userId is null.
      if (b.userId != null && !wi) {
        key = `user:${b.userId}`;
      } else if (email && email !== '—') {
        key = `email:${email.toLowerCase()}`;
      } else if (phone && phone !== '—') {
        key = `np:${(name || '').toLowerCase()}|${phone}`;
      } else {
        key = `id:${b.id}`;
      }
      if (!map[key]) {
        // Persist the grouping key on the object so React row keys can
        // reuse it. Previously the row key was
        //   key={g.email || g.userId || g.name}
        // which collided whenever multiple guests shared a fallback
        // value (anonymous walk-ins all had email='—' and name='Guest'
        // → identical keys). React's reconciler against duplicate keys
        // is undefined-behavior-prone — when the filtered list shrunk
        // on search, stale rows from the prior render lingered in the
        // DOM. The grouping `key` here is already unique-per-guest by
        // construction (user_id / email / name+phone / booking_id), so
        // it's the right thing to render with too. Same pattern as
        // Bookings using b.bookingId.
        map[key] = { id: key, name, email, phone, visits: [] };
      }
      map[key].visits.push(b);
    });

    return Object.values(map).map(g => {
      // Pending bookings aren't "visits" — the guest hasn't committed
      // funds and the booking auto-cancels after 5 min. Surfacing them
      // in a guest's history inflated total-visit counts with records
      // that were about to disappear.
      const visits = g.visits.filter(v => v.status !== 'Pending');
      const sorted = [...visits].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
      const done   = visits.filter(v => v.status === 'Completed');
      // Total spend = paid_amount across all visits. Single source of
      // truth; Cancelled rows contribute the forfeited portion (₱0 if
      // abandoned, reservation_fee if they paid then cancelled), and
      // in-progress rows contribute whatever has been collected so
      // far. Previous status-based heuristic mis-counted abandoned
      // cancellations as having forfeited the quoted reservation fee.
      const totalSpend = visits.reduce((s, v) => s + Number(v.paidAmount ?? 0), 0);
      return {
        ...g,
        visits:          sorted,
        totalVisits:     visits.length,
        completedVisits: done.length,
        lastVisit:       sorted[0]?.checkIn ?? null,
        totalSpend,
      };
    }).sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
  }, [bookings]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Defensive coercion: name/email/phone *should* be strings after
    // the `guests` memo above, but a future regression upstream
    // shouldn't silently break filtering again. (|| '') keeps a
    // throwing predicate from cratering the whole memo.
    const list = !term ? guests : guests.filter(g =>
      (g.name  || '').toLowerCase().includes(term) ||
      (g.email || '').toLowerCase().includes(term) ||
      String(g.phone || '').includes(term)
    );
    return [...list].sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'Guest')         { aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); }
      else if (sortBy === 'Total Visits') { aVal = a.totalVisits;            bVal = b.totalVisits; }
      else if (sortBy === 'Completed')    { aVal = a.completedVisits;         bVal = b.completedVisits; }
      else if (sortBy === 'Total Spend')  { aVal = a.totalSpend;              bVal = b.totalSpend; }
      else { aVal = a.lastVisit ?? ''; bVal = b.lastVisit ?? ''; }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [guests, search, sortBy, sortDir]);

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <Helmet><title>Guest Records — Frontdesk</title></Helmet>
      {/* ── View Guest Modal ── */}
      {viewGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Guest history">
          <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Visit History — {viewGuest.name}</h3>
                <button onClick={() => setViewGuest(null)} className="text-slate-500 hover:text-slate-700" aria-label="Close">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Guest profile */}
              <div className="flex items-center mb-5 p-4 bg-slate-50 rounded">
                <div className="h-14 w-14 rounded-full bg-sky-600 text-white flex items-center justify-center text-lg font-bold mr-4 flex-shrink-0">
                  {initials(viewGuest.name)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{viewGuest.name}</p>
                  <p className="text-sm text-slate-600">{viewGuest.email}</p>
                  <p className="text-sm text-slate-500">{viewGuest.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-sky-700">{viewGuest.completedVisits}</p>
                  <p className="text-xs text-slate-500">Completed</p>
                  <p className="text-sm font-semibold text-emerald-700 mt-1">{fmtMoney(viewGuest.totalSpend)}</p>
                  <p className="text-xs text-slate-500">Total Spend</p>
                </div>
              </div>

              {/* Visit history — desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['ID', 'Room', 'Date', 'Guests', 'Amount', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewGuest.visits.map(v => (
                      <tr key={v.bookingId}>
                        <td className="px-3 py-2 text-xs text-slate-400">{v.id}</td>
                        <td className="px-3 py-2">{v.roomType}</td>
                        <td className="px-3 py-2 text-slate-600">{fmtDate(v.checkIn)}</td>
                        <td className="px-3 py-2 text-center">{v.guests}</td>
                        <td className="px-3 py-2">{fmtMoney(v.total)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            v.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            v.status === 'Confirmed' ? 'bg-sky-100 text-sky-800' :
                            v.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>{v.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 text-sm font-semibold">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right text-slate-600">Totals:</td>
                      <td className="px-3 py-2 text-center">{viewGuest.visits.reduce((s, v) => s + v.guests, 0)}</td>
                      <td className="px-3 py-2 text-emerald-700">{fmtMoney(viewGuest.totalSpend)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Visit history — mobile cards. Modal max-w-xl is wider
                  than a phone viewport, so the six-column desktop
                  table forces horizontal scroll inside the modal.
                  Card stack keeps every visit visible at a glance. */}
              <ul className="md:hidden space-y-2">
                {viewGuest.visits.map(v => (
                  <li key={v.bookingId} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-slate-800 truncate">{v.roomType}</p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{v.id}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-medium shrink-0 ${
                        v.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                        v.status === 'Confirmed' ? 'bg-sky-100 text-sky-800' :
                        v.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>{v.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Date</p>
                        <p className="text-slate-700 mt-0.5">{fmtDate(v.checkIn)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Guests</p>
                        <p className="text-slate-700 mt-0.5">{v.guests}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Amount</p>
                        <p className="text-slate-800 font-medium mt-0.5">{fmtMoney(v.total)}</p>
                      </div>
                    </div>
                  </li>
                ))}
                {/* Mobile equivalent of the tfoot — Totals row. */}
                <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-600">Totals</span>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        {viewGuest.visits.reduce((s, v) => s + v.guests, 0)} guests
                      </p>
                      <p className="font-semibold text-emerald-700">{fmtMoney(viewGuest.totalSpend)}</p>
                    </div>
                  </div>
                </li>
              </ul>

              <div className="flex justify-end mt-4">
                <button onClick={() => setViewGuest(null)}
                  className="px-4 py-2 border rounded text-sm text-slate-700">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Search */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true"></i>
              <input
                type="text"
                aria-label="Search guests by name, email, or phone"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-full w-full text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <p className="text-sm text-slate-500 whitespace-nowrap">
              {loading ? '—' : `${filtered.length} guest${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {loading ? (
            // Skeleton — see Bookings.jsx for the rationale. Two
            // variants: a ghost table for md+ that mirrors the real
            // table's column count, and a card-stack for <md that
            // mirrors the mobile card list rendered below.
            <>
            <div className="hidden md:block overflow-x-auto" aria-busy="true" aria-label="Loading guest records">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {['Guest', 'Contact', 'Total Visits', 'Completed', 'Last Visit', 'Total Spend', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-slate-200 mr-3 flex-shrink-0" />
                          <div className="h-3 w-28 bg-slate-200 rounded" />
                        </div>
                      </td>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-3 bg-slate-200 rounded" style={{ width: `${50 + ((i + j) * 7) % 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden space-y-3" aria-busy="true" aria-label="Loading guest records">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-slate-200 rounded w-32" />
                      <div className="h-3 bg-slate-100 rounded w-44" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <div key={j}>
                        <div className="h-2.5 bg-slate-100 rounded w-12 mb-1.5" />
                        <div className="h-3 bg-slate-200 rounded w-16" />
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            </>
          ) : (
          <>
            {/* Desktop table — wrapped in hidden md:block so the mobile
                card list (rendered after this block) is the only one
                visible <md. Seven columns with avatar + numerics
                doesn't fit phone widths without crushing. */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  {/* Header order MUST match the body-cell order below
                      (Guest → Contact → Total Visits → Completed →
                      Last Visit → Total Spend → Actions). The non-sortable
                      "Contact" column sits at position 2 between Guest
                      and Total Visits, before the sortable cluster. */}
                  <tr>
                    {[
                      { kind: 'sort',   label: 'Guest',        key: 'Guest' },
                      { kind: 'plain',  label: 'Contact' },
                      { kind: 'sort',   label: 'Total Visits', key: 'Total Visits' },
                      { kind: 'sort',   label: 'Completed',    key: 'Completed' },
                      { kind: 'sort',   label: 'Last Visit',   key: 'Last Visit' },
                      { kind: 'sort',   label: 'Total Spend',  key: 'Total Spend' },
                      { kind: 'plain',  label: 'Actions' },
                    ].map((col) => {
                      if (col.kind === 'plain') {
                        return (
                          <th key={col.label} scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                            {col.label}
                          </th>
                        );
                      }
                      const isSorted = sortBy === col.key;
                      const ariaSort = isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
                      return (
                        <th
                          key={col.key}
                          scope="col"
                          aria-sort={ariaSort}
                          className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase"
                        >
                          <button
                            onClick={() => { if(sortBy===col.key) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(col.key);setSortDir('asc');} }}
                            aria-label={`Sort by ${col.label}, currently ${ariaSort}`}
                            className="flex items-center gap-1 hover:text-sky-600 transition-colors group"
                          >
                            {col.label}
                            <span className="text-slate-400 group-hover:text-sky-400" aria-hidden="true">
                              {isSorted
                                ? <i className={`fas fa-arrow-${sortDir==='asc'?'up':'down'} text-sky-500`}></i>
                                : <i className="fas fa-sort opacity-40"></i>}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No guests found.</td>
                    </tr>
                  ) : filtered.map((g) => (
                    <tr
                      key={g.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View history for ${g.name}`}
                      className="hover:bg-slate-50 cursor-pointer focus:outline-none focus:bg-sky-50 focus:ring-2 focus:ring-inset focus:ring-sky-400"
                      onClick={() => setViewGuest(g)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setViewGuest(g);
                        }
                      }}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-sky-600 text-white flex items-center justify-center font-semibold mr-3 flex-shrink-0 text-sm">
                            {initials(g.name)}
                          </div>
                          <p className="font-medium text-sm text-slate-900">{g.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-700">{fmtGuestEmail(g.email)}</p>
                        <p className="text-xs text-slate-500">{g.phone}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-center text-slate-700">{g.totalVisits}</td>
                      <td className="px-4 py-4 text-sm text-center font-medium text-emerald-700">{g.completedVisits}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{fmtDate(g.lastVisit)}</td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-800">{fmtMoney(g.totalSpend)}</td>
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewGuest(g)}
                          className="text-sky-600 hover:text-sky-800 text-sm">
                          <i className="fas fa-eye mr-1" aria-hidden="true"></i>View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list — same data, single-column. Whole card
                is the click target; the View button (visible on
                desktop) collapses into the chevron affordance and an
                aria-label on the card. */}
            {filtered.length === 0 ? (
              <div className="md:hidden px-4 py-10 text-center text-slate-400">
                No guests found.
              </div>
            ) : (
              <ul className="md:hidden space-y-3">
                {filtered.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setViewGuest(g)}
                      className="w-full text-left rounded-xl border border-slate-200 bg-white shadow-sm p-4 hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-sky-400"
                      aria-label={`View history for ${g.name}`}
                    >
                      {/* Top — avatar + name + chevron */}
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-sky-600 text-white flex items-center justify-center font-semibold flex-shrink-0 text-sm">
                          {initials(g.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base text-slate-900 truncate">{g.name}</p>
                          <p className="text-xs text-slate-600 truncate">{fmtGuestEmail(g.email)}</p>
                          {g.phone && <p className="text-xs text-slate-500 truncate">{g.phone}</p>}
                        </div>
                        <i className="fas fa-chevron-right text-slate-300 text-xs" aria-hidden="true"></i>
                      </div>

                      {/* Stats — 2x2 grid */}
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Visits</p>
                          <p className="text-sm text-slate-700 mt-0.5">
                            {g.totalVisits}
                            <span className="text-emerald-700 font-medium"> · {g.completedVisits} done</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Last Visit</p>
                          <p className="text-sm text-slate-700 mt-0.5">{fmtDate(g.lastVisit)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Total Spend</p>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmtMoney(g.totalSpend)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
          )}
        </div>
      </main>
      <Toast message={toast} type={toastType} onClose={clearToast} />
    </Shell>
  );
}
