import { useCallback, useEffect, useState } from "react";
import { getAdminHistory, getAdminHistoryFacets } from "../../lib/adminApi";
import useDebounce from "../../hooks/useDebounce.js";
import Modal from "../../components/modals/Modal.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { fmtDateTime } from "../../lib/format";
import { printHtml } from "../../lib/print.js";

// ── Category config ──────────────────────────────────────────────────────────
// When adding a new category, also add a QUICK_FILTERS entry below AND a
// CATEGORY_STYLES entry. Unknown categories render with the "system" style
// as a fallback so nothing breaks if the backend logs a fresh category the
// frontend hasn't learned about yet.
const CATEGORIES = [
  { value: "",             label: "All Categories" },
  { value: "booking",      label: "Booking" },
  { value: "payment",      label: "Payment" },
  { value: "room",         label: "Rooms" },
  { value: "user",         label: "Users" },
  { value: "auth",         label: "Auth" },
  { value: "promo",        label: "Promo Codes" },
  { value: "settings",     label: "Settings" },
  { value: "content",      label: "Content" },
  { value: "gallery",      label: "Gallery" },
  { value: "announcement", label: "Announcements" },
  { value: "newsletter",   label: "Newsletter" },
  { value: "upload",       label: "Media Uploads" },
  { value: "message",      label: "Messages" },
  { value: "review",       label: "Reviews" },
  { value: "system",       label: "System" },
];

const CATEGORY_STYLES = {
  booking:      { bg: "bg-blue-100",    text: "text-blue-800",    icon: "fa-calendar-check" },
  payment:      { bg: "bg-emerald-100", text: "text-emerald-800", icon: "fa-money-bill-wave" },
  room:         { bg: "bg-purple-100",  text: "text-purple-800",  icon: "fa-bed" },
  user:         { bg: "bg-amber-100",   text: "text-amber-800",   icon: "fa-user" },
  auth:         { bg: "bg-red-100",     text: "text-red-800",     icon: "fa-lock" },
  promo:        { bg: "bg-green-100",   text: "text-green-800",   icon: "fa-tag" },
  settings:     { bg: "bg-orange-100",  text: "text-orange-800",  icon: "fa-sliders-h" },
  content:      { bg: "bg-pink-100",    text: "text-pink-800",    icon: "fa-globe" },
  gallery:      { bg: "bg-fuchsia-100", text: "text-fuchsia-800", icon: "fa-images" },
  announcement: { bg: "bg-cyan-100",    text: "text-cyan-800",    icon: "fa-bullhorn" },
  newsletter:   { bg: "bg-teal-100",    text: "text-teal-800",    icon: "fa-envelope-open-text" },
  upload:       { bg: "bg-indigo-100",  text: "text-indigo-800",  icon: "fa-cloud-upload-alt" },
  message:      { bg: "bg-lime-100",    text: "text-lime-800",    icon: "fa-comment-dots" },
  review:       { bg: "bg-yellow-100",  text: "text-yellow-800",  icon: "fa-star" },
  system:       { bg: "bg-slate-100",   text: "text-slate-700",   icon: "fa-cog" },
};

const ROLE_STYLES = {
  owner:      { bg: "bg-emerald-100", text: "text-emerald-800" },
  admin:      { bg: "bg-blue-100",    text: "text-blue-800" },
  front_desk: { bg: "bg-sky-100",     text: "text-sky-800" },
  guest:      { bg: "bg-amber-100",   text: "text-amber-800" },
  system:     { bg: "bg-slate-100",   text: "text-slate-600" },
};

// Role filter dropdown — "guest" is included because user-surface actions
// (profile edits, reviews, cancellations) flow through the activity log
// under role=guest, and staff need to filter them in and out.
const ROLES = [
  { value: "",           label: "All Roles" },
  { value: "owner",      label: "Owner" },
  { value: "front_desk", label: "Front Desk" },
  { value: "guest",      label: "Guest" },
  { value: "system",     label: "System" },
];

const PER_PAGE_OPTIONS = [10, 25, 50];

