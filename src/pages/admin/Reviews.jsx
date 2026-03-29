import { useState, useEffect } from "react";
import { getAdminReviews, updateAdminReview } from "../../lib/adminApi";
import Toast, { useToast } from "../../components/ui/Toast";

export default function AdminReviews() {
  const [reviews,      setReviews]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [searchTerm,   setSearchTerm]   = useState("");
  const [viewReview,   setViewReview]   = useState(null);
  const [toast, showToast, clearToast, toastType] = useToast();

  useEffect(() => {
    getAdminReviews()
      .then(r => setReviews(r.data.data))
      .catch(() => setError("Failed to load reviews."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = reviews.filter(r => {
    const matchSearch = r.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (r.comment || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    const matchRating = !filterRating || r.rating.toString() === filterRating;
    return matchSearch && matchStatus && matchRating;
  });

  async function handleStatus(id, status) {
    try {
      await updateAdminReview(id, { status });
      setReviews(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    } catch { showToast("Failed to update review."); }
  }

  async function handleFeature(id, featured) {
    try {
      await updateAdminReview(id, { featured });
      setReviews(rs => rs.map(r => r.id === id ? { ...r, featured } : r));
    } catch { showToast("Failed to update review."); }
  }

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} />
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Guest Reviews</h1>
        <p className="text-sm text-slate-500 mt-1">Monitor guest feedback and keep your service quality high.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Average Rating", value: `${avgRating} / 5`, icon: "fa-star",        color: "bg-amber-100 text-amber-600" },
          { label: "Approved",       value: reviews.filter(r => r.status === "Approved").length, icon: "fa-check-circle", color: "bg-sky-100 text-sky-600" },
          { label: "Featured",       value: reviews.filter(r => r.featured).length,     icon: "fa-heart",       color: "bg-emerald-100 text-emerald-600" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${c.color}`}><i className={`fas ${c.icon} text-xl`}></i></div>
              <div>
                <p className="text-slate-500 text-sm">{c.label}</p>
                <p className="text-2xl font-semibold text-slate-900">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">{error}</div>}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1 md:flex-none">
            <input type="text" placeholder="Search reviews…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 w-full text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <i className="fas fa-search absolute left-3 top-3 text-slate-400"></i>
          </div>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select value={filterRating} onChange={e => setFilterRating(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">All Ratings</option>
              {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="px-6 py-10 text-center text-slate-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-400">No reviews found.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(review => (
              <div
                key={review.id}
                onClick={() => setViewReview(review)}
                className="p-5 hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-base font-semibold text-slate-900">{review.guestName}</h4>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <i key={i} className={`fas fa-star text-xs ${i < review.rating ? "text-amber-400" : "text-slate-200"}`}></i>
                        ))}
                      </div>
                      {review.featured && (
                        <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Featured</span>
                      )}
                      {review.room && (
                        <span className="text-xs text-slate-400">· {review.room}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-1">{review.comment}</p>
                    <p className="text-xs text-slate-400">{review.date}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      review.status === "Approved" ? "bg-emerald-100 text-emerald-800" :
                      review.status === "Pending"  ? "bg-amber-100 text-amber-800" :
                                                     "bg-rose-100 text-rose-800"}`}>
                      {review.status}
                    </span>

                    {review.status === "Pending" && (
                      <>
                        <button onClick={() => handleStatus(review.id, "Approved")}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100">
                          <i className="fas fa-check"></i> Approve
                        </button>
                        <button onClick={() => handleStatus(review.id, "Rejected")}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
                          <i className="fas fa-ban"></i> Reject
                        </button>
                      </>
                    )}

                    <button onClick={() => handleFeature(review.id, !review.featured)}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium ${
                        review.featured ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}>
                      <i className="fas fa-heart"></i>
                      {review.featured ? "Unfeature" : "Feature"}
                    </button>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* View Review Modal */}
      {viewReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Review Details</h3>
              <button onClick={() => setViewReview(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold">
                  {viewReview.guestName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{viewReview.guestName}</p>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <i key={i} className={`fas fa-star text-xs ${i < viewReview.rating ? "text-amber-400" : "text-slate-200"}`}></i>
                    ))}
                    <span className="ml-1 text-xs text-slate-400">{viewReview.rating} / 5</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-slate-700 text-sm italic">"{viewReview.comment}"</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Room",    viewReview.room  || "—"],
                  ["Date",    viewReview.date  || "—"],
                  ["Status",  viewReview.status],
                  ["Featured",viewReview.featured ? "Yes" : "No"],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className="font-semibold text-slate-900">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
              {viewReview.status === "Pending" && (
                <>
                  <button
                    onClick={() => { handleStatus(viewReview.id, "Approved"); setViewReview(v => ({ ...v, status: "Approved" })); }}
                    className="px-3 py-2 bg-sky-600 text-white rounded-xl text-sm hover:bg-sky-700">
                    Approve
                  </button>
                  <button
                    onClick={() => { handleStatus(viewReview.id, "Rejected"); setViewReview(v => ({ ...v, status: "Rejected" })); }}
                    className="px-3 py-2 bg-rose-600 text-white rounded-xl text-sm hover:bg-rose-700">
                    Reject
                  </button>
                </>
              )}
              <button onClick={() => setViewReview(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
