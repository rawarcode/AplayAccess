// src/pages/dashboard/Messages.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getMessages, sendMessage, replyMessage, markMessageRead } from "../../lib/messageApi.js";
import Toast, { useToast } from "../../components/ui/Toast.jsx";
import { Helmet } from "react-helmet-async";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Compose Modal ───────────────────────────────────────────────────────────
function ComposeModal({ open, onClose, onSent }) {
  const [form, setForm] = useState({ subject: "", content: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") {
        if ((form.subject.trim() || form.content.trim()) && !confirm("Discard your draft?")) return;
        setForm({ subject: "", content: "" });
        setError("");
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, form]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject.trim() || !form.content.trim()) return;
    setError("");
    setSending(true);
    try {
      await sendMessage({ subject: form.subject, body: form.content });
      setForm({ subject: "", content: "" });
      onSent?.();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to send message.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const hasDraft = form.subject.trim() || form.content.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (hasDraft) { if (!confirm("Discard your draft?")) return; }
          setForm({ subject: "", content: "" });
          setError("");
          onClose();
        }}
      />
      <div className="relative bg-white w-full max-w-lg rounded-xl shadow-xl animate-hero-fade-in opacity-0">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            <i className="fas fa-pen-to-square mr-2 text-blue-600"></i>New Message
          </h3>
          <button onClick={() => {
            if (hasDraft) { if (!confirm("Discard your draft?")) return; }
            setForm({ subject: "", content: "" });
            setError("");
            onClose();
          }} className="text-gray-400 hover:text-gray-600">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <div className="relative">
              <i className="fas fa-heading absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Question about amenities"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <div className="relative">
              <i className="fas fa-comment-alt absolute left-3 top-3 text-gray-400"></i>
              <textarea
                rows={4}
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write your message to Aplaya Beach Resort..."
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => {
              if (hasDraft) { if (!confirm("Discard your draft?")) return; }
              setForm({ subject: "", content: "" });
              setError("");
              onClose();
            }} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm transition"
            >
              <i className={`fas ${sending ? "fa-spinner fa-spin" : "fa-paper-plane"}`}></i>
              {sending ? "Sending..." : "Send Message"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Messages() {
  const [threads, setThreads]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [currentId, setCurrentId] = useState(null);
  // Mobile: show chat view when a thread is selected
  const [mobileChat, setMobileChat] = useState(false);

  const [reply, setReply]         = useState("");
  const [sending, setSending]     = useState(false);
  const [replyError, setReplyError] = useState("");

  const bottomRef    = useRef(null);
  const textareaRef  = useRef(null);
  const [scrollTick, setScrollTick] = useState(0);
  const [toast, showToast, clearToast, toastType] = useToast();

  const [composeOpen, setComposeOpen] = useState(false);

  // Load threads on mount
  useEffect(() => {
    getMessages()
      .then((data) => {
        setThreads(data);
        if (data.length > 0) setCurrentId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll for new messages every 10s
  useEffect(() => {
    const id = setInterval(() => {
      getMessages()
        .then((data) => setThreads(data))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to bottom when thread changes or after send
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentId, scrollTick]);

  const totalUnread = useMemo(() => threads.reduce((t, c) => t + (c.unread || 0), 0), [threads]);

  const current = useMemo(
    () => threads.find((t) => t.id === currentId) || null,
    [threads, currentId]
  );

  function openThread(id) {
    setCurrentId(id);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
    markMessageRead(id).catch(() => {});
    setReply("");
    setReplyError("");
    setMobileChat(true);
  }

  const sendReply = useCallback(async () => {
    const text = reply.trim();
    if (!text || !current || sending) return;
    setReplyError("");
    setSending(true);
    try {
      const res = await replyMessage(current.id, text);
      const newMsg = res.data;
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== current.id) return t;
          return {
            ...t,
            messages: [...t.messages, newMsg],
            lastMessage: text,
            timestamp: "Just now",
          };
        })
      );
      setReply("");
      setScrollTick((t) => t + 1);
    } catch {
      setReplyError("Failed to send reply. Please try again.");
    } finally {
      setSending(false);
    }
  }, [reply, current, sending]);

  async function handleComposeSent() {
    const data = await getMessages().catch(() => []);
    setThreads(data);
    if (data.length > 0) setCurrentId(data[0].id);
    setComposeOpen(false);
    showToast("Message sent to Aplaya Beach Resort!", "success");
  }

  function handleReplyKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [reply]);

  // Avatar fallback
  function avatarSrc(thread) {
    return thread?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(thread?.name || "Resort")}&background=3b82f6&color=fff&size=80`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <Helmet><title>Messages — Aplaya Beach Resort</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Header */}
      <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <i className="fas fa-envelope text-blue-600 text-lg"></i>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            <p className="text-gray-500 text-sm">
              {loading ? "Loading..." : totalUnread > 0 ? `${totalUnread} unread` : "No unread messages"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <i className="fas fa-plus"></i>
          New Message
        </button>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">
          <div className="border-r">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 border-b animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-100 rounded w-48"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:flex items-center justify-center min-h-[520px] text-gray-300">
            <div className="text-center">
              <i className="fas fa-comments text-5xl mb-3"></i>
              <p className="text-sm">Loading conversations...</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">

          {/* Thread list — hidden on mobile when viewing a chat */}
          <div className={`border-r ${mobileChat ? "hidden lg:block" : ""}`}>
            {threads.length === 0 ? (
              <div className="p-8 text-center">
                <i className="fas fa-inbox text-gray-200 text-4xl mb-3 block"></i>
                <p className="text-gray-400 text-sm">No messages yet.</p>
                <button
                  onClick={() => setComposeOpen(true)}
                  className="mt-2 text-xs text-blue-600 hover:underline font-medium"
                >
                  <i className="fas fa-plus mr-1"></i>Send your first message
                </button>
              </div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => openThread(thread.id)}
                  className={[
                    "w-full text-left p-3 border-b hover:bg-gray-50 flex items-center gap-3 transition-colors",
                    currentId === thread.id ? "bg-blue-50" : "",
                  ].join(" ")}
                >
                  <img
                    src={avatarSrc(thread)}
                    alt={thread.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(thread.name || "R")}&background=3b82f6&color=fff&size=80`; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={`text-sm truncate ${thread.unread > 0 ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                        {thread.subject}
                      </h4>
                      <span className="text-[11px] text-gray-400 shrink-0 ml-2">{timeAgo(thread.timestamp)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs text-gray-500 truncate">
                        {thread.lastSender === "user" && <span className="text-gray-400">You: </span>}
                        {thread.lastMessage}
                      </p>
                      {thread.unread > 0 && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shrink-0">
                          {thread.unread > 9 ? "9+" : thread.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Chat view — hidden on mobile when viewing thread list */}
          <div className={`flex flex-col min-h-[520px] ${!mobileChat ? "hidden lg:flex" : ""}`}>
            {/* Chat header */}
            <div className="p-4 border-b flex items-center gap-3">
              {/* Mobile back button */}
              <button
                onClick={() => setMobileChat(false)}
                className="lg:hidden p-1.5 text-gray-500 hover:text-blue-600"
                aria-label="Back to threads"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
              {current ? (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img
                    src={avatarSrc(current)}
                    alt={current.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=3b82f6&color=fff&size=80`; }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{current.subject}</h3>
                    <p className="text-xs text-gray-400">{current.name}</p>
                  </div>
                </div>
              ) : (
                <h3 className="font-semibold text-gray-500 text-sm">Select a conversation</h3>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
              {!current ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                  <i className="fas fa-comments text-5xl mb-3"></i>
                  <p className="text-sm font-medium">No conversation selected</p>
                  <p className="text-xs text-gray-300 mt-1">Choose a thread or start a new message</p>
                </div>
              ) : current.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                  <i className="fas fa-comment-dots text-4xl mb-3"></i>
                  <p className="text-sm">No messages in this thread yet</p>
                </div>
              ) : (
                current.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    {m.sender !== "user" && (
                      <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0 mr-2 mt-1">
                        <i className="fas fa-umbrella-beach text-xs"></i>
                      </div>
                    )}
                    <div
                      className={[
                        "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                        m.sender === "user"
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-white text-gray-800 border border-gray-100 rounded-bl-md",
                      ].join(" ")}
                    >
                      {m.sender !== "user" && (
                        <p className="text-[10px] font-semibold text-blue-600 mb-0.5">Aplaya Beach Resort</p>
                      )}
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      <div className={`mt-1 text-[10px] ${m.sender === "user" ? "text-blue-200" : "text-gray-400"}`}>
                        {timeAgo(m.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            <div className="p-3 border-t bg-white">
              {replyError && (
                <div className="mb-2 text-sm text-red-600 flex items-center gap-1.5">
                  <i className="fas fa-exclamation-circle text-xs"></i>
                  {replyError}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder={current ? "Type your reply... (Enter to send, Shift+Enter for new line)" : "Select a conversation first"}
                  disabled={!current || sending}
                  rows={1}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none text-sm"
                  style={{ minHeight: 42, maxHeight: 120 }}
                />
                <button
                  onClick={sendReply}
                  disabled={!current || sending || !reply.trim()}
                  className="h-[42px] w-[42px] shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition"
                  aria-label="Send reply"
                >
                  <i className={`fas ${sending ? "fa-spinner fa-spin" : "fa-paper-plane"}`}></i>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Compose modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={handleComposeSent}
      />
    </div>
  );
}
