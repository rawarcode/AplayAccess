// src/pages/dashboard/Messages.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getMessages, sendMessage, replyMessage, markMessageRead } from "../../lib/messageApi.js";
import Toast, { useToast } from "../../components/ui/Toast.jsx";
import { Helmet } from "react-helmet-async";
import {
  playMessageChime,
  isMessageSoundMuted,
  setMessageSoundMuted,
  onMessageSoundMuteChange,
} from "../../lib/notificationSound.js";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Messages() {
  const [threads, setThreads]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [currentId, setCurrentId] = useState(null);
  const [mobileChat, setMobileChat] = useState(false);

  const [reply, setReply]         = useState("");
  const [sending, setSending]     = useState(false);
  const [replyError, setReplyError] = useState("");

  // Quick-send (replaces compose modal)
  const [quickMsg, setQuickMsg]   = useState("");
  const [quickSending, setQuickSending] = useState(false);

  const bottomRef    = useRef(null);
  const textareaRef  = useRef(null);
  const [scrollTick, setScrollTick] = useState(0);
  const [toast, showToast, clearToast, toastType] = useToast();

  // ── Chime-on-new-message wiring ──────────────────────────────────────
  // Plays a soft two-tone chime when the signature (total message count
  // across all threads) increases between polls. Skips the very first
  // load after mount so refreshes / navigations don't replay the sound
  // for already-arrived messages. See src/lib/notificationSound.js.
  const hasLoadedOnce     = useRef(false);
  const prevSignatureRef  = useRef(0);
  const [soundMuted, setSoundMutedLocal] = useState(isMessageSoundMuted);

  // Keep the toggle icon in sync if the mute is flipped in another tab
  // or from the shell-level toggle.
  useEffect(() => onMessageSoundMuteChange(setSoundMutedLocal), []);

  // Fires after every threads update. Compares new total-message-count
  // to the last observed value; a genuine increase means the latest
  // fetch brought in something new since the last poll.
  useEffect(() => {
    const sig = threads.reduce(
      (n, t) => n + 1 /* root */ + (t.messages?.length ?? 0),
      0
    );
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current  = true;
      prevSignatureRef.current = sig;
      return;
    }
    if (sig > prevSignatureRef.current) {
      playMessageChime();
    }
    prevSignatureRef.current = sig;
  }, [threads]);

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
    }, 20_000);
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
      // Auto-reply is returned inline when a rule matched. Append
      // the bot bubble immediately so the user sees the response
      // on the next paint — no extra refetch needed.
      const botReply = res.auto_reply;
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== current.id) return t;
          const appended = botReply
            ? [...t.messages, newMsg, botReply]
            : [...t.messages, newMsg];
          return {
            ...t,
            messages: appended,
            lastMessage: botReply ? botReply.text : text,
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

  // Quick-send: creates a thread directly — no modal
  async function handleQuickSend(e) {
    e.preventDefault();
    const text = quickMsg.trim();
    if (!text || quickSending) return;
    setQuickSending(true);
    try {
      await sendMessage({ subject: text.slice(0, 100), body: text });
      setQuickMsg("");
      // Reload threads to pick up the new one + auto-reply
      const data = await getMessages().catch(() => []);
      setThreads(data);
      if (data.length > 0) setCurrentId(data[0].id);
      setMobileChat(true);
      showToast("Message sent!", "success");
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to send message.";
      showToast(msg, "error");
    } finally {
      setQuickSending(false);
    }
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <Helmet><title>Messages — Aplaya Beach Resort</title></Helmet>
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Header with inline quick-send */}
      <div className="p-6 border-b space-y-4">
        <div className="flex items-center gap-3">
          <i className="fas fa-envelope text-sky-600 text-lg"></i>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
            <p className="text-slate-500 text-sm">
              {loading ? "Loading..." : totalUnread > 0 ? `${totalUnread} unread` : "No unread messages"}
            </p>
          </div>
          {/* Chime mute toggle. Persists to localStorage via
              notificationSound utility; syncs across tabs + shell bell. */}
          <button
            type="button"
            onClick={() => setMessageSoundMuted(!soundMuted)}
            title={soundMuted ? "Unmute message sound" : "Mute message sound"}
            aria-label={soundMuted ? "Unmute message sound" : "Mute message sound"}
            aria-pressed={soundMuted}
            className="h-11 w-11 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-600 hover:text-slate-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <i className={`fas ${soundMuted ? "fa-volume-xmark" : "fa-volume-high"} text-sm`} aria-hidden="true"></i>
          </button>
        </div>

        {/* Quick-send bar — replaces "New Message" button + compose modal */}
        <form onSubmit={handleQuickSend} className="flex items-center gap-2">
          <div className="relative flex-1">
            <i className="fas fa-pen absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              value={quickMsg}
              onChange={e => setQuickMsg(e.target.value)}
              placeholder="Type a new message to Aplaya Beach Resort..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 placeholder:text-slate-400 transition"
            />
          </div>
          <button
            type="submit"
            disabled={!quickMsg.trim() || quickSending}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-5 py-2.5 min-h-11 rounded-xl text-sm font-medium transition shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <i className={`fas ${quickSending ? "fa-spinner fa-spin" : "fa-paper-plane"} text-xs`} aria-hidden="true"></i>
            {quickSending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">
          <div className="border-r">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 border-b animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-32"></div>
                  <div className="h-3 bg-slate-100 rounded w-48"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:flex items-center justify-center min-h-[420px] max-h-[72vh] text-slate-300">
            <div className="text-center">
              <i className="fas fa-comments text-5xl mb-3"></i>
              <p className="text-sm">Loading conversations...</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">

          {/* Thread list */}
          <div className={`border-r ${mobileChat ? "hidden lg:block" : ""}`}>
            {threads.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-100 mb-3">
                  <i className="fas fa-inbox text-slate-300 text-2xl"></i>
                </div>
                <p className="text-slate-500 font-medium text-sm">No messages yet</p>
                <p className="text-xs text-slate-600 mt-1">Use the input above to send your first message.</p>
              </div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => openThread(thread.id)}
                  className={[
                    "w-full text-left p-3 border-b hover:bg-slate-50 flex items-center gap-3 transition-colors",
                    currentId === thread.id ? "bg-sky-50" : "",
                  ].join(" ")}
                >
                  <img
                    src={avatarSrc(thread)}
                    alt={thread.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=3b82f6&color=fff&size=80`; }}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={`text-sm truncate ${thread.unread > 0 ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                        {thread.subject}
                      </h4>
                      <span className="text-[11px] text-slate-600 shrink-0 ml-2">{timeAgo(thread.timestamp)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs text-slate-500 truncate">
                        {thread.lastSender === "user" && <span className="text-slate-400">You: </span>}
                        {thread.lastMessage}
                      </p>
                      {thread.unread > 0 && (
                        <span className="bg-sky-600 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shrink-0">
                          {thread.unread > 9 ? "9+" : thread.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Chat view */}
          <div className={`flex flex-col min-h-[420px] max-h-[72vh] ${!mobileChat ? "hidden lg:flex" : ""}`}>
            {/* Chat header */}
            <div className="p-4 border-b flex items-center gap-3">
              <button
                onClick={() => setMobileChat(false)}
                type="button"
                className="lg:hidden w-11 h-11 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-sky-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Back to threads"
              >
                <i className="fas fa-arrow-left" aria-hidden="true"></i>
              </button>
              {current ? (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img
                    src={avatarSrc(current)}
                    alt={current.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=3b82f6&color=fff&size=80`; }}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm truncate">{current.subject}</h3>
                    <p className="text-xs text-slate-600">{current.name}</p>
                  </div>
                </div>
              ) : (
                <h3 className="font-semibold text-slate-500 text-sm">Select a conversation</h3>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {!current ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <i className="fas fa-comments text-slate-300 text-2xl"></i>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No conversation selected</p>
                  <p className="text-xs text-slate-600 mt-1">Choose a thread or send a new message above</p>
                </div>
              ) : current.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <i className="fas fa-comment-dots text-4xl mb-3"></i>
                  <p className="text-sm">No messages in this thread yet</p>
                </div>
              ) : (
                current.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    {m.sender !== "user" && (
                      <div className="h-7 w-7 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-bold text-sky-600 shrink-0 mr-2 mt-1">
                        <i className="fas fa-umbrella-beach text-xs"></i>
                      </div>
                    )}
                    <div
                      className={[
                        "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                        m.sender === "user"
                          ? "bg-sky-600 text-white rounded-br-md"
                          : "bg-white text-slate-800 border border-slate-100 rounded-bl-md",
                      ].join(" ")}
                    >
                      {m.sender !== "user" && (
                        <p className="text-[10px] font-semibold text-sky-600 mb-0.5">
                          {m.sender_name || "Aplaya Beach Resort"}
                        </p>
                      )}
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      <div className={`mt-1 text-[10px] ${m.sender === "user" ? "text-sky-200" : "text-slate-400"}`}>
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
                  placeholder={current ? "Type your reply... (Enter to send)" : "Select a conversation first"}
                  disabled={!current || sending}
                  rows={1}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-slate-50 resize-none text-sm"
                  style={{ minHeight: 42, maxHeight: 120 }}
                />
                <button
                  onClick={sendReply}
                  disabled={!current || sending || !reply.trim()}
                  type="button"
                  className="h-11 w-11 shrink-0 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white inline-flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                  aria-label="Send reply"
                >
                  <i className={`fas ${sending ? "fa-spinner fa-spin" : "fa-paper-plane"}`} aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
