import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import { getAdminReviews, updateAdminReview, deleteAdminReview } from "../../lib/adminApi";
import useDebounce from "../../hooks/useDebounce.js";

const PAGE_SIZE = 10;

const STATUS_PILLS = [
  { value: "",         label: "All" },
  { value: "Pending",  label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

const RATING_PILLS = [
  { value: "", label: "All Ratings" },
  { value: "5", label: "5 ★" },
  { value: "4", label: "4 ★" },
  { value: "3", label: "3 ★" },
  { value: "2", label: "2 ★" },
  { value: "1", label: "1 ★" },
];

export default function AdminReviews() {
  const [toast, showToast, clearToast, toastType, toastAction] = useToast(5000);

  /* ── state ── */
  const [reviews,      setReviews]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [searchTerm,   setSearchTerm]   = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page,         setPage]         = useState(1);
  const [viewReview,   setViewReview]   = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const searchRef = useRef(null);
  const undoTimerRef = useRef(null);
  const undoItemRef = useRef(null);

  /* ── load ── */
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getAdminReviews()
      .then(r => setReviews(r.data.data))
      .catch(() => { setLoadError(true); showToast("Failed to load reviews.", "error"); })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  /* ── filter + sort + paginate ── */
  const filtered = reviews.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterRating && r.rating.toString() !== filterRating) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return r.guestName.toLowerCase().includes(q) || (r.comment || "").toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus, filterRating]);

  /* ── pagination ellipsis ── */
  function getPageNumbers() {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      const start = Math.max(2, safePage - 1);
      const end   = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }

  /* ── actions ── */
  async function execPendingAction() {
    if (!pendingAction) return;
    const { id, type, featured, review } = pendingAction;
    setPendingAction(null);
    if (type === "delete") {
      handleDelete(review);
      return;
    }
    try {
      if (type === "approve") {
        const res = await updateAdminReview(id, { status: "Approved" });
        const updated = res.data?.data ?? res.data ?? { status: "Approved" };
        setReviews(rs => rs.map(r => r.id === id ? { ...r, ...updated } : r));
        if (viewReview?.id === id) setViewReview(v => ({ ...v, ...updated }));
        showToast("Review approved.", "success");
      } else if (type === "reject") {
        const res = await updateAdminReview(id, { status: "Rejected" });
        const updated = res.data?.data ?? res.data ?? { status: "Rejected" };
        setReviews(rs => rs.map(r => r.id === id ? { ...r, ...updated } : r));
        if (viewReview?.id === id) setViewReview(v => ({ ...v, ...updated }));
        showToast("Review rejected.", "success");
      } else if (type === "feature") {
        const res = await updateAdminReview(id, { featured });
        const updated = res.data?.data ?? res.data ?? { featured };
        setReviews(rs => rs.map(r => r.id === id ? { ...r, ...updated } : r));
        if (viewReview?.id === id) setViewReview(v => ({ ...v, ...updated }));
        showToast(featured ? "Review featured." : "Review unfeatured.", "success");
      }
    } catch {
      showToast("Failed to update review.", "error");
    }
  }

  /* ── undo-delete ── */
  function flushPendingDelete() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoItemRef.current) {
      const id = undoItemRef.current.id;
      undoItemRef.current = null;
      deleteAdminReview(id).catch(() => {});
    }
  }

  function handleDelete(review) {
    // flush any previous pending delete first
    flushPendingDelete();

    // optimistic removal
    undoItemRef.current = review;
    setReviews(rs => rs.filter(r => r.id !== review.id));
    if (viewReview?.id === review.id) setViewReview(null);

    showToast(
      `Review by ${review.guestName} deleted.`,
      "success",
      {
        label: "Undo",
        onClick: () => {
          if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
          }
          undoItemRef.current = null;
          load();
          showToast("Delete undone.", "success");
        },
      },
    );

    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      const item = undoItemRef.current;
      if (item) {
        undoItemRef.current = null;
        deleteAdminReview(item.id).catch(() => {
          showToast("Failed to delete review.", "error");
          load();
        });
      }
    }, 6000);
  }

  // flush pending delete on unmount
  useEffect(() => () => flushPendingDelete(), []);

  /* ── stats ── */
  const avgRating    = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";
  const pendingCount = reviews.filter(r => r.status === "Pending").length;
  const approvedCount = reviews.filter(r => r.status === "Approved").length;
  const featuredCount = reviews.filter(r => r.featured).length;

  /* ── stars helper ── */
  const Stars = ({ rating, size = "text-xs" }) => (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <i key={i} className={`fas fa-star ${size} ${i < rating ? "text-amber-400" : "text-slate-200"}`}></i>
      ))}
    </div>
  );

  /* ── skeleton ── */
  const SkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="p-5 animate-pulse flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-200 rounded w-3/4"></div>
          <div className="h-3 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
      </div>
    ));

  return (
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* ── #2 ConfirmDialog for actions ── */}
      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.label || ""}
        message={pendingAction?.desc || ""}
        confirmLabel={pendingAction?.label || "Confirm"}
        variant={pendingAction?.type === "reject" || pendingAction?.type === "delete" ? "danger" : pendingAction?.type === "approve" ? "info" : "info"}
        onConfirm={execPendingAction}
        onCancel={() => setPendingAction(null)}
      />

      {/* ── #4 Page header with icon badge ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <i className="fas fa-star text-amber-600"></i>
            </span>
            Reviews
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Monitor guest feedback and keep your service quality high.</p>
        </div>
        {/* ── #13 Pending badge ── */}
        {pendingCount > 0 && (
          <button onClick={() => { setFilterStatus("Pending"); setFilterRating(""); }}
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-100 transition">
            <span className="h-6 w-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{pendingCount}</span>
            Pending Approval
          </button>
        )}
      </div>

      {/* ── #10 Stat cards with icon-badge pattern ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Average Rating", value: `${avgRating} / 5`, icon: "fa-star",         bg: "bg-amber-100",   text: "text-amber-600" },
          { label: "Pending",        value: pendingCount,        icon: "fa-clock",        bg: "bg-orange-100",  text: "text-orange-600" },
          { label: "Approved",       value: approvedCount,       icon: "fa-check-circle", bg: "bg-sky-100",     text: "text-sky-600" },
          { label: "Featured",       value: featuredCount,       icon: "fa-heart",        bg: "bg-emerald-100", text: "text-emerald-600" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <span className={`h-9 w-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                <i className={`fas ${c.icon} ${c.text}`}></i>
              </span>
              <div>
                <p className="text-slate-500 text-xs font-medium">{c.label}</p>
                <p className="text-xl font-bold text-slate-900">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── #11 #12 Search + pill filters ── */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by guest name or comment..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm placeholder:text-slate-400 transition"
            />
            {searchTerm && (
              <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                <i className="fas fa-times-circle text-sm"></i>
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Status:</span>
          {STATUS_PILLS.map(p => (
            <button key={p.value} onClick={() => setFilterStatus(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterStatus === p.value
                  ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {p.label}
            </button>
          ))}
          <span className="w-px h-5 bg-slate-200 mx-1"></span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Rating:</span>
          {RATING_PILLS.map(p => (
            <button key={p.value} onClick={() => setFilterRating(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterRating === p.value
                  ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">Total reviews</p>
            <p className="text-2xl font-semibold text-slate-900">{reviews.length}</p>
          </div>
          {(debouncedSearch || filterStatus || filterRating) && (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {filtered.length} of {reviews.length}
            </span>
          )}
        </div>

        {/* ── #8 Loading skeleton ── */}
        {loading ? (
          <div className="divide-y divide-slate-100">
            <SkeletonRows />
          </div>
        ) : loadError && reviews.length === 0 ? (
          /* ── #7 Error retry ── */
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-rose-100 mb-4">
              <i className="fas fa-exclamation-triangle text-rose-400 text-2xl"></i>
            </div>
            <p className="text-slate-700 font-semibold">Failed to load reviews</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Check your connection and try again.</p>
            <button onClick={load}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl shadow-sm transition">
              <i className="fas fa-redo text-xs"></i>Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          /* ── #6 Empty state ── */
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
              <i className="fas fa-star text-slate-300 text-2xl"></i>
            </div>
            <p className="text-slate-500 font-medium">
              {debouncedSearch || filterStatus || filterRating ? "No reviews match your filters." : "No reviews yet."}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {debouncedSearch || filterStatus || filterRating
                ? "Try adjusting your search or filter."
                : "Reviews will appear here when guests submit feedback."}
            </p>
            {(debouncedSearch || filterStatus || filterRating) && (
              <button onClick={() => { setSearchTerm(""); setFilterStatus(""); setFilterRating(""); }}
                className="mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium">
                <i className="fas fa-times mr-1.5"></i>Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {paginated.map(review => (
                <div
                  key={review.id}
                  onClick={() => setViewReview(review)}
                  className="p-5 hover:bg-amber-50/40 cursor-pointer transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
                        {review.guestName?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-slate-900">{review.guestName}</h4>
                          <Stars rating={review.rating} />
                          {review.featured && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              <i className="fas fa-heart text-[8px]"></i>Featured
                            </span>
                          )}
                          {review.room && (
                            <span className="text-xs text-slate-400">· {review.room}</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 mb-1">{review.comment}</p>
                        <p className="text-xs text-slate-400">{review.date}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        review.status === "Approved" ? "bg-emerald-100 text-emerald-800" :
                        review.status === "Pending"  ? "bg-amber-100 text-amber-800" :
                                                       "bg-rose-100 text-rose-800"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          review.status === "Approved" ? "bg-emerald-500" :
                          review.status === "Pending"  ? "bg-amber-500" :
                                                         "bg-rose-500"
                        }`} />
                        {review.status}
                      </span>

                      {review.status === "Pending" && (
                        <>
                          <button onClick={() => setPendingAction({ id: review.id, type: "approve", label: "Approve Review", desc: "This review will be approved and made visible to guests." })}
                            className="h-8 w-8 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition" title="Approve">
                            <i className="fas fa-check text-xs"></i>
                          </button>
                          <button onClick={() => setPendingAction({ id: review.id, type: "reject", label: "Reject Review", desc: "This review will be rejected and hidden from guests." })}
                            className="h-8 w-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-500 hover:text-rose-700 transition" title="Reject">
                            <i className="fas fa-ban text-xs"></i>
                          </button>
                        </>
                      )}

                      <button onClick={() => setPendingAction({ id: review.id, type: "feature", label: review.featured ? "Unfeature Review" : "Feature Review", desc: review.featured ? "Remove this review from the featured section." : "This review will be highlighted in the featured section.", featured: !review.featured })}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition ${
                          review.featured ? "hover:bg-rose-50 text-rose-400 hover:text-rose-600" : "hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700"
                        }`} title={review.featured ? "Unfeature" : "Feature"}>
                        <i className={`fas fa-heart text-xs`}></i>
                      </button>

                      <button onClick={() => setPendingAction({ id: review.id, type: "delete", label: "Delete Review", desc: `Delete review by ${review.guestName}? You can undo within 6 seconds.`, review })}
                        className="h-8 w-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-600 transition" title="Delete">
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── #5 Pagination with ellipsis ── */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                    className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                    <i className="fas fa-chevron-left text-xs"></i>
                  </button>
                  {getPageNumbers().map((n, i) =>
                    n === "..." ? (
                      <span key={`e-${i}`} className="h-8 min-w-[2rem] flex items-center justify-center text-xs text-slate-400">…</span>
                    ) : (
                      <button key={n} onClick={() => setPage(n)}
                        className={`h-8 min-w-[2rem] rounded-lg text-xs font-semibold transition ${
                          n === safePage
                            ? "bg-amber-500 text-white shadow-sm"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}>
                        {n}
                      </button>
                    )
                  )}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                    className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition">
                    <i className="fas fa-chevron-right text-xs"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── #1 #9 View Review Modal (shared Modal + colored stat cards) ── */}
      <Modal open={!!viewReview} onClose={() => setViewReview(null)} maxWidth="max-w-md">
        {viewReview && (
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className="fas fa-star text-amber-600"></i>
                </span>
                Review Details
              </h3>
              <button onClick={() => setViewReview(null)} className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Guest info */}
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-base shrink-0">
                  {viewReview.guestName?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{viewReview.guestName}</p>
                  <div className="flex items-center gap-1.5">
                    <Stars rating={viewReview.rating} />
                    <span className="text-xs text-slate-400 font-medium">{viewReview.rating} / 5</span>
                  </div>
                </div>
              </div>

              {/* Comment */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-slate-700 text-sm leading-relaxed italic">"{viewReview.comment}"</p>
              </div>

              {/* Colored stat cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Room */}
                <div className="rounded-xl bg-sky-50 border border-sky-100 p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-6 w-6 rounded-md bg-sky-100 flex items-center justify-center">
                      <i className="fas fa-bed text-sky-600 text-[10px]"></i>
                    </span>
                    <span className="text-[10px] font-semibold text-sky-600 uppercase tracking-wide">Room</span>
                  </div>
                  <p className="text-sm font-bold text-sky-800">{viewReview.room || "—"}</p>
                </div>
                {/* Date */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center">
                      <i className="fas fa-calendar text-slate-500 text-[10px]"></i>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Date</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{viewReview.date || "—"}</p>
                </div>
                {/* Status */}
                <div className={`rounded-xl border p-3.5 ${
                  viewReview.status === "Approved" ? "bg-emerald-50 border-emerald-100" :
                  viewReview.status === "Pending"  ? "bg-amber-50 border-amber-100" :
                                                     "bg-rose-50 border-rose-100"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-6 w-6 rounded-md flex items-center justify-center ${
                      viewReview.status === "Approved" ? "bg-emerald-100" :
                      viewReview.status === "Pending"  ? "bg-amber-100" : "bg-rose-100"
                    }`}>
                      <i className={`fas ${
                        viewReview.status === "Approved" ? "fa-check-circle" :
                        viewReview.status === "Pending"  ? "fa-clock" : "fa-ban"
                      } text-[10px] ${
                        viewReview.status === "Approved" ? "text-emerald-600" :
                        viewReview.status === "Pending"  ? "text-amber-600" : "text-rose-600"
                      }`}></i>
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                      viewReview.status === "Approved" ? "text-emerald-600" :
                      viewReview.status === "Pending"  ? "text-amber-600" : "text-rose-600"
                    }`}>Status</span>
                  </div>
                  <p className={`text-sm font-bold ${
                    viewReview.status === "Approved" ? "text-emerald-800" :
                    viewReview.status === "Pending"  ? "text-amber-800" : "text-rose-800"
                  }`}>{viewReview.status}</p>
                </div>
                {/* Featured */}
                <div className={`rounded-xl border p-3.5 ${viewReview.featured ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-6 w-6 rounded-md flex items-center justify-center ${viewReview.featured ? "bg-emerald-100" : "bg-slate-100"}`}>
                      <i className={`fas fa-heart text-[10px] ${viewReview.featured ? "text-emerald-600" : "text-slate-400"}`}></i>
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${viewReview.featured ? "text-emerald-600" : "text-slate-500"}`}>Featured</span>
                  </div>
                  <p className={`text-sm font-bold ${viewReview.featured ? "text-emerald-800" : "text-slate-600"}`}>
                    {viewReview.featured ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
              {viewReview.status === "Pending" && (
                <>
                  <button onClick={() => setPendingAction({ id: viewReview.id, type: "approve", label: "Approve Review", desc: "This review will be approved and made visible to guests." })}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition">
                    <i className="fas fa-check mr-1.5 text-xs"></i>Approve
                  </button>
                  <button onClick={() => setPendingAction({ id: viewReview.id, type: "reject", label: "Reject Review", desc: "This review will be rejected and hidden from guests." })}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition">
                    <i className="fas fa-ban mr-1.5 text-xs"></i>Reject
                  </button>
                </>
              )}
              <button onClick={() => setViewReview(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
