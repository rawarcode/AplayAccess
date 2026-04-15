import { useState, useEffect, useCallback } from "react";
import {
  getAdminAnnouncements,
  createAdminAnnouncement,
  updateAdminAnnouncement,
  deleteAdminAnnouncement,
} from "../../lib/adminApi";
import { isVideoUrl } from "../../lib/uploadApi.js";
import MediaPicker from "../../components/ui/MediaPicker.jsx";

const BLANK = {
  title: "",
  body: "",
  media_url: "",
  is_active: true,
  is_pinned: false,
  published_at: new Date().toISOString().slice(0, 16),
};

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null); // id to confirm delete
  const [toast, setToast] = useState(null); // { msg, type }

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    getAdminAnnouncements()
      .then((r) => setAnnouncements(r.data?.data ?? []))
      .catch(() => showToast("Failed to load announcements.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing({ ...BLANK });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing({
      ...item,
      published_at: item.published_at
        ? new Date(item.published_at).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function setField(k, v) {
    setEditing((x) => ({ ...x, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    if (!editing.title?.trim()) {
      showToast("Title is required.", "error");
      return;
    }
    if (!editing.body?.trim()) {
      showToast("Body is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title:        editing.title,
        body:         editing.body,
        media_url:    editing.media_url || null,
        is_active:    editing.is_active,
        is_pinned:    editing.is_pinned,
        published_at: editing.published_at || null,
      };
      if (editing.id) {
        await updateAdminAnnouncement(editing.id, payload);
        showToast("Announcement updated.");
      } else {
        await createAdminAnnouncement(payload);
        showToast("Announcement created.");
      }
      closeModal();
      load();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        Object.values(err?.response?.data?.errors ?? {})?.[0]?.[0] ||
        "Save failed.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id) {
    try {
      await deleteAdminAnnouncement(id);
      showToast("Announcement deleted.");
      setDeleteId(null);
      load();
    } catch {
      showToast("Delete failed.", "error");
    }
  }

  async function toggleActive(item) {
    try {
      await updateAdminAnnouncement(item.id, { is_active: !item.is_active });
      load();
    } catch {
      showToast("Failed to update status.", "error");
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Announcements</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Post updates, event notices, and promos visible to guests.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow transition-all"
        >
          <i className="fas fa-plus"></i>
          New Announcement
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <i className="fas fa-spinner fa-spin text-2xl mr-3"></i>
          Loading announcements…
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
          <i className="fas fa-bullhorn text-4xl mb-3 block text-gray-300"></i>
          <p className="font-medium">No announcements yet.</p>
          <p className="text-sm mt-1">Click "New Announcement" to create the first one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 w-16">Media</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Title / Body</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Published</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Active</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {announcements.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors ${!item.is_active ? "opacity-50" : ""}`}
                >
                  {/* Media thumbnail */}
                  <td className="px-4 py-3">
                    {item.media_url ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {isVideoUrl(item.media_url) ? (
                          <div className="relative w-full h-full">
                            <video
                              src={item.media_url}
                              muted
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <i className="fas fa-play text-white text-xs"></i>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={item.media_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                        <i className="fas fa-image"></i>
                      </div>
                    )}
                  </td>

                  {/* Title + body */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.is_pinned && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          📌 Pinned
                        </span>
                      )}
                      <span className="font-semibold text-gray-800">{item.title}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{item.body}</p>
                    {item.creator?.name && (
                      <p className="text-gray-300 text-xs mt-0.5">by {item.creator.name}</p>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell whitespace-nowrap">
                    {formatDate(item.published_at)}
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(item)}
                      title={item.is_active ? "Deactivate" : "Activate"}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition
                        ${item.is_active
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${item.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                      {item.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {deleteId === item.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-500">Delete?</span>
                        <button
                          onClick={() => confirmDelete(item.id)}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg font-semibold"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteId(null)}
                          className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition"
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="text-red-500 hover:text-red-700 px-2 py-1 rounded transition"
                          title="Delete"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && editing ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                {editing.id ? "Edit Announcement" : "New Announcement"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <form onSubmit={save} className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) => setField("title", e.target.value)}
                  required
                  placeholder="e.g. Summer Promo 2026"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a]"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editing.body}
                  onChange={(e) => setField("body", e.target.value)}
                  required
                  rows={4}
                  placeholder="Write your announcement here…"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] resize-none"
                />
              </div>

              {/* Media upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Photo / Video
                  <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
                </label>
                <MediaPicker
                  value={editing.media_url ?? ""}
                  onChange={(url) => setField("media_url", url)}
                  previousUrl={editing.id ? editing.media_url : null}
                  folder="announcements"
                  accept="image/*,video/*"
                  label="Upload Photo or Video"
                />
                {/* Preview after upload */}
                {editing.media_url && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-h-52 flex items-center justify-center">
                    {isVideoUrl(editing.media_url) ? (
                      <video
                        src={editing.media_url}
                        controls
                        className="max-h-52 w-full object-contain"
                      />
                    ) : (
                      <img
                        src={editing.media_url}
                        alt="Preview"
                        className="max-h-52 object-contain"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Published At */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Published At
                </label>
                <input
                  type="datetime-local"
                  value={editing.published_at ?? ""}
                  onChange={(e) => setField("published_at", e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a]"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setField("is_pinned", !editing.is_pinned)}
                    className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                      editing.is_pinned ? "bg-amber-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                        editing.is_pinned ? "left-5" : "left-1"
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700">📌 Pinned</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setField("is_active", !editing.is_active)}
                    className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                      editing.is_active ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                        editing.is_active ? "left-5" : "left-1"
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Active (visible to guests)</span>
                </label>
              </div>

              {/* Footer buttons */}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#1e3a8a] hover:bg-[#152c6e] text-white shadow transition disabled:opacity-60"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <i className="fas fa-spinner fa-spin"></i> Saving…
                    </span>
                  ) : editing.id ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all
            ${toast.type === "error" ? "bg-red-600" : "bg-green-600"}`}
        >
          <i className={`fas ${toast.type === "error" ? "fa-circle-xmark" : "fa-circle-check"}`}></i>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
