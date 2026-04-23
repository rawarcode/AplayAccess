/**
 * StaffChatWidget — floating message bubble for staff users.
 *
 * Mirrors the guest ChatWidget's visual language but serves the
 * opposite audience: staff replying to many guests instead of one
 * guest chatting with the resort. Violet bubble (vs. guest sky) so
 * the two widgets never get confused at a glance.
 *
 * Two internal views:
 *   - List: 10 most recent threads, unread ones on top.
 *   - Detail: one thread's bubbles + inline reply composer.
 *
 * Intentional scope boundaries:
 *   - Reply only. No "compose new message" — that flow lives on the
 *     full Owner Messages page where there's room for the recipient
 *     picker.
 *   - No delete / restrict / guest search. Those belong on the full
 *     page too; the widget is the quick-reply sidecar.
 *
 * Chime / unread-count interaction:
 *   - useStaffNotifications already plays the chime when the shell's
 *     unreadMessages count increases. We don't replay it here —
 *     doing both would double-fire. The widget just reflects the
 *     unread count visually via a red badge on the bubble.
 *
 * Guarded with a role check — never renders for guest users or
 * logged-out visitors, even if someone forgets to remove the import
 * from a guest-facing shell.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getAdminMessages,
  replyAdminMessage,
  markAdminMessageRead,
} from '../lib/adminApi.js';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso.replace(' ', 'T')).getTime()) / 1000;
  if (isNaN(diff)) return '';
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso.replace(' ', 'T')).toLocaleDateString();
}

function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function StaffChatWidget() {
  const { user } = useAuth();

  // Hooks run unconditionally even for guests — we just early-return
  // from render. React requires hook order to be stable, so we cannot
  // early-return before the hook calls.
  const [open, setOpen]                     = useState(false);
  const [threads, setThreads]               = useState([]);
  const [selectedThreadId, setSelectedId]   = useState(null);
  const [reply, setReply]                   = useState('');
  const [sending, setSending]               = useState(false);
  const [sendError, setSendError]           = useState('');
  const listBottomRef = useRef(null);
  const composerRef   = useRef(null);

  const isStaff = !!user && user.role !== 'guest';

  // Fetcher — called on mount, poll tick, and after a send so the
  // widget always reflects server truth. Silent failures; the shell
  // bell already surfaces outage state if something's broken.
  const fetchThreads = useCallback(async () => {
    if (!isStaff) return;
    try {
      const r = await getAdminMessages();
      setThreads(Array.isArray(r.data?.data) ? r.data.data : []);
    } catch {
      /* non-critical */
    }
  }, [isStaff]);

  // Initial load + polling. Same cadence as everywhere else in the
  // app so the widget and other surfaces (bell, Messages page) stay
  // in rough lockstep.
  useEffect(() => {
    if (!isStaff) return;
    fetchThreads();
    const id = setInterval(fetchThreads, 20_000);
    return () => clearInterval(id);
  }, [isStaff, fetchThreads]);

  // When the user opens a specific thread, mark it read on the
  // backend so the sidebar unread count decays. Optimistically flip
  // is_read on the local copy so the badge updates immediately.
  useEffect(() => {
    if (!open || !selectedThreadId) return;
    const t = threads.find(x => x.id === selectedThreadId);
    if (!t || t.is_read) return;
    markAdminMessageRead(selectedThreadId).catch(() => {});
    setThreads(prev => prev.map(x =>
      x.id === selectedThreadId ? { ...x, is_read: true } : x
    ));
  }, [open, selectedThreadId, threads]);

  // Auto-scroll the detail view to the latest message when opening
  // a thread or after a reply is sent.
  useEffect(() => {
    if (selectedThreadId) {
      listBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedThreadId, threads]);

  // Focus the composer as soon as a thread is selected so staff
  // don't have to reach for the mouse to reply.
  useEffect(() => {
    if (selectedThreadId && open) {
      setTimeout(() => composerRef.current?.focus(), 80);
    }
  }, [selectedThreadId, open]);

  if (!isStaff) return null;

  const selected = selectedThreadId
    ? threads.find(t => t.id === selectedThreadId) ?? null
    : null;

  // Top 10 most-recent threads, unread first. The backend returns
  // them latest first already, so we just stable-sort by unread.
  const visibleThreads = [...threads]
    .sort((a, b) => Number(!a.is_read) - Number(!b.is_read))
    .reverse()
    .slice(-10)
    .reverse();

  const totalUnread = threads.filter(t => !t.is_read).length;

  async function handleSend() {
    const body = reply.trim();
    if (!body || !selected || sending) return;
    setSendError('');
    setSending(true);
    try {
      const r = await replyAdminMessage(selected.id, body);
      const newReply = r.data?.data ?? r.data;
      // Append locally so the send feels instant; the next poll will
      // reconcile if anything's off.
      setThreads(prev => prev.map(t =>
        t.id !== selected.id ? t : {
          ...t,
          is_read: true,
          replies: [...(t.replies ?? []), newReply],
        }
      ));
      setReply('');
    } catch (err) {
      setSendError(err?.response?.data?.message || 'Failed to send. Try again.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating bubble — violet to distinguish from the guest
          widget. Same bottom-right anchor + bounce animation. */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-[9989] h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
          open
            ? 'bg-slate-700 hover:bg-slate-800'
            : 'bg-violet-600 hover:bg-violet-700'
        }`}
        aria-label={
          open
            ? 'Close staff messages'
            : totalUnread > 0
              ? `Open staff messages — ${totalUnread} unread`
              : 'Open staff messages'
        }
      >
        <i className={`fas ${open ? 'fa-times' : 'fa-headset'} text-white text-xl`}></i>
        {!open && totalUnread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full bg-rose-500 border-2 border-white text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none pointer-events-none animate-pulse"
            aria-hidden="true"
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-24 right-6 z-[9989] w-[400px] max-w-[calc(100vw-2rem)] transition-all duration-300 origin-bottom-right ${
          open ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: '560px' }}>

          {/* Header */}
          <div className="bg-violet-600 px-5 py-4 shrink-0 flex items-center gap-3">
            {selectedThreadId && (
              <button
                onClick={() => setSelectedId(null)}
                className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
                aria-label="Back to thread list"
              >
                <i className="fas fa-arrow-left text-sm"></i>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm truncate">
                {selected ? selected.sender : 'Messages'}
              </h3>
              <p className="text-violet-100 text-xs truncate">
                {selected
                  ? selected.sender_email
                  : totalUnread > 0
                    ? `${totalUnread} unread thread${totalUnread !== 1 ? 's' : ''}`
                    : 'All caught up'}
              </p>
            </div>
          </div>

          {/* Body — either the thread list or one thread's bubbles */}
          {!selectedThreadId ? (
            <ThreadList
              threads={visibleThreads}
              onPick={setSelectedId}
            />
          ) : selected ? (
            <ThreadDetail
              thread={selected}
              reply={reply}
              setReply={setReply}
              sending={sending}
              sendError={sendError}
              onSend={handleSend}
              onKeyDown={handleKeyDown}
              composerRef={composerRef}
              bottomRef={listBottomRef}
            />
          ) : null}

          {/* Footer link to the full Messages page — only shown in
              list view. Owners + frontdesk both need the full page
              for anything beyond quick replies. */}
          {!selectedThreadId && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between">
              <Link
                to={user?.role === 'owner' ? '/owner/messages' : '/frontdesk/messages'}
                onClick={() => setOpen(false)}
                className="text-xs text-violet-700 hover:text-violet-900 font-medium"
              >
                <i className="fas fa-external-link-alt mr-1"></i>
                Open full Messages
              </Link>
              <span className="text-[11px] text-slate-400">Updates every 20s</span>
            </div>
          )}
        </div>
      </div>

    </>
  );
}

// ─── Thread list view ──────────────────────────────────────────────
function ThreadList({ threads, onPick }) {
  if (threads.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 gap-2 bg-slate-50" style={{ minHeight: 280 }}>
        <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <i className="fas fa-check-circle text-emerald-600 text-2xl"></i>
        </div>
        <p className="text-sm font-medium text-slate-600">No messages yet</p>
        <p className="text-xs text-slate-400">Guest inquiries will appear here.</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white" style={{ minHeight: 280, maxHeight: 400 }}>
      {threads.map(t => {
        const last    = t.replies?.at(-1);
        const preview = last?.body ?? t.body ?? '';
        const unread  = !t.is_read;
        const ts      = last?.created_at ?? t.created_at;
        return (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition ${
              unread ? 'bg-violet-50 hover:bg-violet-100' : 'hover:bg-slate-50'
            }`}
          >
            <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
              unread ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {initials(t.sender)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-sm truncate ${unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                  {t.sender}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(ts)}</span>
              </div>
              <p className={`text-xs truncate ${unread ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                {t.subject || '(No subject)'}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{preview}</p>
            </div>
            {unread && (
              <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Thread detail + composer ──────────────────────────────────────
function ThreadDetail({ thread, reply, setReply, sending, sendError, onSend, onKeyDown, composerRef, bottomRef }) {
  // Build a single ordered list: root + replies. sender_type decides
  // which side of the conversation each bubble lands on.
  const bubbles = [
    {
      id: thread.id,
      body: thread.body,
      sender_type: 'guest',
      created_at: thread.created_at,
    },
    ...(thread.replies ?? []),
  ];
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50" style={{ minHeight: 240, maxHeight: 340 }}>
        {bubbles.map(b => {
          const fromStaff = b.sender_type === 'resort';
          return (
            <div key={b.id ?? `b-${Math.random()}`} className={`flex ${fromStaff ? 'justify-end' : 'justify-start'}`}>
              {!fromStaff && (
                <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <i className="fas fa-user text-slate-600 text-[10px]"></i>
                </div>
              )}
              <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                fromStaff
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-white text-slate-700 border border-slate-200 rounded-bl-sm shadow-sm'
              }`}>
                {b.body}
                <p className={`text-[10px] mt-1 ${fromStaff ? 'text-violet-200' : 'text-slate-400'}`}>
                  {timeAgo(b.created_at)}
                </p>
              </div>
              {fromStaff && (
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 ml-2 mt-0.5">
                  <i className="fas fa-headset text-violet-600 text-[10px]"></i>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-3 py-3 border-t border-slate-200 bg-white shrink-0">
        {sendError && (
          <p className="text-[11px] text-rose-600 mb-1.5 px-1">
            <i className="fas fa-exclamation-circle mr-1"></i>{sendError}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={composerRef}
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Reply…  (Enter to send, Shift+Enter for newline)"
            disabled={sending}
            rows={2}
            maxLength={2000}
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 placeholder:text-slate-400 disabled:opacity-50 transition resize-none"
          />
          <button
            onClick={onSend}
            disabled={!reply.trim() || sending}
            className="h-10 w-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center transition shrink-0"
            aria-label="Send"
            title="Send"
          >
            <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-sm`}></i>
          </button>
        </div>
      </div>
    </>
  );
}
