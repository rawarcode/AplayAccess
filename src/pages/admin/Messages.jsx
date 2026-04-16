import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getAdminMessages, replyAdminMessage, markAdminMessageRead, getAutoReplies, createAutoReply, updateAutoReply, deleteAutoReply } from "../../lib/adminApi";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import useDebounce from "../../hooks/useDebounce.js";

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

const MATCH_TYPES = [
  { value: "contains",    label: "Contains",    desc: "Keyword appears anywhere" },
  { value: "exact",       label: "Exact",       desc: "Message is exactly the keyword" },
  { value: "starts_with", label: "Starts with", desc: "Message begins with keyword" },
];

const BLANK_RULE = { keyword: "", response: "", match_type: "contains", is_active: true, priority: 0 };

// ─── Thread Skeleton ──────────────────────────────────────────────────────────
function ThreadSkeleton() {
  return Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="px-4 py-3.5 border-b border-slate-100 flex items-start gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0"></div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3.5 bg-slate-200 rounded w-24"></div>
          <div className="h-3 bg-slate-200 rounded w-10"></div>
        </div>
        <div className="h-3 bg-slate-200 rounded w-3/4"></div>
        <div className="h-2.5 bg-slate-200 rounded w-1/2"></div>
      </div>
    </div>
  ));
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

