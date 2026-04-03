import { useCallback, useEffect, useState } from "react";
import { getAdminHistory } from "../../lib/adminApi";

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "",         label: "All Categories" },
  { value: "booking",  label: "Booking" },
  { value: "room",     label: "Rooms" },
  { value: "user",     label: "Users" },
  { value: "promo",    label: "Promo Codes" },
  { value: "settings", label: "Settings" },
  { value: "content",  label: "Content" },
  { value: "review",   label: "Reviews" },
  { value: "system",   label: "System" },
];

const CATEGORY_STYLES = {
  booking:  { bg: "bg-blue-100",   text: "text-blue-800",   icon: "fa-calendar-check" },
  room:     { bg: "bg-purple-100", text: "text-purple-800", icon: "fa-bed"            },
  user:     { bg: "bg-amber-100",  text: "text-amber-800",  icon: "fa-user"           },
  promo:    { bg: "bg-green-100",  text: "text-green-800",  icon: "fa-tag"            },
  settings: { bg: "bg-orange-100", text: "text-orange-800", icon: "fa-sliders-h"      },
  content:  { bg: "bg-pink-100",   text: "text-pink-800",   icon: "fa-globe"          },
  review:   { bg: "bg-yellow-100", text: "text-yellow-800", icon: "fa-star"           },
  system:   { bg: "bg-gray-100",   text: "text-gray-700",   icon: "fa-cog"            },
};

const ROLE_STYLES = {
  owner:      { bg: "bg-emerald-100", text: "text-emerald-800" },
  admin:      { bg: "bg-blue-100",    text: "text-blue-800"    },
  front_desk: { bg: "bg-sky-100",     text: "text-sky-800"     },
  system:     { bg: "bg-gray-100",    text: "text-gray-600"    },
};

function CategoryBadge({ category }) {
  const s = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.system;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <i className={`fas ${s.icon} text-[10px]`}></i>
      {category}
    </span>
  );
}

function RoleBadge({ role }) {
  const s = ROLE_STYLES[role] ?? ROLE_STYLES.system;
  const label = role === "front_desk" ? "Front Desk" : (role?.charAt(0).toUpperCase() + role?.slice(1));
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {label}
    </span>
  );
}

function fmtDateTime(str) {
  if (!str) return "—";
  return new Date(str.replace(" ", "T")).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export default function AdminHistory() {
  const [sortBy,  setSortBy]  = useState('Timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [logs,     setLogs]     = useState([]);
  const [meta,     setMeta]     = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // Filters
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("");
  const [from,     setFrom]     = useState("");
  const [to,       setTo]       = useState("");
  const [page,     setPage]     = useState(1);

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

  useEffect(() => {
    const params = { page };
    if (search)   params.search   = search;
    if (category) params.category = category;
    if (from)     params.from     = from;
    if (to)       params.to       = to;
    load(params);
  }, [page, search, category, from, to, load]);

  // Reset to page 1 whenever any filter changes
  function applyFilter(setter) {
    return (val) => { setter(val); setPage(1); };
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time audit log of all staff and system actions.
          </p>
        </div>
        {meta.total > 0 && (
          <div className="text-sm text-slate-500">
            <span className="font-semibold text-slate-800">{meta.total.toLocaleString()}</span> total entries
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4 flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            placeholder="Search action, description, user..."
            value={search}
            onChange={e => applyFilter(setSearch)(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        {/* Category */}
        <select
          value={category}
          onChange={e => applyFilter(setCategory)(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={from}
          onChange={e => applyFilter(setFrom)(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          title="From date"
        />
        <input
          type="date"
          value={to}
          onChange={e => applyFilter(setTo)(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          title="To date"
        />

        {/* Clear */}
        {(search || category || from || to) && (
          <button
            onClick={() => { setSearch(""); setCategory(""); setFrom(""); setTo(""); setPage(1); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <i className="fas fa-times mr-1"></i>Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fas fa-spinner fa-spin text-2xl mb-3 block"></i>
            Loading activity history...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fas fa-history text-3xl mb-3 block text-slate-300"></i>
            {search || category || from || to
              ? "No entries match your filters."
              : "No activity logged yet. Actions will appear here as staff use the system."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <tr>
                  {[['Timestamp','Timestamp'],['User','User'],['Category','Category'],['Action','Action']].map(([label,key]) => (
                    <th key={key} className="px-5 py-3 text-left">
                      <button onClick={() => { if(sortBy===key) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(key);setSortDir('asc');} }}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors group">
                        {label}
                        <span className="text-slate-400 group-hover:text-blue-400">
                          {sortBy===key ? <i className={`fas fa-arrow-${sortDir==='asc'?'up':'down'} text-blue-500`}></i> : <i className="fas fa-sort opacity-40"></i>}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...logs].sort((a, b) => {
                  let aVal, bVal;
                  if (sortBy === 'User')     { aVal = (a.user_name ?? a.user?.name ?? '').toLowerCase(); bVal = (b.user_name ?? b.user?.name ?? '').toLowerCase(); }
                  else if (sortBy === 'Category') { aVal = (a.category ?? '').toLowerCase(); bVal = (b.category ?? '').toLowerCase(); }
                  else if (sortBy === 'Action')   { aVal = (a.action ?? '').toLowerCase();   bVal = (b.action ?? '').toLowerCase(); }
                  else { aVal = a.created_at ?? ''; bVal = b.created_at ?? ''; }
                  if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
                  if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
                  return 0;
                }).map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-slate-500">
                      {fmtDateTime(log.created_at)}
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
                    <td className="px-5 py-3 text-slate-600 max-w-sm">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
            <span>Page {meta.current_page} of {meta.last_page}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={meta.current_page === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              <button
                onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}
                disabled={meta.current_page === meta.last_page}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
