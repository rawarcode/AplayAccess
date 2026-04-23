import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { getAdminRooms, createAdminRoom, updateAdminRoom, deleteAdminRoom, getAdminAddons } from "../../lib/adminApi";
import { RESORT_ID } from "../../lib/config.js";
import Toast, { useToast } from "../../components/ui/Toast";
import ImageUpload from "../../components/ui/ImageUpload.jsx";
import useDebounce from "../../hooks/useDebounce.js";
import OwnerAddons from "./Addons.jsx";
import { TabBar } from "./Users.jsx";

const PAGE_SIZE = 10;

// ── Availability status config ────────────────────────────────────────────
const AVAIL = {
  available:   { label: "Available",          color: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", icon: "fa-check-circle" },
  renovation:  { label: "Under Renovation",   color: "bg-rose-100 text-rose-800",       dot: "bg-rose-500",    icon: "fa-hard-hat"     },
  maintenance: { label: "Under Maintenance",  color: "bg-amber-100 text-amber-800",     dot: "bg-amber-500",   icon: "fa-wrench"       },
  reserved:    { label: "Reserved / Blocked", color: "bg-purple-100 text-purple-800",   dot: "bg-purple-500",  icon: "fa-lock"         },
  closed:      { label: "Temporarily Closed", color: "bg-slate-100 text-slate-600",     dot: "bg-slate-400",   icon: "fa-ban"          },
};

// ── Feature icon palette ──────────────────────────────────────────────────
const FEATURE_ICONS = [
  { icon: "fa-wifi",            label: "WiFi"         },
  { icon: "fa-tv",              label: "TV"           },
  { icon: "fa-snowflake",       label: "AC"           },
  { icon: "fa-coffee",          label: "Coffee"       },
  { icon: "fa-bath",            label: "Bath"         },
  { icon: "fa-shower",          label: "Shower"       },
  { icon: "fa-water-ladder",    label: "Pool"         },
  { icon: "fa-umbrella-beach",  label: "Beach"        },
  { icon: "fa-lock",            label: "Safe"         },
  { icon: "fa-door-open",       label: "Balcony"      },
  { icon: "fa-couch",           label: "Living Area"  },
  { icon: "fa-utensils",        label: "Dining"       },
  { icon: "fa-dumbbell",        label: "Gym"          },
  { icon: "fa-spa",             label: "Spa"          },
  { icon: "fa-wind",            label: "Fan"          },
  { icon: "fa-concierge-bell",  label: "Room Service" },
  { icon: "fa-parking",         label: "Parking"      },
  { icon: "fa-star",            label: "Premium"      },
  { icon: "fa-microphone",      label: "Videoke"      },
  { icon: "fa-check",           label: "Other"        },
];

const BLANK = {
  name: "", category: "room", description: "", day_rate: 1500, overnight_rate: 2000, rate_24hr: 2500,
  capacity: 2, capacity_label: "", quantity: 1,
  beds: "", image: "",
  availability_status: "available", features: [], allowed_booking_types: null,
};

const COTTAGE_TEMPLATE = {
  ...BLANK,
  name: "", category: "cottage", capacity: 10, capacity_label: "Up to 10 pax",
  quantity: 1, day_rate: 2000, overnight_rate: 2500, rate_24hr: 3500,
  features: [{ text: "Beachside", icon: "fa-umbrella-beach" }],
};

const PAVILION_TEMPLATE = {
  ...BLANK,
  name: "", category: "pavilion", capacity: 30, capacity_label: "Up to 30 pax",
  quantity: 1, day_rate: 3000, overnight_rate: 4000, rate_24hr: 5000,
  features: [{ text: "Open Air", icon: "fa-wind" }, { text: "Pool View", icon: "fa-water-ladder" }],
};

// ── Category metadata for modal header ────────────────────────────────────
const CATEGORY_META = {
  room:     { label: "Room",     icon: "fa-bed",            color: "bg-sky-100 text-sky-600"     },
  cottage:  { label: "Cottage",  icon: "fa-umbrella-beach", color: "bg-amber-100 text-amber-600" },
  pavilion: { label: "Pavilion", icon: "fa-archway",        color: "bg-emerald-100 text-emerald-600" },
  tent:     { label: "Tent",     icon: "fa-campground",     color: "bg-rose-100 text-rose-600"   },
};

const ADMIN_CATEGORY_TABS = [
  { key: "",         label: "All",       icon: "fa-th-large"       },
  { key: "room",     label: "Rooms",     icon: "fa-bed"            },
  { key: "cottage",  label: "Cottages",  icon: "fa-umbrella-beach" },
  { key: "pavilion", label: "Pavilions", icon: "fa-archway"        },
  { key: "tent",     label: "Tents",     icon: "fa-campground"     },
];

function getRoomCategory(r) {
  if (r.category) return r.category;
  const n = (r.name || "").toLowerCase();
  if (n.includes("tent"))     return "tent";
  if (n.includes("cottage"))  return "cottage";
  if (n.includes("pavilion")) return "pavilion";
  return "room";
}

function AvailBadge({ status }) {
  const cfg = AVAIL[status] || AVAIL.available;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Live card preview ─────────────────────────────────────────────────────
function RoomPreview({ room }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white text-sm">
      <div className="relative h-40 bg-slate-100">
        {room.image
          ? <img src={room.image} alt={room.name} className="w-full h-full object-cover"
              onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300">
              <i className="fas fa-image text-4xl"></i>
            </div>
        }
      </div>
      <div className="p-4">
        <p className="font-bold text-slate-900 text-base mb-1">{room.name || <span className="text-slate-300 italic">Room name</span>}</p>
        {room.description && <p className="text-slate-500 text-xs mb-3 line-clamp-2">{room.description}</p>}
        {room.features?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {room.features.slice(0, 4).map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                <i className={`fas ${f.icon || "fa-check"} text-[10px]`}></i> {f.text}
              </span>
            ))}
            {room.features.length > 4 && <span className="text-xs text-slate-400">+{room.features.length - 4} more</span>}
          </div>
        )}
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-bold text-blue-600">{"\u20B1"}{Number(room.day_rate || 0).toLocaleString()} <span className="text-slate-400 text-xs font-normal">/day</span></span>
            <span className="text-xs text-slate-400">max {room.capacity || "\u2014"} pax</span>
          </div>
          <div className="flex gap-3 text-xs text-slate-500">
            <span>{"\u20B1"}{Number(room.overnight_rate || 0).toLocaleString()} /night</span>
            <span>{"\u20B1"}{Number(room.rate_24hr || 0).toLocaleString()} /24hr</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function AdminRooms() {
  // URL-synced tab state so /owner/rooms?tab=addons lands on Add-ons and
  // the legacy /owner/addons redirect works cleanly.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'addons' ? 'addons' : 'rooms';
  const setActiveTab = (key) => {
    if (key === 'rooms') setSearchParams({});
    else setSearchParams({ tab: key });
  };

  const [rooms,        setRooms]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);
  const [saveError,    setSaveError]    = useState("");
  const [refreshing,   setRefreshing]   = useState(false);
  const [toast, showToast, clearToast, toastType, toastAction] = useToast(6000);
  const undoRef = useRef(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [addMenuOpen,  setAddMenuOpen]  = useState(false);
  const addMenuRef     = useRef(null);
  const formRef        = useRef(null);
  const [viewRoom,     setViewRoom]     = useState(null);
  const [searchTerm,      setSearchTerm]      = useState("");
  const [filterAvail,     setFilterAvail]     = useState("");
  const [filterCategory,  setFilterCategory]  = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Unsaved changes discard confirm (#2)
  const [discardOpen,  setDiscardOpen]  = useState(false);

  // Feature input state
  const [featureInput,   setFeatureInput]   = useState("");
  const [selectedIcon,   setSelectedIcon]   = useState("fa-check");

  // Catalog of addons for the "Attached add-ons" section. Fetched once,
  // used to render Package/Optional/None pickers inside the room form.
  const [addonCatalog, setAddonCatalog] = useState([]);
  useEffect(() => {
    getAdminAddons()
      .then(r => setAddonCatalog(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  // Map of addon_id → { relation: 'package' | 'optional', price, qty }.
  // Rows missing from the map are "None" (not attached). Kept separate
  // from `editing` so the addons UI can mutate independently of the
  // rest of the form — simpler reducer than nesting into `editing`.
  const [attachedAddons, setAttachedAddons] = useState({});

  // Seed attachedAddons from a room's pivot data (openEdit / openDuplicate)
  // or clear it (openCreate). Called from each of those paths.
  const loadAttachedFromRoom = (room) => {
    const map = {};
    for (const a of (room?.addons ?? [])) {
      const rel = a.pivot?.relation;
      if (rel !== 'package' && rel !== 'optional') continue;
      map[a.id] = {
        relation: rel,
        price: Number(a.pivot.price ?? a.price ?? 0),
        qty:   Number(a.pivot.qty ?? 1),
      };
    }
    setAttachedAddons(map);
  };

  // Three-way status change: null (None) | 'optional' | 'package'.
  const setAddonRelation = (addonId, relation) => {
    setAttachedAddons(prev => {
      const next = { ...prev };
      if (!relation) {
        delete next[addonId];
        return next;
      }
      const catalog = addonCatalog.find(c => c.id === addonId);
      const existing = next[addonId];
      next[addonId] = {
        relation,
        price: existing?.price ?? Number(catalog?.price ?? 0),
        qty:   existing?.qty ?? 1,
      };
      return next;
    });
  };

  const setAddonField = (addonId, key, value) => {
    setAttachedAddons(prev => {
      const row = prev[addonId];
      if (!row) return prev;
      return { ...prev, [addonId]: { ...row, [key]: value } };
    });
  };
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconPickerRef    = useRef(null);
  const iconButtonRef    = useRef(null);
  // Viewport-relative coordinates for the floating icon picker. We use
  // fixed positioning (not absolute) so the popover escapes the modal
  // form's overflow-y-auto clipping, which was cropping the bottom rows
  // of the grid.
  const [iconPickerPos, setIconPickerPos] = useState({ top: 0, left: 0 });

  // Bulk selection (#13)
  const [selected, setSelected] = useState(new Set());

  // Pagination (#6)
  const [page, setPage] = useState(1);

  // Click-outside closes icon picker. Both the trigger button and the
  // floating popover are valid click targets — excluding both prevents
  // the popover from closing when clicking an icon inside it.
  useEffect(() => {
    if (!iconPickerOpen) return;
    const handler = (e) => {
      if (iconPickerRef.current && iconPickerRef.current.contains(e.target)) return;
      if (iconButtonRef.current && iconButtonRef.current.contains(e.target)) return;
      setIconPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [iconPickerOpen]);

  // Compute viewport coordinates for the popover when it opens, plus
  // reposition on window resize / scroll so the picker stays anchored
  // to the trigger button even if the underlying form scrolls.
  useEffect(() => {
    if (!iconPickerOpen) return;
    const reposition = () => {
      const btn = iconButtonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const POPOVER_W = 208;   // w-52 = 13rem = 208px
      const POPOVER_H = 180;   // 4 rows × 36px + padding
      // Default: below the trigger. If that would overflow the viewport
      // bottom, flip above.
      let top = r.bottom + 8;
      if (top + POPOVER_H > window.innerHeight - 8) top = Math.max(8, r.top - POPOVER_H - 8);
      // Clamp horizontally so the popover doesn't run off the right edge.
      const left = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_W - 8));
      setIconPickerPos({ top, left });
    };
    reposition();
    window.addEventListener("resize", reposition);
    // Capture-phase scroll so nested scroll containers (the modal form)
    // also trigger a reposition while the picker is open.
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [iconPickerOpen]);

  // Click-outside closes add menu
  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) setAddMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addMenuOpen]);

  // Cleanup undo timer on unmount
  useEffect(() => () => { if (undoRef.current) clearTimeout(undoRef.current.timer); }, []);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    getAdminRooms()
      .then(r => { setRooms(r.data.data); setError(null); })
      .catch(() => setError("Failed to load rooms."))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh 20s
  useEffect(() => {
    const id = setInterval(() => load(true), 20_000);
    return () => clearInterval(id);
  }, [load]);

  const [sortBy,  setSortBy]  = useState("Name");
  const [sortDir, setSortDir] = useState("asc");

  // #1 — fixed "Qty" sort case
  const filtered = rooms.filter(r => {
    const matchSearch    = r.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchAvail     = !filterAvail     || r.availability_status === filterAvail;
    const matchCategory  = !filterCategory  || getRoomCategory(r) === filterCategory;
    return matchSearch && matchAvail && matchCategory;
  }).sort((a, b) => {
    let aVal, bVal;
    if (sortBy === "Name")                { aVal = a.name.toLowerCase();           bVal = b.name.toLowerCase(); }
    else if (sortBy === "Qty")            { aVal = Number(a.quantity ?? 1);        bVal = Number(b.quantity ?? 1); }
    else if (sortBy === "Capacity")       { aVal = Number(a.capacity);             bVal = Number(b.capacity); }
    else if (sortBy === "Day Rate")       { aVal = Number(a.day_rate);             bVal = Number(b.day_rate); }
    else if (sortBy === "Overnight Rate") { aVal = Number(a.overnight_rate);       bVal = Number(b.overnight_rate); }
    else if (sortBy === "24hr Rate")      { aVal = Number(a.rate_24hr ?? 0);       bVal = Number(b.rate_24hr ?? 0); }
    else                                  { aVal = a.availability_status ?? "";    bVal = b.availability_status ?? ""; }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, filterAvail, filterCategory]);

  // #6 — pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showFrom   = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showTo     = Math.min(page * PAGE_SIZE, filtered.length);

  // Category counts
  const countRoom     = rooms.filter(r => getRoomCategory(r) === "room").length;
  const countCottage  = rooms.filter(r => getRoomCategory(r) === "cottage").length;
  const countPavilion = rooms.filter(r => getRoomCategory(r) === "pavilion").length;

  // #13 — bulk selection helpers
  const allPageIds   = new Set(paginated.map(r => r.id));
  const allSelected  = paginated.length > 0 && paginated.every(r => selected.has(r.id));
  const someSelected = paginated.some(r => selected.has(r.id));

  function toggleSelectAll() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) { paginated.forEach(r => next.delete(r.id)); }
      else { paginated.forEach(r => next.add(r.id)); }
      return next;
    });
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // #13 — bulk delete
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  function handleBulkDelete() {
    const ids = [...selected];
    const removedRooms = rooms.filter(r => ids.includes(r.id));
    setBulkDeleteOpen(false);

    // Optimistically remove
    setRooms(prev => prev.filter(r => !ids.includes(r.id)));
    setSelected(new Set());

    // Cancel any pending single undo
    if (undoRef.current) { clearTimeout(undoRef.current.timer); undoRef.current = null; }

    const timer = setTimeout(async () => {
      undoRef.current = null;
      let fail = 0;
      for (const id of ids) {
        try { await deleteAdminRoom(id); } catch { fail++; }
      }
      if (fail) {
        load(true);
        showToast(`${fail} room(s) failed to delete.`, "error");
      }
    }, 6000);

    undoRef.current = { timer, rooms: removedRooms };

    showToast(`${ids.length} room(s) deleted.`, "success", {
      label: "Undo",
      onClick: () => {
        if (undoRef.current) { clearTimeout(undoRef.current.timer); undoRef.current = null; }
        setRooms(prev => [...prev, ...removedRooms]);
        showToast(`${removedRooms.length} room(s) restored.`, "info");
      },
    });
  }

  function openCreate(template = BLANK) {
    setEditing({ ...template });
    setEditSnapshot(JSON.stringify(template));
    setSaveError("");
    setFeatureInput("");
    setSelectedIcon(CATEGORY_META[template.category]?.icon === "fa-bed" ? "fa-check" : (template.features?.[0]?.icon || "fa-check"));
    setIconPickerOpen(false);
    setAddMenuOpen(false);
    // No attachments on a fresh room.
    setAttachedAddons({});
    setModalOpen(true);
    setTimeout(() => formRef.current?.scrollTo({ top: 0 }), 50);
  }

  function openEdit(room) {
    const features = (room.features || []).map(f =>
      typeof f === "string" ? { text: f, icon: "fa-check" } : f
    );
    const data = { ...room, availability_status: room.availability_status || "available", features };
    setEditing(data);
    setEditSnapshot(JSON.stringify(data));
    setSaveError("");
    setFeatureInput("");
    setSelectedIcon("fa-check");
    setIconPickerOpen(false);
    // Hydrate attached-addons from the room's pivot data the backend
    // ships in `room.addons[].pivot.{relation,price,qty}`.
    loadAttachedFromRoom(room);
    setViewRoom(null);
    setModalOpen(true);
    setTimeout(() => formRef.current?.scrollTo({ top: 0 }), 50);
  }

  // #2 — unsaved changes guard via ConfirmDialog
  function guardedCloseModal() {
    if (editing && editSnapshot && JSON.stringify(editing) !== editSnapshot) {
      setDiscardOpen(true);
      return;
    }
    setModalOpen(false);
  }

  function confirmDiscard() {
    setDiscardOpen(false);
    setModalOpen(false);
  }

  function setField(k, v) { setEditing(x => ({ ...x, [k]: v })); }

  function addFeature() {
    const text = featureInput.trim();
    if (!text) return;
    const existing = editing.features || [];
    if (!existing.find(f => f.text === text)) {
      setField("features", [...existing, { text, icon: selectedIcon }]);
    }
    setFeatureInput("");
  }

  function removeFeature(idx) {
    setField("features", (editing.features || []).filter((_, i) => i !== idx));
  }

  function moveFeature(idx, dir) {
    const arr = [...(editing.features || [])];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setField("features", arr);
  }

  function openDuplicate(room) {
    const features = (room.features || []).map(f =>
      typeof f === "string" ? { text: f, icon: "fa-check" } : f
    );
    const data = {
      ...room,
      id: undefined,
      name: `${room.name} (Copy)`,
      availability_status: room.availability_status || "available",
      features,
    };
    setEditing(data);
    setEditSnapshot(JSON.stringify(data));
    setSaveError("");
    setFeatureInput("");
    setSelectedIcon("fa-check");
    setIconPickerOpen(false);
    // Duplicate inherits the original's attachments — owner can trim.
    loadAttachedFromRoom(room);
    setViewRoom(null);
    setModalOpen(true);
    setTimeout(() => formRef.current?.scrollTo({ top: 0 }), 50);
  }

  // Delete room — soft-delete with undo, then permanent after timeout
  function handleDelete() {
    if (!deleteTarget) return;
    const room = deleteTarget;
    setDeleteTarget(null);
    setViewRoom(null);

    // Optimistically remove from local state
    setRooms(prev => prev.filter(r => r.id !== room.id));
    setSelected(prev => { const next = new Set(prev); next.delete(room.id); return next; });

    // Cancel any pending undo timer
    if (undoRef.current) { clearTimeout(undoRef.current.timer); undoRef.current = null; }

    // Schedule real API delete after 6s
    const timer = setTimeout(async () => {
      undoRef.current = null;
      try {
        await deleteAdminRoom(room.id);
      } catch {
        // If API fails, reload to restore
        load(true);
        showToast("Failed to delete room. Restored.", "error");
      }
    }, 6000);

    undoRef.current = { timer, room };

    showToast(`"${room.name}" deleted.`, "success", {
      label: "Undo",
      onClick: () => {
        if (undoRef.current) { clearTimeout(undoRef.current.timer); undoRef.current = null; }
        setRooms(prev => [...prev, room]);
        showToast(`"${room.name}" restored.`, "info");
      },
    });
  }

  async function saveRoom(e) {
    e.preventDefault();
    setSaving(true);
    // Flatten the attachedAddons map into the array shape the backend
    // expects. Empty array = "no attached add-ons" and will clear any
    // existing pivot rows server-side on PATCH.
    const attached_addons = Object.entries(attachedAddons).map(([addonId, row]) => ({
      addon_id: Number(addonId),
      relation: row.relation,
      price:    Number(row.price ?? 0),
      qty:      Number(row.qty ?? 1),
    }));
    const payload = {
      name:                editing.name,
      category:            editing.category || "room",
      description:         editing.description,
      day_rate:            Number(editing.day_rate),
      overnight_rate:      Number(editing.overnight_rate),
      rate_24hr:           Number(editing.rate_24hr ?? 0),
      capacity:            Number(editing.capacity),
      capacity_label:      editing.capacity_label || undefined,
      quantity:            Number(editing.quantity ?? 1),
      availability_status: editing.availability_status || "available",
      beds:                editing.beds      || undefined,
      image:               editing.image     || undefined,
      features:               editing.features?.length ? editing.features : null,
      allowed_booking_types:  editing.allowed_booking_types?.length ? editing.allowed_booking_types : null,
      attached_addons,
      resort_id:              RESORT_ID,
    };
    try {
      editing.id ? await updateAdminRoom(editing.id, payload) : await createAdminRoom(payload);
      showToast(editing.id ? "Room updated." : "Room created.", "success");
      setModalOpen(false);
      load(true);
    } catch (err) {
      setSaveError(err?.response?.data?.message || "Failed to save room.");
    } finally {
      setSaving(false);
    }
  }

  // ── Skeleton loading ──────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex items-center gap-6 animate-pulse">
          <div className="h-5 w-5 rounded bg-slate-200 shrink-0"></div>
          <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0"></div>
          <div className="h-4 bg-slate-200 rounded w-32"></div>
          <div className="h-4 bg-slate-100 rounded w-10"></div>
          <div className="h-4 bg-slate-100 rounded w-16"></div>
          <div className="h-4 bg-slate-200 rounded w-20"></div>
          <div className="h-4 bg-slate-200 rounded w-20"></div>
          <div className="h-4 bg-slate-100 rounded w-20"></div>
          <div className="h-5 bg-slate-200 rounded-full w-24"></div>
        </div>
      ))}
    </div>
  );

  const TABS = [
    { key: 'rooms',  icon: 'fa-bed',            label: 'Rooms'   },
    { key: 'addons', icon: 'fa-concierge-bell', label: 'Add-ons' },
  ];

  // Add-ons tab — delegate to the existing OwnerAddons page under a
  // shared tab bar. One screen now owns everything a guest can pay for.
  if (activeTab === 'addons') {
    return (
      <>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <OwnerAddons />
      </>
    );
  }

  return (
    <>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} action={toastAction} />

      {/* ── Header card (#4 title, #9 styled count pills) ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <i className="fas fa-bed text-sky-600 text-lg"></i>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Room Management</h1>
            <p className="text-sm text-slate-500">Manage rooms, rates, and availability.</p>
            {rooms.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {[
                  { count: countRoom,     label: "Rooms",     icon: "fa-bed",            bg: "bg-sky-50 text-sky-700 border-sky-200"     },
                  { count: countCottage,  label: "Cottages",  icon: "fa-umbrella-beach", bg: "bg-amber-50 text-amber-700 border-amber-200" },
                  { count: countPavilion, label: "Pavilions", icon: "fa-archway",        bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                ].map(({ count, label, icon, bg }) => (
                  <span key={label} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${bg}`}>
                    <i className={`fas ${icon} text-[10px]`}></i>{count} {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* #13 — Bulk actions bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                {selected.size} selected
              </span>
              <button onClick={() => setBulkDeleteOpen(true)} type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition">
                <i className="fas fa-trash text-[10px]"></i>Delete
              </button>
              <button onClick={() => setSelected(new Set())} type="button"
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 transition">
                Clear
              </button>
            </div>
          )}

          <button onClick={() => load(true)} disabled={refreshing}
            className="p-2 text-slate-400 hover:text-slate-600 transition disabled:opacity-50" title="Refresh" type="button">
            <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
          </button>
          <div className="relative" ref={addMenuRef}>
            <button onClick={() => setAddMenuOpen(o => !o)} type="button"
              className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl shadow-sm text-sm font-medium transition">
              <i className="fas fa-plus"></i>Add New
              <i className={`fas fa-chevron-down text-[10px] transition-transform ${addMenuOpen ? "rotate-180" : ""}`}></i>
            </button>
            {addMenuOpen && (
              <div className="absolute right-0 top-11 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 w-48 animate-hero-fade-in opacity-0">
                {[
                  { template: BLANK,             label: "Room",     icon: "fa-bed",            color: "text-sky-600"     },
                  { template: COTTAGE_TEMPLATE,   label: "Cottage",  icon: "fa-umbrella-beach", color: "text-amber-600"   },
                  { template: PAVILION_TEMPLATE,  label: "Pavilion", icon: "fa-archway",        color: "text-emerald-600" },
                ].map(({ template, label, icon, color }) => (
                  <button key={label} type="button"
                    onClick={() => openCreate(template)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition">
                    <i className={`fas ${icon} w-4 text-center ${color}`}></i>
                    <span>New {label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error with retry */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-6 text-center">
          <i className="fas fa-exclamation-triangle text-3xl mb-3 block"></i>
          <p className="font-medium mb-3">{error}</p>
          <button onClick={() => load()} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 transition" type="button">
            <i className="fas fa-redo mr-2"></i>Retry
          </button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {ADMIN_CATEGORY_TABS.map(tab => {
          const count = tab.key === ""
            ? rooms.length
            : rooms.filter(r => getRoomCategory(r) === tab.key).length;
          return (
            <button key={tab.key}
              onClick={() => setFilterCategory(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                filterCategory === tab.key
                  ? "bg-sky-600 text-white border-sky-600 shadow"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600"
              }`}
              type="button"
            >
              <i className={`fas ${tab.icon} text-xs`}></i>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                filterCategory === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Table card ── */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-sm text-slate-600">{filterCategory ? `${filterCategory.charAt(0).toUpperCase() + filterCategory.slice(1)}s` : "Total Rooms"}</p>
            <p className="text-2xl font-semibold text-slate-900">{filtered.length}</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <input type="text" aria-label="Search rooms" placeholder="Search rooms\u2026"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
            <select value={filterAvail} onChange={e => setFilterAvail(e.target.value)}
              className="min-w-44 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm">
              <option value="">All Availability</option>
              {Object.entries(AVAIL).map(([val, { label }]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            renderSkeleton()
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <i className="fas fa-bed text-slate-200 text-4xl mb-3 block"></i>
              <p className="text-slate-400 font-medium">
                {debouncedSearch || filterAvail || filterCategory ? "No rooms match your filters." : "No rooms yet. Add your first room above."}
              </p>
            </div>
          ) : (
            <table className="min-w-full text-sm text-slate-700">
              {/* #10 — sky palette for sort headers */}
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  {/* #13 — bulk select checkbox */}
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left w-12"></th>
                  {[["Name","Name"],["Qty","Qty"],["Capacity","Capacity"],["Day Rate","Day Rate"],["Overnight Rate","Overnight Rate"],["24hr Rate","24hr Rate"],["Availability","Availability"]].map(([label,key]) => (
                    <th key={key} className="px-4 py-3 text-left">
                      <button onClick={() => { if(sortBy===key) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortBy(key);setSortDir("asc");} }}
                        className="flex items-center gap-1 hover:text-sky-600 transition-colors group" type="button">
                        {label}
                        <span className="text-slate-400 group-hover:text-sky-400">
                          {sortBy===key ? <i className={`fas fa-arrow-${sortDir==="asc"?"up":"down"} text-sky-500`}></i> : <i className="fas fa-sort opacity-40"></i>}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {paginated.map((room, idx) => {
                  const avail = room.availability_status || "available";
                  const isUnavailable = avail !== "available";
                  const isSelected = selected.has(room.id);
                  return (
                    <tr key={room.id} role="button" tabIndex={0} onClick={() => setViewRoom(room)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewRoom(room); }}}
                      className={`cursor-pointer transition-colors ${isUnavailable ? "opacity-60" : ""} ${isSelected ? "bg-sky-50/70" : idx % 2 === 1 ? "bg-slate-50/50" : ""} hover:bg-sky-50`}>
                      {/* #13 — row checkbox */}
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(room.id)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-4">
                        {room.image
                          ? <img src={room.image} alt={room.name} className="h-10 w-10 rounded-full object-cover" loading="lazy" decoding="async" />
                          : <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><i className="fas fa-bed"></i></div>
                        }
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          {room.name}
                          {(() => {
                            const cat = getRoomCategory(room);
                            const catStyle = { cottage: "bg-amber-100 text-amber-700", pavilion: "bg-emerald-100 text-emerald-700" }[cat];
                            return catStyle ? (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catStyle}`}>{cat}</span>
                            ) : null;
                          })()}
                        </div>
                        {room.capacity_label && <span className="text-xs text-slate-400">{room.capacity_label}</span>}
                        {room.allowed_booking_types?.length > 0 && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                            {room.allowed_booking_types.join("/")} only
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-center">{room.quantity ?? 1}</td>
                      <td className="px-4 py-4 text-slate-600">{room.capacity} pax</td>
                      <td className="px-4 py-4 text-slate-600">{"\u20B1"}{Number(room.day_rate).toLocaleString()}</td>
                      <td className="px-4 py-4 text-slate-600">{"\u20B1"}{Number(room.overnight_rate).toLocaleString()}</td>
                      <td className="px-4 py-4 text-slate-600">{"\u20B1"}{Number(room.rate_24hr ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4"><AvailBadge status={avail} /></td>
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(room)} className="text-sky-600 hover:text-sky-800 font-medium text-xs" type="button">Edit</button>
                          <button onClick={() => setDeleteTarget(room)} className="text-rose-500 hover:text-rose-700 font-medium text-xs" type="button">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* #6 #7 — Pagination + Showing X–Y of Z */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{showFrom}</span>–<span className="font-semibold text-slate-700">{showTo}</span> of{" "}
              <span className="font-semibold text-slate-700">{filtered.length}</span> rooms
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition" type="button">
                  <i className="fas fa-chevron-left text-[10px] mr-1"></i>Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "..." ? (
                      <span key={`dots-${i}`} className="px-2 text-slate-400 text-xs">...</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p)}
                        className={`h-11 w-11 rounded-lg text-xs font-semibold transition ${
                          page === p ? "bg-sky-600 text-white shadow" : "text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`} type="button">{p}</button>
                    )
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition" type="button">
                  Next<i className="fas fa-chevron-right text-[10px] ml-1"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── View Room Modal (#5 shared Modal, #8 stat cards) ── */}
      <Modal open={!!viewRoom} onClose={() => setViewRoom(null)} maxWidth="max-w-lg">
        {viewRoom && (() => {
          const avail = viewRoom.availability_status || "available";
          const features = (viewRoom.features || []).map(f =>
            typeof f === "string" ? { text: f, icon: "fa-check" } : f
          );
          return (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${CATEGORY_META[getRoomCategory(viewRoom)]?.color || "bg-sky-100 text-sky-600"}`}>
                    <i className={`fas ${CATEGORY_META[getRoomCategory(viewRoom)]?.icon || "fa-bed"}`}></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{viewRoom.name}</h3>
                    <p className="text-xs text-slate-400">{CATEGORY_META[getRoomCategory(viewRoom)]?.label || "Room"} Details</p>
                  </div>
                </div>
                <button onClick={() => setViewRoom(null)} className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close" type="button">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Image */}
                {viewRoom.image && (
                  <img src={viewRoom.image} alt={viewRoom.name} loading="lazy" className="w-full h-44 object-cover rounded-xl" />
                )}

                {/* Unavailable banner */}
                {avail !== "available" && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${AVAIL[avail].color}`}>
                    <i className={`fas ${AVAIL[avail].icon}`}></i>{AVAIL[avail].label}
                  </div>
                )}

                {/* #8 — Rate stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Day Rate",       value: `\u20B1${Number(viewRoom.day_rate).toLocaleString()}`,       icon: "fa-sun",   bg: "bg-amber-50",   text: "text-amber-700",   iconBg: "bg-amber-100 text-amber-500"   },
                    { label: "Overnight Rate",  value: `\u20B1${Number(viewRoom.overnight_rate).toLocaleString()}`, icon: "fa-moon",  bg: "bg-indigo-50",  text: "text-indigo-700",  iconBg: "bg-indigo-100 text-indigo-500"  },
                    { label: "24hr Rate",       value: `\u20B1${Number(viewRoom.rate_24hr ?? 0).toLocaleString()}`, icon: "fa-clock", bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-500" },
                  ].map(({ label, value, icon, bg, text, iconBg }) => (
                    <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                      <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center mx-auto mb-2`}>
                        <i className={`fas ${icon} text-xs`}></i>
                      </div>
                      <p className={`text-sm font-bold ${text}`}>{value}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Info cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Capacity",     value: viewRoom.capacity_label || `${viewRoom.capacity} pax`, icon: "fa-users",   bg: "bg-violet-50",  iconColor: "text-violet-500" },
                    { label: "Quantity",      value: `${viewRoom.quantity ?? 1} unit(s)`,                   icon: "fa-layer-group", bg: "bg-sky-50",  iconColor: "text-sky-500"    },
                    { label: "Beds",          value: viewRoom.beds || "\u2014",                             icon: "fa-bed",     bg: "bg-pink-50",    iconColor: "text-pink-500"   },
                  ].map(({ label, value, icon, bg, iconColor }) => (
                    <div key={label} className={`${bg} rounded-xl p-3 flex items-center gap-3`}>
                      <div className={`h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0 ${iconColor}`}>
                        <i className={`fas ${icon} text-xs`}></i>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Description */}
                {viewRoom.description && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{viewRoom.description}</p>
                  </div>
                )}

                {/* Booking type restrictions */}
                {viewRoom.allowed_booking_types?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-2">
                      <i className="fas fa-exclamation-triangle mr-1"></i>Booking Type Restriction
                    </p>
                    <div className="flex gap-2">
                      {viewRoom.allowed_booking_types.map(t => (
                        <span key={t} className="px-2.5 py-1 bg-white text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                          {t === "day" ? "Day only" : t === "night" ? "Night only" : "24hr only"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Features */}
                {features.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Room Features</p>
                    <div className="flex flex-wrap gap-1.5">
                      {features.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full text-xs font-medium">
                          <i className={`fas ${f.icon} text-[10px]`}></i> {f.text}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(viewRoom)} type="button"
                  className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-sm hover:bg-rose-100 transition">
                  <i className="fas fa-trash mr-1"></i>Delete
                </button>
                <button onClick={() => openDuplicate(viewRoom)} type="button"
                  className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-sm hover:bg-amber-100 transition">
                  <i className="fas fa-copy mr-1"></i>Duplicate
                </button>
                <button onClick={() => setViewRoom(null)} type="button"
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition">Close</button>
                <button onClick={() => openEdit(viewRoom)} type="button"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm transition">Edit</button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ── Edit / Create Modal ── */}
      <Modal open={modalOpen} onClose={guardedCloseModal} maxWidth="max-w-2xl">
        <form onSubmit={saveRoom} ref={formRef} className="max-h-[85vh] overflow-y-auto">
          {/* Sticky header */}
          {(() => {
            const cat = editing?.category || "room";
            const meta = CATEGORY_META[cat] || CATEGORY_META.room;
            const isEdit = !!editing?.id;
            return (
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                    <i className={`fas ${meta.icon} text-lg`}></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {isEdit ? `Edit ${meta.label}` : `Add New ${meta.label}`}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {isEdit ? `Update ${meta.label.toLowerCase()} details and rates` : `Create a new ${meta.label.toLowerCase()} listing`}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={guardedCloseModal}
                  className="h-11 w-11 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            );
          })()}

          <div className="p-6 space-y-6">

            {/* ── Section 1: Basic Information ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-sky-100 flex items-center justify-center">
                    <i className="fas fa-info-circle text-sky-500 text-[11px]"></i>
                  </span>
                  Basic Information
                </h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Name <span className="text-red-400">*</span></label>
                  <input required value={editing?.name || ""} onChange={e => setField("name", e.target.value)}
                    placeholder={
                      editing?.category === "cottage"  ? "e.g. Beachfront Cottage A" :
                      editing?.category === "pavilion" ? "e.g. Poolside Pavilion 1" :
                      "e.g. Deluxe Room 101"
                    }
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Category <span className="text-red-400">*</span></label>
                  <select value={editing?.category || "room"} onChange={e => setField("category", e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm transition">
                    <option value="room">Room</option>
                    <option value="cottage">Cottage</option>
                    <option value="pavilion">Pavilion</option>
                    <option value="tent">Tent</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Description <span className="text-red-400">*</span></label>
                  <textarea required rows={3} value={editing?.description || ""} onChange={e => setField("description", e.target.value)}
                    placeholder="Brief description shown to guests..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 resize-none transition" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Availability Status <span className="text-red-400">*</span></label>
                  <select value={editing?.availability_status || "available"} onChange={e => setField("availability_status", e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm transition">
                    {Object.entries(AVAIL).map(([val, { label }]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  {editing?.availability_status && editing.availability_status !== "available" && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <i className="fas fa-exclamation-triangle shrink-0"></i>
                      This room won't appear for booking until set back to Available.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 2: Pricing ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-emerald-100 flex items-center justify-center">
                    <i className="fas fa-peso-sign text-emerald-500 text-[11px]"></i>
                  </span>
                  Pricing
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    ["Day Rate",       "day_rate",       "fa-sun",   "6AM\u20136PM" ],
                    ["Overnight Rate", "overnight_rate", "fa-moon",  "6PM\u20137AM" ],
                    ["24hr Rate",      "rate_24hr",      "fa-clock", "Full day"     ],
                  ].map(([label, key, icon, sub]) => (
                    <div key={key} className="bg-white rounded-lg border border-slate-200 p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <i className={`fas ${icon} text-slate-400 text-xs`}></i>
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
                        <span className="text-red-400 text-xs">*</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{"\u20B1"}</span>
                        <input required type="number" min={0}
                          value={editing?.[key] ?? ""}
                          onChange={e => setField(key, e.target.value)}
                          className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:bg-white text-sm font-medium transition" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">{sub}</p>
                    </div>
                  ))}
                </div>
                {editing && (() => {
                  const d = Number(editing.day_rate) || 0;
                  const n = Number(editing.overnight_rate) || 0;
                  const h = Number(editing.rate_24hr) || 0;
                  const warnings = [];
                  if (d > 0 && n > 0 && n < d) warnings.push("Overnight rate is lower than day rate");
                  if (n > 0 && h > 0 && h < n) warnings.push("24hr rate is lower than overnight rate");
                  if (d > 0 && h > 0 && h < d) warnings.push("24hr rate is lower than day rate");
                  return warnings.length > 0 ? (
                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
                      <i className="fas fa-exclamation-triangle mt-0.5 shrink-0"></i>
                      <div>{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* ── Section 3: Capacity & Details ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-violet-100 flex items-center justify-center">
                    <i className="fas fa-users text-violet-500 text-[11px]"></i>
                  </span>
                  Capacity & Details
                </h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Capacity (pax) <span className="text-red-400">*</span></label>
                  <input required type="number" min={1} value={editing?.capacity ?? ""} onChange={e => setField("capacity", e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Capacity Label</label>
                  <input placeholder={"e.g. 4\u20135 pax"} value={editing?.capacity_label || ""} onChange={e => setField("capacity_label", e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Quantity (units) <span className="text-red-400">*</span></label>
                  <input required type="number" min={1} value={editing?.quantity ?? ""} onChange={e => setField("quantity", e.target.value)}
                    placeholder="e.g. 12 for Small Cottages"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Beds</label>
                  <input placeholder="e.g. 1 King Bed" value={editing?.beds || ""} onChange={e => setField("beds", e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition" />
                </div>
              </div>
            </div>

            {/* ── Section 4: Media ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-pink-100 flex items-center justify-center">
                    <i className="fas fa-image text-pink-500 text-[11px]"></i>
                  </span>
                  Media
                </h3>
              </div>
              <div className="p-5 space-y-3">
                {editing?.image && (
                  <div className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-lg">
                    <img src={editing.image} alt="Current" className="h-20 w-28 rounded-lg object-cover border border-slate-100" loading="lazy" decoding="async"
                      onError={e => { e.target.style.display = "none"; }} />
                    <div className="text-xs text-slate-500 min-w-0 flex-1">
                      <p className="font-semibold text-slate-700 mb-0.5">Current image</p>
                      <p className="truncate text-slate-400">{editing.image}</p>
                    </div>
                    <button type="button" onClick={() => setField("image", "")}
                      className="text-xs text-rose-500 hover:text-rose-700 shrink-0 px-2 py-1 hover:bg-rose-50 rounded-md transition">
                      <i className="fas fa-trash mr-1"></i>Remove
                    </button>
                  </div>
                )}
                <ImageUpload
                  value={editing?.image || ""}
                  onChange={url => setField("image", url)}
                  folder="rooms"
                  label="Upload Room Image"
                />
              </div>
            </div>

            {/* ── Section 5: Features ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-amber-100 flex items-center justify-center">
                    <i className="fas fa-sparkles text-amber-500 text-[11px]"></i>
                  </span>
                  Features
                  {(editing?.features || []).length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full font-bold">{editing.features.length}</span>
                  )}
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex gap-2">
                  <div className="relative">
                    <button ref={iconButtonRef} type="button" onClick={() => setIconPickerOpen(p => !p)}
                      aria-haspopup="true"
                      aria-expanded={iconPickerOpen}
                      aria-label="Pick an icon for this feature"
                      className="h-[42px] px-3 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 shrink-0 transition focus:outline-none focus:ring-2 focus:ring-sky-400">
                      <i className={`fas ${selectedIcon} text-sky-500`} aria-hidden="true"></i>
                      <i className="fas fa-chevron-down text-[10px] text-slate-400" aria-hidden="true"></i>
                    </button>
                    {/* Portal to document.body so the popover escapes the
                        modal's transform ancestor. The Modal component's
                        dialog div has animate-hero-fade-in which sets a
                        transform — and a transformed ancestor makes any
                        descendant position:fixed anchor to it instead of
                        the viewport (CSS containing-block rules). Without
                        the portal, the popover flew off to the right edge
                        of the modal rather than sitting below the trigger. */}
                    {iconPickerOpen && createPortal(
                      <div
                        ref={iconPickerRef}
                        role="listbox"
                        aria-label="Feature icon options"
                        style={{ position: 'fixed', top: iconPickerPos.top, left: iconPickerPos.left }}
                        className="z-[10000] bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 grid grid-cols-5 gap-1 w-52"
                      >
                        {FEATURE_ICONS.map(({ icon, label }) => (
                          <button key={icon} type="button" title={label}
                            aria-label={label}
                            aria-selected={selectedIcon === icon}
                            onClick={() => { setSelectedIcon(icon); setIconPickerOpen(false); }}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition ${selectedIcon === icon ? "bg-sky-100 text-sky-600 ring-2 ring-sky-300" : "hover:bg-slate-100 text-slate-500"}`}>
                            <i className={`fas ${icon}`} aria-hidden="true"></i>
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                  <input
                    value={featureInput}
                    onChange={e => setFeatureInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                    placeholder="e.g. Air Conditioning"
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-300 transition"
                  />
                  <button type="button" onClick={addFeature}
                    className="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-sm font-semibold shrink-0 transition">
                    <i className="fas fa-plus mr-1 text-xs"></i>Add
                  </button>
                </div>

                {(editing?.features || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editing.features.map((f, i) => (
                      <div key={i} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-sm">
                        <i className={`fas ${f.icon || "fa-check"} text-sky-500 text-[10px]`}></i>
                        <span>{f.text}</span>
                        <div className="flex items-center gap-0.5 ml-1 border-l border-slate-200 pl-1.5">
                          <button type="button" onClick={() => moveFeature(i, -1)} disabled={i === 0}
                            className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition" title="Move up">
                            <i className="fas fa-chevron-up text-[9px]"></i>
                          </button>
                          <button type="button" onClick={() => moveFeature(i, 1)} disabled={i === editing.features.length - 1}
                            className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition" title="Move down">
                            <i className="fas fa-chevron-down text-[9px]"></i>
                          </button>
                          <button type="button" onClick={() => removeFeature(i)}
                            className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition" title="Remove">
                            <i className="fas fa-times text-[9px]"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(editing?.features || []).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-3 bg-white rounded-lg border border-dashed border-slate-200">
                    <i className="fas fa-sparkles mr-1"></i>No features added yet. Pick an icon and type above.
                  </p>
                )}
              </div>
            </div>

            {/* ── Section 6: Booking Types (#3 — fixed checkbox icon color) ── */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-indigo-100 flex items-center justify-center">
                    <i className="fas fa-calendar-check text-indigo-500 text-[11px]"></i>
                  </span>
                  Booking Types
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-slate-400">Leave all unchecked to allow all types.</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "day",   label: "Day",      sub: "6AM \u2013 6PM",  icon: "fa-sun",   checkedBg: "bg-amber-50 border-amber-300 ring-1 ring-amber-200",   checkedIcon: "text-amber-600"   },
                    { key: "night", label: "Night",    sub: "6PM \u2013 7AM",  icon: "fa-moon",  checkedBg: "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200", checkedIcon: "text-indigo-600"  },
                    { key: "24hr",  label: "24 Hours", sub: "Full day",        icon: "fa-clock", checkedBg: "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200", checkedIcon: "text-emerald-600" },
                  ].map(({ key, label, sub, icon, checkedBg, checkedIcon }) => {
                    const checked = (editing?.allowed_booking_types ?? []).includes(key);
                    return (
                      <label key={key} className="relative cursor-pointer select-none">
                        <input type="checkbox" checked={checked}
                          onChange={e => {
                            const current = editing?.allowed_booking_types ?? [];
                            const next = e.target.checked ? [...current, key] : current.filter(t => t !== key);
                            setField("allowed_booking_types", next.length ? next : null);
                          }}
                          className="sr-only"
                        />
                        <div className={`flex flex-col items-center gap-1.5 p-3.5 bg-white border border-slate-200 rounded-lg transition-all hover:border-slate-300 ${checked ? checkedBg : ""}`}>
                          <i className={`fas ${icon} ${checked ? checkedIcon : "text-slate-400"} transition-colors`}></i>
                          <span className="text-xs font-semibold text-slate-700">{label}</span>
                          <span className="text-[10px] text-slate-400">{sub}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {editing?.allowed_booking_types?.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <i className="fas fa-exclamation-triangle shrink-0"></i>
                    Guests can only book: {editing.allowed_booking_types.join(", ")}.
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 7: Attached add-ons ───────────────────────────
                Each catalog add-on gets a three-way status (None /
                Optional / Package) + per-room price override + qty.
                Package items auto-attach to every booking of this
                room (bundled); Optional only surfaces in this room's
                picker when a guest is booking it. Priced here at the
                room's per-room rate, not the addon catalog's default. */}
            {addonCatalog.length > 0 && (() => {
              const basePackageTotal = Object.entries(attachedAddons)
                .filter(([, row]) => row.relation === 'package')
                .reduce((sum, [, row]) => sum + (Number(row.price) || 0) * (Number(row.qty) || 1), 0);
              const baseDay = Number(editing?.day_rate ?? 0);
              return (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 bg-white">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md bg-amber-100 flex items-center justify-center">
                        <i className="fas fa-link text-amber-500 text-[11px]"></i>
                      </span>
                      Attached Add-ons
                    </h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <p className="text-xs text-slate-500">
                      <strong>Package</strong> = bundled into the room rate, auto-added to every booking.
                      <strong className="ml-2">Optional</strong> = shown in this room's add-on picker for guests to opt into.
                    </p>

                    <div className="space-y-2">
                      {addonCatalog.map(cat => {
                        const row      = attachedAddons[cat.id];
                        const relation = row?.relation ?? null;
                        return (
                          <div key={cat.id}
                            className={`rounded-lg border bg-white p-3 transition-colors ${
                              relation === 'package'  ? 'border-emerald-300 ring-1 ring-emerald-100' :
                              relation === 'optional' ? 'border-sky-300 ring-1 ring-sky-100' :
                              'border-slate-200'
                            }`}>
                            <div className="flex items-center gap-3 flex-wrap">
                              <i className={`fas ${cat.icon || 'fa-tag'} text-slate-500 w-5 text-center`} aria-hidden="true"></i>
                              <span className="font-medium text-slate-700 text-sm min-w-[140px]">{cat.name}</span>

                              {/* Status picker */}
                              <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 text-[11px] font-semibold">
                                {[
                                  { key: null,        label: 'None' },
                                  { key: 'optional',  label: 'Optional' },
                                  { key: 'package',   label: 'Package' },
                                ].map(opt => {
                                  const active = relation === opt.key;
                                  return (
                                    <button
                                      key={opt.label}
                                      type="button"
                                      onClick={() => setAddonRelation(cat.id, opt.key)}
                                      aria-pressed={active}
                                      className={`px-3 py-1.5 transition-colors ${
                                        active
                                          ? opt.key === 'package'  ? 'bg-emerald-500 text-white' :
                                            opt.key === 'optional' ? 'bg-sky-500 text-white' :
                                                                     'bg-slate-500 text-white'
                                          : 'bg-white text-slate-500 hover:bg-slate-50'
                                      }`}>
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Per-room price + qty, only meaningful when attached */}
                              {relation && (
                                <>
                                  <div className="flex items-center gap-1.5 ml-auto">
                                    <span className="text-[11px] text-slate-400">₱</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={row.price}
                                      onChange={e => setAddonField(cat.id, 'price', e.target.value)}
                                      className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-400"
                                      aria-label={`${cat.name} price for this room`}
                                    />
                                    <span className="text-[11px] text-slate-400">×</span>
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={row.qty}
                                      onChange={e => setAddonField(cat.id, 'qty', e.target.value)}
                                      className="w-14 px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-400"
                                      aria-label={`${cat.name} qty for this room`}
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bundled-total preview — shows what the guest sees */}
                    {basePackageTotal > 0 && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between text-emerald-800">
                          <span className="font-medium flex items-center gap-2">
                            <i className="fas fa-box text-emerald-500"></i>
                            Bundled day rate (shown to guest)
                          </span>
                          <span className="font-bold tabular-nums">
                            ₱{(baseDay + basePackageTotal).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-1">
                          ₱{baseDay.toLocaleString()} base + ₱{basePackageTotal.toLocaleString()} package add-ons
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Live Preview ── */}
            {editing && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-white">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center">
                      <i className="fas fa-eye text-slate-500 text-[11px]"></i>
                    </span>
                    Guest Card Preview
                  </h3>
                </div>
                <div className="p-5">
                  <RoomPreview room={editing} />
                </div>
              </div>
            )}

            {saveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <i className="fas fa-exclamation-circle shrink-0"></i>{saveError}
              </div>
            )}

          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
            <button type="button" onClick={guardedCloseModal}
              className="px-5 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium transition">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 shadow-sm transition">
              {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : <><i className="fas fa-check mr-2"></i>Save {CATEGORY_META[editing?.category || "room"]?.label}</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Room"
        message={<>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* #2 — Discard unsaved changes confirmation */}
      <ConfirmDialog
        open={discardOpen}
        title="Discard Changes"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        variant="danger"
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardOpen(false)}
      />

      {/* #13 — Bulk delete confirmation */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete Selected Rooms"
        message={<>Are you sure you want to delete <strong>{selected.size}</strong> room(s)? This cannot be undone.</>}
        confirmLabel={`Delete ${selected.size} Room(s)`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
    </>
  );
}