// ─── Auto-Reply Rules Panel ───────────────────────────────────────────────────
function AutoReplyPanel({ open, onClose, showToast }) {
  const [rules, setRules]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null);   // null = list view, object = edit/create
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const undoRef = useRef(null);

  const loadRules = useCallback(() => {
    setLoading(true);
    getAutoReplies()
      .then(r => setRules(r.data.data ?? r.data))
      .catch(() => showToast("Failed to load auto-reply rules.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { if (open) loadRules(); }, [open, loadRules]);
  useEffect(() => () => { if (undoRef.current) clearTimeout(undoRef.current.timer); }, []);

  async function saveRule(e) {
    e.preventDefault();
    if (!editing.keyword?.trim() || !editing.response?.trim()) {
      showToast("Keyword and response are required.", "error");
      return;
    }
    setSaving(true);
    const payload = {
      keyword:    editing.keyword.trim(),
      response:   editing.response.trim(),
      match_type: editing.match_type || "contains",
      is_active:  Boolean(editing.is_active),
      priority:   Number(editing.priority) || 0,
    };
    try {
      if (editing.id) {
        await updateAutoReply(editing.id, payload);
        showToast("Rule updated.", "success");
      } else {
        await createAutoReply(payload);
        showToast("Rule created.", "success");
      }
      setEditing(null);
      loadRules();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save rule.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(rule) {
    if (undoRef.current) { clearTimeout(undoRef.current.timer); undoRef.current = null; }

    setRules(prev => prev.filter(r => r.id !== rule.id));
    setDeleteTarget(null);

    const timer = setTimeout(async () => {
      try { await deleteAutoReply(rule.id); }
      catch { setRules(prev => [...prev, rule]); showToast("Failed to delete rule.", "error"); }
      undoRef.current = null;
    }, 6000);

    undoRef.current = { timer, rule };
    showToast(`"${rule.keyword}" deleted.`, "success", {
      label: "Undo",
      onClick: () => { clearTimeout(timer); undoRef.current = null; setRules(prev => [...prev, rule]); },
    });
  }

  async function toggleActive(rule) {
    try {
      await updateAutoReply(rule.id, { is_active: !rule.is_active });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
      showToast(`"${rule.keyword}" ${rule.is_active ? "disabled" : "enabled"}.`, "success");
    } catch {
      showToast("Failed to update rule.", "error");
    }
  }

  // ── Edit/Create form ──
  if (editing) {
    return (
      <Modal open={open} onClose={() => setEditing(null)} maxWidth="max-w-lg">
        <form onSubmit={saveRule}>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <i className="fas fa-robot text-violet-600 text-lg"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editing.id ? "Edit Rule" : "New Auto-Reply Rule"}</h2>
                <p className="text-xs text-slate-400">{editing.id ? "Update keyword trigger and response" : "Define a keyword and automated response"}</p>
              </div>
            </div>
            <button type="button" onClick={() => setEditing(null)}
              className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Keyword */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-sky-100 flex items-center justify-center">
                    <i className="fas fa-key text-sky-500 text-[10px]"></i>
                  </span>Trigger
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Keyword <span className="text-red-400">*</span></label>
                  <input required placeholder="e.g. price, check-in, wifi" value={editing.keyword}
                    onChange={e => setEditing(prev => ({ ...prev, keyword: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 text-sm placeholder:text-slate-300 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Match Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {MATCH_TYPES.map(mt => {
                      const isActive = editing.match_type === mt.value;
                      return (
                        <button key={mt.value} type="button" onClick={() => setEditing(prev => ({ ...prev, match_type: mt.value }))}
                          className={`flex flex-col items-center gap-1 p-3 border rounded-lg transition-all ${
                            isActive ? "bg-violet-50 border-violet-300 ring-1 ring-violet-200" : "bg-white border-slate-200 hover:border-slate-300"
                          }`}>
                          <span className={`text-xs font-semibold ${isActive ? "text-violet-700" : "text-slate-700"}`}>{mt.label}</span>
                          <span className="text-[10px] text-slate-400">{mt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Priority</label>
                  <input type="number" min={0} max={100} value={editing.priority}
                    onChange={e => setEditing(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-24 px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm transition" />
                  <p className="text-[10px] text-slate-400 mt-1">Higher priority rules are checked first.</p>
                </div>
              </div>
            </div>

            {/* Response */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center">
                    <i className="fas fa-reply text-emerald-500 text-[10px]"></i>
                  </span>Auto-Reply Message
                </h3>
              </div>
              <div className="p-4">
                <textarea required rows={4} placeholder="The automated response sent to the guest..."
                  value={editing.response}
                  onChange={e => setEditing(prev => ({ ...prev, response: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 text-sm placeholder:text-slate-300 transition resize-none" />
                <p className={`text-[10px] mt-1 ${editing.response.length > 1800 ? "text-rose-500" : "text-slate-400"}`}>
                  {editing.response.length}/2000
                </p>
              </div>
            </div>

            {/* Active toggle */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="p-4">
                <div onClick={() => setEditing(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className="flex items-center justify-between cursor-pointer select-none p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${editing.is_active ? "bg-emerald-100" : "bg-slate-100"}`}>
                      <i className={`fas ${editing.is_active ? "fa-check-circle text-emerald-500" : "fa-pause-circle text-slate-400"}`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{editing.is_active ? "Active" : "Inactive"}</p>
                      <p className="text-xs text-slate-400">{editing.is_active ? "This rule will trigger on matching messages" : "This rule is disabled"}</p>
                    </div>
                  </div>
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${editing.is_active ? "bg-emerald-500" : "bg-slate-300"}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editing.is_active ? "left-6" : "left-1"}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(null)}
              className="px-5 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium transition">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 shadow-sm transition">
              {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : <><i className="fas fa-check mr-2"></i>{editing.id ? "Save Changes" : "Create Rule"}</>}
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // ── Rules list view ──
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <i className="fas fa-robot text-violet-600 text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Auto-Reply Rules</h2>
              <p className="text-xs text-slate-400">Keyword-triggered automated responses for guest messages</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing({ ...BLANK_RULE })}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition">
              <i className="fas fa-plus text-xs"></i>New Rule
            </button>
            <button onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-slate-400">
              <i className="fas fa-spinner fa-spin mr-2"></i>Loading rules…
            </div>
          ) : rules.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-violet-100 mb-4">
                <i className="fas fa-robot text-violet-400 text-2xl"></i>
              </div>
              <p className="text-slate-600 font-semibold">No auto-reply rules yet</p>
              <p className="text-sm text-slate-400 mt-1 mb-5">Create rules to automatically respond to common guest questions.</p>
              <button onClick={() => setEditing({ ...BLANK_RULE })}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-sm transition">
                <i className="fas fa-plus text-xs"></i>Create First Rule
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rules.map(rule => (
                <div key={rule.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">
                          <i className="fas fa-key text-[9px]"></i>{rule.keyword}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          rule.match_type === "exact" ? "bg-sky-100 text-sky-700" :
                          rule.match_type === "starts_with" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {rule.match_type === "contains" ? "Contains" : rule.match_type === "exact" ? "Exact" : "Starts with"}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          rule.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${rule.is_active ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                          {rule.is_active ? "Active" : "Inactive"}
                        </span>
                        {rule.priority > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium">P{rule.priority}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{rule.response}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditing({ ...rule })} title="Edit"
                        className="h-8 w-8 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-800 transition">
                        <i className="fas fa-pen text-xs"></i>
                      </button>
                      <button onClick={() => toggleActive(rule)} title={rule.is_active ? "Disable" : "Enable"}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition ${
                          rule.is_active ? "hover:bg-amber-50 text-amber-500 hover:text-amber-700" : "hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700"
                        }`}>
                        <i className={`fas ${rule.is_active ? "fa-toggle-off" : "fa-toggle-on"} text-xs`}></i>
                      </button>
                      <button onClick={() => setDeleteTarget(rule)} title="Delete"
                        className="h-8 w-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-400 hover:text-rose-600 transition">
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {rules.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <i className="fas fa-info-circle"></i>
              Rules are checked by priority (highest first). First matching rule triggers the auto-reply.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Rule"
        message={<>Delete auto-reply rule for <strong>"{deleteTarget?.keyword}"</strong>? You can undo within 6 seconds.</>}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminMessages() {
  const [toast, showToast, clearToast, toastType, toastAction] = useToast(6000);

  const [threads,     setThreads]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(false);
  const [activeId,    setActiveId]    = useState(null);
  const [reply,       setReply]       = useState("");
  const [sending,     setSending]     = useState(false);
  const [searchTerm,  setSearchTerm]  = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterRead,  setFilterRead]  = useState("all");
  const [scrollTick,  setScrollTick]  = useState(0);
  const [rulesOpen,   setRulesOpen]   = useState(false);
  const bottomRef = useRef(null);
  const searchRef = useRef(null);

  // ── load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getAdminMessages()
      .then(r => {
        const data = r.data.data;
        setThreads(data);
        if (data.length > 0 && !activeId) setActiveId(data[0].id);
      })
      .catch(() => { setLoadError(true); showToast("Failed to load messages.", "error"); })
      .finally(() => setLoading(false));
  }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Poll every 10s
  useEffect(() => {
    const id = setInterval(() => {
      getAdminMessages()
        .then(r => setThreads(r.data.data))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, scrollTick]);

  // ── derived ───────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = threads;
    if (filterRead === "unread")  list = list.filter(t => !t.is_read);
    if (filterRead === "replied") list = list.filter(t => t.replies?.some(r => r.sender_type === "resort"));
    if (filterRead === "pending") list = list.filter(t => !t.replies?.some(r => r.sender_type === "resort"));
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.sender.toLowerCase().includes(q) ||
        t.sender_email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [threads, filterRead, debouncedSearch]);

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
      showToast("Failed to send reply. Please try again.", "error");
    } finally {
      setSending(false);
    }
  }

  const allMessages = active
    ? [{ id: active.id, body: active.body, sender_type: "guest",  created_at: active.created_at, sender: active.sender },
       ...(active.replies ?? [])]
    : [];

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* Auto-Reply Rules Panel */}
      <AutoReplyPanel open={rulesOpen} onClose={() => setRulesOpen(false)} showToast={showToast} />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <i className="fas fa-envelope text-sky-600"></i>
            </span>
            Messages
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Read and respond to guest inquiries.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-Reply Rules button */}
          <button onClick={() => setRulesOpen(true)}
            className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-100 transition">
            <i className="fas fa-robot text-xs"></i>
            Auto-Replies
          </button>
          {/* Unread badge */}
          {stats.unread > 0 && !loading && (
            <button onClick={() => setFilterRead("unread")}
              className="inline-flex items-center gap-2 bg-sky-50 border border-sky-200 text-sky-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-100 transition">
              <span className="h-6 w-6 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">{stats.unread}</span>
              Unread
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total",        value: stats.total,   icon: "fa-envelope",      bg: "bg-sky-100",    text: "text-sky-600"    },
          { label: "Unread",       value: stats.unread,  icon: "fa-envelope-open", bg: "bg-amber-100",  text: "text-amber-600"  },
          { label: "Needs Reply",  value: stats.pending, icon: "fa-reply",         bg: "bg-rose-100",   text: "text-rose-600"   },
        ].map(c => (
          <div key={c.label} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <span className={`h-9 w-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                <i className={`fas ${c.icon} ${c.text}`}></i>
              </span>
              <div>
                <p className="text-xs text-slate-500 font-medium">{c.label}</p>
                <p className="text-xl font-bold text-slate-900 leading-none">{loading ? "—" : c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex min-h-0"
           style={{ minHeight: "520px" }}>

        {/* Thread list */}
        <div className="w-80 shrink-0 flex flex-col border-r border-slate-200">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search guests or subjects…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50 placeholder:text-slate-400 transition"
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                  <i className="fas fa-times-circle text-xs"></i>
                </button>
              )}
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
                  className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition ${
                    filterRead === f.key
                      ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <ThreadSkeleton />
            ) : loadError && threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4 gap-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-100 flex items-center justify-center">
                  <i className="fas fa-exclamation-triangle text-rose-400"></i>
                </div>
                <p className="text-sm text-slate-600 font-medium">Failed to load</p>
                <button onClick={load}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1.5">
                  <i className="fas fa-redo text-[10px]"></i>Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4 gap-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <i className="fas fa-inbox text-slate-300 text-lg"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">
                    {debouncedSearch ? "No matches" : filterRead !== "all" ? `No ${filterRead} messages` : "No messages yet"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {debouncedSearch ? "Try a different search term." : "Messages from guests will appear here."}
                  </p>
                </div>
                {(debouncedSearch || filterRead !== "all") && (
                  <button onClick={() => { setSearchTerm(""); setFilterRead("all"); }}
                    className="text-xs text-sky-600 hover:text-sky-700 font-medium">
                    <i className="fas fa-times mr-1"></i>Clear filters
                  </button>
                )}
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

        {/* Conversation panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
              <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center">
                <i className="fas fa-comments text-slate-300 text-3xl"></i>
              </div>
              <div>
                <p className="text-slate-600 font-semibold">No conversation selected</p>
                <p className="text-sm text-slate-400 mt-1">Choose a thread from the left to view the conversation.</p>
              </div>
            </div>
          ) : (
            <>
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
