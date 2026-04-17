import { useEffect, useState } from "react";
import { getNewsletterSubscribers, sendNewsletterCampaign } from "../../lib/adminApi";

const TEMPLATES = [
  {
    icon: "fa-tag",
    color: "bg-rose-50 text-rose-600",
    label: "Promo / Discount",
    subject: "🎉 Exclusive Promo — Special Rates Just for You!",
    body: `Hi there!

We have an exciting promo exclusively for our newsletter subscribers!

Enjoy up to [X]% off on selected rooms when you book from [start date] to [end date]. This is our way of saying thank you for being part of the Aplaya Beach Resort family.

Use promo code: [PROMO CODE] at checkout.

Don't miss out — slots are limited!

We look forward to welcoming you soon.

Warm regards,
Aplaya Beach Resort Team`,
  },
  {
    icon: "fa-sun",
    color: "bg-amber-50 text-amber-600",
    label: "Summer Special",
    subject: "☀️ Summer is Here — Make the Most of It at Aplaya!",
    body: `Hello,

Summer is in full swing, and there's no better place to enjoy it than Aplaya Beach Resort!

Whether you're looking for a relaxing day by the beach, a romantic overnight getaway, or a fun-filled family vacation, we have the perfect package for you.

🌊 Enjoy our beachfront rooms, swimming pool, and world-class amenities.
🍹 Sip cocktails as you watch the sunset.
🏄 Try our exciting water activities.

Book now and make this summer unforgettable!

See you at the beach,
Aplaya Beach Resort Team`,
  },
  {
    icon: "fa-star",
    color: "bg-purple-50 text-purple-600",
    label: "New Room / Suite",
    subject: "✨ Introducing Our Newest Room — [Room Name]!",
    body: `Dear Guest,

We are thrilled to announce the launch of our newest accommodation — the [Room Name]!

Designed with your comfort in mind, this stunning [room type] features:
• [Feature 1, e.g. panoramic ocean views]
• [Feature 2, e.g. private plunge pool]
• [Feature 3, e.g. king-sized bed with premium linens]

As one of our valued newsletter subscribers, you get early access to book before we open it to the public.

Reserve your stay today and be among the first to experience this paradise.

With excitement,
Aplaya Beach Resort Team`,
  },
  {
    icon: "fa-calendar-check",
    color: "bg-emerald-50 text-emerald-600",
    label: "Weekend Getaway",
    subject: "🏖️ The Perfect Weekend Escape Awaits You!",
    body: `Hi there!

Are you looking for the perfect weekend escape? Look no further!

Aplaya Beach Resort is offering a special weekend deal — arrive on [day] and leave feeling completely refreshed.

What's included:
✅ Overnight accommodation
✅ Complimentary breakfast for two
✅ Access to all resort amenities
✅ Free parking

Available every [Fri–Sun]. Book at least [X] days in advance to lock in this rate.

Life's short — take the weekend off!

See you soon,
Aplaya Beach Resort Team`,
  },
  {
    icon: "fa-champagne-glasses",
    color: "bg-blue-50 text-blue-600",
    label: "Special Event",
    subject: "🎊 You're Invited — [Event Name] at Aplaya Beach Resort!",
    body: `Dear Guest,

We are excited to invite you to [Event Name] happening at Aplaya Beach Resort!

📅 Date: [Date]
🕐 Time: [Time]
📍 Venue: Aplaya Beach Resort, [Location]

[Brief description of the event — e.g., An evening of live music, fine dining, and beachside entertainment under the stars.]

Limited slots available. Secure your spot now by replying to this email or booking through our website.

We hope to celebrate with you!

Warmly,
Aplaya Beach Resort Team`,
  },
  {
    icon: "fa-heart",
    color: "bg-pink-50 text-pink-600",
    label: "Thank You",
    subject: "💙 Thank You for Choosing Aplaya Beach Resort!",
    body: `Dear Valued Guest,

Thank you for being part of the Aplaya Beach Resort family!

Your support means the world to us, and we are committed to making every visit an unforgettable experience.

As a token of our appreciation, we would like to offer you a special loyalty discount of [X]% on your next booking. Simply mention this email when you reserve.

We can't wait to welcome you back to paradise.

With gratitude,
Aplaya Beach Resort Team`,
  },
];

const STORAGE_KEY = "aplaya_newsletter_templates_v1";

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return TEMPLATES;
    const saved = JSON.parse(raw);
    // Merge: saved overrides defaults by index, preserving icon/color from defaults
    return TEMPLATES.map((def, i) => saved[i] ? { ...def, ...saved[i] } : def);
  } catch {
    return TEMPLATES;
  }
}

