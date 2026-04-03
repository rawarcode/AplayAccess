import { useState, useEffect, useRef } from "react";
import { getAdminGallery, createAdminGallery, batchFeaturedGallery, deleteAdminGallery, getAdminContacts, updateAdminContent, getAdminReviews, updateAdminReview, deleteAdminReview } from "../../lib/adminApi";
import { api } from "../../lib/api";

// ─── Persistence key ──────────────────────────────────────────────────────────
const CONTENT_KEY = "aplaya_page_content_v1";

// ─── Default content (mirrors the actual hardcoded values in Home.jsx / Resort.jsx) ─
const DEFAULT_CONTENT = {
  // ── Home page (/home) ──────────────────────────────────────────────────────
  home_hero: {
    background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80",
    title:      "Welcome to Paradise",
    subtitle:   "Choose your perfect getaway from our collection of stunning beach resorts.",
  },
  home_resorts: {
    sectionTitle:    "Our Beach Resorts",
    sectionSubtitle: "Select the resort that matches your dream vacation.",
    cards: [
      {
        name:  "Aplaya Beach Resort Cavite",
        desc:  "Experience luxury and breathtaking ocean views at our flagship resort.",
        image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=2070&q=80",
        badge: "Popular",
      },
      {
        name:  "Aplaya Beach Resort Cebu",
        desc:  "Relax in our serene bay-side location with world-class amenities.",
        image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80",
        badge: "",
      },
      {
        name:  "Aplaya Beach Resort Bohol",
        desc:  "Dive into adventure with our exclusive coral reef access and diving center.",
        image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2000&q=80",
        badge: "",
      },
    ],
  },
  // ── Resort page (/resort) ──────────────────────────────────────────────────
  resort_hero: {
    background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80",
    title:      "Welcome to Paradise",
    subtitle:   "Aplaya Beach Resort offers the perfect blend of luxury, comfort, and breathtaking ocean views.",
    ctaText:    "Book Your Stay",
  },
  resort_about: {
    title:      "Discover Aplaya Beach Resort",
    paragraph1: "Nestled along the pristine coastline, Aplaya Beach Resort is a tropical paradise offering luxurious accommodations, world-class amenities, and unforgettable experiences.",
    paragraph2: "Our resort combines modern comfort with traditional charm, creating the perfect setting for your dream vacation.",
    image:      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80",
    rating:     "4.9",
  },
  resort_rooms: {
    sectionTitle:    "Our Accommodations",
    sectionSubtitle: "Choose from our selection of luxurious rooms and suites, each designed to provide the ultimate comfort and relaxation.",
  },
  resort_contact: {
    address: "123 Beachfront Avenue, Coastal City, Paradise Island",
    phone:   "+1 (555) 123-4567",
    email:   "reservations@aplayabeachresort.com",
  },
  resort_reviews: {
    visible:         true,
    sectionTitle:    "What Our Guests Say",
    sectionSubtitle: "Don't just take our word for it — hear from our satisfied guests.",
  },
  resort_newsletter: {
    visible:  true,
    title:    "Subscribe to Our Newsletter",
    subtitle: "Stay updated with our latest offers, news, and events. Join our mailing list today!",
  },
};

function loadContent() {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (!raw) return DEFAULT_CONTENT;
    return { ...DEFAULT_CONTENT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONTENT;
  }
}

function saveContent(content) {
  localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function ImagePreview({ url }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt="preview"
      className="mt-2 w-full h-32 object-cover rounded-lg border border-gray-200"
      onError={e => { e.target.style.display = "none"; }}
    />
  );
}

