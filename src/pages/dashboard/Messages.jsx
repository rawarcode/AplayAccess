// src/pages/dashboard/Messages.jsx
import { useMemo, useState } from "react";
import useLockBodyScroll from "../../hooks/useLockBodyScroll.js";
import { sampleConversations } from "../../data/dashboard.js";

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
  const [conversations, setConversations] = useState(sampleConversations);
  const totalUnread = useMemo(() => conversations.reduce((t, c) => t + (c.unread || 0), 0), [conversations]);

  const [currentId, setCurrentId] = useState(conversations[0]?.id ?? null);

  const current = useMemo(
    () => conversations.find((c) => c.id === currentId) || null,
    [conversations, currentId]
  );

  const [reply, setReply] = useState("");
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  const [compose, setCompose] = useState({ recipient: "", subject: "", content: "" });
  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  function openConversation(id) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
    setCurrentId(id);
  }

  function sendReply() {
    const text = reply.trim();
    if (!text || !current) return;

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== current.id) return c;
        const msg = {
          id: Date.now(),
          sender: "user",
          text,
          timestamp: new Date().toLocaleString(),
        };
        return {
          ...c,
          messages: [...c.messages, msg],
          lastMessage: text,
          timestamp: "Just now",
        };
      })
    );
    setReply("");
  }

  function submitNewMessage(e) {
    e.preventDefault();
    if (!compose.recipient || !compose.subject || !compose.content) return;

    // For now: just close and show a simple confirm
    alert(`Your message "${compose.subject}" has been sent to ${compose.recipient}!`);
    setNewMsgOpen(false);
    setCompose({ recipient: "", subject: "", content: "" });
  }

  function submitChangePassword(e) {
    e.preventDefault();
    if (pwd.newPassword !== pwd.confirm) {
      alert("New passwords do not match!");
      return;
    }
    if ((pwd.newPassword || "").length < 8) {
      alert("Password must be at least 8 characters long!");
      return;
    }
    alert("Password changed successfully! (demo)");
    setPwdOpen(false);
    setPwd({ currentPassword: "", newPassword: "", confirm: "" });
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600">
            Inbox • {totalUnread > 0 ? `${totalUnread} unread` : "No unread"}
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
        {/* Conversations list */}
        <div className="border-r">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => openConversation(conv.id)}
              className={[
                "w-full text-left p-3 border-b hover:bg-gray-50 flex items-center gap-3",
                currentId === conv.id ? "bg-blue-50" : "",
              ].join(" ")}
            >
              <img src={conv.avatar} alt={conv.name} className="w-10 h-10 rounded-full" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <h4 className="font-medium text-gray-900 truncate">{conv.name}</h4>
                  <span className="text-xs text-gray-500">{conv.timestamp}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                  {conv.unread > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Message thread */}
        <div className="flex flex-col min-h-[520px]">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">{current?.name || "Select a conversation"}</h3>
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

          {/* Reply */}
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
              />
              <button
                onClick={sendReply}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal open={newMsgOpen} title="New Message" onClose={() => setNewMsgOpen(false)}>
        <form onSubmit={submitNewMessage} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
            <input
              value={compose.recipient}
              onChange={(e) => setCompose((p) => ({ ...p, recipient: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="e.g. Aplaya Support"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              value={compose.subject}
              onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="Subject"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              rows={4}
              value={compose.content}
              onChange={(e) => setCompose((p) => ({ ...p, content: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="Write your message..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewMsgOpen(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium">
              Send
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={pwdOpen} title="Change Password" onClose={() => setPwdOpen(false)}>
        <form onSubmit={submitChangePassword} className="space-y-4">
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
            <button type="button" onClick={() => setPwdOpen(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium">
              Update Password
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}