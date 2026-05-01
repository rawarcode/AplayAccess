import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useLockBodyScroll from "../hooks/useLockBodyScroll.js";
import { getAnnouncements } from "../lib/resortApi.js";
import { isVideoUrl } from "../lib/uploadApi.js";
import { Helmet } from "react-helmet-async";
import Modal from "../components/modals/Modal.jsx";

function formatDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(null);

  useLockBodyScroll(!!selected);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getAnnouncements()
      .then((data) => setAnnouncements(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="pt-16 bg-slate-900 min-h-screen">
      <Helmet>
        <title>Announcements — Aplaya Beach Resort</title>
        <meta name="description" content="Latest news, events, and announcements from Aplaya Beach Resort." />
      </Helmet>

      {/* HERO */}
      <section
        className="relative h-[55vh] flex items-center justify-center text-center overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 animate-hero-fade-in [animation-delay:0.2s] opacity-0">
            Latest Announcements
          </h1>
          <p className="text-lg md:text-xl animate-hero-fade-in [animation-delay:0.6s] opacity-0">
            Stay updated with events, promos, and news from Aplaya Beach Resort.
          </p>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none"
            className="relative block w-[calc(100%+1.3px)] h-[100px]">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              opacity=".25" fill="#0f172a" />
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              opacity=".5" fill="#0f172a" />
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="#0f172a" />
          </svg>
        </div>
      </section>

      {/* CONTENT */}
      <main className="py-16 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Load error banner */}
          {loadError && !loading && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200/20 bg-amber-500/10 px-4 py-3 mb-8">
              <i className="fas fa-exclamation-triangle text-amber-400" aria-hidden="true" />
              <span className="text-sm text-amber-300 flex-1">Could not load announcements — showing cached data if available.</span>
              <button onClick={load} className="text-sm font-medium text-amber-300 hover:text-amber-200 underline">Retry</button>
            </div>
          )}

          {loading ? (
            /* Skeleton loading cards */
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-slate-800 rounded-2xl overflow-hidden shadow-lg animate-pulse">
                  <div className="h-52 bg-slate-700" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-slate-700 rounded w-1/3" />
                    <div className="h-5 bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-700 rounded w-full" />
                    <div className="h-3 bg-slate-700 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-bullhorn text-3xl text-slate-600" aria-hidden="true"></i>
              </div>
              <p className="text-xl font-semibold text-slate-300">No announcements yet.</p>
              <p className="text-sm mt-2">Check back soon for updates from Aplaya Beach Resort.</p>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {announcements.map((item, i) => (
                <div
                  key={item.id}
                  className="group relative bg-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col hover:-translate-y-1 transition-all duration-300 ring-1 ring-slate-700 hover:ring-sky-500/40 animate-hero-fade-in opacity-0"
                  style={{ animationDelay: `${Math.min(i * 0.1, 0.8)}s` }}
                >
                  {/* Hover glow */}
                  {/* Media */}
                  {item.media_url && (
                    <div className="bg-slate-900 rounded-t-2xl overflow-hidden flex items-center justify-center min-h-52">
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
                      <span className="text-xs text-slate-400">{formatDate(item.published_at)}</span>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2 leading-snug">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed line-clamp-3 flex-1">
                      {item.body}
                    </p>
                    <button
                      onClick={() => setSelected(item)}
                      type="button"
                      className="mt-4 self-start inline-flex items-center px-2 py-1.5 -ml-2 rounded text-sm font-semibold text-sky-300 hover:text-sky-200 hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              ← Back to Resort
            </Link>
          </div>
        </div>
      </main>

      {/* Full-detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} maxWidth="max-w-2xl" label={selected?.title ? `Announcement: ${selected.title}` : "Announcement"}>
        {selected && (
          <>
            {/* Media */}
            {selected.media_url && (
              <div className="rounded-t-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                {isVideoUrl(selected.media_url) ? (
                  <video src={selected.media_url} controls autoPlay className="w-full object-contain" />
                ) : (
                  <img src={selected.media_url} alt={selected.title} className="w-full object-contain" loading="eager" decoding="async" />
                )}
              </div>
            )}

            <div className="p-6">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {selected.is_pinned && (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                    📌 Pinned
                  </span>
                )}
                <span className="text-xs text-slate-500">{formatDate(selected.published_at)}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">{selected.title}</h2>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{selected.body}</p>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