function Field({ label, value, onChange, type = "text", rows }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      )}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function SectionCard({ icon, title, badge, children, onEdit, editing, onSave, onCancel, visible, onToggleVisible }) {
  const hideable = visible !== undefined;

  return (
    <div className={`bg-white rounded-lg shadow border ${editing ? "border-[#1e3a8a]" : visible === false ? "border-gray-200 opacity-60" : "border-gray-200"} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${visible === false ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-[#1e3a8a]"}`}>
            <i className={`fas ${icon} text-sm`}></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-800 text-sm">{title}</p>
              {hideable && visible === false && (
                <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Hidden</span>
              )}
            </div>
            {badge && <span className="text-xs text-gray-400">{badge}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hideable && !editing && (
            <button
              onClick={onToggleVisible}
              title={visible ? "Hide section" : "Show section"}
              className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                visible
                  ? "bg-gray-100 hover:bg-yellow-50 hover:text-yellow-600 text-gray-500"
                  : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
              }`}
            >
              <i className={`fas ${visible ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
              {visible ? "Hide" : "Show"}
            </button>
          )}
          {!editing && (
            <button
              onClick={onEdit}
              className="text-xs bg-gray-100 hover:bg-[#1e3a8a] hover:text-white text-gray-600 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <i className="fas fa-pen text-xs"></i> Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {children}
        {editing && (
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
            <button onClick={onCancel}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={onSave}
              className="px-4 py-2 text-sm bg-[#1e3a8a] hover:bg-[#152c6e] text-white rounded-lg flex items-center gap-2">
              <i className="fas fa-check text-xs"></i> Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Individual section editors ───────────────────────────────────────────────

function HomeHeroEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-image" title="Hero Section" badge="Home page · /" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="relative rounded-lg overflow-hidden h-28 bg-gray-100">
          <img src={content.background} alt="hero bg"
            className="w-full h-full object-cover"
            onError={e => { e.target.style.display = "none"; }} />
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4">
            <p className="font-bold text-sm leading-tight">{content.title}</p>
            <p className="text-xs text-white/80 mt-1 line-clamp-1">{content.subtitle}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Background Image URL" value={form.background} onChange={f("background")} />
          <ImagePreview url={form.background} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" value={form.title} onChange={f("title")} />
            <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function HomeResortsEditor({ content, onSave }) {
  const [editing,      setEditing]      = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [form, setForm] = useState(content);

  const cancel = () => { setForm(content); setEditing(false); setExpandedCard(null); };
  const save   = () => { onSave(form); setEditing(false); setExpandedCard(null); };
  const updateCard = (i, key, val) =>
    setForm(p => ({ ...p, cards: p.cards.map((c, ci) => ci === i ? { ...c, [key]: val } : c) }));

  return (
    <SectionCard icon="fa-th-large" title="Resort Cards" badge="Home page · /" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">{content.sectionTitle}</p>
          <p className="text-xs text-gray-400 mb-3">{content.sectionSubtitle}</p>
          <div className="grid grid-cols-3 gap-2">
            {content.cards.map((c, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-gray-100">
                <img src={c.image} alt={c.name}
                  className="w-full h-16 object-cover"
                  onError={e => { e.target.style.display = "none"; }} />
                <p className="text-xs text-gray-600 px-2 py-1 truncate">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Section Title" value={form.sectionTitle} onChange={v => setForm(p => ({ ...p, sectionTitle: v }))} />
            <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={v => setForm(p => ({ ...p, sectionSubtitle: v }))} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Resort Cards</p>
            <div className="space-y-2">
              {form.cards.map((card, i) => (
                <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <img src={card.image} alt={card.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={e => { e.target.style.display = "none"; }} />
                      <span className="text-sm font-medium text-gray-700">{card.name}</span>
                    </div>
                    <i className={`fas fa-chevron-${expandedCard === i ? "up" : "down"} text-xs text-gray-400`}></i>
                  </button>
                  {expandedCard === i && (
                    <div className="p-4 space-y-3">
                      <Field label="Resort Name" value={card.name} onChange={v => updateCard(i, "name", v)} />
                      <Field label="Description" value={card.desc} onChange={v => updateCard(i, "desc", v)} rows={2} />
                      <Field label="Badge Text (leave empty for none)" value={card.badge} onChange={v => updateCard(i, "badge", v)} />
                      <Field label="Card Image URL" value={card.image} onChange={v => updateCard(i, "image", v)} />
                      <ImagePreview url={card.image} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function ResortHeroEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-image" title="Hero Section" badge="Resort page · /resort" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="relative rounded-lg overflow-hidden h-28 bg-gray-100">
          <img src={content.background} alt="hero bg"
            className="w-full h-full object-cover"
            onError={e => { e.target.style.display = "none"; }} />
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4">
            <p className="font-bold text-sm leading-tight">{content.title}</p>
            <p className="text-xs text-white/80 mt-1 line-clamp-1">{content.subtitle}</p>
            <span className="mt-2 text-xs bg-blue-600 px-2 py-0.5 rounded">{content.ctaText}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Background Image URL" value={form.background} onChange={f("background")} />
          <ImagePreview url={form.background} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" value={form.title} onChange={f("title")} />
            <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
            <Field label="CTA Button Text" value={form.ctaText} onChange={f("ctaText")} />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function ResortAboutEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-info-circle" title="About Section" badge="Resort page · /resort" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="flex gap-3">
          <img src={content.image} alt="about"
            className="w-24 h-20 object-cover rounded-lg flex-shrink-0"
            onError={e => { e.target.style.display = "none"; }} />
          <div>
            <p className="font-semibold text-gray-800 text-sm">{content.title}</p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{content.paragraph1}</p>
            <span className="text-xs text-blue-600 mt-1 inline-block">★ {content.rating} Guest Rating</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Section Title" value={form.title} onChange={f("title")} />
            <Field label="Guest Rating" value={form.rating} onChange={f("rating")} />
            <Field label="Paragraph 1" value={form.paragraph1} onChange={f("paragraph1")} rows={3} />
            <Field label="Paragraph 2" value={form.paragraph2} onChange={f("paragraph2")} rows={3} />
          </div>
          <Field label="Section Image URL" value={form.image} onChange={f("image")} />
          <ImagePreview url={form.image} />
        </div>
      )}
    </SectionCard>
  );
}

function ResortRoomsSectionEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-bed" title="Rooms Section Header" badge="Resort page · /resort" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div>
          <p className="font-semibold text-gray-800 text-sm">{content.sectionTitle}</p>
          <p className="text-xs text-gray-500 mt-1">{content.sectionSubtitle}</p>
          <p className="text-xs text-gray-300 mt-2 italic">Individual rooms are managed in Manage Rooms</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Section Title" value={form.sectionTitle} onChange={f("sectionTitle")} />
          <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={f("sectionSubtitle")} rows={2} />
          <p className="text-xs text-gray-400 italic">
            <i className="fas fa-info-circle mr-1"></i>
            Individual rooms are managed in <strong>Manage Rooms</strong>.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function ResortContactEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-address-book" title="Contact Info" badge="Resort page · /resort" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="space-y-1.5 text-sm text-gray-600">
          <p><i className="fas fa-map-marker-alt w-4 text-[#1e3a8a] mr-1"></i>{content.address}</p>
          <p><i className="fas fa-phone w-4 text-[#1e3a8a] mr-1"></i>{content.phone}</p>
          <p><i className="fas fa-envelope w-4 text-[#1e3a8a] mr-1"></i>{content.email}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Address" value={form.address} onChange={f("address")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Phone" value={form.phone} onChange={f("phone")} />
            <Field label="Email" type="email" value={form.email} onChange={f("email")} />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function ResortReviewsEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };
  const toggleVisible = () => onSave({ ...content, visible: !content.visible });

  return (
    <SectionCard icon="fa-star" title="Reviews Section" badge="Resort page · /resort" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}
      visible={content.visible} onToggleVisible={toggleVisible}>
      {!editing ? (
        <div>
          <p className="font-semibold text-gray-800 text-sm">{content.sectionTitle}</p>
          <p className="text-xs text-gray-500 mt-1">{content.sectionSubtitle}</p>
          <p className="text-xs text-gray-300 mt-2 italic">Individual reviews come from guest submissions.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Section Title" value={form.sectionTitle} onChange={f("sectionTitle")} />
          <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={f("sectionSubtitle")} rows={2} />
          <p className="text-xs text-gray-400 italic">
            <i className="fas fa-info-circle mr-1"></i>
            Individual reviews come from guest submissions via the Reviews page.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function ResortNewsletterEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };
  const toggleVisible = () => onSave({ ...content, visible: !content.visible });

  return (
    <SectionCard icon="fa-envelope-open-text" title="Newsletter Section" badge="Resort page · /resort" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}
      visible={content.visible} onToggleVisible={toggleVisible}>
      {!editing ? (
        <div>
          <p className="font-semibold text-gray-800 text-sm">{content.title}</p>
          <p className="text-xs text-gray-500 mt-1">{content.subtitle}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Title" value={form.title} onChange={f("title")} />
          <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
        </div>
      )}
    </SectionCard>
  );
}

// ─── Gallery categories ───────────────────────────────────────────────────────

const CATEGORIES = ["beach", "rooms", "amenities", "dining", "events", "other"];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Gallery Tab ──────────────────────────────────────────────────────────────
function GalleryTab() {
  const [images,      setImages]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  // selectedIds: Set of image IDs the admin wants on /resort (working copy)
  const [selectedIds, setSelectedIds] = useState(new Set());
  // savedIds: what's actually saved in the DB (for dirty detection)
  const savedIdsRef                   = useRef(new Set());
  const [showForm,    setShowForm]    = useState(false);
  const [filterCat,   setFilterCat]   = useState("all");
  const [deleteId,    setDeleteId]    = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [addSaving,   setAddSaving]   = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiError,    setApiError]    = useState("");
  const [form, setForm] = useState({ image_url: "", caption: "", category: "beach", sort_order: "" });

  useEffect(() => {
    setLoading(true);
    getAdminGallery()
      .then(r => {
        const imgs = r.data.data || [];
        setImages(imgs);
        const ids = new Set(imgs.filter(i => i.is_featured).map(i => i.id));
        setSelectedIds(ids);
        savedIdsRef.current = new Set(ids);
      })
      .catch(() => setApiError("Failed to load gallery images."))
      .finally(() => setLoading(false));
  }, []);

  // Filter by category, then sort: saved-featured images first, rest by sort_order.
  // Uses savedIdsRef (not selectedIds) so the order only changes after clicking Save.
  const filtered = (filterCat === "all" ? images : images.filter(i => i.category === filterCat))
    .slice()
    .sort((a, b) => {
      const aSaved = savedIdsRef.current.has(a.id) ? 0 : 1;
      const bSaved = savedIdsRef.current.has(b.id) ? 0 : 1;
      if (aSaved !== bSaved) return aSaved - bSaved;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  // dirty = selectedIds differs from savedIds
  const isDirty = (() => {
    const saved = savedIdsRef.current;
    if (saved.size !== selectedIds.size) return true;
    for (const id of selectedIds) if (!saved.has(id)) return true;
    return false;
  })();

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSaveSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setApiError("");
    setSaveSuccess(false);
    try {
      const r = await batchFeaturedGallery([...selectedIds]);
      const imgs = r.data.data || [];
      setImages(imgs);
      const ids = new Set(imgs.filter(i => i.is_featured).map(i => i.id));
      setSelectedIds(ids);
      savedIdsRef.current = new Set(ids);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setApiError(err?.response?.data?.message || "Failed to save resort gallery.");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setSelectedIds(new Set(savedIdsRef.current));
    setSaveSuccess(false);
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    setApiError("");
    try {
      const payload = {
        resort_id:  1,
        image_url:  form.image_url,
        caption:    form.caption || null,
        category:   form.category,
        sort_order: parseInt(form.sort_order) || images.length + 1,
      };
      const r = await createAdminGallery(payload);
      setImages(prev => [...prev, r.data.data]);
      setForm({ image_url: "", caption: "", category: "beach", sort_order: "" });
      setShowForm(false);
    } catch (err) {
      setApiError(err?.response?.data?.message || "Failed to add image.");
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Resort gallery save bar — sticky so it follows the viewport while scrolling */}
      <div className={`sticky top-0 z-20 rounded-xl border px-5 py-4 flex flex-wrap items-center gap-3 transition-colors shadow-sm ${
        isDirty ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"
      }`}>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">Resort Gallery Selection</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Click images below to select or deselect them.
            {" "}<strong>{selectedIds.size}</strong> image{selectedIds.size !== 1 ? "s" : ""} selected for <strong>/resort</strong>.
            {isDirty && <span className="text-amber-600 ml-1">— unsaved changes</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <i className="fas fa-check-circle"></i> Saved!
            </span>
          )}
          {isDirty && (
            <button onClick={handleDiscard}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100">
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {saving
              ? <><i className="fas fa-spinner fa-spin text-xs"></i> Saving…</>
              : <><i className="fas fa-save text-xs"></i> Save to Resort</>}
          </button>
        </div>
      </div>

      {apiError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <i className="fas fa-exclamation-circle mr-2"></i>{apiError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Filter:</span>
          {["all", ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterCat === cat ? "bg-[#1e3a8a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-4 py-2 rounded-lg text-sm">
          <i className="fas fa-plus"></i> Add Image
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Add New Gallery Image</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL <span className="text-red-500">*</span></label>
              <input type="url" required placeholder="https://example.com/image.jpg" value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
              <ImagePreview url={form.image_url} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" placeholder="Short description" value={form.caption}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); setApiError(""); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={addSaving}
                className="px-4 py-2 text-sm bg-[#1e3a8a] hover:bg-[#152c6e] disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-2">
                {addSaving ? <><i className="fas fa-spinner fa-spin text-xs"></i> Adding…</> : "Add Image"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <i className="fas fa-spinner fa-spin text-2xl mb-3"></i><p>Loading gallery…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <i className="fas fa-images text-4xl mb-3"></i><p>No images in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(img => {
            const isSelected = selectedIds.has(img.id);
            return (
              <div
                key={img.id}
                onClick={() => toggleSelect(img.id)}
                className={`bg-white rounded-lg shadow overflow-hidden cursor-pointer relative transition-all ${
                  isSelected
                    ? "ring-3 ring-[#1e3a8a] ring-offset-2"
                    : "opacity-70 hover:opacity-90 hover:shadow-md"
                }`}
              >
                <div className="relative h-48 bg-gray-100">
                  <img src={img.image_url} alt={img.caption || "Gallery"} className="w-full h-full object-cover"
                    onError={e => { e.target.src = "https://placehold.co/400x300?text=No+Image"; }} />

                  {/* Checkmark overlay */}
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? "bg-[#1e3a8a] border-[#1e3a8a]"
                      : "bg-white/70 border-white"
                  }`}>
                    {isSelected && <i className="fas fa-check text-white text-xs"></i>}
                  </div>

                  {/* Delete button — stop propagation so clicking it doesn't toggle selection */}
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteId(img.id); }}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 shadow transition"
                    title="Delete image"
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                </div>

                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800 truncate">{img.caption || <span className="text-gray-400 italic">No caption</span>}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{img.category}</span>
                    {isSelected && (
                      <span className="text-xs text-[#1e3a8a] font-medium flex items-center gap-1">
                        <i className="fas fa-check-circle text-xs"></i> On resort
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <i className="fas fa-trash text-red-500"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Image</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
              <button
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setApiError("");
                  try {
                    await deleteAdminGallery(deleteId);
                    setImages(p => p.filter(i => i.id !== deleteId));
                    setDeleteId(null);
                  } catch {
                    setApiError("Failed to delete image. Please try again.");
                    setDeleteId(null);
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-2">
                {deleting ? <><i className="fas fa-spinner fa-spin text-xs"></i> Deleting…</> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contact Submissions Tab ──────────────────────────────────────────────────
function ContactSubmissionsTab() {
  const [contacts, setContacts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState("");
  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    setLoading(true);
    getAdminContacts()
      .then(r => setContacts(r.data.data || []))
      .catch(() => setApiError("Failed to load contact submissions."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(c =>
    [c.name, c.email, c.subject].some(v => v && v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {apiError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <i className="fas fa-exclamation-circle mr-2"></i>{apiError}
        </div>
      )}
      <div className="relative">
        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
        <input type="text" placeholder="Search by name, email or subject..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-left">Subject</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading submissions…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No submissions found.</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-gray-500">{c.email}</td>
                  <td className="px-6 py-4">{c.subject}</td>
                  <td className="px-6 py-4 text-gray-400 whitespace-nowrap">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => setSelected(c)}
                      className="text-[#1e3a8a] hover:underline text-sm font-medium">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">Contact Submission</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
                <div><p className="text-xs text-gray-400">Name</p><p className="font-medium">{selected.name}</p></div>
                <div><p className="text-xs text-gray-400">Email</p><p className="font-medium">{selected.email}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-400">Subject</p><p className="font-medium">{selected.subject}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-400">Date</p><p className="font-medium">{formatDate(selected.created_at)}</p></div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Message</p>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-4 leading-relaxed">{selected.message}</p>
              </div>
            </div>
            <div className="flex justify-end mt-5 gap-2">
              <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-4 py-2 rounded-lg text-sm">
                <i className="fas fa-reply"></i> Reply via Email
              </a>
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reviews Tab ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  Pending:  "bg-amber-100 text-amber-700",
};

function ReviewsTab({ content, onSave }) {
  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState("");
  const [saving,   setSaving]   = useState(null); // id being saved

  // Section settings editing
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));
  const cancelEdit = () => { setForm(content); setEditing(false); };
  const saveEdit   = () => { onSave(form); setEditing(false); };
  const toggleVisible = () => onSave({ ...content, visible: !content.visible });

  const load = () => {
    setLoading(true);
    getAdminReviews()
      .then(r => setReviews(r.data.data || []))
      .catch(() => setApiError("Failed to load reviews."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function patch(id, data) {
    setSaving(id);
    try {
      await updateAdminReview(id, data);
      setReviews(rs => rs.map(r => r.id === id ? { ...r, ...data } : r));
    } catch {
      setApiError("Failed to update review.");
    } finally {
      setSaving(null);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    setSaving(id);
    try {
      await deleteAdminReview(id);
      setReviews(rs => rs.filter(r => r.id !== id));
    } catch {
      setApiError("Failed to delete review.");
    } finally {
      setSaving(null);
    }
  }

  const featured  = reviews.filter(r => r.featured).length;
  const pending   = reviews.filter(r => r.status === "Pending").length;

  return (
    <div className="space-y-5">

      {/* Section settings card */}
      <SectionCard
        icon="fa-star" title="Reviews Section" badge="Resort page · /resort"
        editing={editing} onEdit={() => setEditing(true)} onSave={saveEdit} onCancel={cancelEdit}
        visible={content.visible} onToggleVisible={toggleVisible}
      >
        {!editing ? (
          <div>
            <p className="font-semibold text-gray-800 text-sm">{content.sectionTitle}</p>
            <p className="text-xs text-gray-500 mt-1">{content.sectionSubtitle}</p>
            <p className="text-xs text-gray-300 mt-2 italic">Only featured reviews appear on the resort page.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Section Title"    value={form.sectionTitle}    onChange={f("sectionTitle")} />
            <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={f("sectionSubtitle")} rows={2} />
          </div>
        )}
      </SectionCard>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Reviews", value: reviews.length, color: "text-slate-700", icon: "fa-comments" },
          { label: "Featured",      value: featured,       color: "text-emerald-600", icon: "fa-heart" },
          { label: "Pending",       value: pending,        color: "text-amber-600",   icon: "fa-clock" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg shadow border border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center ${s.color}`}>
              <i className={`fas ${s.icon} text-sm`}></i>
            </div>
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {apiError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <i className="fas fa-exclamation-circle mr-2"></i>{apiError}
        </div>
      )}

      {/* Reviews list */}
      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <i className="fas fa-star text-sm text-[#1e3a8a]"></i>
          <h3 className="font-semibold text-gray-800 text-sm">All Reviews</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <i className="fas fa-spinner fa-spin text-2xl mb-3"></i><p>Loading reviews…</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <i className="fas fa-star text-4xl mb-3"></i><p>No reviews yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reviews.map(r => (
              <div key={r.id} className={`px-5 py-4 flex flex-col md:flex-row md:items-start gap-4 ${saving === r.id ? "opacity-50 pointer-events-none" : ""}`}>

                {/* Left: guest info + review */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{r.guestName}</span>
                    <span className="text-yellow-400 text-xs">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {r.status}
                    </span>
                    {r.featured && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1">
                        <i className="fas fa-heart text-[10px]"></i> Featured
                      </span>
                    )}
                    {r.room && <span className="text-xs text-gray-400">{r.room}</span>}
                    <span className="text-xs text-gray-300 ml-auto">{r.date}</span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">&ldquo;{r.comment}&rdquo;</p>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex flex-wrap gap-2 shrink-0">
                  {r.status === "Pending" && (
                    <>
                      <button onClick={() => patch(r.id, { status: "Approved" })}
                        className="text-xs px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg font-medium">
                        Approve
                      </button>
                      <button onClick={() => patch(r.id, { status: "Rejected" })}
                        className="text-xs px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-medium">
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "Approved" && (
                    <button onClick={() => patch(r.id, { featured: !r.featured })}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                        r.featured
                          ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}>
                      {r.featured ? "Unfeature" : "Feature"}
                    </button>
                  )}
                  <button onClick={() => remove(r.id)}
                    className="text-xs px-3 py-1.5 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg font-medium">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = ["Page Editor", "Gallery", "Contact Submissions", "Reviews"];

export default function AdminContent() {
  const [activeTab, setActiveTab] = useState(0);
  const [content,   setContent]   = useState(loadContent);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState('');

  // On mount: pull the real values from the backend (overrides localStorage defaults)
  useEffect(() => {
    api.get('/api/content')
      .then(r => {
        const d = r.data?.data ?? {};
        if (Object.keys(d).length === 0) return;
        const mapped = {};
        Object.keys(DEFAULT_CONTENT).forEach(k => {
          if (d[`page_${k}`] !== undefined) mapped[k] = d[`page_${k}`];
        });
        if (Object.keys(mapped).length > 0) {
          setContent(prev => ({ ...prev, ...mapped }));
        }
      })
      .catch(() => {}); // silently fall back to localStorage
  }, []);

  const update = (key) => (val) => {
    const next = { ...content, [key]: val };
    setContent(next);
    saveContent(next); // local cache
    // Push to backend with page_ prefix so public pages can read it
    setSaving(true);
    updateAdminContent({ [`page_${key}`]: val })
      .then(() => { setSaveMsg('Published!'); setTimeout(() => setSaveMsg(''), 3000); })
      .catch(() => { setSaveMsg('Failed to publish'); setTimeout(() => setSaveMsg(''), 3000); })
      .finally(() => setSaving(false));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === i
                  ? "border-[#1e3a8a] text-[#1e3a8a]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}>
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Page Editor */}
      {activeTab === 0 && (
        <div className="space-y-6">
          {/* Home page */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="fas fa-home text-[#1e3a8a]"></i>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Home Page <span className="text-gray-300 font-normal normal-case">/</span></h2>
            </div>
            <div className="space-y-3">
              <HomeHeroEditor    content={content.home_hero}    onSave={update("home_hero")} />
              <HomeResortsEditor content={content.home_resorts} onSave={update("home_resorts")} />
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <i className="fas fa-umbrella-beach text-[#1e3a8a]"></i>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Resort Page <span className="text-gray-300 font-normal normal-case">/resort</span></h2>
            </div>
            <div className="space-y-3">
              <ResortHeroEditor          content={content.resort_hero}       onSave={update("resort_hero")} />
              <ResortAboutEditor         content={content.resort_about}      onSave={update("resort_about")} />
              <ResortRoomsSectionEditor  content={content.resort_rooms}      onSave={update("resort_rooms")} />
              <ResortContactEditor       content={content.resort_contact}    onSave={update("resort_contact")} />
              <ResortNewsletterEditor    content={content.resort_newsletter} onSave={update("resort_newsletter")} />
            </div>
          </div>

          {(saving || saveMsg) && (
            <div className={`flex items-center gap-2 text-sm font-medium ${
              saveMsg === 'Failed to publish' ? 'text-red-500' : 'text-emerald-600'
            }`}>
              {saving
                ? <><i className="fas fa-spinner fa-spin text-xs"></i> Publishing to website…</>
                : <><i className="fas fa-check-circle"></i> {saveMsg} Changes are now live.</>
              }
            </div>
          )}
        </div>
      )}

      {activeTab === 1 && <GalleryTab />}
      {activeTab === 2 && <ContactSubmissionsTab />}
      {activeTab === 3 && <ReviewsTab content={content.resort_reviews} onSave={update("resort_reviews")} />}
    </div>
  );
}
