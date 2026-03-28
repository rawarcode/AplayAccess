import { useState } from "react";

// ── Sample data (replace with API calls when backend is wired) ───────────────

const SAMPLE_GALLERY = [
  { id: 1, image_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400", caption: "Beach front view", category: "beach", sort_order: 1 },
  { id: 2, image_url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", caption: "Deluxe suite interior", category: "rooms", sort_order: 2 },
  { id: 3, image_url: "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400", caption: "Pool area at sunset", category: "amenities", sort_order: 3 },
  { id: 4, image_url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400", caption: "Dining experience", category: "dining", sort_order: 4 },
];

const SAMPLE_CONTACTS = [
  { id: 1, name: "Maria Santos",  email: "maria@email.com",  subject: "Room inquiry",        message: "Hi, I would like to ask about available rooms for July.",          created_at: "2025-06-10T09:15:00Z" },
  { id: 2, name: "Juan Dela Cruz",email: "juan@email.com",   subject: "Event booking",       message: "We are planning a small gathering for 20 people. Do you have function rooms?", created_at: "2025-06-12T14:30:00Z" },
  { id: 3, name: "Anna Reyes",    email: "anna@email.com",   subject: "Feedback",            message: "Just wanted to say we had a wonderful stay last weekend. Thank you!", created_at: "2025-06-14T08:00:00Z" },
  { id: 4, name: "Carlos Lim",    email: "carlos@email.com", subject: "Lost and found",      message: "I think I left my charger in Room 205 last week.",                  created_at: "2025-06-15T11:45:00Z" },
];

const CATEGORIES = ["beach", "rooms", "amenities", "dining", "events", "other"];

const TABS = ["Website Content", "Gallery", "Contact Submissions"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function WebsiteContentTab() {
  const [content, setContent] = useState({
    heroTitle:       "Welcome to Aplay Resort",
    heroSubtitle:    "Experience Paradise at the Best Beach Resort in Philippines",
    aboutTitle:      "About Aplay Resort",
    aboutText:       "Aplay Resort is a premier destination offering world-class amenities and unforgettable experiences.",
    contactEmail:    "info@aplayresort.com",
    contactPhone:    "+63 2 1234 5678",
    contactAddress:  "123 Beach Road, Aplaya, Cavite, Philippines",
  });
  const [editing, setEditing] = useState(false);
  const [temp,    setTemp]    = useState({ ...content });

  const save = (e) => { e.preventDefault(); setContent(temp); setEditing(false); };
  const cancel = () => { setTemp(content); setEditing(false); };

  if (!editing) return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-4 py-2 rounded-lg text-sm"
        >
          <i className="fas fa-edit"></i> Edit Content
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <i className="fas fa-image text-[#1e3a8a]"></i> Hero Section
        </h3>
        <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Title:</span> {content.heroTitle}</p>
        <p className="text-sm text-gray-600"><span className="font-medium">Subtitle:</span> {content.heroSubtitle}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <i className="fas fa-info-circle text-[#1e3a8a]"></i> About Section
        </h3>
        <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Title:</span> {content.aboutTitle}</p>
        <p className="text-sm text-gray-600"><span className="font-medium">Text:</span> {content.aboutText}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <i className="fas fa-address-book text-[#1e3a8a]"></i> Contact Information
        </h3>
        <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Email:</span> {content.contactEmail}</p>
        <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Phone:</span> {content.contactPhone}</p>
        <p className="text-sm text-gray-600"><span className="font-medium">Address:</span> {content.contactAddress}</p>
      </div>

      <p className="text-xs text-gray-400 italic">
        <i className="fas fa-info-circle mr-1"></i>
        Changes here will reflect on the public-facing website once backend is connected.
      </p>
    </div>
  );

  return (
    <form onSubmit={save} className="bg-white rounded-lg shadow p-6 space-y-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-800">Edit Website Content</h2>
        <button type="button" onClick={cancel} className="text-gray-400 hover:text-gray-600">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Hero Section</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={temp.heroTitle}
              onChange={(e) => setTemp(x => ({ ...x, heroTitle: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input type="text" value={temp.heroSubtitle}
              onChange={(e) => setTemp(x => ({ ...x, heroSubtitle: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">About Section</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={temp.aboutTitle}
              onChange={(e) => setTemp(x => ({ ...x, aboutTitle: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
            <textarea rows={3} value={temp.aboutText}
              onChange={(e) => setTemp(x => ({ ...x, aboutText: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={temp.contactEmail}
              onChange={(e) => setTemp(x => ({ ...x, contactEmail: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="text" value={temp.contactPhone}
              onChange={(e) => setTemp(x => ({ ...x, contactPhone: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={temp.contactAddress}
              onChange={(e) => setTemp(x => ({ ...x, contactAddress: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={cancel}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit"
          className="px-4 py-2 text-sm bg-[#1e3a8a] hover:bg-[#152c6e] text-white rounded-lg">
          Save Changes
        </button>
      </div>
    </form>
  );
}

function GalleryTab() {
  const [images,     setImages]     = useState(SAMPLE_GALLERY);
  const [showForm,   setShowForm]   = useState(false);
  const [filterCat,  setFilterCat]  = useState("all");
  const [deleteId,   setDeleteId]   = useState(null);
  const [form, setForm] = useState({ image_url: "", caption: "", category: "beach", sort_order: "" });

  const filtered = filterCat === "all" ? images : images.filter(i => i.category === filterCat);

  const handleAdd = (e) => {
    e.preventDefault();
    const newImage = {
      id: Date.now(),
      image_url:  form.image_url,
      caption:    form.caption,
      category:   form.category,
      sort_order: parseInt(form.sort_order) || images.length + 1,
    };
    setImages(prev => [...prev, newImage]);
    setForm({ image_url: "", caption: "", category: "beach", sort_order: "" });
    setShowForm(false);
  };

  const handleDelete = (id) => {
    setImages(prev => prev.filter(i => i.id !== id));
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Filter:</span>
          {["all", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filterCat === cat
                  ? "bg-[#1e3a8a] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-4 py-2 rounded-lg text-sm"
        >
          <i className="fas fa-plus"></i> Add Image
        </button>
      </div>

      {/* Add Image Form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Add New Gallery Image</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL <span className="text-red-500">*</span></label>
              <input
                type="url" required
                placeholder="https://example.com/image.jpg"
                value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                placeholder="Short description"
                value={form.caption}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="number" min="1"
                placeholder="e.g. 5"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm bg-[#1e3a8a] hover:bg-[#152c6e] text-white rounded-lg">
                Add Image
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Image Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <i className="fas fa-images text-4xl mb-3"></i>
          <p>No images in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(img => (
            <div key={img.id} className="bg-white rounded-lg shadow overflow-hidden group relative">
              <div className="relative h-48 bg-gray-100">
                <img
                  src={img.image_url}
                  alt={img.caption || "Gallery image"}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.src = "https://placehold.co/400x300?text=No+Image"; }}
                />
                <button
                  onClick={() => setDeleteId(img.id)}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                >
                  <i className="fas fa-trash text-xs"></i>
                </button>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-800 truncate">{img.caption || <span className="text-gray-400 italic">No caption</span>}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{img.category}</span>
                  <span className="text-xs text-gray-400">#{img.sort_order}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
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
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactSubmissionsTab() {
  const [contacts]    = useState(SAMPLE_CONTACTS);
  const [selected,    setSelected]   = useState(null);
  const [search,      setSearch]     = useState("");

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
        <input
          type="text"
          placeholder="Search by name, email or subject..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      </div>

      {/* Table */}
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                    No contact submissions found.
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-gray-500">{c.email}</td>
                  <td className="px-6 py-4">{c.subject}</td>
                  <td className="px-6 py-4 text-gray-400 whitespace-nowrap">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelected(c)}
                      className="text-[#1e3a8a] hover:underline text-sm font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">
        <i className="fas fa-info-circle mr-1"></i>
        {contacts.length} total submission{contacts.length !== 1 ? "s" : ""}. Read-only — replies should be sent via email.
      </p>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">Contact Submission</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-400">Name</p>
                  <p className="font-medium text-gray-800">{selected.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="font-medium text-gray-800">{selected.email}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Subject</p>
                  <p className="font-medium text-gray-800">{selected.subject}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Date</p>
                  <p className="font-medium text-gray-800">{formatDate(selected.created_at)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Message</p>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-4 leading-relaxed">{selected.message}</p>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <a
                href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-4 py-2 rounded-lg text-sm mr-2"
              >
                <i className="fas fa-reply"></i> Reply via Email
              </a>
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminContent() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="p-6 space-y-6">
      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === i
                  ? "border-[#1e3a8a] text-[#1e3a8a]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 0 && <WebsiteContentTab />}
      {activeTab === 1 && <GalleryTab />}
      {activeTab === 2 && <ContactSubmissionsTab />}
    </div>
  );
}