// ── Quick-filter pill config (#10) ───────────────────────────────────────────
const QUICK_FILTERS = [
  { value: "",             label: "All",           icon: "fa-layer-group" },
  { value: "booking",      label: "Booking",       icon: "fa-calendar-check" },
  { value: "payment",      label: "Payment",       icon: "fa-money-bill-wave" },
  { value: "room",         label: "Rooms",         icon: "fa-bed" },
  { value: "user",         label: "Users",         icon: "fa-user" },
  { value: "auth",         label: "Auth",          icon: "fa-lock" },
  { value: "promo",        label: "Promo",         icon: "fa-tag" },
  { value: "settings",     label: "Settings",      icon: "fa-sliders-h" },
  { value: "content",      label: "Content",       icon: "fa-globe" },
  { value: "gallery",      label: "Gallery",       icon: "fa-images" },
  { value: "announcement", label: "Announcements", icon: "fa-bullhorn" },
  { value: "newsletter",   label: "Newsletter",    icon: "fa-envelope-open-text" },
  { value: "upload",       label: "Uploads",       icon: "fa-cloud-upload-alt" },
  { value: "message",      label: "Messages",      icon: "fa-comment-dots" },
  { value: "review",       label: "Reviews",       icon: "fa-star" },
  { value: "system",       label: "System",        icon: "fa-cog" },
];

function CategoryBadge({ category }) {
  const s = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.system;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <i className={`fas ${s.icon} text-[10px]`} aria-hidden="true"></i>
      {category}
    </span>
  );
}

function RoleBadge({ role }) {
  const s = ROLE_STYLES[role] ?? ROLE_STYLES.system;
  const label = role === "front_desk"
    ? "Front Desk"
    : (role ? (role.charAt(0).toUpperCase() + role.slice(1)) : "System");
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {label}
    </span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr.replace(" ", "T")).getTime()) / 1000;
  if (diff < 0) return "";
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return "";
}

// ── HTML escape helper (prevent stored XSS in document.write exports) ───────
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

