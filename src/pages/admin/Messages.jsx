import { useState, useEffect, useMemo, useRef } from "react";
import { getAdminMessages, replyAdminMessage, markAdminMessageRead } from "../../lib/adminApi";
import Toast, { useToast } from "../../components/ui/Toast";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return "—";
  return new Date(str.replace(" ", "T")).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function timeAgo(str) {
  if (!str) return "";
  const diff = Date.now() - new Date(str.replace(" ", "T")).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

// ─── Thread List Item ──────────────────────────────────────────────────────────
function ThreadItem({ thread, active, onClick }) {
  const lastReply    = thread.replies?.at(-1);
  const preview      = lastReply?.body ?? thread.body;
  const unread       = !thread.is_read;
  const hasResortRep = thread.replies?.some(r => r.sender_type === "resort");

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 transition-colors flex items-start gap-3
        ${active ? "bg-sky-50 border-l-4 border-l-sky-500" : "hover:bg-slate-50 border-l-4 border-l-transparent"}`}
    >
      {/* Avatar */}
      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
        ${unread ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-600"}`}>
        {initials(thread.sender)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-sm truncate ${unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
            {thread.sender}
          </span>
          <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(thread.created_at)}</span>
        </div>

        <p className={`text-xs truncate mb-1 ${unread ? "font-semibold text-slate-800" : "text-slate-500"}`}>
          {thread.subject}
        </p>

        <p className="text-[11px] text-slate-400 truncate">{preview}</p>

        <div className="flex items-center gap-2 mt-1">
          {unread && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block"></span>New
            </span>
          )}
          {hasResortRep ? (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium">
              <i className="fas fa-check mr-0.5"></i>Replied
            </span>
          ) : (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">
              <i className="fas fa-clock mr-0.5"></i>Needs reply
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, isStaff }) {
  return (
    <div className={`flex items-end gap-2 ${isStaff ? "justify-end" : "justify-start"}`}>
      {!isStaff && (
        <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
          <i className="fas fa-user text-xs"></i>
        </div>
      )}
      <div className={`max-w-[72%] ${isStaff ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
          ${isStaff
            ? "bg-sky-600 text-white rounded-br-sm"
            : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"}`}>
          {msg.body}
        </div>
        <span className="text-[10px] text-slate-400 px-1">
          {isStaff ? `${msg.sender} · ` : ""}{fmtDate(msg.created_at)}
        </span>
      </div>
      {isStaff && (
        <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
          <i className="fas fa-headset text-sky-600 text-xs"></i>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminMessages() {
  const [threads,     setThreads]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activeId,    setActiveId]    = useState(null);
  const [reply,       setReply]       = useState("");
  const [sending,     setSending]     = useState(false);
  const [searchTerm,  setSearchTerm]  = useState("");
  const [filterRead,  setFilterRead]  = useState("all"); // "all" | "unread" | "replied"
  const [scrollTick,  setScrollTick]  = useState(0);
  const bottomRef = useRef(null);
  const [toast, showToast, clearToast, toastType] = useToast();

  // ── load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    getAdminMessages()
      .then(r => {
        const data = r.data.data;
        setThreads(data);
        if (data.length > 0) setActiveId(data[0].id);
      })
      .catch(() => setError("Failed to load messages."))
      .finally(() => setLoading(false));
  }, []);

  // Poll every 10 s — picks up new guest messages without a manual refresh
  useEffect(() => {
    const id = setInterval(() => {
      getAdminMessages()
        .then(r => setThreads(r.data.data))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to latest message only when the active thread changes or after sending
  // (not on every poll, so the viewport doesn't jump while typing)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, scrollTick]);

  // ── derived ───────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = threads;
    if (filterRead === "unread")  list = list.filter(t => !t.is_read);
    if (filterRead === "replied") list = list.filter(t => t.replies?.some(r => r.sender_type === "resort"));
    if (filterRead === "pending") list = list.filter(t => !t.replies?.some(r => r.sender_type === "resort"));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.sender.toLowerCase().includes(q) ||
        t.sender_email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [threads, filterRead, searchTerm]);

  const active = useMemo(() => threads.find(t => t.id === activeId) ?? null, [threads, activeId]);

  const stats = useMemo(() => ({
    total:   threads.length,
    unread:  threads.filter(t => !t.is_read).length,
    pending: threads.filter(t => !t.replies?.some(r => r.sender_type === "resort")).length,
  }), [threads]);

  // ── open thread ───────────────────────────────────────────────────────────────
  function openThread(id) {
    setActiveId(id);
    setReply("");
    const thread = threads.find(t => t.id === id);
    if (thread?.is_read === false) {
      setThreads(prev => prev.map(t => t.id === id ? { ...t, is_read: true } : t));
      markAdminMessageRead(id).catch(() => {});
    }
  }

  // ── send reply ────────────────────────────────────────────────────────────────
  async function sendReply() {
    const body = reply.trim();
    if (!body || !active || sending) return;
    setSending(true);
    try {
      const res = await replyAdminMessage(active.id, body);
      const newReply = res.data;
      setThreads(prev => prev.map(t =>
        t.id !== active.id ? t : {
          ...t,
          is_read: true,
          replies: [...(t.replies ?? []), newReply],
        }
      ));
      setReply("");
      setScrollTick((t) => t + 1);
      showToast("Reply sent.", "success");
    } catch {
      showToast("Failed to send reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // ── compose thread list ────────────────────────────────────────────────────────
  const allMessages = active
    ? [{ id: active.id, body: active.body, sender_type: "guest",  created_at: active.created_at, sender: active.sender },
       ...(active.replies ?? [])]
    : [];

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* ── Header ── */}
      <div>
        <p className="text-sm text-slate-500 mt-1">Read and respond to guest inquiries.</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",        value: stats.total,   icon: "fa-envelope",       color: "bg-sky-100 text-sky-600"      },
          { label: "Unread",       value: stats.unread,  icon: "fa-envelope-open",  color: "bg-amber-100 text-amber-600"  },
          { label: "Needs Reply",  value: stats.pending, icon: "fa-reply",          color: "bg-rose-100 text-rose-600"    },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2.5 ${c.color}`}>
                <i className={`fas ${c.icon} text-base`}></i>
              </div>
              <div>
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className="text-2xl font-bold text-slate-900 leading-none">{loading ? "—" : c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">
          <i className="fas fa-exclamation-circle mr-2"></i>{error}
        </div>
      )}

      {/* ── Main panel ── */}
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex min-h-0"
           style={{ minHeight: "520px" }}>

        {/* ── Thread list ── */}
        <div className="w-80 shrink-0 flex flex-col border-r border-slate-200">

          {/* Search + filter */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Search guests or subjects…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50"
              />
            </div>
            <div className="flex gap-1">
              {[
                { key: "all",     label: "All"     },
                { key: "unread",  label: "Unread"  },
                { key: "pending", label: "Pending" },
                { key: "replied", label: "Replied" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterRead(f.key)}
                  className={`flex-1 text-[11px] font-medium py-1 rounded-md transition-colors
                    ${filterRead === f.key
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Thread items */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                <i className="fas fa-spinner fa-spin mr-2"></i>Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm gap-2">
                <i className="fas fa-inbox text-2xl"></i>
                <span>No messages found.</span>
              </div>
            ) : (
              filtered.map(thread => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  active={thread.id === activeId}
                  onClick={() => openThread(thread.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Conversation panel ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <i className="fas fa-comments text-5xl opacity-30"></i>
              <p className="text-sm">Select a conversation to view messages.</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{active.subject}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span><i className="fas fa-user mr-1 text-slate-400"></i>{active.sender}</span>
                    <span className="text-slate-300">·</span>
                    <span><i className="fas fa-envelope mr-1 text-slate-400"></i>{active.sender_email}</span>
                    <span className="text-slate-300">·</span>
                    <span><i className="fas fa-clock mr-1 text-slate-400"></i>{fmtDate(active.created_at)}</span>
                  </p>
                </div>
                <div className="shrink-0">
                  {active.replies?.some(r => r.sender_type === "resort") ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      <i className="fas fa-check-circle"></i>Replied
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                      <i className="fas fa-clock"></i>Awaiting reply
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50">
                {allMessages.map((msg, i) => (
                  <Bubble
                    key={msg.id ?? i}
                    msg={msg}
                    isStaff={msg.sender_type === "resort"}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <div className="px-5 py-4 border-t border-slate-200 bg-white">
                <div className="flex items-end gap-3">
                  <div className="flex-1 border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-400 transition-shadow bg-white">
                    <textarea
                      rows={2}
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
                      }}
                      placeholder="Type your reply to the guest… (Enter to send, Shift+Enter for new line)"
                      className="w-full px-4 py-3 text-sm text-slate-800 resize-none focus:outline-none"
                    />
                    <div className="flex items-center justify-between px-3 pb-2">
                      <span className="text-[11px] text-slate-400">Replying as Aplaya Beach Resort</span>
                      <span className={`text-[11px] ${reply.length > 1800 ? "text-rose-500" : "text-slate-400"}`}>
                        {reply.length}/2000
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={sendReply}
                    disabled={!reply.trim() || sending || reply.length > 2000}
                    className="shrink-0 inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700
                      disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl
                      text-sm font-medium transition-colors shadow-sm"
                  >
                    {sending
                      ? <><i className="fas fa-spinner fa-spin"></i> Sending…</>
                      : <><i className="fas fa-paper-plane"></i> Send</>}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
