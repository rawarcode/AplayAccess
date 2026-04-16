import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getAutoReplyKeywords } from "../lib/resortApi.js";
import { sendMessage, replyMessage } from "../lib/messageApi.js";

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
 * Shows keyword chips for quick answers.
 * Logged-in guests can also type freely (auto-creates a thread).
 */
export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen]             = useState(false);
  const [keywords, setKeywords]     = useState([]);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [loadingKw, setLoadingKw]   = useState(true);
  const bottomRef = useRef(null);
  const threadIdRef = useRef(null); // reuse one thread per session

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

  // Add a welcome message on first open
  const welcomed = useRef(false);
  useEffect(() => {
    if (open && !welcomed.current) {
      welcomed.current = true;
      setMessages([{
        id: "welcome",
        type: "bot",
        text: "Hi! Welcome to Aplaya Beach Resort. How can I help you? Tap a topic below or type your question.",
      }]);
    }
  }, [open]);

  // Find matching keyword response (word-boundary match — prevents "price" matching "surprise")
  const findLocalMatch = useCallback((text) => {
    return keywords.find(k => {
      const regex = new RegExp(`\\b${k.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return regex.test(text);
    });
  }, [keywords]);

  // Handle sending a message (keyword click or typed)
  async function handleSend(text) {
    const body = (text || input).trim();
    if (!body || sending) return;

    // Add user bubble
    const userMsg = { id: Date.now(), type: "user", text: body };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Check local keyword match
    const match = findLocalMatch(body);

    if (match) {
      // Show bot response immediately
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          type: "bot",
          text: match.response,
        }]);
      }, 400); // slight delay for natural feel
    }

    // If logged in, also send as a real message thread (reuse one thread)
    if (user) {
      setSending(true);
      try {
        if (threadIdRef.current) {
          // Reply in the existing thread
          await replyMessage(threadIdRef.current, body);
        } else {
          // First message — create thread, store its ID
          const res = await sendMessage({ subject: "Chat Inquiry", body });
          threadIdRef.current = res.data?.id ?? res.id ?? null;
        }
        if (!match) {
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: Date.now() + 2,
              type: "bot",
              text: "Thanks for your message! Our team will get back to you shortly. You can check your Messages page for the reply.",
            }]);
          }, 500);
        }
      } catch {
        setMessages(prev => [...prev, {
          id: Date.now() + 3,
          type: "bot",
          text: "Sorry, I couldn't send your message right now. Please try again later.",
        }]);
      } finally {
        setSending(false);
      }
    } else if (!match) {
      // Not logged in and no keyword match
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now() + 4,
          type: "bot",
          text: "I don't have an answer for that yet. Please log in to send a message to our team, or try one of the topics below!",
        }]);
      }, 400);
    }
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

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-[9990] h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
          open
            ? "bg-slate-700 hover:bg-slate-800 rotate-0"
            : "bg-sky-600 hover:bg-sky-700 animate-bounce-slow"
        }`}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        <i className={`fas ${open ? "fa-times" : "fa-comments"} text-white text-xl transition-transform duration-200`}></i>
      </button>

      {/* Chat panel */}
      <div className={`fixed bottom-24 right-6 z-[9990] w-[380px] max-w-[calc(100vw-2rem)] transition-all duration-300 origin-bottom-right ${
        open ? "scale-100 opacity-100 pointer-events-auto" : "scale-90 opacity-0 pointer-events-none"
      }`}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: "520px" }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-sky-600 to-sky-700 px-5 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <i className="fas fa-umbrella-beach text-white text-lg"></i>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Aplaya Beach Resort</h3>
                <p className="text-sky-100 text-xs flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block"></span>
                  We typically reply instantly
                </p>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50" style={{ minHeight: "200px", maxHeight: "320px" }}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                {msg.type === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <i className="fas fa-robot text-sky-600 text-xs"></i>
                  </div>
                )}
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.type === "user"
                    ? "bg-sky-600 text-white rounded-br-sm"
                    : "bg-white text-slate-700 border border-slate-200 rounded-bl-sm shadow-sm"
                }`}>
                  {msg.type === "bot" ? <BotText text={msg.text} /> : msg.text}
                </div>
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
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Quick topics</p>
              <div className="flex flex-wrap gap-1.5">
                {availableKeywords.map(k => (
                  <button
                    key={k.keyword}
                    onClick={() => handleSend(k.keyword)}
                    disabled={sending}
                    className="px-3 py-1.5 bg-sky-50 border border-sky-200 text-sky-700 text-xs font-medium rounded-full hover:bg-sky-100 hover:border-sky-300 transition disabled:opacity-50"
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
                className="h-10 w-10 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white flex items-center justify-center transition shrink-0"
                aria-label="Send"
              >
                <i className={`fas ${sending ? "fa-spinner fa-spin" : "fa-paper-plane"} text-sm`}></i>
              </button>
            </div>
            {!user && (
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                <a href="/resort" className="text-sky-600 hover:text-sky-700 font-medium">Log in</a> to send messages to our team
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bounce animation for the bubble */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
