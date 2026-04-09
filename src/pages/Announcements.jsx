import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { getAnnouncements } from "../lib/resortApi.js";
import { isVideoUrl } from "../lib/uploadApi.js";

function formatDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // full-detail modal

  useLockBodyScroll(!!selected);

  useEffect(() => {
    getAnnouncements()
      .then((data) => setAnnouncements(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pt-16 bg-gray-900 min-h-screen">
      {/* HERO */}
      <section
        className="relative h-[55vh] flex items-center justify-center text-center"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Latest Announcements</h1>
          <p className="text-lg md:text-xl">
            Stay updated with events, promos, and news from Aplaya Beach Resort.
          </p>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="relative block w-[calc(100%+1.3px)] h-[100px]"
          >
            <path
              d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              opacity=".25"
              fill="#111827"
            />
            <path
              d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              opacity=".5"
              fill="#111827"
            />
            <path
              d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="#111827"
            />
          </svg>
        </div>
      </section>

      {/* CONTENT */}
      <main className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {loading ? (
            <div className="flex justify-center py-20 text-gray-400">
              <i className="fas fa-spinner fa-spin text-3xl"></i>
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <i className="fas fa-bullhorn text-5xl mb-4 block text-gray-600"></i>
              <p className="text-xl font-semibold text-gray-300">No announcements yet.</p>
              <p className="text-sm mt-2">Check back soon for updates from Aplaya Beach Resort.</p>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {announcements.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-800 rounded-2xl overflow-hidden shadow-lg flex flex-col hover:-translate-y-1 transition-transform duration-300"
                >
                  {/* Media */}
                  {item.media_url && (
                    <div className="bg-gray-900 rounded-t-2xl overflow-hidden flex items-center justify-center min-h-52">
                      {isVideoUrl(item.media_url) ? (
                        <video
                          src={item.media_url}
                          controls
                          playsInline
                          className="w-full object-contain"
                        />
                      ) : (
                        <img
                          src={item.media_url}
                          alt={item.title}
                          className="w-full object-contain max-h-[480px]"
                          loading="lazy"
                        />
                      )}
                    </div>
                  )}

                  {/* Card body */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {item.is_pinned && (
                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                          📌 Pinned
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{formatDate(item.published_at)}</span>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2 leading-snug">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-3 flex-1">
                      {item.body}
                    </p>
                    <button
                      onClick={() => setSelected(item)}
                      className="mt-4 self-start text-sm font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      Read More →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-14 text-center">
            <Link
              to="/resort"
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              ← Back to Resort
            </Link>
          </div>
        </div>
      </main>

      {/* Full-detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Media */}
            {selected.media_url && (
              <div className="rounded-t-2xl overflow-hidden bg-gray-900 flex items-center justify-center">
                {isVideoUrl(selected.media_url) ? (
                  <video
                    src={selected.media_url}
                    controls
                    autoPlay
                    className="w-full object-contain"
                  />
                ) : (
                  <img
                    src={selected.media_url}
                    alt={selected.title}
                    className="w-full object-contain"
                  />
                )}
              </div>
            )}

            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {selected.is_pinned && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                        📌 Pinned
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(selected.published_at)}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-gray-400 hover:text-white transition flex-shrink-0"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{selected.body}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