// ── PDF Export ───────────────────────────────────────────────────────────────
function exportPDF(logs, filters) {
  const filterSummary = [
    filters.search && `Search: "${esc(filters.search)}"`,
    filters.category && `Category: ${esc(filters.category)}`,
    filters.role && `Role: ${esc(filters.role)}`,
    filters.action && `Action: ${esc(filters.action)}`,
    filters.from && `From: ${esc(filters.from)}`,
    filters.to && `To: ${esc(filters.to)}`,
  ].filter(Boolean).join(" · ") || "All entries";

  const rows = logs.map(l => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;white-space:nowrap">${esc(fmtDateTime(l.created_at))}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px">${esc(l.user_name ?? "\u2014")}<br><small style="color:#64748b">${esc(l.user_role ?? "")}</small></td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px">${esc(l.category ?? "")}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600">${esc(l.action ?? "")}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;max-width:280px;word-break:break-word">${esc(l.description ?? "")}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html><html><head><title>Activity Log Export</title>
    <style>
      body{font-family:Arial,sans-serif;margin:24px;color:#1e293b}
      h1{font-size:18px;margin:0 0 4px}
      .meta{font-size:12px;color:#64748b;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:2px solid #cbd5e1}
      tr:nth-child(even) td{background:#f8fafc}
      @media print{body{margin:12px}h1{font-size:16px}}
    </style></head><body>
    <h2>Activity Log — Aplaya Beach Resort</h2>
    <div class="meta">Exported: ${new Date().toLocaleString("en-PH")} · Filters: ${filterSummary} · ${logs.length} entries</div>
    <table>
      <thead><tr><th>Timestamp</th><th>User</th><th>Category</th><th>Action</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
  // Hidden-iframe print via the shared util — works on mobile where
  // the window.open popup pattern is blocked or renders as a dead
  // tab. Same fix as the other three print callers (Reports owner +
  // frontdesk, Transactions). See lib/print.js.
  printHtml(html, { title: 'Aplaya Activity Log' });
}

// ── Page number buttons (#4 — sky palette) ──────────────────────────────────
function PageButtons({ current, total, onChange }) {
  if (total <= 1) return null;

  const pages = [];
  const range = 2;

  if (current > 1) pages.push(1);
  if (current > range + 2) pages.push("...");

  for (let i = Math.max(2, current - range); i <= Math.min(total - 1, current + range); i++) {
    pages.push(i);
  }

  if (current < total - range - 1) pages.push("...");
  if (total > 1) pages.push(total);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-slate-600 transition"
        type="button"
      >
        <i className="fas fa-chevron-left text-[10px] mr-1" aria-hidden="true"></i>Prev
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dot-${i}`} className="px-1.5 text-slate-400 text-xs">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-11 w-11 rounded-lg text-xs font-semibold transition ${
              p === current
                ? "bg-sky-600 text-white shadow"
                : "border border-slate-200 hover:bg-slate-100 text-slate-600"
            }`}
            type="button"
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-slate-600 transition"
        type="button"
      >
        Next<i className="fas fa-chevron-right text-[10px] ml-1" aria-hidden="true"></i>
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdminHistory() {
  const [selectedLog, setSelectedLog] = useState(null);
  const [logs,     setLogs]     = useState([]);
  const [meta,     setMeta]     = useState({ current_page: 1, last_page: 1, total: 0, per_page: 25 });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // #6 — Toast
  const [toast, showToast, clearToast, toastType] = useToast();

  // Filters
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("");
  const [role,     setRole]     = useState("");
  const [action,   setAction]   = useState("");
  const [from,     setFrom]     = useState("");
  const [to,       setTo]       = useState("");
  const [page,     setPage]     = useState(1);
  const [perPage,  setPerPage]  = useState(25);

  // Facets for the Action dropdown. Scoped by the currently-selected
  // category so the action list shrinks to only what's relevant (e.g.
  // picking `booking` narrows the Action menu to "Booking Confirmed",
  // "Booking Cancelled", "Guest Checked In", …).
  const [actionFacets, setActionFacets] = useState([]);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  // #11 — active filter count
  const activeFilterCount = [search, category, role, action, from, to].filter(Boolean).length;

  const load = useCallback(async (params) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminHistory(params);
      setLogs(res.data.data);
      setMeta(res.data.meta);
    } catch {
      setError("Failed to load activity history.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on filter/page/perPage changes
  useEffect(() => {
    const params = { page, per_page: perPage };
    if (debouncedSearch) params.search   = debouncedSearch;
    if (category)        params.category = category;
    if (role)            params.role     = role;
    if (action)          params.action   = action;
    if (from)            params.from     = from;
    if (to)              params.to       = to;
    load(params);
  }, [page, perPage, debouncedSearch, category, role, action, from, to, load]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, category, role, action, from, to, perPage]);

  // Re-fetch action facets when the category changes. Picking a category
  // trims the Action dropdown to only that category's actions; clearing
  // category re-fetches the full set. Silent failure is fine — the
  // dropdown just stays empty and the user falls back to the text search.
  useEffect(() => {
    const params = {};
    if (category) params.category = category;
    getAdminHistoryFacets(params)
      .then((res) => setActionFacets(Array.isArray(res.data.actions) ? res.data.actions : []))
      .catch(() => setActionFacets([]));
    // If the selected action is no longer valid under the new category
    // scope, clear it so results aren't silently blank.
    setAction("");
  }, [category]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      const params = { page, per_page: perPage };
      if (debouncedSearch) params.search   = debouncedSearch;
      if (category)        params.category = category;
      if (role)            params.role     = role;
      if (action)          params.action   = action;
      if (from)            params.from     = from;
      if (to)              params.to       = to;
      load(params);
    }, 20_000);
    return () => clearInterval(id);
  }, [autoRefresh, page, perPage, debouncedSearch, category, role, action, from, to, load]);

  // Pagination helpers
  const startRow = meta.total === 0 ? 0 : (meta.current_page - 1) * (meta.per_page || perPage) + 1;
  const endRow = Math.min(meta.current_page * (meta.per_page || perPage), meta.total);

  function clearAllFilters() {
    setSearch(""); setCategory(""); setRole(""); setAction(""); setFrom(""); setTo("");
  }

  // ── Skeleton loading ──────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex gap-6 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-32"></div>
          <div className="h-4 bg-slate-200 rounded w-24"></div>
          <div className="h-4 bg-slate-100 rounded w-20"></div>
          <div className="h-4 bg-slate-200 rounded w-28"></div>
          <div className="h-4 bg-slate-100 rounded w-48 flex-1"></div>
        </div>
      ))}
    </div>
  );

  return (
    <>
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* ── Header card (#5 title, #7 distinctive icon) ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <i className="fas fa-history text-indigo-600 text-lg" aria-hidden="true"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Activity Log</h2>
            <p className="text-sm text-slate-500">
              Real-time audit log of all staff and system actions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(r => !r)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition ${
              autoRefresh
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
            title={autoRefresh ? "Auto-refresh ON (30s)" : "Enable auto-refresh"}
            type="button"
          >
            <i className={`fas fa-sync-alt ${autoRefresh ? "fa-spin" : ""}`} aria-hidden="true"></i>
            {autoRefresh ? "Live" : "Auto"}
          </button>

          {/* PDF Export */}
          <button
            onClick={() => {
              exportPDF(logs, { search: debouncedSearch, category, role, action, from, to });
              showToast("PDF export opened in new tab.", "info");
            }}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition disabled:opacity-40"
            title="Export current page as PDF"
            type="button"
          >
            <i className="fas fa-file-pdf" aria-hidden="true"></i>
            Export PDF
          </button>

          {meta.total > 0 && (
            <span className="text-sm text-slate-500">
              <span className="font-semibold text-slate-800">{meta.total.toLocaleString()}</span> entries
            </span>
          )}
        </div>
      </div>

      {/* ── Category quick-filter pills (#10) ── */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map(qf => (
          <button
            key={qf.value}
            onClick={() => setCategory(qf.value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              category === qf.value
                ? "bg-indigo-600 text-white border-indigo-600 shadow"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
            }`}
            type="button"
          >
            <i className={`fas ${qf.icon} text-[10px]`} aria-hidden="true"></i>
            {qf.label}
          </button>
        ))}
      </div>

      {/* ── Filters (#9 active filter pills, #11 clear badge) ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
              <input
                type="text"
                placeholder="Action, description, user..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>

          {/* Role filter — who performed the action */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Action filter — populated from the facets endpoint, scoped to category */}
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Action {category && <span className="text-slate-400">(in {category})</span>}
            </label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              disabled={actionFacets.length === 0}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">All Actions</option>
              {actionFacets.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {/* Per page */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Per page</label>
            <select
              value={perPage}
              onChange={e => setPerPage(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
            >
              {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* #11 — Clear all filters badge with count */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 self-end transition"
              type="button"
            >
              <i className="fas fa-times text-[10px]" aria-hidden="true"></i>
              Clear
              <span className="bg-rose-200 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
            </button>
          )}
        </div>

        {/* #9 — Active filter pill badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium">
                <i className="fas fa-search text-[9px]" aria-hidden="true"></i>"{search}"
                <button onClick={() => setSearch("")} className="hover:text-indigo-900 ml-0.5" type="button"><i className="fas fa-times text-[9px]" aria-hidden="true"></i></button>
              </span>
            )}
            {category && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium">
                <i className="fas fa-filter text-[9px]" aria-hidden="true"></i>{category}
                <button onClick={() => setCategory("")} className="hover:text-purple-900 ml-0.5" type="button"><i className="fas fa-times text-[9px]" aria-hidden="true"></i></button>
              </span>
            )}
            {role && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                <i className="fas fa-user-tag text-[9px]" aria-hidden="true"></i>Role: {role === "front_desk" ? "Front Desk" : role}
                <button onClick={() => setRole("")} className="hover:text-emerald-900 ml-0.5" type="button"><i className="fas fa-times text-[9px]" aria-hidden="true"></i></button>
              </span>
            )}
            {action && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                <i className="fas fa-bolt text-[9px]" aria-hidden="true"></i>Action: {action}
                <button onClick={() => setAction("")} className="hover:text-amber-900 ml-0.5" type="button"><i className="fas fa-times text-[9px]" aria-hidden="true"></i></button>
              </span>
            )}
            {from && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-medium">
                <i className="fas fa-calendar text-[9px]" aria-hidden="true"></i>From: {from}
                <button onClick={() => setFrom("")} className="hover:text-sky-900 ml-0.5" type="button"><i className="fas fa-times text-[9px]" aria-hidden="true"></i></button>
              </span>
            )}
            {to && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-medium">
                <i className="fas fa-calendar text-[9px]" aria-hidden="true"></i>To: {to}
                <button onClick={() => setTo("")} className="hover:text-sky-900 ml-0.5" type="button"><i className="fas fa-times text-[9px]" aria-hidden="true"></i></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          renderSkeleton()
        ) : error ? (
          <div className="p-12 text-center">
            <i className="fas fa-exclamation-triangle text-rose-300 text-3xl mb-3 block" aria-hidden="true"></i>
            <p className="text-rose-600 font-medium mb-3">{error}</p>
            <button
              onClick={() => load({ page, per_page: perPage })}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 transition"
              type="button"
            >
              <i className="fas fa-redo mr-2" aria-hidden="true"></i>Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <i className="fas fa-history text-3xl mb-3 block text-slate-300" aria-hidden="true"></i>
            <p className="text-slate-400">
              {activeFilterCount > 0
                ? "No entries match your filters."
                : "No activity logged yet. Actions will appear here as staff use the system."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left">Timestamp</th>
                  <th className="px-5 py-3 text-left">User</th>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th className="px-5 py-3 text-left">Action</th>
                  <th className="px-5 py-3 text-left">Description</th>
                </tr>
              </thead>
              {/* #3 — sky hover */}
              <tbody className="divide-y divide-slate-100">
                {logs.map((log, idx) => {
                  const ago = timeAgo(log.created_at);
                  return (
                    <tr
                      key={log.id}
                      role="button" tabIndex={0}
                      onClick={() => setSelectedLog(log)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLog(log); }}}
                      className={`hover:bg-sky-50 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-xs text-slate-500">{fmtDateTime(log.created_at)}</p>
                        {ago && <p className="text-[11px] text-slate-400">{ago}</p>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800 text-sm">{log.user_name}</div>
                        <RoleBadge role={log.user_role} />
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <CategoryBadge category={log.category} />
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap font-medium text-slate-800">
                        {log.action}
                      </td>
                      <td className="px-5 py-3 text-slate-600 max-w-sm truncate">
                        {log.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Showing <span className="font-semibold text-slate-800">{startRow}–{endRow}</span> of{" "}
              <span className="font-semibold text-slate-800">{meta.total.toLocaleString()}</span>
            </span>
            <PageButtons
              current={meta.current_page}
              total={meta.last_page}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </div>

    {/* ── Log Detail Modal (#2 — shared Modal, #8 card-section headers) ── */}
    <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} maxWidth="max-w-lg" label={selectedLog ? `Activity log entry — ${selectedLog.action || selectedLog.event_type || 'detail'}` : 'Activity log entry'}>
      {selectedLog && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                (CATEGORY_STYLES[selectedLog.category] ?? CATEGORY_STYLES.system).bg
              }`}>
                <i className={`fas ${(CATEGORY_STYLES[selectedLog.category] ?? CATEGORY_STYLES.system).icon} ${
                  (CATEGORY_STYLES[selectedLog.category] ?? CATEGORY_STYLES.system).text
                }`} aria-hidden="true"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedLog.action}</h3>
                <p className="text-xs text-slate-400">Log Entry Details</p>
              </div>
            </div>
            <button onClick={() => setSelectedLog(null)} className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close" type="button">
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Description card-section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-indigo-100 flex items-center justify-center">
                    <i className="fas fa-align-left text-indigo-500 text-[9px]" aria-hidden="true"></i>
                  </span>
                  Description
                </h4>
              </div>
              <div className="p-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {selectedLog.description ?? "\u2014"}
                </p>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Timestamp */}
              <div className="bg-sky-50 rounded-xl p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0 text-sky-500">
                  <i className="fas fa-clock text-xs" aria-hidden="true"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Timestamp</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{fmtDateTime(selectedLog.created_at)}</p>
                  {timeAgo(selectedLog.created_at) && (
                    <p className="text-[10px] text-slate-400">{timeAgo(selectedLog.created_at)}</p>
                  )}
                </div>
              </div>

              {/* User */}
              <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0 text-amber-500">
                  <i className="fas fa-user text-xs" aria-hidden="true"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">User</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{selectedLog.user_name ?? "\u2014"}</p>
                  <RoleBadge role={selectedLog.user_role} />
                </div>
              </div>

              {/* Category */}
              <div className="bg-purple-50 rounded-xl p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0 text-purple-500">
                  <i className={`fas ${(CATEGORY_STYLES[selectedLog.category] ?? CATEGORY_STYLES.system).icon} text-xs`} aria-hidden="true"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Category</p>
                  <CategoryBadge category={selectedLog.category} />
                </div>
              </div>

              {/* IP Address */}
              {selectedLog.ip_address && (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0 text-slate-500">
                    <i className="fas fa-globe text-xs" aria-hidden="true"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">IP Address</p>
                    <p className="text-sm font-semibold text-slate-800 font-mono">{selectedLog.ip_address}</p>
                  </div>
                </div>
              )}

              {/* Subject */}
              {selectedLog.subject_type && (
                <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0 text-emerald-500">
                    <i className="fas fa-link text-xs" aria-hidden="true"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Subject</p>
                    <p className="text-sm font-semibold text-slate-800">{selectedLog.subject_type} #{selectedLog.subject_id}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={() => setSelectedLog(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              type="button"
            >
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
    </>
  );
}
