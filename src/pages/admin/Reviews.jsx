import { useState } from "react";

export default function AdminReviews() {
  const [reviews, setReviews] = useState([
    {
      id: 1,
      guestName: "Sarah Williams",
      rating: 5,
      comment: "Amazing experience! The staff was incredibly friendly and the rooms were spotless.",
      date: "2024-01-15",
      status: "Approved",
      featured: true,
    },
    {
      id: 2,
      guestName: "Michael Chen",
      rating: 4,
      comment: "Great resort with beautiful views. Food could be better.",
      date: "2024-01-12",
      status: "Approved",
      featured: false,
    },
    {
      id: 3,
      guestName: "Emma Johnson",
      rating: 5,
      comment: "Perfect vacation spot! Will definitely come back.",
      date: "2024-01-10",
      status: "Pending",
      featured: false,
    },
  ]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReviews = reviews.filter((r) => {
    const matches = r.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.comment.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = !filterStatus || r.status === filterStatus;
    const ratingMatch = !filterRating || r.rating.toString() === filterRating;
    return matches && statusMatch && ratingMatch;
  });

  function toggleFeature(id) {
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, featured: !r.featured } : r)));
  }

  function updateReviewStatus(id, status) {
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  function deleteReview(id) {
    if (window.confirm("Delete this review?")) {
      setReviews((list) => list.filter((r) => r.id !== id));
    }
  }

  const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Guest Reviews</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor guest feedback and keep your service quality high.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 rounded-full p-3">
              <i className="fas fa-star text-amber-600 text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Average Rating</p>
              <p className="text-2xl font-semibold text-slate-900">{avgRating} / 5</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="bg-sky-100 rounded-full p-3">
              <i className="fas fa-check-circle text-sky-600 text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Approved</p>
              <p className="text-2xl font-semibold text-slate-900">{reviews.filter((r) => r.status === "Approved").length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 rounded-full p-3">
              <i className="fas fa-heart text-emerald-600 text-xl"></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm">Featured</p>
              <p className="text-2xl font-semibold text-slate-900">{reviews.filter((r) => r.featured).length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1 md:flex-none">
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 w-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <i className="fas fa-search absolute left-3 top-3 text-slate-400"></i>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Filter by Status</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Filter by Rating</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {filteredReviews.map((review) => (
            <div key={review.id} className="p-5 border-b last:border-b-0 hover:bg-slate-50">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h4 className="text-lg font-semibold text-slate-900">{review.guestName}</h4>
                    <div className="flex items-center gap-1 text-amber-500">
                      {[...Array(review.rating)].map((_, i) => (
                        <i key={i} className="fas fa-star text-amber-400"></i>
                      ))}
                    </div>
                    {review.featured && (
                      <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{review.comment}</p>
                  <p className="text-xs text-slate-400">{review.date}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      review.status === "Approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : review.status === "Pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {review.status}
                  </span>

                  {review.status === "Pending" && (
                    <>
                      <button
                        onClick={() => updateReviewStatus(review.id, "Approved")}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                      >
                        <i className="fas fa-check"></i>
                        Approve
                      </button>
                      <button
                        onClick={() => updateReviewStatus(review.id, "Rejected")}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <i className="fas fa-ban"></i>
                        Reject
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => toggleFeature(review.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      review.featured
                        ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                    }`}
                  >
                    <i className={`fas fa-heart ${review.featured ? "fas" : "far"}`}></i>
                    {review.featured ? "Unfeature" : "Feature"}
                  </button>

                  <button
                    onClick={() => deleteReview(review.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  >
                    <i className="fas fa-trash"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
