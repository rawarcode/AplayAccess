import { useState } from "react";

export default function AdminContent() {
  const [content, setContent] = useState({
    heroTitle: "Welcome to Aplay Resort",
    heroSubtitle: "Experience Paradise at the Best Beach Resort in Philippines",
    aboutTitle: "About Aplay Resort",
    aboutText: "Aplay Resort is a premier destination offering world-class amenities and unforgettable experiences.",
    contactEmail: "info@aplayresort.com",
    contactPhone: "+63 2 1234 5678",
    contactAddress: "123 Beach Road, Boracay, Philippines",
  });
  const [editing, setEditing] = useState(false);
  const [tempContent, setTempContent] = useState({ ...content });

  function handleSave(e) {
    e.preventDefault();
    setContent(tempContent);
    setEditing(false);
  }

  function handleCancel() {
    setTempContent(content);
    setEditing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Content Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Update hero text, about section, and contact details easily.
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <i className="fas fa-edit"></i> Edit Content
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Hero Section</h3>
            <p className="text-slate-600 text-sm mb-2">
              <span className="font-semibold">Title:</span> {content.heroTitle}
            </p>
            <p className="text-slate-600 text-sm">
              <span className="font-semibold">Subtitle:</span> {content.heroSubtitle}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">About Section</h3>
            <p className="text-slate-600 text-sm mb-2">
              <span className="font-semibold">Title:</span> {content.aboutTitle}
            </p>
            <p className="text-slate-600 text-sm">
              <span className="font-semibold">Text:</span> {content.aboutText}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Contact Information</h3>
            <div className="space-y-2">
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">Email:</span> {content.contactEmail}
              </p>
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">Phone:</span> {content.contactPhone}
              </p>
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">Address:</span> {content.contactAddress}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Edit Content</h2>
              <p className="text-sm text-slate-500">Update the landing page content shown to guests.</p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-600"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hero Title</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={tempContent.heroTitle}
                onChange={(e) => setTempContent((x) => ({ ...x, heroTitle: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hero Subtitle</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={tempContent.heroSubtitle}
                onChange={(e) => setTempContent((x) => ({ ...x, heroSubtitle: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">About Title</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={tempContent.aboutTitle}
                onChange={(e) => setTempContent((x) => ({ ...x, aboutTitle: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">About Text</label>
              <textarea
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                rows="4"
                value={tempContent.aboutText}
                onChange={(e) => setTempContent((x) => ({ ...x, aboutText: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={tempContent.contactEmail}
                onChange={(e) => setTempContent((x) => ({ ...x, contactEmail: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={tempContent.contactPhone}
                onChange={(e) => setTempContent((x) => ({ ...x, contactPhone: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Address</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={tempContent.contactAddress}
                onChange={(e) => setTempContent((x) => ({ ...x, contactAddress: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