function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function OwnerNewsletter() {
  const [subscribers, setSubscribers] = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject,     setSubject]     = useState("");
  const [body,        setBody]        = useState("");
  const [tab,         setTab]         = useState("compose"); // "compose" | "templates" | "preview"
  const [sending,     setSending]     = useState(false);
  const [result,      setResult]      = useState(null); // { sent, failed, message }
  const [error,       setError]       = useState("");

  // Template editing
  const [templates,   setTemplates]   = useState(loadTemplates);
  const [editingIdx,  setEditingIdx]  = useState(null); // index of template being edited
  const [editForm,    setEditForm]    = useState(null); // { label, subject, body }

  useEffect(() => {
    setLoading(true);
    getNewsletterSubscribers()
      .then(r => {
        setSubscribers(r.data.data || []);
        setTotal(r.data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = subscribers.filter(s =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  function openCompose() {
    setSubject("");
    setBody("");
    setTab("compose");
    setResult(null);
    setError("");
    setComposeOpen(true);
  }

  function applyTemplate(tpl) {
    setSubject(tpl.subject);
    setBody(tpl.body);
    setTab("compose");
  }

  function startEdit(i, e) {
    e.stopPropagation();
    setEditingIdx(i);
    setEditForm({ label: templates[i].label, subject: templates[i].subject, body: templates[i].body });
  }

  function cancelEdit() {
    setEditingIdx(null);
    setEditForm(null);
  }

  function saveEdit(i) {
    const updated = templates.map((t, idx) => idx === i ? { ...t, ...editForm } : t);
    setTemplates(updated);
    saveTemplates(updated);
    setEditingIdx(null);
    setEditForm(null);
  }

  function resetTemplate(i, e) {
    e.stopPropagation();
    const updated = templates.map((t, idx) => idx === i ? { ...TEMPLATES[idx] } : t);
    setTemplates(updated);
    saveTemplates(updated);
    if (editingIdx === i) cancelEdit();
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message body are required.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await sendNewsletterCampaign(subject.trim(), body.trim());
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to send campaign.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Newsletter</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage subscribers and send promotional email campaigns.
          </p>
        </div>
        <button
          onClick={openCompose}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
        >
          <i className="fas fa-paper-plane text-xs"></i> Send Campaign
        </button>
      </div>

      {/* Stat card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-brand">
            <i className="fas fa-envelope text-lg"></i>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{total}</p>
            <p className="text-xs text-slate-400">Total Subscribers</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <i className="fas fa-circle-check text-lg"></i>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{total}</p>
            <p className="text-xs text-slate-400">Active</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <i className="fas fa-bullhorn text-lg"></i>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">—</p>
            <p className="text-xs text-slate-400">Campaigns Sent</p>
          </div>
        </div>
      </div>

      {/* Subscriber list */}
      <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <i className="fas fa-users text-sm text-brand"></i>
            <h3 className="font-semibold text-slate-800 text-sm">Subscribers</h3>
          </div>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Search email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">#</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-left">Subscribed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                  <i className="fas fa-spinner fa-spin mr-2"></i>Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                  {search ? "No subscribers match your search." : "No subscribers yet."}
                </td></tr>
              ) : filtered.map((s, i) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-6 py-3 font-medium text-slate-800">{s.email}</td>
                  <td className="px-6 py-3 text-slate-400 text-xs">{formatDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compose Modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Compose email">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-brand">
                  <i className="fas fa-paper-plane text-sm"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Send Email Campaign</h3>
                  <p className="text-xs text-slate-400">Sending to {total} subscriber{total !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={() => setComposeOpen(false)} className="text-slate-400 hover:text-slate-600 w-11 h-11 flex items-center justify-center rounded-lg hover:bg-slate-100" aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Result banner */}
            {result && (
              <div className="mx-6 mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <i className="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Campaign Sent!</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {result.sent} email{result.sent !== 1 ? 's' : ''} delivered
                    {result.failed > 0 ? `, ${result.failed} failed` : ''}.
                  </p>
                </div>
              </div>
            )}

            {/* Tabs: Compose | Templates | Preview */}
            {!result && (
              <div className="flex border-b border-slate-100 flex-shrink-0">
                {[
                  { key: "compose",   icon: "fa-pen",           label: "Compose"   },
                  { key: "templates", icon: "fa-layer-group",   label: "Templates" },
                  { key: "preview",   icon: "fa-eye",           label: "Preview"   },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <i className={`fas ${t.icon} mr-2`}></i>{t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* ── Compose tab ── */}
              {!result && tab === "compose" && (
                <div className="p-6 space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                      <i className="fas fa-exclamation-circle"></i> {error}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject Line</label>
                    <input
                      type="text"
                      placeholder="e.g. Exclusive Summer Promo — 20% Off All Rooms!"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Message Body</label>
                    <textarea
                      rows={10}
                      placeholder={"Hi there,\n\nWe have an exciting promo just for our newsletter subscribers!\n\n..."}
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none font-mono"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Plain text. A "Book Now" button and unsubscribe notice are added automatically.
                      {" "}<button type="button" onClick={() => setTab("templates")} className="text-brand underline hover:no-underline">Use a template</button>
                    </p>
                  </div>
                </div>
              )}

              {/* ── Templates tab ── */}
              {!result && tab === "templates" && (
                <div className="p-6 space-y-3">
                  <p className="text-xs text-slate-400 mb-4">
                    Click a template to use it, or click <strong>Edit</strong> to customise it permanently.
                  </p>
                  <div className="space-y-3">
                    {templates.map((tpl, i) => (
                      <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">

                        {/* ── View mode ── */}
                        {editingIdx !== i && (
                          <div className="p-4 flex items-start gap-4">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tpl.color}`}>
                              <i className={`fas ${tpl.icon} text-sm`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm">{tpl.label}</p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{tpl.subject}</p>
                              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{tpl.body}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => applyTemplate(tpl)}
                                className="text-xs bg-brand hover:bg-brand-dark text-white px-3 py-1.5 rounded-lg font-medium"
                              >
                                Use
                              </button>
                              <button
                                type="button"
                                onClick={(e) => startEdit(i, e)}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium"
                              >
                                <i className="fas fa-pen text-xs mr-1"></i>Edit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => resetTemplate(i, e)}
                                title="Reset to default"
                                className="text-xs text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100"
                              >
                                <i className="fas fa-rotate-left text-xs"></i>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ── Edit mode ── */}
                        {editingIdx === i && editForm && (
                          <div className="p-4 bg-blue-50/50 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tpl.color}`}>
                                <i className={`fas ${tpl.icon} text-xs`}></i>
                              </div>
                              <p className="text-sm font-semibold text-slate-700">Editing Template</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Template Name</label>
                              <input
                                type="text"
                                value={editForm.label}
                                onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Subject Line</label>
                              <input
                                type="text"
                                value={editForm.subject}
                                onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Message Body</label>
                              <textarea
                                rows={8}
                                value={editForm.body}
                                onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none font-mono bg-white"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEdit(i)}
                                className="px-3 py-1.5 text-sm bg-brand hover:bg-brand-dark text-white rounded-lg font-medium flex items-center gap-1.5"
                              >
                                <i className="fas fa-check text-xs"></i> Save Template
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Preview tab ── */}
              {!result && tab === "preview" && (
                <div className="p-6">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Mock email header */}
                    <div className="bg-brand px-6 py-5 text-center">
                      <p className="text-white font-bold text-lg">🏖️ Aplaya Beach Resort</p>
                      <p className="text-white/70 text-xs mt-1">Your Paradise Getaway</p>
                    </div>
                    <div className="p-6 bg-white">
                      <p className="font-bold text-brand text-lg mb-4 leading-snug">
                        {subject || <span className="text-slate-300 italic">Subject line will appear here</span>}
                      </p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {body || <span className="text-slate-300 italic">Message body will appear here</span>}
                      </p>
                      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <span className="inline-block bg-brand text-white text-sm font-semibold px-6 py-3 rounded-lg">
                          Explore Our Rooms &amp; Book Now
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 text-center">
                      <p className="text-xs text-slate-400">You're receiving this because you subscribed to the Aplaya Beach Resort newsletter.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center flex-shrink-0">
              <button
                onClick={() => setComposeOpen(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              >
                {result ? 'Close' : 'Cancel'}
              </button>
              {!result && (
                <button
                  onClick={handleSend}
                  disabled={sending || !subject.trim() || !body.trim()}
                  className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
                >
                  {sending
                    ? <><i className="fas fa-spinner fa-spin text-xs"></i> Sending…</>
                    : <><i className="fas fa-paper-plane text-xs"></i> Send to {total} Subscriber{total !== 1 ? 's' : ''}</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
