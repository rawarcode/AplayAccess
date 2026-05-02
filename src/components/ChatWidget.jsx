import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getAutoReplyKeywords } from "../lib/resortApi.js";
import { getMessages, sendMessage, replyMessage, markMessageRead } from "../lib/messageApi.js";
import { playMessageChime } from "../lib/notificationSound.js";
import { useDraggableWidget } from "../lib/useDraggableWidget.js";
import Avatar from "./ui/Avatar.jsx";

/** Render bot text with route links (/rooms, /resort, etc.) as clickable Link components */
function BotText({ text }) {
  // Match internal routes like /rooms, /resort, /gallery, /dashboard, /announcements
  const parts = text.split(/(\/(?:rooms|resort|gallery|dashboard|announcements)(?:\/[a-z-]*)?\b)/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^\/(?:rooms|resort|gallery|dashboard|announcements)/.test(part) ? (
          <Link key={i} to={part} className="underline font-semibold hover:opacity-80 transition">
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/**
 * Floating chat widget — bottom-right bubble.
 *
 * Two audiences:
 *  - Anonymous visitors: local keyword matching only. Messages are
 *    never sent to the server; the widget serves as a FAQ-style help
 *    stand-in and prompts sign-in for real support.
 *  - Logged-in guests: widget is a thin client over the same thread
 *    their /dashboard/messages page uses. Loads existing thread on
 *    mount, polls every 20s, re-syncs after each send. Matches the
 *    one-thread-per-guest consolidation enforced by the backend.
 *
 * Local-only bubbles (welcome, anonymous keyword responses) carry ids
 * like 'welcome' / 'bot-*' / 'tmp-*'. Server-sourced bubbles use
 * 'm-<serverId>'. Sync replaces every 'm-*' bubble with the fresh
 * server state and preserves the rest.
 */
export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen]             = useState(false);
  const [keywords, setKeywords]     = useState([]);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [loadingKw, setLoadingKw]   = useState(true);
  // Unread server replies from staff. Shown as a red dot on the
  // closed bubble. Cleared when the widget opens and markMessageRead
  // lands on the backend (or silently — next poll resyncs).
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef(null);
  // Populated by syncFromServer once the user has a server-side
  // thread. Reused across replies. Re-hydrated on every mount
  // so refresh / relog doesn't lose track of it.
  const threadIdRef = useRef(null);
  // Chime baseline — first poll establishes "current truth". Later
  // polls that return MORE server messages fire the chime.
  const hasFetchedOnceRef     = useRef(false);
  const prevServerMsgCountRef = useRef(0);
  // Whether we've already injected the welcome bubble for this
  // session. Reset on logout so a fresh login gets the greeting.
  const welcomed = useRef(false);

  // Load keywords once
  useEffect(() => {
    getAutoReplyKeywords()
      .then(data => setKeywords(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingKw(false));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Convert a server thread into widget bubbles. 'm-' prefix tags
  // them as server-sourced so sync can find + replace them.
  function threadToBubbles(thread) {
    if (!thread) return [];
    return (thread.messages ?? []).map(m => ({
      id:   `m-${m.id}`,
      type: m.sender === 'user' ? 'user' : 'bot',
      // Surfaced on resort-sent bubbles so the guest sees which
      // staff member replied. Null for auto-reply-rule matches and
      // legacy rows — the bubble hides the label in that case.
      senderName:   m.sender_name ?? null,
      senderAvatar: m.sender_avatar ?? null,
      text: m.text,
    }));
  }

  // Pull thread state + merge into local messages. No-op for
  // anonymous visitors. Safe to call on mount, poll tick, or post-send.
  const syncFromServer = useCallback(async () => {
    if (!user) return;
    try {
      const threads = await getMessages();
      const thread  = threads?.[0] ?? null;  // backend guarantees ≤1 per guest
      threadIdRef.current = thread?.id ?? null;

      const serverBubbles = threadToBubbles(thread);
      const serverCount   = serverBubbles.length;

      setMessages(prev => {
        const welcome = prev.filter(m => m.id === 'welcome');
        const others  = prev.filter(m =>
          !String(m.id).startsWith('m-') && m.id !== 'welcome'
        );
        return [...welcome, ...serverBubbles, ...others];
      });

      if (hasFetchedOnceRef.current && serverCount > prevServerMsgCountRef.current) {
        const delta      = serverCount - prevServerMsgCountRef.current;
        const newBubbles = serverBubbles.slice(-delta);
        const staffCount = newBubbles.filter(b => b.type === 'bot').length;
        if (staffCount > 0) {
          playMessageChime();
          if (!open) setUnreadCount(c => c + staffCount);
        }
      }
      if (!hasFetchedOnceRef.current) {
        hasFetchedOnceRef.current = true;
        if (thread && !open) setUnreadCount(thread.unread || 0);
      }
      prevServerMsgCountRef.current = serverCount;
    } catch {
      /* widget is non-critical — swallow and retry next tick */
    }
  }, [user, open]);

  // Wipe widget state on logout so the next user (or the
  // logged-out view) doesn't see the prior session's history.
  useEffect(() => {
    if (user) return;
    setMessages([]);
    setUnreadCount(0);
    threadIdRef.current = null;
    hasFetchedOnceRef.current = false;
    prevServerMsgCountRef.current = 0;
    welcomed.current = false;
  }, [user]);

  // Initial thread load on login
  useEffect(() => {
    if (!user) return;
    syncFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Poll every 20s for staff replies while logged in
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => syncFromServer(), 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // When the widget opens with unread replies, mark the thread read
  // server-side and clear the local dot. Failure is silent; next
  // sync will reconcile state.
  useEffect(() => {
    if (!open || !user || !threadIdRef.current || unreadCount === 0) return;
    markMessageRead(threadIdRef.current).catch(() => {});
    setUnreadCount(0);
  }, [open, user, unreadCount]);

  // Welcome bubble — only for users who have no thread yet (otherwise
  // their conversation history sits on top and a stock greeting above
  // it is noise).
  useEffect(() => {
    if (!open || welcomed.current) return;
    const hasServerMessages = messages.some(m => String(m.id).startsWith('m-'));
    if (hasServerMessages) return;
    welcomed.current = true;
    setMessages(prev => [
      {
        id: "welcome",
        type: "bot",
        text: "Hi! Welcome to Aplaya Beach Resort. How can I help you? Tap a topic below or type your question.",
      },
      ...prev,
    ]);
  }, [open, messages]);

  // Find matching keyword response (word-boundary match — prevents "price" matching "surprise")
  const findLocalMatch = useCallback((text) => {
    return keywords.find(k => {
      const regex = new RegExp(`\\b${k.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return regex.test(text);
    });
  }, [keywords]);

  // Handle sending a message (keyword click or typed).
  //
  // Logged-in path: dispatch to the server, then re-sync to pull back
  // the user's own message + any auto-reply the backend fires. This
  // replaces the optimistic bubble we add immediately so the user
  // isn't staring at a frozen screen during the network round-trip.
  // We rely on the server's auto-reply rules rather than the local
  // keyword match so we don't render the same response twice.
  //
  // Anonymous path: local keyword match only. Nothing is persisted
  // server-side — the widget acts as a small FAQ.
  async function handleSend(text) {
    const body = (text || input).trim();
    if (!body || sending) return;
    setInput("");

    if (user) {
      const tempId = `tmp-${Date.now()}`;
      setMessages(prev => [...prev, { id: tempId, type: 'user', text: body }]);

      setSending(true);
      try {
        if (threadIdRef.current) {
          await replyMessage(threadIdRef.current, body);
        } else {
          await sendMessage({ subject: "Chat Inquiry", body });
        }
        // Re-sync: just-sent message comes back as 'm-*'. Drop the
        // optimistic 'tmp-' so it isn't duplicated in the transcript.
        await syncFromServer();
        setMessages(prev => prev.filter(m => m.id !== tempId));
      } catch {
        setMessages(prev => [...prev, {
          id: `bot-${Date.now()}`,
          type: "bot",
          text: "Sorry, I couldn't send your message right now. Please try again later.",
        }]);
      } finally {
        setSending(false);
      }
      return;
    }

    // Anonymous — purely client-side
    const userBubble = { id: Date.now(), type: "user", text: body };
    setMessages(prev => [...prev, userBubble]);
    const match = findLocalMatch(body);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        type: "bot",
        text: match
          ? match.response
          : "I don't have an answer for that yet. Please log in to send a message to our team, or try one of the topics below!",
      }]);
    }, 400);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Filter out already-asked keywords
  const askedKeywords = messages.filter(m => m.type === "user").map(m => m.text.toLowerCase());
  const availableKeywords = keywords.filter(k => !askedKeywords.includes(k.keyword.toLowerCase()));

  // Drag-to-reposition. Persists per-widget; bubble + panel translate
  // in lockstep so the panel stays anchored above the bubble wherever
  // the user parks it.
  const { handlers: dragHandlers, style: dragStyle, wasDragged } = useDraggableWidget('guest-chat');

  return (
    <>
      {/* Floating bubble — shows an unread badge when the widget is
          closed and the guest has untouched staff replies on their
          thread. Badge clears the instant they open the widget.
          Draggable: the user can move it out of the way of any
          underlying button. transition-colors instead of transition-all
          so the drag transform isn't smoothed (would feel laggy). */}
      <button
        onClick={() => { if (wasDragged.current) return; setOpen(o => !o); }}
        {...dragHandlers}
        style={dragStyle}
        className={`fixed bottom-6 right-6 z-[9990] h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-colors duration-300 cursor-grab active:cursor-grabbing ${
          open
            ? "bg-slate-700 hover:bg-slate-800"
            : "bg-sky-600 hover:bg-sky-700"
        }`}
        aria-label={
          open
            ? "Close chat"
            : unreadCount > 0
              ? `Open chat — ${unreadCount} new reply${unreadCount !== 1 ? "s" : ""}`
              : "Open chat"
        }
      >
        <i className={`fas ${open ? "fa-times" : "fa-comments"} text-white text-xl transition-transform duration-200 pointer-events-none`}></i>
        {!open && unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full bg-rose-500 border-2 border-white text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none pointer-events-none animate-pulse"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel — outer wrapper carries the drag translate so it
          tracks the bubble; inner div keeps the open/close scale
          animation. Two layers because the inline transform on the
          wrapper would otherwise stomp the Tailwind `scale-*` class on
          the panel and the open animation would jump-cut.
          pointer-events-none on the OUTER wrapper unconditionally —
          the wrapper is a 380px region floating over the page even
          when the panel is invisible, and would otherwise block
          underlying buttons. The inner div re-enables pointer events
          while open so clicks on visible panel content still work. */}
      <div
        style={dragStyle}
        className="fixed bottom-24 right-6 z-[9990] w-[380px] max-w-[calc(100vw-2rem)] pointer-events-none"
      >
      <div className={`transition-all duration-300 origin-bottom-right ${
        open ? "scale-100 opacity-100 pointer-events-auto" : "scale-90 opacity-0 pointer-events-none"
      }`}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: "520px" }}>

          {/* Header */}
          <div className="bg-sky-600 px-5 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <i className="fas fa-umbrella-beach text-white text-lg"></i>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Aplaya Beach Resort</h3>
                <p className="text-sky-100 text-xs flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block"></span>
                  We usually reply within an hour
                </p>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50" style={{ minHeight: "200px", maxHeight: "320px" }}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                {msg.type === "bot" && (
                  <Avatar
                    src={msg.senderAvatar}
                    name={msg.senderName || 'Aplaya Resort'}
                    className="shrink-0 h-7 w-7 mr-2 mt-0.5"
                    fallbackClassName="bg-sky-100 text-sky-700 text-[10px] font-bold"
                  />
                )}
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.type === "user"
                    ? "bg-sky-600 text-white rounded-br-sm"
                    : "bg-white text-slate-700 border border-slate-200 rounded-bl-sm shadow-sm"
                }`}>
                  {msg.type === "bot" && msg.senderName && (
                    <p className="text-[10px] font-semibold text-sky-600 mb-0.5">{msg.senderName}</p>
                  )}
                  {msg.type === "bot" ? <BotText text={msg.text} /> : msg.text}
                </div>
                {msg.type === "user" && (
                  <Avatar
                    src={user?.avatar}
                    name={user?.name || 'You'}
                    className="shrink-0 h-7 w-7 ml-2 mt-0.5"
                    fallbackClassName="bg-sky-600 text-white text-[10px] font-bold"
                  />
                )}
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center shrink-0 mr-2">
                  <i className="fas fa-robot text-sky-600 text-xs"></i>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Keyword chips */}
          {availableKeywords.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-white shrink-0">
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Quick topics</p>
              <div className="flex flex-wrap gap-1.5">
                {availableKeywords.map(k => (
                  <button
                    key={k.keyword}
                    onClick={() => handleSend(k.keyword)}
                    disabled={sending}
                    type="button"
                    className="px-3.5 py-2.5 min-h-11 bg-sky-50 border border-sky-200 text-sky-700 text-xs font-medium rounded-full hover:bg-sky-100 hover:border-sky-300 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {k.keyword}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="px-3 py-3 border-t border-slate-200 bg-white shrink-0">
            <div className="flex items-end gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={user ? "Type a message..." : "Type a question or tap a topic..."}
                disabled={sending}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 placeholder:text-slate-400 disabled:opacity-50 transition"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || sending}
                type="button"
                className="h-11 w-11 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white flex items-center justify-center transition shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                aria-label="Send"
              >
                <i className={`fas ${sending ? "fa-spinner fa-spin" : "fa-paper-plane"} text-sm`} aria-hidden="true"></i>
              </button>
            </div>
            {!user && (
              <p className="text-[10px] text-slate-600 mt-1.5 text-center">
                <a href="/resort" className="text-sky-700 hover:text-sky-800 font-medium underline rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Log in</a> to send messages to our team
              </p>
            )}
          </div>
        </div>
      </div>
      </div>

    </>
  );
}
