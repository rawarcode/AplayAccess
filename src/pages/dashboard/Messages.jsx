// src/pages/dashboard/Messages.jsx
import { useEffect, useMemo, useState } from "react";
import useLockBodyScroll from "../../hooks/useLockBodyScroll.js";
import { getMessages, sendMessage, replyMessage, markMessageRead } from "../../lib/messageApi.js";
import { changePassword } from "../../lib/profileApi.js";

function Modal({ open, title, children, onClose }) {
  useLockBodyScroll(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-gray-500/75" />
        <div className="relative bg-white w-full max-w-lg rounded-lg shadow-xl">
          <div className="p-5 flex items-center justify-between border-b">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const [threads, setThreads]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [currentId, setCurrentId] = useState(null);

  const [reply, setReply]       = useState("");
  const [sending, setSending]   = useState(false);
  const [replyError, setReplyError] = useState("");

  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [pwdOpen, setPwdOpen]       = useState(false);

  const [compose, setCompose] = useState({ subject: "", content: "" });
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError]     = useState("");

  const [pwd, setPwd]           = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwdError, setPwdError]   = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

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

  const totalUnread = useMemo(() => threads.reduce((t, c) => t + (c.unread || 0), 0), [threads]);

  const current = useMemo(
    () => threads.find((t) => t.id === currentId) || null,
    [threads, currentId]
  );

  function openThread(id) {
    setCurrentId(id);
    // Mark as read locally then persist
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
    markMessageRead(id).catch(() => {});
    setReply("");
  }

  async function sendReply() {
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
    } catch {
      setReplyError("Failed to send reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function submitNewMessage(e) {
    e.preventDefault();
    if (!compose.subject || !compose.content) return;
    setComposeError("");
    setComposeSending(true);
    try {
      await sendMessage({ subject: compose.subject, body: compose.content });
      // Refresh thread list
      const data = await getMessages();
      setThreads(data);
      if (data.length > 0) setCurrentId(data[0].id);
      setNewMsgOpen(false);
      setCompose({ subject: "", content: "" });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to send message.";
      setComposeError(msg);
    } finally {
      setComposeSending(false);
    }
  }

  async function submitChangePassword(e) {
    e.preventDefault();
    setPwdError("");
    if (pwd.newPassword !== pwd.confirm) {
      setPwdError("New passwords do not match.");
      return;
    }
    if ((pwd.newPassword || "").length < 8) {
      setPwdError("Password must be at least 8 characters.");
      return;
    }
    setPwdSaving(true);
    try {
      await changePassword(pwd.currentPassword, pwd.newPassword);
      setPwdSuccess(true);
      setPwd({ currentPassword: "", newPassword: "", confirm: "" });
      setTimeout(() => {
        setPwdOpen(false);
        setPwdSuccess(false);
      }, 1500);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors || {})?.[0]?.[0] ||
        "Failed to change password.";
      setPwdError(msg);
    } finally {
      setPwdSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600">
            Inbox • {loading ? "Loading..." : totalUnread > 0 ? `${totalUnread} unread` : "No unread"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setNewMsgOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            New Message
          </button>
          <button
            onClick={() => setPwdOpen(true)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
          >
            Change Password
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">
        {/* Thread list */}
        <div className="border-r">
          {loading ? (
            <p className="p-4 text-sm text-gray-400">Loading messages...</p>
          ) : threads.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No messages yet. Send one!</p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => openThread(thread.id)}
                className={[
                  "w-full text-left p-3 border-b hover:bg-gray-50 flex items-center gap-3",
                  currentId === thread.id ? "bg-blue-50" : "",
                ].join(" ")}
              >
                <img src={thread.avatar} alt={thread.name} className="w-10 h-10 rounded-full" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <h4 className="font-medium text-gray-900 truncate">{thread.subject}</h4>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{thread.timestamp}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-sm text-gray-600 truncate">{thread.lastMessage}</p>
                    {thread.unread > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shrink-0">
                        {thread.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Message thread */}
        <div className="flex flex-col min-h-[520px]">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">{current?.subject || "Select a conversation"}</h3>
            {current && <p className="text-xs text-gray-500">{current.name}</p>}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
            {!current ? (
              <div className="h-full flex items-center justify-center text-gray-500">No conversation selected</div>
            ) : current.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">No messages yet</div>
            ) : (
              current.messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                      m.sender === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800",
                    ].join(" ")}
                  >
                    <div>{m.text}</div>
                    <div className={`mt-1 text-[11px] ${m.sender === "user" ? "text-blue-100" : "text-gray-400"}`}>
                      {m.timestamp}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reply input */}
          <div className="p-4 border-t bg-white">
            {replyError && (
              <p className="mb-2 text-sm text-red-600">{replyError}</p>
            )}
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={current ? "Type your reply..." : "Select a conversation first"}
                disabled={!current || sending}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
              />
              <button
                onClick={sendReply}
                disabled={!current || sending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Message modal */}
      <Modal open={newMsgOpen} title="New Message" onClose={() => { setNewMsgOpen(false); setComposeError(""); }}>
        <form onSubmit={submitNewMessage} className="space-y-4">
          {composeError ? (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{composeError}</div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              value={compose.subject}
              onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="e.g. Question about amenities"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              rows={4}
              value={compose.content}
              onChange={(e) => setCompose((p) => ({ ...p, content: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="Write your message to Aplaya Beach Resort..."
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewMsgOpen(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={composeSending} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm">
              {composeSending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password modal */}
      <Modal open={pwdOpen} title="Change Password" onClose={() => { setPwdOpen(false); setPwdError(""); setPwdSuccess(false); }}>
        <form onSubmit={submitChangePassword} className="space-y-4">
          {pwdSuccess ? (
            <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700 font-medium">
              ✓ Password changed successfully!
            </div>
          ) : null}
          {pwdError ? (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{pwdError}</div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={pwd.currentPassword}
              onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={pwd.newPassword}
              onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pwd.confirm}
              onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPwdOpen(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={pwdSaving} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm">
              {pwdSaving ? "Saving..." : "Update Password"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
