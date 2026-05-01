import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { getAdminGallery, updateAdminGallery, batchCreateGallery, renameCategoryGallery, toggleCategoryHidden, batchFeaturedGallery, deleteAdminGallery, getAdminContacts, markAdminContactRead, replyAdminContact, updateAdminContent, getAdminReviews, updateAdminReview, deleteAdminReview, getResortAmenities, createResortAmenity, updateResortAmenity, deleteResortAmenity } from "../../lib/adminApi";
import { api } from "../../lib/api";
import { RESORT_ID } from "../../lib/config.js";
import MediaPicker from "../../components/ui/MediaPicker.jsx";
import { isVideoUrl, uploadFile } from "../../lib/uploadApi.js";
import Modal from "../../components/modals/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import useDebounce from "../../hooks/useDebounce.js";
import OwnerAnnouncements from "./Announcements.jsx";
import { TabBar } from "./Users.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";

// Matches REVIEWS_SEEN_KEY in useStaffNotifications.js — viewing the
// Reviews tab here timestamps "reviews seen up to now", which clears
// the bell's "N new reviews this week" counter. Same constant lives in
// pages/owner/Reviews.jsx (the standalone page that's now a redirect
// target — kept in sync by hand since both surfaces still exist).
const REVIEWS_SEEN_KEY = "aplaya_reviews_last_seen_at";

// ─── Persistence key ──────────────────────────────────────────────────────────
const CONTENT_KEY = "aplaya_page_content_v2";

// ─── Default content (mirrors the actual hardcoded values in Home.jsx / Resort.jsx) ─
const DEFAULT_CONTENT = {
  // ── Site-wide ──────────────────────────────────────────────────────────────
  navbar: {
    siteName:  "Aplaya Cottages & Rentals",
    logoImage: "/logo.jpg",
  },
  footer: {
    tagline:   "Your perfect tropical getaway offering luxury accommodations and unforgettable experiences.",
    address:   "Purok 7 Sitio Pobres Brgy Munting Mapino, Naic, Philippines, 4110",
    phone:     "+63 908 191 4721",
    email:     "aplayabeachresortph@gmail.com",
    hours: [
      { day: "Monday - Sunday", time: "7:00 AM - 9:00 PM" },
    ],
    facebook:  "https://www.facebook.com/aplayabeach",
    instagram: "",
    twitter:   "",
    tiktok:    "",
    copyright: "© 2026 Aplaya Cottages & Rentals. All rights reserved.",
  },
  // ── Home page (/home) ──────────────────────────────────────────────────────
  // Defaults sync with src/pages/Home.jsx HOME_DEFAULTS so the website
  // builder pre-fills with the same copy visitors see on the live site
  // when no override has been saved. Specifics over hyperbole; PayMaya
  // intentionally omitted (no longer accepted — only GCash + cash).
  home_hero: {
    background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    // Still-frame fallback for video heroes — used when the
    // visitor prefers reduced motion (a11y) and as the buffering
    // frame on slow connections. Only meaningful when background
    // is a video; the editor surfaces the picker conditionally.
    poster:     "",
    title:      "Aplaya Beach Resort",
    subtitle:   "Beachfront. Cottages, pavilions, rooms. Day, overnight, or 24-hour stays.",
    ctaText:    "See rooms & rates",
  },
  home_why: {
    sectionTitle:    "What you get",
    sectionSubtitle: "The basics, done right. No add-on fees for what should be included.",
    features: [
      { icon: "fa-umbrella-beach", title: "Beachfront cottages",   desc: "Private cottages and pavilions a few steps from the water — book the one that fits your group size." },
      { icon: "fa-clock",          title: "Three booking windows", desc: "Day visit (6 AM–6 PM), overnight (6 PM–7 AM), or full 24-hour. Pick the one that matches the trip." },
      { icon: "fa-mobile-screen",  title: "Online or at the gate", desc: "Reserve online with GCash, or pay cash on arrival. Same rates either way." },
      // Removed "Entrance covered too" card — falsely claimed
      // entrance fee was built into the booking total. In reality
      // bookings.total stores room rate only; entrance_fee is a
      // separate column collected at check-in. Defaults must stay
      // in sync with src/pages/Home.jsx HOME_DEFAULTS.why.features.
    ],
  },
  // home_resorts (PLURAL) was a legacy multi-resort cards block ("Our
  // Beach Resorts" listing fake Cavite/Cebu/Bohol locations) that
  // Home.jsx never consumed — Home reads page_home_resort (SINGULAR)
  // for the about-the-resort block instead. Audit caught it because
  // the CMS editor still rendered the section, exposing made-up
  // claims about a "collection of stunning beach resorts" that
  // Aplaya does not have. Removed entirely; the HomeResortsEditor
  // function below is now unreferenced and can be deleted in a
  // follow-up cleanup.

  // home_resort — "About the resort" / "Our resorts" card block on
  // Home. Shape is { sectionTitle, sectionSubtitle, cards: [{...}] }
  // so the section can scale from one resort today to N resorts
  // later (e.g. Cavite + Cebu + Bohol) without code changes — owner
  // adds cards through the editor. Defaults must stay in sync with
  // src/pages/Home.jsx HOME_DEFAULTS.resort.
  //
  // CMS overrides saved against the OLD singular shape
  // (top-level name/desc/image/badge/ctaText) are still consumed by
  // Home.jsx via normalizeResortContent — no DB migration needed.
  home_resort: {
    sectionTitle:    "About the resort",
    sectionSubtitle: "A small beachfront resort on the Cavite coast — built for day trips, family getaways, and overnight stays without the metro hotel markup.",
    cards: [
      {
        id:       "aplaya-cavite",
        name:     "Aplaya Beach Resort Cavite",
        location: "Naic, Cavite",
        desc:     "Private cottages, pavilions, and rooms a few steps from the water. Parking is included with every booking. Day rate, overnight, and 24-hour options — pick the window that fits the trip.",
        image:    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1280&q=80",
        badge:    "Now Open",
        ctaText:  "Explore & Book Now",
        link:     "/resort",
      },
    ],
  },
  home_cta: {
    title:      "Ready to book?",
    subtitle:   "Pick a date and a room — most slots can be reserved in under a minute.",
    buttonText: "Book a stay",
  },
  // ── Resort page (/resort) ──────────────────────────────────────────────────
  // Defaults sync with src/pages/Resort.jsx DEFAULT_PC. CLAUDE.md
  // hazard note: editing one without the other creates a "live site
  // shows X, builder pre-fills Y" mismatch. Audit-flagged AI-template
  // copy ("Welcome to Paradise", "perfect blend of luxury", "tropical
  // paradise", "luxurious accommodations") replaced with fact-led
  // language. Aplaya is a small beachfront in Naic, Cavite — no
  // pool, no luxury accommodations, marketing shouldn't claim them.
  resort_hero: {
    background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80",
    // Still-frame fallback used when `background` is a video and
    // the visitor prefers reduced motion. See HOME_DEFAULTS.hero
    // notes — same a11y contract.
    poster:     "",
    title:      "Aplaya Beach Resort",
    subtitle:   "Beachfront. Cottages, pavilions, rooms. Day, overnight, or 24-hour stays.",
    ctaText:    "See rooms & rates",
  },
  resort_about: {
    title:      "About the resort",
    paragraph1: "Aplaya is a family-run beachfront resort in Naic, Cavite — about two hours south of Manila. We rent cottages, pavilions, and rooms by the day, the night, or the full 24 hours.",
    paragraph2: "Parking is included with every booking. The room rate is shown upfront online; a per-head entrance fee is collected at the gate when you arrive — you'll see both totals before you pay.",
    image:      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80",
    // Poster still for video about-image (same role as hero.poster).
    imagePoster: "",
  },
  resort_rooms: {
    sectionTitle:    "Rooms, cottages, and pavilions",
    sectionSubtitle: "Pick what fits your group size and the kind of trip you're planning.",
  },
  resort_contact: {
    // Real Aplaya address (Naic, Cavite). Was a "123 Beachfront
    // Avenue, Coastal City, Paradise Island" placeholder before —
    // would have shipped to live if the owner never visited the CMS.
    address:        "Purok 7 Sitio Pobres Brgy Munting Mapino, Naic, Cavite, 4110",
    phone:          "+63 908 191 4721",
    email:          "aplayabeachresortph@gmail.com",
    directions_url: "",
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
  // ── Rooms page (/rooms) ────────────────────────────────────────────────────
  rooms_hero: {
    background: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2070&q=80",
    title: "Our Luxurious Accommodations",
    subtitle: "Discover the perfect room for your stay at Aplaya Beach Resort.",
  },
  // ── Gallery page (/gallery) ────────────────────────────────────────────────
  gallery_hero: {
    background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80",
    title: "Our Photo Gallery",
    subtitle: "A visual journey through the beauty and luxury of Aplaya Beach Resort.",
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


const PAGE_SIZE = 10;

function ImagePreview({ url }) {
  if (!url) return null;
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        muted playsInline
        className="mt-2 w-full h-32 object-cover rounded-lg border border-slate-200"
      />
    );
  }
  return (
    <img
      src={url}
      alt="preview"
      className="mt-2 w-full h-32 object-cover rounded-lg border border-slate-200"
      onError={e => { e.target.style.display = "none"; }}
    />
  );
}

function Field({ label, value, onChange, type = "text", rows, placeholder, maxLength }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {rows ? (
        <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} maxLength={maxLength}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} maxLength={maxLength}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
      )}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function SectionCard({ icon, title, badge, children, onEdit, editing, onSave, onCancel, visible, onToggleVisible }) {
  const hideable = visible !== undefined;
  // Confirm-before-save gate. Save button opens the confirm; on
  // confirm we fire the parent's onSave. One source of truth so
  // every editable CMS section gets the gate without each call site
  // wiring its own dialog. See pages-wide policy on mutating
  // actions (the CLAUDE.md note).
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  return (
    <div className={`bg-white rounded-lg shadow border ${editing ? "border-brand" : visible === false ? "border-slate-200 opacity-60" : "border-slate-200"} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${visible === false ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-brand"}`}>
            <i className={`fas ${icon} text-sm`} aria-hidden="true"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-800 text-sm">{title}</p>
              {hideable && visible === false && (
                <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">Hidden</span>
              )}
            </div>
            {badge && <span className="text-xs text-slate-400">{badge}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hideable && !editing && (
            <button
              onClick={onToggleVisible}
              title={visible ? "Hide section" : "Show section"}
              className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                visible
                  ? "bg-slate-100 hover:bg-yellow-50 hover:text-yellow-600 text-slate-500"
                  : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
              }`}
            >
              <i className={`fas ${visible ? "fa-eye-slash" : "fa-eye"} text-xs`} aria-hidden="true"></i>
              {visible ? "Hide" : "Show"}
            </button>
          )}
          {!editing && (
            <button
              onClick={onEdit}
              className="text-xs bg-slate-100 hover:bg-brand hover:text-white text-slate-600 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <i className="fas fa-pen text-xs" aria-hidden="true"></i> Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {children}
        {editing && (
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
            <button onClick={onCancel}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => setSaveConfirmOpen(true)}
              className="px-4 py-2 text-sm bg-brand hover:bg-brand-dark text-white rounded-lg flex items-center gap-2">
              <i className="fas fa-check text-xs" aria-hidden="true"></i> Save Changes
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={saveConfirmOpen}
        title={`Save changes to "${title}"?`}
        message="The change goes live on the public site immediately. You can re-edit at any time."
        confirmLabel="Save changes"
        variant="info"
        onConfirm={() => { setSaveConfirmOpen(false); onSave?.(); }}
        onCancel={() => setSaveConfirmOpen(false)}
      />
    </div>
  );
}

// ─── Individual section editors ───────────────────────────────────────────────

function HeroPreview({ bg, title, subtitle, extra }) {
  return (
    <div className="relative rounded-lg overflow-hidden h-36 bg-slate-200 mt-4 border border-slate-200">
      {isVideoUrl(bg)
        ? <video src={bg} autoPlay muted loop playsInline className="w-full h-full object-cover" />
        : bg
          ? <img src={bg} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
          : <div className="w-full h-full bg-slate-300" />
      }
      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4">
        <p className="font-bold text-sm leading-snug line-clamp-2">{title || <span className="opacity-40 italic">Title</span>}</p>
        <p className="text-xs text-white/75 mt-1 line-clamp-2">{subtitle || <span className="opacity-40 italic">Subtitle</span>}</p>
        {extra}
      </div>
      <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">Live Preview</span>
    </div>
  );
}

function NavbarEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  const LogoDisplay = ({ image, name, size = "h-8" }) =>
    image
      ? <img src={image} alt={name} className={`${size} w-auto object-contain`} onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
      : <span className="text-2xl">🏖️</span>;

  return (
    <SectionCard icon="fa-bars" title="Navbar / Brand" badge="Site-wide · all pages" editing={editing}
      onEdit={() => { setForm(content); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="flex items-center gap-3 py-2">
          <LogoDisplay image={content.logoImage} name={content.siteName} />
          <span className="text-lg font-bold text-blue-600">{content.siteName}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo section — compact preview + upload */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Logo Image</label>
              <div className="flex items-start gap-4">
                {/* Small logo preview */}
                <div className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {form.logoImage ? (
                    <img src={form.logoImage} alt="Logo" className="h-full w-full object-contain p-1.5" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                  ) : (
                    <div className="text-center">
                      <i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i>
                      <p className="text-[9px] text-slate-300 mt-0.5">No logo</p>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <MediaPicker
                    value={form.logoImage}
                    onChange={url => setForm(p => ({ ...p, logoImage: url }))}
                    previousUrl={content.logoImage}
                    folder="logo"
                    accept="image/*"
                    label="Upload Logo"
                  />
                  <p className="text-[10px] text-slate-400">PNG with transparent background recommended.</p>
                  {form.logoImage && (
                    <button type="button" onClick={() => setForm(p => ({ ...p, logoImage: "" }))}
                      className="text-[10px] text-red-400 hover:text-red-600 transition flex items-center gap-1">
                      <i className="fas fa-times text-[8px]" aria-hidden="true"></i> Remove logo
                    </button>
                  )}
                </div>
              </div>
            </div>
            <Field label="Site Name" value={form.siteName} onChange={f("siteName")} />
          </div>
          {/* Live preview */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-white px-4 h-14 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <LogoDisplay image={form.logoImage} name={form.siteName} size="h-7" />
                <span className="text-base font-bold text-blue-600">{form.siteName}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>Resort</span><span>Rooms</span><span>Gallery</span>
                <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-md">Book Now</span>
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 py-1 bg-slate-50">Live Preview</p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function FooterEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));
  const updateHour = (i, key, val) =>
    setForm(p => ({ ...p, hours: p.hours.map((h, hi) => hi === i ? { ...h, [key]: val } : h) }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-shoe-prints" title="Footer" badge="Site-wide · all pages" editing={editing}
      onEdit={() => { setForm(content); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700 italic line-clamp-2">&ldquo;{content.tagline}&rdquo;</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Contact card */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Contact</p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5"><i className="fas fa-map-marker-alt text-brand w-3 text-center text-[10px]" aria-hidden="true"></i>{content.address || <span className="text-slate-300 italic">Not set</span>}</p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5"><i className="fas fa-phone text-brand w-3 text-center text-[10px]" aria-hidden="true"></i>{content.phone || <span className="text-slate-300 italic">Not set</span>}</p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5"><i className="fas fa-envelope text-brand w-3 text-center text-[10px]" aria-hidden="true"></i>{content.email || <span className="text-slate-300 italic">Not set</span>}</p>
            </div>
            {/* Hours card */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Hours</p>
              {(content.hours || []).map((h, i) => (
                <p key={i} className="text-xs text-slate-600"><span className="font-medium">{h.day}</span> · {h.time}</p>
              ))}
              {(!content.hours || content.hours.length === 0) && <p className="text-xs text-slate-300 italic">Not set</p>}
            </div>
            {/* Social card */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Social</p>
              <div className="flex items-center gap-2">
                {[
                  { key: "facebook", icon: "fa-facebook-f", color: "text-blue-600" },
                  { key: "instagram", icon: "fa-instagram", color: "text-pink-500" },
                  { key: "twitter", icon: "fa-twitter", color: "text-sky-400" },
                  { key: "tiktok", icon: "fa-tiktok", color: "text-slate-800" },
                ].map(s => (
                  <span key={s.key} className={`h-7 w-7 rounded-full flex items-center justify-center text-xs ${content[s.key] ? `bg-slate-100 ${s.color}` : "bg-slate-50 text-slate-200"}`}>
                    <i className={`fab ${s.icon}`}></i>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">{content.copyright}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Basic Info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span className="h-5 w-5 rounded-md bg-blue-100 flex items-center justify-center">
                  <i className="fas fa-quote-left text-blue-500 text-[10px]" aria-hidden="true"></i>
                </span>
                Basic Info
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tagline" value={form.tagline} onChange={f("tagline")} rows={2} />
              <Field label="Copyright Line" value={form.copyright} onChange={f("copyright")} />
            </div>
          </div>

          {/* Contact Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span className="h-5 w-5 rounded-md bg-sky-100 flex items-center justify-center">
                  <i className="fas fa-phone text-sky-500 text-[10px]" aria-hidden="true"></i>
                </span>
                Contact Details
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Address" value={form.address} onChange={f("address")} />
              <Field label="Phone" value={form.phone} onChange={f("phone")} />
              <Field label="Email" value={form.email} onChange={f("email")} />
            </div>
          </div>

          {/* Opening Hours */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span className="h-5 w-5 rounded-md bg-amber-100 flex items-center justify-center">
                  <i className="fas fa-clock text-amber-500 text-[10px]" aria-hidden="true"></i>
                </span>
                Opening Hours
              </h3>
              <button type="button"
                onClick={() => setForm(p => ({ ...p, hours: [...(p.hours || []), { day: "", time: "" }] }))}
                className="text-xs text-brand hover:underline flex items-center gap-1">
                <i className="fas fa-plus text-[10px]" aria-hidden="true"></i> Add Row
              </button>
            </div>
            <div className="p-4 space-y-2">
              {(form.hours || []).map((h, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={h.day} onChange={e => updateHour(i, "day", e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    placeholder="Day(s) e.g. Monday - Sunday" />
                  <input value={h.time} onChange={e => updateHour(i, "time", e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    placeholder="Hours e.g. 7:00 AM - 9:00 PM" />
                  {(form.hours || []).length > 1 && (
                    <button type="button"
                      onClick={() => setForm(p => ({ ...p, hours: p.hours.filter((_, hi) => hi !== i) }))}
                      className="text-red-400 hover:text-red-600 transition-colors p-1 shrink-0">
                      <i className="fas fa-times text-xs" aria-hidden="true"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Social Media */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span className="h-5 w-5 rounded-md bg-pink-100 flex items-center justify-center">
                  <i className="fas fa-share-alt text-pink-500 text-[10px]" aria-hidden="true"></i>
                </span>
                Social Media Links
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Facebook URL"  value={form.facebook  || ""} onChange={f("facebook")} />
              <Field label="Instagram URL" value={form.instagram || ""} onChange={f("instagram")} />
              <Field label="Twitter URL"   value={form.twitter   || ""} onChange={f("twitter")} />
              <Field label="TikTok URL"    value={form.tiktok    || ""} onChange={f("tiktok")} />
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function HomeHeroEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-image" title="Hero Section" badge="Home page · /" editing={editing}
      onEdit={() => { setForm(content); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="relative rounded-lg overflow-hidden h-28 bg-slate-100">
          {isVideoUrl(content.background)
            ? <video src={content.background} muted playsInline className="w-full h-full object-cover" />
            : <img src={content.background} alt="hero bg" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
          }
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4">
            <p className="font-bold text-sm leading-tight">{content.title}</p>
            <p className="text-xs text-white/80 mt-1 line-clamp-1">{content.subtitle}</p>
            {content.ctaText && <span className="mt-1.5 text-xs bg-blue-600 px-2 py-0.5 rounded">{content.ctaText}</span>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Background Image / Video</label>
            <div className="flex items-start gap-4">
              <div className="h-20 w-32 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                {form.background ? (
                  isVideoUrl(form.background)
                    ? <video src={form.background} muted playsInline className="h-full w-full object-cover" />
                    : <img src={form.background} alt="Background" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <MediaPicker
                  value={form.background}
                  onChange={url => setForm(p => ({ ...p, background: url }))}
                  previousUrl={content.background}
                  folder="hero"
                  accept="image/*,video/*"
                  label="Choose Background"
                />
                <p className="text-[10px] text-slate-400">Recommended: 1920×1080 or wider. Supports images and videos.</p>
              </div>
            </div>
          </div>

          {/* Poster picker — only meaningful when the background is
              a video. Two reasons to set it:
                1. Visitors with prefers-reduced-motion get the still
                   instead of the autoplay video (the page would
                   otherwise render a broken image element pointing
                   at the video URL).
                2. It's the frame the browser shows while the video
                   is buffering on slow connections.
              Hidden when background is an image — there's no video
              to fall back from. */}
          {isVideoUrl(form.background) && (
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Poster Image <span className="text-slate-400 normal-case tracking-normal">(fallback for reduced motion)</span>
              </label>
              <div className="flex items-start gap-4">
                <div className="h-20 w-32 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {form.poster ? (
                    <img src={form.poster} alt="Poster" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                  ) : (
                    <div className="text-center"><i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i><p className="text-[9px] text-slate-300 mt-0.5">No poster</p></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <MediaPicker
                    value={form.poster || ""}
                    onChange={url => setForm(p => ({ ...p, poster: url }))}
                    previousUrl={content.poster}
                    folder="hero"
                    accept="image/*"
                    label="Choose Poster"
                  />
                  <p className="text-[10px] text-slate-400">A still frame from your video, or any representative image. Skipped: visitors who can't see the video get only a dark hero.</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" value={form.title} onChange={f("title")} />
            <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
            <Field label="CTA Button Text" value={form.ctaText || ""} onChange={f("ctaText")} placeholder="e.g. Book Now" />
          </div>
          <HeroPreview
            bg={form.background}
            title={form.title}
            subtitle={form.subtitle}
            extra={form.ctaText ? <span className="mt-1.5 text-xs bg-blue-600 px-2 py-0.5 rounded">{form.ctaText}</span> : null}
          />
        </div>
      )}
    </SectionCard>
  );
}

// ─── HomeResortEditor ────────────────────────────────────────────────────────
// Multi-card editor for the "About the resort" / "Our resorts" block
// on Home. Shape is { sectionTitle, sectionSubtitle, cards: [{...}] }
// — one card today, N cards if/when the resort expands to multiple
// physical locations. Owner can add, remove, reorder, and edit
// per-card fields without touching code.
//
// Backward-compatibility: CMS overrides saved before this multi-
// card change have name/desc/image/etc. at the top level. The
// normalizer below detects the old shape and migrates it into a
// single-element cards array on first edit, so an owner who hits
// "Edit" on a legacy section gets the new editor populated with
// their existing data.
//
// Card layout on the public site is automatic:
//   - 1 card  → full-width landscape (image left, text right)
//   - 2 cards → 2-column grid, portrait
//   - 3+ cards → 3-column grid, portrait
// See src/pages/Home.jsx for the renderer.
function blankResortCard() {
  return {
    id:       `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name:     "",
    location: "",
    desc:     "",
    image:    "",
    badge:    "",
    ctaText:  "Explore & Book Now",
    link:     "/resort",
  };
}

function normalizeResortContentForm(c) {
  if (!c || typeof c !== 'object') {
    return { sectionTitle: '', sectionSubtitle: '', cards: [] };
  }
  if (Array.isArray(c.cards)) {
    return {
      sectionTitle:    c.sectionTitle    ?? '',
      sectionSubtitle: c.sectionSubtitle ?? '',
      cards:           c.cards.map(card => ({ ...blankResortCard(), ...card })),
    };
  }
  // Old singular shape — promote to single-card array.
  return {
    sectionTitle:    c.sectionTitle    ?? '',
    sectionSubtitle: c.sectionSubtitle ?? '',
    cards: [{
      ...blankResortCard(),
      name:     c.name    ?? '',
      location: c.location ?? '',
      desc:     c.desc    ?? '',
      image:    c.image   ?? '',
      badge:    c.badge   ?? '',
      ctaText:  c.ctaText ?? 'Explore & Book Now',
      link:     c.link    ?? '/resort',
    }],
  };
}

function HomeResortEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => normalizeResortContentForm(content));
  // Confirm-before-delete gate. Card removal is destructive (the
  // owner loses the image upload + all card content) so an explicit
  // confirm matches the page-wide policy on mutating actions.
  const [removeIdx, setRemoveIdx] = useState(null);

  const cancel = () => { setForm(normalizeResortContentForm(content)); setEditing(false); setRemoveIdx(null); };
  const save   = () => { onSave(form); setEditing(false); setRemoveIdx(null); };

  function updateSection(key, val) { setForm(p => ({ ...p, [key]: val })); }
  function updateCard(idx, key, val) {
    setForm(p => ({ ...p, cards: p.cards.map((c, i) => i === idx ? { ...c, [key]: val } : c) }));
  }
  function addCard() {
    setForm(p => ({ ...p, cards: [...p.cards, blankResortCard()] }));
  }
  function confirmRemoveCard(idx) {
    setRemoveIdx(idx);
  }
  function actuallyRemoveCard() {
    if (removeIdx == null) return;
    setForm(p => ({ ...p, cards: p.cards.filter((_, i) => i !== removeIdx) }));
    setRemoveIdx(null);
  }
  function moveCard(idx, dir) {
    setForm(p => {
      const next = [...p.cards];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return p;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...p, cards: next };
    });
  }

  // Read-only preview uses the canonical (already-normalized) shape
  // so the preview never crashes on legacy CMS data.
  const previewCards = normalizeResortContentForm(content).cards;
  const cardCountLabel = previewCards.length === 0
    ? 'No cards'
    : previewCards.length === 1 ? '1 card' : `${previewCards.length} cards`;

  return (
    <SectionCard icon="fa-umbrella-beach" title="Resort Cards" badge={`Home page · ${cardCountLabel}`} editing={editing}
      onEdit={() => { setForm(normalizeResortContentForm(content)); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="space-y-2">
          {previewCards.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">No resort cards configured. Click Edit to add one.</p>
          ) : previewCards.map((c, i) => (
            <div key={c.id || i} className="rounded-lg border border-slate-200 overflow-hidden flex bg-white">
              <div className="w-24 h-20 shrink-0 bg-slate-100">
                {c.image && (
                  <img src={c.image} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                )}
              </div>
              <div className="p-3 flex-1 min-w-0">
                {c.badge && (
                  <span className="inline-block bg-sky-100 text-sky-700 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1">{c.badge}</span>
                )}
                <p className="text-sm font-bold text-slate-800 truncate">{c.name || <span className="text-slate-300 italic">Untitled</span>}</p>
                {c.location && <p className="text-[10px] text-slate-400 truncate">{c.location}</p>}
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Shared header — section title + subtitle that sit ABOVE
              all cards on the rendered page. */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">Section Header (shown above all cards)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Section Title"    value={form.sectionTitle}    onChange={(v) => updateSection('sectionTitle', v)}    placeholder="e.g. About the resort / Our resorts" />
              <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={(v) => updateSection('sectionSubtitle', v)} rows={2} placeholder="Short paragraph above the card grid" />
            </div>
          </div>

          {/* Per-card editors */}
          <div className="space-y-3">
            {form.cards.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4 border border-dashed border-slate-200 rounded-lg">
                No resort cards yet. Click "Add Resort Card" below to start.
              </p>
            )}
            {form.cards.map((card, idx) => (
              <div key={card.id || idx} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                {/* Card header — index + reorder + remove */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <p className="text-xs font-semibold text-slate-600">
                    Card {idx + 1}{card.name ? ` — ${card.name}` : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveCard(idx, -1)} disabled={idx === 0}
                      title="Move up"
                      className="h-8 w-8 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition">
                      <i className="fas fa-arrow-up text-xs" aria-hidden="true"></i>
                    </button>
                    <button type="button" onClick={() => moveCard(idx, 1)} disabled={idx === form.cards.length - 1}
                      title="Move down"
                      className="h-8 w-8 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition">
                      <i className="fas fa-arrow-down text-xs" aria-hidden="true"></i>
                    </button>
                    <button type="button" onClick={() => confirmRemoveCard(idx)}
                      title="Remove card"
                      className="h-8 w-8 rounded hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition">
                      <i className="fas fa-trash text-xs" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>

                {/* Image picker */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Card Image</label>
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-24 rounded border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {card.image ? (
                        <img src={card.image} alt="" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                      ) : (
                        <i className="fas fa-image text-slate-300 text-sm" aria-hidden="true"></i>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* folder must match the backend UploadController's
                          allowlist (avatars/rooms/gallery/hero/
                          announcements/logo/misc). 'gallery' is the
                          right bucket for marketing-card imagery —
                          'hero' is reserved for full-bleed page
                          backgrounds. */}
                      <MediaPicker
                        value={card.image}
                        onChange={url => updateCard(idx, 'image', url)}
                        previousUrl={card.image}
                        folder="gallery"
                        accept="image/*"
                        label="Choose Image"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Resort Name"    value={card.name     || ""} onChange={(v) => updateCard(idx, 'name',     v)} placeholder="e.g. Aplaya Beach Resort Cavite" />
                  <Field label="Location"       value={card.location || ""} onChange={(v) => updateCard(idx, 'location', v)} placeholder="e.g. Naic, Cavite (optional)" />
                  <Field label="Badge"          value={card.badge    || ""} onChange={(v) => updateCard(idx, 'badge',    v)} placeholder="e.g. Now Open (leave empty to hide)" />
                  <Field label="CTA Button"     value={card.ctaText  || ""} onChange={(v) => updateCard(idx, 'ctaText',  v)} placeholder="e.g. Explore & Book Now" />
                  <Field label="Description"    value={card.desc     || ""} onChange={(v) => updateCard(idx, 'desc',     v)} rows={3} placeholder="Card body text" />
                  <Field label="Link / URL"     value={card.link     || ""} onChange={(v) => updateCard(idx, 'link',     v)} placeholder="e.g. /resort or /resort/cebu or # for none" />
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addCard}
            className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm font-medium text-slate-500 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 transition">
            <i className="fas fa-plus text-xs mr-1.5" aria-hidden="true"></i>Add Resort Card
          </button>
        </div>
      )}

      {/* Per-card delete confirmation. Unlike the SectionCard's
          built-in save confirm (which fires on the whole-section
          Save), this gates the in-form trash-icon click so an
          accidental tap doesn't wipe a card's image and content. */}
      <ConfirmDialog
        open={removeIdx != null}
        title="Remove resort card?"
        message={removeIdx != null && form.cards[removeIdx]
          ? <>Remove <strong>{form.cards[removeIdx].name || `Card ${removeIdx + 1}`}</strong>? The card and its image disappear immediately. Click Cancel on the section editor afterwards if you want to undo.</>
          : 'Remove this card?'}
        confirmLabel="Remove card"
        variant="danger"
        onConfirm={actuallyRemoveCard}
        onCancel={() => setRemoveIdx(null)}
      />
    </SectionCard>
  );
}

// ─── HomeWhyEditor ───────────────────────────────────────────────────────────
const WHY_ICON_OPTIONS = [
  "fa-umbrella-beach", "fa-bed", "fa-utensils", "fa-spa", "fa-wifi",
  "fa-swimming-pool", "fa-cocktail", "fa-sun", "fa-ship", "fa-mountain",
  "fa-tree", "fa-car", "fa-plane", "fa-map-marked-alt", "fa-heart", "fa-star",
];

// Visual icon picker — portal-based popover so it escapes any transform
// or overflow ancestor (matches the pattern in owner/Rooms.jsx). The
// previous <select> element rendered icon names as plain text
// ("umbrella-beach"), which told the owner nothing about what the icon
// looks like until they saved and checked the live preview.
function IconPickerField({ value, onChange, options = WHY_ICON_OPTIONS }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const btn = triggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const W = 240; // popover width
      const H = 200; // popover approx height
      let top = r.bottom + 8;
      if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 8);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      setPos({ top, left });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const label = value?.replace(/^fa-/, "") || "pick icon";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Icon: ${label}. Click to change.`}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 flex items-center gap-2 transition"
      >
        <i className={`fas ${value || "fa-question"} text-sky-500 w-4 text-center`} aria-hidden="true"></i>
        <span className="text-slate-700 flex-1 text-left truncate">{label}</span>
        <i className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true"></i>
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          aria-label="Icon options"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 240 }}
          className="z-[10000] bg-white border border-slate-200 rounded-xl shadow-xl p-2 grid grid-cols-6 gap-1"
        >
          {options.map(icon => {
            const selected = icon === value;
            return (
              <button
                key={icon}
                type="button"
                title={icon.replace(/^fa-/, "")}
                aria-label={icon.replace(/^fa-/, "")}
                aria-selected={selected}
                onClick={() => { onChange(icon); setOpen(false); }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition ${selected ? "bg-sky-100 text-sky-600 ring-2 ring-sky-300" : "hover:bg-slate-100 text-slate-500"}`}
              >
                <i className={`fas ${icon}`} aria-hidden="true"></i>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

function HomeWhyEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  const updateFeature = (i, key, val) =>
    setForm(p => ({ ...p, features: p.features.map((f, fi) => fi === i ? { ...f, [key]: val } : f) }));
  const addFeature = () => {
    if ((form.features || []).length >= 8) return;
    setForm(p => ({ ...p, features: [...(p.features || []), { icon: "fa-star", title: "", desc: "" }] }));
  };
  const removeFeature = (i) => {
    if ((form.features || []).length <= 1) return;
    setForm(p => ({ ...p, features: p.features.filter((_, fi) => fi !== i) }));
  };

  return (
    <SectionCard icon="fa-lightbulb" title="Why Choose Us" badge="Home page · /" editing={editing}
      onEdit={() => { setForm(content); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div>
          <p className="font-semibold text-slate-800 text-sm">{content.sectionTitle}</p>
          <p className="text-xs text-slate-500 mt-1 mb-3">{content.sectionSubtitle}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(content.features || []).map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-3 text-center hover:shadow-sm transition">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-1.5">
                  <i className={`fas ${f.icon} text-brand text-sm`} aria-hidden="true"></i>
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate">{f.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Section Title" value={form.sectionTitle} onChange={v => setForm(p => ({ ...p, sectionTitle: v }))} />
            <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={v => setForm(p => ({ ...p, sectionSubtitle: v }))} rows={2} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Features ({(form.features || []).length}/8)</label>
              {(form.features || []).length < 8 && (
                <button type="button" onClick={addFeature}
                  className="text-xs text-brand hover:underline flex items-center gap-1">
                  <i className="fas fa-plus text-[10px]" aria-hidden="true"></i> Add Feature
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(form.features || []).map((feat, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Feature {i + 1}</span>
                    {(form.features || []).length > 1 && (
                      <button type="button" onClick={() => removeFeature(i)}
                        className="text-red-400 hover:text-red-600 transition p-1">
                        <i className="fas fa-trash text-xs" aria-hidden="true"></i>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Icon</label>
                      <IconPickerField
                        value={feat.icon}
                        onChange={(ico) => updateFeature(i, "icon", ico)}
                      />
                    </div>
                    <Field label="Title" value={feat.title} onChange={v => updateFeature(i, "title", v)} maxLength={50} />
                    <Field label="Description" value={feat.desc} onChange={v => updateFeature(i, "desc", v)} maxLength={120} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-3 font-medium">Live Preview</p>
            <div className="text-center mb-3">
              <p className="font-bold text-slate-900 text-sm">{form.sectionTitle || <span className="text-slate-300 italic">Title</span>}</p>
              <p className="text-xs text-slate-500 mt-0.5">{form.sectionSubtitle || <span className="text-slate-300 italic">Subtitle</span>}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(form.features || []).map((feat, i) => (
                <div key={i} className="bg-white rounded-xl p-3 text-center shadow-sm border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
                    <i className={`fas ${feat.icon} text-brand text-sm`} aria-hidden="true"></i>
                  </div>
                  <p className="text-xs font-bold text-slate-900 truncate">{feat.title || <span className="text-slate-300 italic">Title</span>}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{feat.desc || <span className="text-slate-300 italic">Desc</span>}</p>
                </div>
              ))}
            </div>
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
          <p className="text-sm font-medium text-slate-700">{content.sectionTitle}</p>
          <p className="text-xs text-slate-400 mb-3">{content.sectionSubtitle}</p>
          <div className="grid grid-cols-3 gap-2">
            {content.cards.map((c, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-slate-100">
                <img src={c.image} alt={c.name}
                  className="w-full h-16 object-cover"
                  onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                <p className="text-xs text-slate-600 px-2 py-1 truncate">{c.name}</p>
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
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Resort Cards</p>
            <div className="space-y-2">
              {form.cards.map((card, i) => (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition"
                  >
                    <div className="flex items-center gap-3">
                      <img src={card.image} alt={card.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                      <span className="text-sm font-medium text-slate-700">{card.name}</span>
                    </div>
                    <i className={`fas fa-chevron-${expandedCard === i ? "up" : "down"} text-xs text-slate-400`} aria-hidden="true"></i>
                  </button>
                  {expandedCard === i && (
                    <div className="p-4 space-y-3">
                      <Field label="Resort Name" value={card.name} onChange={v => updateCard(i, "name", v)} />
                      <Field label="Description" value={card.desc} onChange={v => updateCard(i, "desc", v)} rows={2} />
                      <Field label="Badge Text (leave empty for none)" value={card.badge} onChange={v => updateCard(i, "badge", v)} />
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Card Image</label>
                        <div className="flex items-start gap-3">
                          <div className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                            {card.image ? (
                              <img src={card.image} alt="Card" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                            ) : (
                              <i className="fas fa-image text-slate-300" aria-hidden="true"></i>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <MediaPicker
                              value={card.image}
                              onChange={url => updateCard(i, "image", url)}
                              previousUrl={content.cards[i]?.image}
                              folder="hero"
                              accept="image/*"
                              label="Choose Card Image"
                            />
                            <p className="text-[10px] text-slate-400">Landscape orientation recommended.</p>
                          </div>
                        </div>
                      </div>
                      {/* Card preview */}
                      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                        <div className="relative h-24 bg-slate-100">
                          {card.image
                            ? <img src={card.image} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} loading="lazy" decoding="async" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-300"><i className="fas fa-image text-2xl" aria-hidden="true"></i></div>
                          }
                          {card.badge && (
                            <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-medium">{card.badge}</span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-bold text-slate-900 truncate">{card.name || <span className="text-slate-300 italic">Name</span>}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{card.desc || <span className="text-slate-300 italic">Description</span>}</p>
                        </div>
                      </div>
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

// ─── HomeCTAEditor ───────────────────────────────────────────────────────────
function HomeCTAEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-bullhorn" title="CTA Banner" badge="Home page · /" editing={editing}
      onEdit={() => { setForm(content); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="rounded-xl overflow-hidden bg-blue-700 p-4 text-center text-white">
          <p className="font-bold text-sm">{content.title}</p>
          <p className="text-xs text-white/70 mt-1 line-clamp-1">{content.subtitle}</p>
          <span className="inline-block mt-2 text-xs bg-white text-blue-600 font-semibold px-3 py-1 rounded-lg">{content.buttonText}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Title" value={form.title} onChange={f("title")} />
          <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
          <Field label="Button Text" value={form.buttonText} onChange={f("buttonText")} />
          {/* Live preview */}
          <div className="p-5 bg-blue-700 rounded-xl text-center text-white">
            <p className="text-[10px] text-white/60 uppercase tracking-wide mb-3 font-medium">Live Preview</p>
            <p className="font-bold text-base">{form.title || <span className="opacity-40 italic">Title</span>}</p>
            <p className="text-xs text-white/75 mt-1">{form.subtitle || <span className="opacity-40 italic">Subtitle</span>}</p>
            <div className="mt-3">
              <span className="inline-block bg-white text-blue-600 text-xs font-semibold px-4 py-1.5 rounded-lg">
                {form.buttonText || "Button"}
              </span>
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
      onEdit={() => { setForm(content); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="relative rounded-lg overflow-hidden h-28 bg-slate-100">
          {isVideoUrl(content.background)
            ? <video src={content.background} muted playsInline className="w-full h-full object-cover" />
            : <img src={content.background} alt="hero bg" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
          }
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4">
            <p className="font-bold text-sm leading-tight">{content.title}</p>
            <p className="text-xs text-white/80 mt-1 line-clamp-1">{content.subtitle}</p>
            <span className="mt-2 text-xs bg-blue-600 px-2 py-0.5 rounded">{content.ctaText}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Background Image / Video</label>
            <div className="flex items-start gap-4">
              <div className="h-20 w-32 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                {form.background ? (
                  isVideoUrl(form.background)
                    ? <video src={form.background} muted playsInline className="h-full w-full object-cover" />
                    : <img src={form.background} alt="Background" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <MediaPicker
                  value={form.background}
                  onChange={url => setForm(p => ({ ...p, background: url }))}
                  previousUrl={content.background}
                  folder="hero"
                  accept="image/*,video/*"
                  label="Choose Background"
                />
                <p className="text-[10px] text-slate-400">Recommended: 1920×1080 or wider. Supports images and videos.</p>
              </div>
            </div>
          </div>

          {/* Poster picker — only when background is a video. See
              HomeHeroEditor for the full rationale; same a11y
              contract on the public Resort page. */}
          {isVideoUrl(form.background) && (
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Poster Image <span className="text-slate-400 normal-case tracking-normal">(fallback for reduced motion)</span>
              </label>
              <div className="flex items-start gap-4">
                <div className="h-20 w-32 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {form.poster ? (
                    <img src={form.poster} alt="Poster" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                  ) : (
                    <div className="text-center"><i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i><p className="text-[9px] text-slate-300 mt-0.5">No poster</p></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <MediaPicker
                    value={form.poster || ""}
                    onChange={url => setForm(p => ({ ...p, poster: url }))}
                    previousUrl={content.poster}
                    folder="hero"
                    accept="image/*"
                    label="Choose Poster"
                  />
                  <p className="text-[10px] text-slate-400">A still frame from your video, or any representative image. Skipped: visitors who can't see the video get only a dark hero.</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" value={form.title} onChange={f("title")} />
            <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
            <Field label="CTA Button Text" value={form.ctaText} onChange={f("ctaText")} />
          </div>
          <HeroPreview
            bg={form.background}
            title={form.title}
            subtitle={form.subtitle}
            extra={<span className="mt-1.5 text-xs bg-blue-600 px-2 py-0.5 rounded">{form.ctaText}</span>}
          />
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
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden">
          <div className="flex gap-4 p-3">
            {content.image ? (
              isVideoUrl(content.image)
                ? <video src={content.image} muted playsInline className="w-28 h-20 object-cover rounded-lg shrink-0 border border-slate-200" />
                : <img src={content.image} alt="about" className="w-28 h-20 object-cover rounded-lg shrink-0 border border-slate-200" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
            ) : (
              <div className="w-28 h-20 rounded-lg bg-slate-200 shrink-0 flex items-center justify-center text-slate-300">
                <i className="fas fa-image text-lg" aria-hidden="true"></i>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm">{content.title}</p>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{content.paragraph1}</p>
              {content.paragraph2 && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{content.paragraph2}</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Section Title" value={form.title} onChange={f("title")} />
            <Field label="Paragraph 1" value={form.paragraph1} onChange={f("paragraph1")} rows={3} />
            <Field label="Paragraph 2" value={form.paragraph2} onChange={f("paragraph2")} rows={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Section Image / Video</label>
            <div className="flex items-start gap-4">
              <div className="h-20 w-28 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                {form.image ? (
                  isVideoUrl(form.image)
                    ? <video src={form.image} muted playsInline className="h-full w-full object-cover" />
                    : <img src={form.image} alt="Section" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <MediaPicker
                  value={form.image}
                  onChange={url => setForm(p => ({ ...p, image: url }))}
                  previousUrl={content.image}
                  folder="hero"
                  accept="image/*,video/*"
                  label="Choose Section Image / Video"
                />
                <p className="text-[10px] text-slate-400">Landscape image or short video clip.</p>
              </div>
            </div>
          </div>

          {/* Poster picker for the about-section video — same a11y
              fallback contract as hero.poster. Only shown when the
              section media is a video. */}
          {isVideoUrl(form.image) && (
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Poster Image <span className="text-slate-400 normal-case tracking-normal">(fallback for reduced motion)</span>
              </label>
              <div className="flex items-start gap-4">
                <div className="h-20 w-28 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {form.imagePoster ? (
                    <img src={form.imagePoster} alt="Poster" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                  ) : (
                    <div className="text-center"><i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i><p className="text-[9px] text-slate-300 mt-0.5">No poster</p></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <MediaPicker
                    value={form.imagePoster || ""}
                    onChange={url => setForm(p => ({ ...p, imagePoster: url }))}
                    previousUrl={content.imagePoster}
                    folder="hero"
                    accept="image/*"
                    label="Choose Poster"
                  />
                  <p className="text-[10px] text-slate-400">Still frame visitors see when reduced-motion is on.</p>
                </div>
              </div>
            </div>
          )}

          {/* About preview */}
          <div className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-3 font-medium">Live Preview</p>
            <div className="flex gap-4">
              {form.image
                ? isVideoUrl(form.image)
                  ? <video src={form.image} muted playsInline className="w-28 h-24 object-cover rounded-lg flex-shrink-0 border border-slate-200" />
                  : <img src={form.image} alt="" className="w-28 h-24 object-cover rounded-lg flex-shrink-0 border border-slate-200" onError={e => { e.target.style.display='none'; }} loading="lazy" decoding="async" />
                : <div className="w-28 h-24 rounded-lg bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-300"><i className="fas fa-image text-2xl" aria-hidden="true"></i></div>
              }
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm">{form.title || <span className="text-slate-300 italic">Title</span>}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-3">{form.paragraph1 || <span className="text-slate-300 italic">Paragraph 1</span>}</p>
              </div>
            </div>
          </div>
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
          <p className="font-semibold text-slate-800 text-sm">{content.sectionTitle}</p>
          <p className="text-xs text-slate-500 mt-1">{content.sectionSubtitle}</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/50 overflow-hidden">
                <div className="h-10 bg-slate-200"></div>
                <div className="p-2 space-y-1">
                  <div className="h-2.5 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-100 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-300 mt-2 italic flex items-center gap-1">
            <i className="fas fa-info-circle" aria-hidden="true"></i>Individual rooms are managed in Manage Rooms
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Section Title" value={form.sectionTitle} onChange={f("sectionTitle")} />
          <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={f("sectionSubtitle")} rows={2} />
          <p className="text-xs text-slate-400 italic">
            <i className="fas fa-info-circle mr-1" aria-hidden="true"></i>
            Individual rooms are managed in <strong>Manage Rooms</strong>.
          </p>
          {/* Preview */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-3 font-medium">Live Preview</p>
            <p className="font-bold text-slate-900 text-base">{form.sectionTitle || <span className="text-slate-300 italic">Section Title</span>}</p>
            <p className="text-xs text-slate-500 mt-1">{form.sectionSubtitle || <span className="text-slate-300 italic">Subtitle</span>}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-10 rounded-lg bg-slate-200 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

const AMENITY_ICONS = [
  "🏖️","🏊","🌊","⛱️","🚤","🛶",
  "🍽️","🍹","🥂","☕","🍦","🎂",
  "📶","🅿️","🚐","✈️","🚗","🛵",
  "💆","🧖","🛁","💪","🏋️","🧘",
  "🌿","🌺","🌴","🌅","🌙","⭐",
  "🎵","🎮","🎯","🎨","📷","🎭",
  "🔒","🧹","🛎️","🔑","💡","❄️",
  "👨‍👩‍👧","🐾","♿","🏥","🧺","✨",
];

const EMPTY_FORM = { name: "", icon: "✨", description: "" };

function AmenityForm({ initial = EMPTY_FORM, onSave, onCancel, saving, label = "Save" }) {
  const [form, setForm] = useState(initial);
  const [showPicker, setShowPicker] = useState(false);
  // Confirm-before-save gate. Same pattern as SectionCard above —
  // each call site re-uses this form for both create + edit paths
  // and goes through one shared confirm. See pages-wide policy on
  // mutating actions.
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3">
      {/* Icon picker */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Icon</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPicker(p => !p)}
            className="w-12 h-12 rounded-xl border-2 border-slate-200 hover:border-sky-400 flex items-center justify-center text-2xl transition bg-slate-50">
            {form.icon || "✨"}
          </button>
          <span className="text-xs text-slate-400">Click to choose icon</span>
        </div>
        {showPicker && (
          <div className="mt-2 p-3 border border-slate-200 rounded-xl bg-white shadow-lg grid grid-cols-12 gap-1 max-h-40 overflow-y-auto">
            {AMENITY_ICONS.map(ico => (
              <button key={ico} type="button" onClick={() => { f("icon")(ico); setShowPicker(false); }}
                className={`text-xl p-1 rounded-lg hover:bg-blue-50 transition ${form.icon === ico ? "bg-blue-100 ring-2 ring-blue-400" : ""}`}>
                {ico}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Name <span className="text-red-400">*</span></label>
        <input value={form.name} onChange={e => f("name")(e.target.value)}
          placeholder="e.g. Beach Access" maxLength={100}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
        <textarea value={form.description} onChange={e => f("description")(e.target.value)}
          placeholder="Short description shown to guests (optional)" rows={2} maxLength={500}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none" />
      </div>

      {/* Preview */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-2">Preview</p>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-lg shrink-0">
            {form.icon || "✨"}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{form.name || <span className="text-slate-300 italic">Amenity name</span>}</p>
            <p className="text-xs text-slate-500 mt-0.5">{form.description || <span className="text-slate-300 italic">Description</span>}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSaveConfirmOpen(true)} disabled={saving || !form.name.trim()}
          className="px-4 py-2 text-xs font-medium text-white bg-brand rounded-lg hover:bg-brand-dark disabled:opacity-50 transition">
          {saving ? "Saving..." : label}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
          Cancel
        </button>
      </div>

      <ConfirmDialog
        open={saveConfirmOpen}
        title="Save amenity?"
        message={<>Save <strong>{form.name || 'this amenity'}</strong>? It will appear on the public Resort page immediately.</>}
        confirmLabel="Save"
        variant="info"
        onConfirm={() => { setSaveConfirmOpen(false); onSave(form); }}
        onCancel={() => setSaveConfirmOpen(false)}
      />
    </div>
  );
}

function ResortAmenitiesEditor() {
  const [amenities, setAmenities] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [adding,    setAdding]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [toast, showToast, clearToast, toastType] = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    getResortAmenities()
      .then(r => setAmenities(r.data.data ?? []))
      .catch(() => showToast("Failed to load amenities.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const handleSaveEdit = async (id, form) => {
    setSaving(true);
    try {
      const res = await updateResortAmenity(id, form);
      setAmenities(prev => prev.map(a => a.id === id ? res.data.data : a));
      setEditingId(null);
      showToast("Amenity updated!", "success");
    } catch { showToast("Failed to update.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteResortAmenity(id);
      setAmenities(prev => prev.filter(a => a.id !== id));
      showToast("Amenity removed.", "success");
    } catch { showToast("Failed to delete.", "error"); }
    finally { setDeleteConfirm(null); }
  };

  const handleAdd = async (form) => {
    setSaving(true);
    try {
      const res = await createResortAmenity(form);
      setAmenities(prev => [...prev, res.data.data]);
      setAdding(false);
      showToast("Amenity added!", "success");
    } catch { showToast("Failed to add.", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <Toast message={toast} type={toastType} onClose={clearToast} />
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <i className="fas fa-concierge-bell text-brand text-sm" aria-hidden="true"></i>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Resort Amenities</p>
            <p className="text-xs text-slate-400">Resort page · /resort · hidden when empty</p>
          </div>
        </div>
        {!adding && !editingId && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand rounded-lg hover:bg-brand-dark transition">
            <i className="fas fa-plus text-xs" aria-hidden="true"></i> Add Amenity
          </button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {loading && <p className="text-xs text-slate-400">Loading...</p>}

        {/* Empty state */}
        {!loading && amenities.length === 0 && !adding && (
          <div className="text-center py-10 text-slate-400">
            <div className="text-4xl mb-3">🏖️</div>
            <p className="text-sm font-medium">No amenities yet</p>
            <p className="text-xs mt-1">The section is hidden from guests until you add some.</p>
          </div>
        )}

        {/* Amenity list */}
        <div className="space-y-2">
          {amenities.map(a => (
            <div key={a.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {editingId === a.id ? (
                <div className="p-4">
                  <p className="text-xs font-semibold text-slate-700 mb-3">Edit Amenity</p>
                  <AmenityForm
                    initial={{ name: a.name, icon: a.icon || "✨", description: a.description ?? "" }}
                    onSave={(form) => handleSaveEdit(a.id, form)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                    label="Save Changes"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-xl shrink-0">
                    {a.icon || "✨"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                    {a.description && <p className="text-xs text-slate-400 truncate">{a.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditingId(a.id); setAdding(false); }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      <i className="fas fa-pen text-xs" aria-hidden="true"></i>
                    </button>
                    <button onClick={() => setDeleteConfirm(a.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <i className="fas fa-trash text-xs" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add form */}
        {adding && (
          <div className="border-2 border-dashed border-sky-300 rounded-xl p-4 bg-sky-50">
            <p className="text-xs font-semibold text-sky-700 mb-3">New Amenity</p>
            <AmenityForm
              onSave={handleAdd}
              onCancel={() => setAdding(false)}
              saving={saving}
              label="Add Amenity"
            />
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} label="Confirm delete">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fas fa-trash text-red-500" aria-hidden="true"></i>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Remove Amenity</h3>
              <p className="text-sm text-slate-500">This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={() => handleDelete(deleteConfirm)}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg inline-flex items-center gap-2">
              Remove
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ResortContactEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-address-book" title="Contact Info & Map" badge="Resort page · /resort" editing={editing}
      onEdit={() => setEditing(true)} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-2">
            {[
              { icon: "fa-map-marker-alt", label: "Address", value: content.address },
              { icon: "fa-phone", label: "Phone", value: content.phone },
              { icon: "fa-envelope", label: "Email", value: content.email },
            ].map(item => (
              <div key={item.icon} className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                  <i className={`fas ${item.icon} text-brand text-[10px]`} aria-hidden="true"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{item.label}</p>
                  <p className="text-xs text-slate-700 truncate">{item.value || <span className="italic text-slate-300">Not set</span>}</p>
                </div>
              </div>
            ))}
          </div>
          {(content.osm_url || content.map_url) ? (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <iframe src={content.osm_url || content.map_url} width="100%" height="120" style={{ border: 0 }} loading="lazy" title="Resort location map" />
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-slate-200 p-3 text-center">
              <i className="fas fa-map-marked-alt text-slate-200 text-lg" aria-hidden="true"></i>
              <p className="text-[10px] text-slate-300 mt-1">No map configured</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Contact Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span className="h-5 w-5 rounded-md bg-sky-100 flex items-center justify-center">
                  <i className="fas fa-phone text-sky-500 text-[10px]" aria-hidden="true"></i>
                </span>
                Contact Details
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <Field label="Address" value={form.address} onChange={f("address")} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Phone" value={form.phone} onChange={f("phone")} />
                <Field label="Email" type="email" value={form.email} onChange={f("email")} />
              </div>
            </div>
          </div>

          {/* Map Settings */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span className="h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center">
                  <i className="fas fa-map-marked-alt text-emerald-500 text-[10px]" aria-hidden="true"></i>
                </span>
                Map Settings
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Map URL — OpenStreetMap embed. The public Resort
                  page (Resort.jsx) reads osm_url only; the legacy
                  map_url Google field is no longer rendered. */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  OpenStreetMap Embed URL
                </label>
                <input
                  type="url"
                  value={form.osm_url || ""}
                  onChange={e => f("osm_url")(e.target.value)}
                  placeholder="https://www.openstreetmap.org/export/embed.html?bbox=...&marker=lat,lng"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
                  <p className="font-semibold"><i className="fas fa-info-circle mr-1" aria-hidden="true"></i>How to get your embed URL:</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li>Go to <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="underline font-medium">openstreetmap.org</a> and search your resort</li>
                    <li>Click <span className="font-medium">Share</span> on the right toolbar</li>
                    <li>Tick <span className="font-medium">Include marker</span>, then copy the URL inside the <span className="font-medium">HTML</span> iframe's <span className="font-medium">src="..."</span></li>
                    <li>Paste it here</li>
                  </ol>
                </div>
              </div>

              {/* Directions URL — kept as a free-form link. Owners
                  typically paste a Google Maps short link
                  (maps.app.goo.gl/...) since the "Get Directions"
                  CTA is meant to launch turn-by-turn nav, which
                  Google does better than OSM's interface. */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  "Get Directions" Link <span className="text-slate-400 font-normal">(opens in a new tab)</span>
                </label>
                <input
                  type="url"
                  value={form.directions_url || ""}
                  onChange={e => f("directions_url")(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Google Maps short link gives the best turn-by-turn experience. Search your resort on Google Maps → Share → Copy link.
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Live Preview</p>
            <div className="space-y-1.5 text-sm text-slate-700">
              <p><i className="fas fa-map-marker-alt w-4 text-brand mr-2" aria-hidden="true"></i>{form.address || <span className="text-slate-300 italic">Address</span>}</p>
              <p><i className="fas fa-phone w-4 text-brand mr-2" aria-hidden="true"></i>{form.phone || <span className="text-slate-300 italic">Phone</span>}</p>
              <p><i className="fas fa-envelope w-4 text-brand mr-2" aria-hidden="true"></i>{form.email || <span className="text-slate-300 italic">Email</span>}</p>
            </div>
            {form.osm_url ? (
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <iframe src={form.osm_url} width="100%" height="200" style={{ border: 0 }} loading="lazy" title="Map preview" />
              </div>
            ) : (
              <div className="h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-sm">
                <i className="fas fa-map-marked-alt mr-2" aria-hidden="true"></i>Map preview will appear here
              </div>
            )}
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
          <p className="font-semibold text-slate-800 text-sm">{content.sectionTitle}</p>
          <p className="text-xs text-slate-500 mt-1">{content.sectionSubtitle}</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex -space-x-1">
              {["bg-sky-400", "bg-emerald-400", "bg-amber-400"].map((c, i) => (
                <div key={i} className={`h-6 w-6 rounded-full ${c} border-2 border-white flex items-center justify-center`}>
                  <i className="fas fa-user text-white text-[8px]" aria-hidden="true"></i>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">Reviews from guests · only featured ones show on resort page</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Section Title" value={form.sectionTitle} onChange={f("sectionTitle")} />
          <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={f("sectionSubtitle")} rows={2} />
          <p className="text-xs text-slate-400 italic">
            <i className="fas fa-info-circle mr-1" aria-hidden="true"></i>
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
        <div className="rounded-xl overflow-hidden bg-sky-600 p-3.5 text-white">
          <p className="font-bold text-sm">{content.title}</p>
          <p className="text-[11px] text-white/70 mt-0.5 line-clamp-1">{content.subtitle}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <div className="flex-1 h-6 bg-white/20 rounded max-w-[140px]"></div>
            <div className="h-6 px-2.5 bg-white text-blue-600 text-[10px] font-semibold rounded flex items-center">Subscribe</div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Title" value={form.title} onChange={f("title")} />
          <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
          {/* Preview */}
          <div className="p-4 bg-blue-600 rounded-xl text-center text-white">
            <p className="text-[10px] text-white/60 uppercase tracking-wide mb-3 font-medium">Live Preview</p>
            <p className="font-bold text-base">{form.title || <span className="opacity-40 italic">Title</span>}</p>
            <p className="text-xs text-white/75 mt-1">{form.subtitle || <span className="opacity-40 italic">Subtitle</span>}</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="flex-1 h-7 bg-white/20 rounded-lg max-w-[160px]"></div>
              <div className="h-7 px-3 bg-white text-blue-600 text-xs font-semibold rounded-lg flex items-center">Subscribe</div>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── RoomsHeroEditor ─────────────────────────────────────────────────────────
function RoomsHeroEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-image" title="Hero Section" badge="Rooms page · /rooms" editing={editing}
      onEdit={() => { setForm(content); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="relative rounded-lg overflow-hidden h-28 bg-slate-100">
          {isVideoUrl(content.background)
            ? <video src={content.background} muted playsInline className="w-full h-full object-cover" />
            : <img src={content.background} alt="hero bg" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
          }
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4">
            <p className="font-bold text-sm leading-tight">{content.title}</p>
            <p className="text-xs text-white/80 mt-1 line-clamp-1">{content.subtitle}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Background Image / Video</label>
            <div className="flex items-start gap-4">
              <div className="h-20 w-32 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                {form.background ? (
                  isVideoUrl(form.background)
                    ? <video src={form.background} muted playsInline className="h-full w-full object-cover" />
                    : <img src={form.background} alt="Background" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <MediaPicker
                  value={form.background}
                  onChange={url => setForm(p => ({ ...p, background: url }))}
                  previousUrl={content.background}
                  folder="hero"
                  accept="image/*,video/*"
                  label="Choose Background"
                />
                <p className="text-[10px] text-slate-400">Recommended: 1920×1080 or wider. Supports images and videos.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" value={form.title} onChange={f("title")} />
            <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
          </div>
          <HeroPreview bg={form.background} title={form.title} subtitle={form.subtitle} />
        </div>
      )}
    </SectionCard>
  );
}

// ─── GalleryHeroEditor ───────────────────────────────────────────────────────
function GalleryHeroEditor({ content, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const cancel = () => { setForm(content); setEditing(false); };
  const save   = () => { onSave(form); setEditing(false); };

  return (
    <SectionCard icon="fa-image" title="Hero Section" badge="Gallery page · /gallery" editing={editing}
      onEdit={() => { setForm(content); setEditing(true); }} onSave={save} onCancel={cancel}>
      {!editing ? (
        <div className="relative rounded-lg overflow-hidden h-28 bg-slate-100">
          {isVideoUrl(content.background)
            ? <video src={content.background} muted playsInline className="w-full h-full object-cover" />
            : <img src={content.background} alt="hero bg" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
          }
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-center px-4">
            <p className="font-bold text-sm leading-tight">{content.title}</p>
            <p className="text-xs text-white/80 mt-1 line-clamp-1">{content.subtitle}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Background Image / Video</label>
            <div className="flex items-start gap-4">
              <div className="h-20 w-32 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                {form.background ? (
                  isVideoUrl(form.background)
                    ? <video src={form.background} muted playsInline className="h-full w-full object-cover" />
                    : <img src={form.background} alt="Background" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg" aria-hidden="true"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <MediaPicker
                  value={form.background}
                  onChange={url => setForm(p => ({ ...p, background: url }))}
                  previousUrl={content.background}
                  folder="hero"
                  accept="image/*,video/*"
                  label="Choose Background"
                />
                <p className="text-[10px] text-slate-400">Recommended: 1920×1080 or wider. Supports images and videos.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" value={form.title} onChange={f("title")} />
            <Field label="Subtitle" value={form.subtitle} onChange={f("subtitle")} rows={2} />
          </div>
          <HeroPreview bg={form.background} title={form.title} subtitle={form.subtitle} />
        </div>
      )}
    </SectionCard>
  );
}

// ─── Gallery categories ───────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Gallery Tab ──────────────────────────────────────────────────────────────
function GalleryTab({ imageCount, setImageCount }) {
  const [images,      setImages]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const savedIdsRef                   = useRef(new Set());
  const [filterCat,   setFilterCat]   = useState("all");
  const [deleteId,    setDeleteId]    = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [toast, showToast, clearToast, toastType] = useToast();

  // ── Category management ──
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingCat,   setRenamingCat]   = useState(null); // { old: string }
  const [renameValue,   setRenameValue]   = useState("");
  const [renaming,      setRenaming]      = useState(false);
  const [deleteCat,     setDeleteCat]     = useState(null); // category name to confirm delete
  const [deletingCat,   setDeletingCat]   = useState(false);
  const [hideCat,       setHideCat]       = useState(null); // category name to confirm hide/show
  const [movingImage,   setMovingImage]   = useState(null); // { id, currentCat }
  const [moveToCat,     setMoveToCat]     = useState("");
  const [previewImg,    setPreviewImg]    = useState(null); // image object for lightbox preview

  // ── Batch upload ──
  const [batchFolder,   setBatchFolder]   = useState(null);  // category name to upload into
  const [batchFiles,    setBatchFiles]    = useState([]);     // { file, preview, status: 'pending'|'uploading'|'done'|'error', url? }
  const [batchUploading, setBatchUploading] = useState(false);
  const batchInputRef = useRef(null);


  useEffect(() => {
    setLoading(true);
    getAdminGallery()
      .then(r => {
        const imgs = r.data.data || [];
        setImages(imgs);
        setImageCount(imgs.length);
        const ids = new Set(imgs.reduce((acc, i) => { if (i.is_featured) acc.push(i.id); return acc; }, []));
        setSelectedIds(ids);
        savedIdsRef.current = new Set(ids);
      })
      .catch(() => showToast("Failed to load gallery images.", "error"))
      .finally(() => setLoading(false));
  }, [showToast, setImageCount]);

  // Derive categories dynamically from actual gallery data (case-insensitive)
  const categories = useMemo(() => {
    const map = new Map();
    images.forEach(i => {
      const cat = (i.category || "").trim();
      if (!cat) return;
      const key = cat.toLowerCase();
      if (!map.has(key)) map.set(key, cat);
    });
    return [...map.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [images]);

  const filtered = (filterCat === "all" ? images : images.filter(i => (i.category || "").toLowerCase() === filterCat.toLowerCase()))
    .slice()
    .sort((a, b) => {
      const aSaved = savedIdsRef.current.has(a.id) ? 0 : 1;
      const bSaved = savedIdsRef.current.has(b.id) ? 0 : 1;
      if (aSaved !== bSaved) return aSaved - bSaved;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

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
  }

  // Save flow: button click → opens confirm → user confirms →
  // handleSave does the API call. Featured-gallery selection
  // controls what shows on the public /resort page, so confirm
  // gates the commit per the page-wide policy.
  const [gallerySaveConfirmOpen, setGallerySaveConfirmOpen] = useState(false);

  async function handleSave() {
    setGallerySaveConfirmOpen(false);
    setSaving(true);
    try {
      const r = await batchFeaturedGallery([...selectedIds]);
      const imgs = r.data.data || [];
      setImages(imgs);
      const ids = new Set(imgs.filter(i => i.is_featured).map(i => i.id));
      setSelectedIds(ids);
      savedIdsRef.current = new Set(ids);
      showToast("Resort gallery saved!", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save resort gallery.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setSelectedIds(new Set(savedIdsRef.current));
  }

  // ── Folder: create ──
  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const exists = categories.some(c => c.toLowerCase() === name.toLowerCase());
    if (exists) { showToast("Folder already exists.", "error"); return; }
    // Set filter to this new folder so user sees it immediately
    setFilterCat(name);
    setNewFolderName("");
    setShowNewFolder(false);
    showToast(`Folder "${name}" created. Add images to it.`, "success");
  }

  // ── Folder: rename ──
  async function handleRenameFolder() {
    if (!renamingCat || !renameValue.trim()) return;
    if (renameValue.trim().toLowerCase() === renamingCat.old.toLowerCase()) { setRenamingCat(null); return; }
    setRenaming(true);
    try {
      const r = await renameCategoryGallery(renamingCat.old, renameValue.trim());
      // Update images in state
      setImages(prev => prev.map(img =>
        (img.category || "").toLowerCase() === renamingCat.old.toLowerCase()
          ? { ...img, category: renameValue.trim() }
          : img
      ));
      if (filterCat.toLowerCase() === renamingCat.old.toLowerCase()) setFilterCat(renameValue.trim());
      showToast(`Renamed to "${renameValue.trim()}" (${r.data.count} images updated).`, "success");
      setRenamingCat(null);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to rename folder.", "error");
    } finally {
      setRenaming(false);
    }
  }


  // ── Category: delete (removes all images in category) ──
  async function handleDeleteCategory() {
    if (!deleteCat) return;
    const catImages = images.filter(i => (i.category || "").toLowerCase() === deleteCat.toLowerCase());
    if (!catImages.length) {
      // Empty folder — just reset filter
      if (filterCat.toLowerCase() === deleteCat.toLowerCase()) setFilterCat("all");
      setDeleteCat(null);
      showToast(`Category "${deleteCat}" removed.`, "success");
      return;
    }
    setDeletingCat(true);
    try {
      for (const img of catImages) {
        await deleteAdminGallery(img.id);
      }
      const remaining = images.filter(i => (i.category || "").toLowerCase() !== deleteCat.toLowerCase());
      setImages(remaining);
      setImageCount(remaining.length);
      if (filterCat.toLowerCase() === deleteCat.toLowerCase()) setFilterCat("all");
      showToast(`Deleted "${deleteCat}" category and ${catImages.length} image${catImages.length !== 1 ? "s" : ""}.`, "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete some images.", "error");
    } finally {
      setDeletingCat(false);
      setDeleteCat(null);
    }
  }

  // ── Category: confirm then toggle hide/show ──
  async function handleConfirmToggleHidden() {
    if (!hideCat) return;
    const catImages = images.filter(i => (i.category || "").toLowerCase() === hideCat.toLowerCase());
    if (!catImages.length) { setHideCat(null); return; }
    const allHidden = catImages.every(i => i.is_hidden);
    const newVal = !allHidden;
    try {
      await toggleCategoryHidden(hideCat, newVal);
      setImages(prev => prev.map(img =>
        (img.category || "").toLowerCase() === hideCat.toLowerCase()
          ? { ...img, is_hidden: newVal }
          : img
      ));
      showToast(`"${hideCat}" is now ${newVal ? "hidden from public" : "visible to public"}.`, "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update visibility.", "error");
    } finally {
      setHideCat(null);
    }
  }

  // ── Move image to different category ──
  async function handleMoveImage() {
    if (!movingImage || !moveToCat) return;
    try {
      await updateAdminGallery(movingImage.id, { category: moveToCat });
      setImages(prev => prev.map(img => img.id === movingImage.id ? { ...img, category: moveToCat } : img));
      showToast(`Image moved to "${moveToCat}".`, "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to move image.", "error");
    } finally {
      setMovingImage(null);
      setMoveToCat("");
    }
  }

  // ── Batch upload ──
  function handleBatchSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBatchFiles(files.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      status: "pending",
      url: null,
    })));
    e.target.value = "";
  }

  function removeBatchFile(idx) {
    setBatchFiles(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  }

  async function handleBatchUpload() {
    if (!batchFolder || !batchFiles.length) return;
    setBatchUploading(true);

    // Upload each file to Cloudinary
    const results = [...batchFiles];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "done") continue;
      results[i] = { ...results[i], status: "uploading" };
      setBatchFiles([...results]);
      try {
        const url = await uploadFile(results[i].file, "gallery");
        results[i] = { ...results[i], status: "done", url };
      } catch {
        results[i] = { ...results[i], status: "error" };
      }
      setBatchFiles([...results]);
    }

    // Batch create in DB
    const successful = results.filter(f => f.status === "done" && f.url);
    if (successful.length) {
      try {
        const payload = successful.map(f => ({
          resort_id: RESORT_ID,
          image_url: f.url,
          caption: null,
          category: batchFolder,
        }));
        const r = await batchCreateGallery(payload);
        const created = r.data.data || [];
        const newImages = [...images, ...created];
        setImages(newImages);
        setImageCount(newImages.length);
        showToast(`${created.length} image${created.length !== 1 ? "s" : ""} added to "${batchFolder}".`, "success");
      } catch (err) {
        showToast(err?.response?.data?.message || "Failed to save batch to database.", "error");
      }
    }

    const failed = results.filter(f => f.status === "error").length;
    if (failed) showToast(`${failed} file${failed !== 1 ? "s" : ""} failed to upload.`, "error");

    // Cleanup
    results.forEach(f => URL.revokeObjectURL(f.preview));
    setBatchFiles([]);
    setBatchFolder(null);
    setBatchUploading(false);
  }

  // Skeleton shimmer grid
  const GallerySkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-slate-200 animate-pulse h-60" />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Resort gallery save bar */}
      <div className={`sticky top-0 z-20 rounded-xl border px-5 py-4 flex flex-wrap items-center gap-3 transition-colors shadow-sm ${
        isDirty ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"
      }`}>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">Resort Gallery Selection</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Use the <i className="fas fa-heart text-rose-500 text-[10px] mx-0.5" aria-hidden="true"></i> button to feature images on the Resort page.
            {" "}<strong>{selectedIds.size}</strong> image{selectedIds.size !== 1 ? "s" : ""} selected for <strong>/resort</strong>.
            {isDirty && <span className="text-amber-600 ml-1">— unsaved changes</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button onClick={handleDiscard}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100">
              Discard
            </button>
          )}
          <button
            onClick={() => setGallerySaveConfirmOpen(true)}
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {saving
              ? <><i className="fas fa-spinner fa-spin text-xs" aria-hidden="true"></i> Saving…</>
              : <><i className="fas fa-save text-xs" aria-hidden="true"></i> Save to Resort</>}
          </button>
        </div>
      </div>

      {/* ── Folder bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <i className="fas fa-folder text-amber-500" aria-hidden="true" /> Categories
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewFolder(v => !v)}
              className="text-xs text-brand hover:text-brand-dark font-medium flex items-center gap-1">
              <i className="fas fa-plus text-[10px]" aria-hidden="true" /> New Category
            </button>
          </div>
        </div>

        {/* Create new folder inline */}
        {showNewFolder && (
          <div className="flex items-center gap-2">
            <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
              placeholder="Category name" autoFocus
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
            <button onClick={handleCreateFolder}
              className="px-3 py-1.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark">Create</button>
            <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        )}

        {/* Folder pills */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterCat("all")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterCat === "all" ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            <i className="fas fa-th-large text-[10px]" aria-hidden="true" /> All
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filterCat === "all" ? "bg-white/20" : "bg-slate-200 text-slate-500"}`}>
              {images.length}
            </span>
          </button>
          {categories.map(cat => {
            const catImgs = images.filter(i => (i.category || "").toLowerCase() === cat.toLowerCase());
            const count = catImgs.length;
            const isHidden = catImgs.length > 0 && catImgs.every(i => i.is_hidden);
            const isActive = filterCat.toLowerCase() === cat.toLowerCase();
            return (
              <div key={cat} className="relative group">
                <button onClick={() => setFilterCat(cat)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive ? "bg-brand text-white" : isHidden ? "bg-slate-100 text-slate-400 hover:bg-slate-200 line-through" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  <i className={`fas ${isHidden ? "fa-eye-slash" : "fa-folder"} text-[10px]`} aria-hidden="true" />
                  {cat}
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white/20" : "bg-slate-200 text-slate-500"}`}>
                    {count}
                  </span>
                </button>
                {/* Hover actions: hide/show · rename · delete */}
                <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={(e) => { e.stopPropagation(); setHideCat(cat); }}
                    className={`w-5 h-5 rounded-full text-white text-[8px] flex items-center justify-center ${isHidden ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-400 hover:bg-slate-600"}`}
                    title={isHidden ? "Show category" : "Hide category"}>
                    <i className={`fas ${isHidden ? "fa-eye" : "fa-eye-slash"}`} aria-hidden="true" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setRenamingCat({ old: cat }); setRenameValue(cat); }}
                    className="w-5 h-5 rounded-full bg-slate-500 text-white text-[8px] flex items-center justify-center hover:bg-slate-700"
                    title="Rename category">
                    <i className="fas fa-pen" aria-hidden="true" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteCat(cat); }}
                    className="w-5 h-5 rounded-full bg-rose-500 text-white text-[8px] flex items-center justify-center hover:bg-rose-700"
                    title="Delete category">
                    <i className="fas fa-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rename inline */}
        {renamingCat && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-600">Rename "{renamingCat.old}" to:</span>
            <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRenameFolder()}
              autoFocus
              className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
            <button onClick={handleRenameFolder} disabled={renaming}
              className="px-3 py-1 bg-brand text-white text-xs rounded-lg hover:bg-brand-dark disabled:opacity-60">
              {renaming ? "Saving..." : "Rename"}
            </button>
            <button onClick={() => setRenamingCat(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        )}

        {/* Hide/show category confirm */}
        {hideCat && (() => {
          const catImgs = images.filter(i => (i.category || "").toLowerCase() === hideCat.toLowerCase());
          const allHidden = catImgs.length > 0 && catImgs.every(i => i.is_hidden);
          return (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${allHidden ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
              <i className={`fas ${allHidden ? "fa-eye text-emerald-500" : "fa-eye-slash text-amber-500"} text-xs`} aria-hidden="true" />
              <span className="text-xs text-slate-700 flex-1">
                {allHidden
                  ? <>Show <strong>"{hideCat}"</strong> ({catImgs.length} image{catImgs.length !== 1 ? "s" : ""}) on the public gallery?</>
                  : <>Hide <strong>"{hideCat}"</strong> ({catImgs.length} image{catImgs.length !== 1 ? "s" : ""}) from the public gallery?</>}
              </span>
              <button onClick={handleConfirmToggleHidden}
                className={`px-3 py-1 text-white text-xs rounded-lg ${allHidden ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`}>
                {allHidden ? "Show" : "Hide"}
              </button>
              <button onClick={() => setHideCat(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
            </div>
          );
        })()}

        {/* Delete category confirm */}
        {deleteCat && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <i className="fas fa-exclamation-triangle text-rose-500 text-xs" aria-hidden="true" />
            <span className="text-xs text-slate-700 flex-1">
              Delete <strong>"{deleteCat}"</strong> and all {images.filter(i => (i.category || "").toLowerCase() === deleteCat.toLowerCase()).length} image{images.filter(i => (i.category || "").toLowerCase() === deleteCat.toLowerCase()).length !== 1 ? "s" : ""} in it? This cannot be undone.
            </span>
            <button onClick={handleDeleteCategory} disabled={deletingCat}
              className="px-3 py-1 bg-rose-600 text-white text-xs rounded-lg hover:bg-rose-700 disabled:opacity-60">
              {deletingCat ? "Deleting..." : "Delete"}
            </button>
            <button onClick={() => setDeleteCat(null)} disabled={deletingCat}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-60">Cancel</button>
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.length > 0 && (
          <button onClick={() => { setBatchFolder(filterCat !== "all" ? filterCat : categories[0]); setBatchFiles([]); }}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm">
            <i className="fas fa-images" aria-hidden="true" /> Batch Upload
          </button>
        )}
        <input ref={batchInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleBatchSelect} />
      </div>

      {/* ── Batch upload panel ── */}
      {batchFolder && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <i className="fas fa-images text-emerald-600" aria-hidden="true" /> Batch Upload to "{batchFolder}"
            </h3>
            <button onClick={() => { setBatchFolder(null); setBatchFiles([]); }}
              className="text-slate-400 hover:text-slate-600"><i className="fas fa-times" aria-hidden="true" /></button>
          </div>

          {/* Folder picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 font-medium">Category:</label>
            <select value={batchFolder} onChange={e => setBatchFolder(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* File picker */}
          <button onClick={() => batchInputRef.current?.click()} disabled={batchUploading}
            className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-8 flex flex-col items-center gap-2 text-emerald-600 hover:bg-emerald-100/50 transition disabled:opacity-50">
            <i className="fas fa-cloud-upload-alt text-2xl" aria-hidden="true" />
            <span className="text-sm font-medium">Click to select multiple files</span>
            <span className="text-xs text-slate-400">Images and videos supported</span>
          </button>

          {/* Preview grid */}
          {batchFiles.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {batchFiles.map((f, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden bg-slate-100 aspect-square">
                    {f.file.type.startsWith("video/") ? (
                      <video src={f.preview} muted playsInline className="w-full h-full object-cover" />
                    ) : (
                      <img src={f.preview} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    )}
                    {/* Status overlay */}
                    {f.status === "uploading" && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <i className="fas fa-spinner fa-spin text-white text-lg" aria-hidden="true" />
                      </div>
                    )}
                    {f.status === "done" && (
                      <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                        <i className="fas fa-check-circle text-white text-xl" aria-hidden="true" />
                      </div>
                    )}
                    {f.status === "error" && (
                      <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                        <i className="fas fa-times-circle text-white text-xl" aria-hidden="true" />
                      </div>
                    )}
                    {/* Remove */}
                    {f.status === "pending" && (
                      <button onClick={() => removeBatchFile(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center hover:bg-red-600">
                        <i className="fas fa-times" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{batchFiles.length} file{batchFiles.length !== 1 ? "s" : ""} selected</span>
                <button onClick={handleBatchUpload} disabled={batchUploading || batchFiles.every(f => f.status === "done")}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium">
                  {batchUploading
                    ? <><i className="fas fa-spinner fa-spin text-xs" aria-hidden="true" /> Uploading...</>
                    : <><i className="fas fa-upload text-xs" aria-hidden="true" /> Upload {batchFiles.filter(f => f.status === "pending").length} Files</>}
                </button>
              </div>
            </>
          )}
        </div>
      )}


      {/* ── Image grid ── */}
      {loading ? (
        <GallerySkeleton />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
            <i className="fas fa-images text-slate-300 text-2xl" aria-hidden="true"></i>
          </div>
          <p className="text-slate-500 font-medium">
            {filterCat === "all" ? "No images yet." : `No images in "${filterCat}".`}
          </p>
          <p className="text-sm text-slate-400 mt-1">Upload some images to get started.</p>
          {filterCat !== "all" && (
            <button onClick={() => { setBatchFolder(filterCat); setBatchFiles([]); }}
              className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              <i className="fas fa-upload mr-1" aria-hidden="true" /> Batch upload to this folder
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(img => {
            const isSelected = selectedIds.has(img.id);
            return (
              <div
                key={img.id}
                onClick={() => setPreviewImg(img)}
                className="group bg-white rounded-lg shadow overflow-hidden cursor-pointer relative transition-all hover:shadow-md"
              >
                <div className="relative h-48 bg-slate-100">
                  {isVideoUrl(img.image_url) ? (
                    <video src={img.image_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={img.image_url} alt={img.caption || "Gallery"} loading="lazy" className="w-full h-full object-cover"
                      onError={e => { e.target.src = "https://placehold.co/400x300?text=No+Image"; }} />
                  )}

                  {/* Featured heart toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleSelect(img.id); }}
                    className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow ${
                      isSelected
                        ? "bg-rose-500 text-white scale-110"
                        : "bg-white/80 text-slate-400 hover:text-rose-500 hover:bg-white"
                    }`}
                    title={isSelected ? "Remove from Resort page" : "Add to Resort page"}
                  >
                    <i className={`fas fa-heart text-sm ${isSelected ? "animate-pulse" : ""}`} aria-hidden="true"></i>
                  </button>

                  {/* Move & Delete buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={e => { e.stopPropagation(); setMovingImage({ id: img.id, currentCat: img.category }); setMoveToCat(""); }}
                      className="bg-sky-500 hover:bg-sky-600 text-white w-7 h-7 rounded-full flex items-center justify-center shadow"
                      title="Move to another category"
                    >
                      <i className="fas fa-arrows-alt text-xs" aria-hidden="true"></i>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteId(img.id); }}
                      className="bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center shadow"
                      title="Delete image"
                    >
                      <i className="fas fa-trash text-xs" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>

                <div className="p-3">
                  <p className="text-sm font-medium text-slate-800 truncate">{img.caption || <span className="text-slate-400 italic">No caption</span>}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs bg-info-bg text-info-fg px-2 py-0.5 rounded-full">{img.category}</span>
                    {isSelected && (
                      <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
                        <i className="fas fa-heart text-[10px]" aria-hidden="true"></i> Resort
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} label="Confirm delete">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fas fa-trash text-red-500" aria-hidden="true"></i>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Delete Image</h3>
              <p className="text-sm text-slate-500">This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} disabled={deleting}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
            <button
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await deleteAdminGallery(deleteId);
                  const newImages = images.filter(i => i.id !== deleteId);
                  setImages(newImages);
                  setImageCount(newImages.length);
                  setDeleteId(null);
                  showToast("Image deleted.", "success");
                } catch {
                  showToast("Failed to delete image. Please try again.", "error");
                  setDeleteId(null);
                } finally {
                  setDeleting(false);
                }
              }}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-2">
              {deleting ? <><i className="fas fa-spinner fa-spin text-xs" aria-hidden="true"></i> Deleting…</> : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Move image modal */}
      <Modal open={!!movingImage} onClose={() => setMovingImage(null)} maxWidth="max-w-sm" label="Move image">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
              <i className="fas fa-arrows-alt text-sky-500" aria-hidden="true"></i>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Move Image</h3>
              <p className="text-sm text-slate-500">Currently in "{movingImage?.currentCat}"</p>
            </div>
          </div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Move to category:</label>
          <select value={moveToCat} onChange={e => setMoveToCat(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 mb-4">
            <option value="">Select category…</option>
            {categories.filter(c => c.toLowerCase() !== (movingImage?.currentCat || "").toLowerCase()).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setMovingImage(null)}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleMoveImage} disabled={!moveToCat}
              className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-2">
              <i className="fas fa-arrows-alt text-xs" aria-hidden="true" /> Move
            </button>
          </div>
        </div>
      </Modal>

      {/* Image preview modal */}
      <Modal open={!!previewImg} onClose={() => setPreviewImg(null)} maxWidth="max-w-3xl" label="Image preview">
        {previewImg && (
          <div className="relative">
            {isVideoUrl(previewImg.image_url) ? (
              <video src={previewImg.image_url} controls autoPlay className="w-full max-h-[75vh] object-contain bg-black rounded-t-lg" />
            ) : (
              <img src={previewImg.image_url} alt={previewImg.caption || "Preview"} className="w-full max-h-[75vh] object-contain bg-black rounded-t-lg" loading="eager" decoding="async" />
            )}
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{previewImg.caption || <span className="text-slate-400 italic">No caption</span>}</p>
                <span className="text-xs bg-info-bg text-info-fg px-2 py-0.5 rounded-full mt-1 inline-block">{previewImg.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { toggleSelect(previewImg.id); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedIds.has(previewImg.id) ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  <i className="fas fa-heart text-[10px]" aria-hidden="true" />
                  {selectedIds.has(previewImg.id) ? "On Resort" : "Add to Resort"}
                </button>
                <button onClick={() => { setMovingImage({ id: previewImg.id, currentCat: previewImg.category }); setMoveToCat(""); setPreviewImg(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
                  <i className="fas fa-arrows-alt text-[10px]" aria-hidden="true" /> Move
                </button>
                <button onClick={() => { setDeleteId(previewImg.id); setPreviewImg(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-100 text-rose-600 hover:bg-rose-200">
                  <i className="fas fa-trash text-[10px]" aria-hidden="true" /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Save Resort Gallery confirm — gates featured-image
          publishing per the page-wide policy on mutating actions. */}
      <ConfirmDialog
        open={gallerySaveConfirmOpen}
        title="Update resort gallery?"
        message={<>Push <strong>{selectedIds.size}</strong> selected image{selectedIds.size !== 1 ? 's' : ''} to the public <strong>/resort</strong> page? Unselected images are removed from the featured set.</>}
        confirmLabel="Save to /resort"
        variant="info"
        onConfirm={handleSave}
        onCancel={() => setGallerySaveConfirmOpen(false)}
      />
    </div>
  );
}

// ─── Contact Submissions Tab ──────────────────────────────────────────────────
function ContactSubmissionsTab({ contactCount, setContactCount }) {
  const [contacts, setContacts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast, showToast, clearToast, toastType] = useToast();
  const [selected, setSelected] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const searchRef = useRef(null);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setLoading(true);
    getAdminContacts()
      .then(r => {
        const data = r.data.data || [];
        setContacts(data);
        setContactCount(data.length);
      })
      .catch(() => showToast("Failed to load contact submissions.", "error"))
      .finally(() => setLoading(false));
  }, [showToast, setContactCount]);

  // Open the modal and stamp the row read on the backend so the bell
  // badge decays. Optimistic local update so the UI flips even if the
  // PATCH is in flight; failure path is silent (we'll resync on next
  // poll).
  function openSubmission(c) {
    setSelected(c);
    setReplyBody(c.reply_body || "");
    if (!c.is_read) {
      setContacts(prev => prev.map(x => x.id === c.id ? { ...x, is_read: true } : x));
      markAdminContactRead(c.id).catch(() => {});
    }
  }

  async function handleSendReply() {
    const body = replyBody.trim();
    if (!body || sending || !selected) return;
    setSending(true);
    try {
      const r = await replyAdminContact(selected.id, body);
      const updated = r.data?.data ?? null;
      if (updated) {
        setContacts(prev => prev.map(x => x.id === updated.id ? updated : x));
        setSelected(updated);
      }
      showToast("Reply sent. The customer will receive your email.", "success");
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to send reply. Please try again.";
      showToast(msg, "error");
    } finally {
      setSending(false);
    }
  }

  const filtered = contacts.filter(c =>
    [c.name, c.email, c.subject].some(v => v && v.toLowerCase().includes(debouncedSearch.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const startIdx = (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, filtered.length);

  // Skeleton rows
  const SkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-36"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
      </tr>
    ));

  return (
    <div className="space-y-4">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
          <input ref={searchRef} type="text" aria-label="Search gallery images" placeholder="Search by name, email or subject..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-400 transition" />
          {search && (
            <button onClick={() => { setSearch(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm" aria-hidden="true"></i>
            </button>
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Stats header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fas fa-envelope text-sm text-brand" aria-hidden="true"></i>
            <div>
              <p className="font-semibold text-slate-800 text-sm">All Contact Submissions</p>
              <p className="text-xs text-slate-400">{contacts.length} total</p>
            </div>
          </div>
          {filtered.length > 0 && (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {startIdx}–{endIdx} of {filtered.length}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Subject</th>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100"><SkeletonRows /></tbody>
            </table>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
                <i className="fas fa-envelope text-slate-300 text-2xl" aria-hidden="true"></i>
              </div>
              <p className="text-slate-500 font-medium">
                {debouncedSearch ? "No submissions match your search." : "No contact submissions yet."}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {debouncedSearch
                  ? "Try adjusting your search."
                  : "Submissions from the contact form will appear here."}
              </p>
              {debouncedSearch && (
                <button onClick={() => setSearch("")}
                  className="mt-4 text-sm text-sky-600 hover:text-sky-700 font-medium">
                  <i className="fas fa-times mr-1.5" aria-hidden="true"></i>Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="min-w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-left">Subject</th>
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-6 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginated.map((c, idx) => (
                    <tr key={c.id} className={`hover:bg-sky-50/40 transition ${idx % 2 === 1 ? "bg-slate-50/50" : ""} ${!c.is_read ? "bg-sky-50/60" : ""}`}>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {!c.is_read && (
                          <span className="inline-block h-2 w-2 rounded-full bg-sky-500 mr-2 align-middle" aria-label="Unread" title="Unread"></span>
                        )}
                        {c.name}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{c.email}</td>
                      <td className="px-6 py-4">{c.subject}</td>
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{formatDate(c.created_at)}</td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-3">
                          <button onClick={() => openSubmission(c)}
                            className="text-brand hover:underline text-sm font-medium">View</button>
                          {c.replied_at && (
                            <span className="text-xs text-emerald-600 font-medium" title={`Replied ${formatDate(c.replied_at)}`}>
                              <i className="fas fa-check mr-1" aria-hidden="true"></i>Replied
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Page {safePage} of {totalPages}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                      className="px-4 py-2.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
                      <i className="fas fa-chevron-left text-[10px] mr-1" aria-hidden="true"></i>Prev
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                      className="px-4 py-2.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
                      Next<i className="fas fa-chevron-right text-[10px] ml-1" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* View modal using shared Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} maxWidth="max-w-2xl" label={selected ? `Contact submission — ${selected.subject || selected.name}` : 'Contact submission'}>
        {selected && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 text-lg">Contact Submission</h3>
              <button type="button" onClick={() => setSelected(null)} className="inline-flex items-center justify-center h-11 w-11 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" aria-label="Close contact submission"><i className="fas fa-times" aria-hidden="true"></i></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-lg">
                <div><p className="text-xs text-slate-400">Name</p><p className="font-medium">{selected.name}</p></div>
                <div><p className="text-xs text-slate-400">Email</p><p className="font-medium">{selected.email}</p></div>
                <div className="col-span-2"><p className="text-xs text-slate-400">Subject</p><p className="font-medium">{selected.subject}</p></div>
                <div className="col-span-2"><p className="text-xs text-slate-400">Date</p><p className="font-medium">{formatDate(selected.created_at)}</p></div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Message</p>
                <p className="text-slate-700 bg-slate-50 rounded-lg p-4 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>

              {/* Reply section. Single-reply per submission for v1 — once
                  sent, the textarea becomes a read-only display of what
                  was sent so there's no accidental re-send. Customer
                  replies land in the resort gmail (reply-to header). */}
              <div>
                <p className="text-xs text-slate-400 mb-1">
                  {selected.replied_at ? "Your reply" : "Reply"}
                </p>
                {selected.replied_at ? (
                  <>
                    <p className="text-slate-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg p-4 leading-relaxed whitespace-pre-wrap">
                      {selected.reply_body}
                    </p>
                    <p className="text-xs text-emerald-700 mt-1.5">
                      <i className="fas fa-check-circle mr-1" aria-hidden="true"></i>
                      Sent {formatDate(selected.replied_at)}
                    </p>
                  </>
                ) : (
                  <>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={6}
                      maxLength={10000}
                      placeholder={`Hi ${selected.name}, thanks for reaching out...`}
                      className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 resize-y"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Sent from the resort. Customer's reply will land in the resort gmail.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-5 gap-3">
              {!selected.replied_at && (
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={sending || !replyBody.trim()}
                  className="inline-flex items-center justify-center min-h-11 gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  {sending
                    ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Sending...</>
                    : <><i className="fas fa-paper-plane" aria-hidden="true"></i> Send Reply</>}
                </button>
              )}
              <button type="button" onClick={() => setSelected(null)}
                className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Reviews Tab ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  Approved: "bg-success-bg text-success-fg",
  Rejected: "bg-danger-bg text-danger-fg",
  Pending:  "bg-warning-bg text-warning-fg",
};

const REVIEW_FILTERS = [
  { key: "all",      label: "All" },
  { key: "Pending",  label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
  { key: "featured", label: "Featured" },
];

function ReviewsTab({ content, onSave, reviewCount, setReviewCount }) {
  const { refresh: refreshNotifications } = useNotifications();
  // Mark "reviews seen up to now" so the bell's "N new reviews this
  // week" counter clears. Bell items deep-link straight to this tab,
  // so this is the natural watermark surface.
  useEffect(() => {
    try { localStorage.setItem(REVIEWS_SEEN_KEY, String(Date.now())); } catch { /* quota / private-mode */ }
    refreshNotifications?.();
  }, [refreshNotifications]);

  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast, showToast, clearToast, toastType] = useToast();
  const [saving,   setSaving]   = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Section settings editing
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState(content);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));
  const cancelEdit = () => { setForm(content); setEditing(false); };
  const saveEdit   = () => { onSave(form); setEditing(false); };
  const toggleVisible = () => onSave({ ...content, visible: !content.visible });

  // Filters, search, pagination
  const [filterStatus, setFilterStatus] = useState("all");
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const searchRef = useRef(null);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(() => {
    setLoading(true);
    getAdminReviews()
      .then(r => {
        const data = r.data.data || [];
        setReviews(data);
        setReviewCount(data.length);
      })
      .catch(() => showToast("Failed to load reviews.", "error"))
      .finally(() => setLoading(false));
  }, [showToast, setReviewCount]);

  useEffect(() => { load(); }, [load]);

  async function patch(id, data) {
    setSaving(id);
    try {
      await updateAdminReview(id, data);
      setReviews(rs => rs.map(r => r.id === id ? { ...r, ...data } : r));
      showToast("Review updated!", "success");
      refreshNotifications?.();
    } catch {
      showToast("Failed to update review.", "error");
    } finally {
      setSaving(null);
    }
  }

  async function remove(id) {
    setSaving(id);
    try {
      await deleteAdminReview(id);
      const newReviews = reviews.filter(r => r.id !== id);
      setReviews(newReviews);
      setReviewCount(newReviews.length);
      showToast("Review deleted.", "success");
      refreshNotifications?.();
    } catch {
      showToast("Failed to delete review.", "error");
    } finally {
      setSaving(null);
      setDeleteConfirm(null);
    }
  }

  const featured  = reviews.filter(r => r.featured).length;
  const pending   = reviews.filter(r => r.status === "Pending").length;

  // Filter + search
  const filtered = reviews.filter(r => {
    if (filterStatus === "featured" && !r.featured) return false;
    if (filterStatus !== "all" && filterStatus !== "featured" && r.status !== filterStatus) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return [r.guestName, r.comment, r.room].some(v => v && v.toLowerCase().includes(q));
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus]);

  // Skeleton
  const SkeletonRows = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="px-5 py-4 animate-pulse flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-40"></div>
          <div className="h-3 bg-slate-200 rounded w-64"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-7 bg-slate-200 rounded w-16"></div>
          <div className="h-7 bg-slate-200 rounded w-16"></div>
        </div>
      </div>
    ));

  return (
    <div className="space-y-5">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Section settings card */}
      <SectionCard
        icon="fa-star" title="Reviews Section" badge="Resort page · /resort"
        editing={editing} onEdit={() => setEditing(true)} onSave={saveEdit} onCancel={cancelEdit}
        visible={content.visible} onToggleVisible={toggleVisible}
      >
        {!editing ? (
          <div>
            <p className="font-semibold text-slate-800 text-sm">{content.sectionTitle}</p>
            <p className="text-xs text-slate-500 mt-1">{content.sectionSubtitle}</p>
            <p className="text-xs text-slate-300 mt-2 italic">Only featured reviews appear on the resort page.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Section Title"    value={form.sectionTitle}    onChange={f("sectionTitle")} />
            <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={f("sectionSubtitle")} rows={2} />
          </div>
        )}
      </SectionCard>

      {/* Search + filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
          <input ref={searchRef} type="text" aria-label="Search testimonials" placeholder="Search by guest name, comment, or room..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-400 transition" />
          {search && (
            <button onClick={() => { setSearch(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm" aria-hidden="true"></i>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {REVIEW_FILTERS.map(rf => (
            <button key={rf.key} onClick={() => setFilterStatus(rf.key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                filterStatus === rf.key
                  ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}>
              {rf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Stats header bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-slate-600">Total</p>
              <p className="text-2xl font-semibold text-slate-900">{reviews.length}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Featured</p>
              <p className="text-2xl font-semibold text-emerald-600">{featured}</p>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <p className="text-sm text-slate-600">Pending</p>
              <p className="text-2xl font-semibold text-amber-600">{pending}</p>
            </div>
          </div>
          {(debouncedSearch || filterStatus !== "all") && (
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              Showing {filtered.length} of {reviews.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100"><SkeletonRows /></div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
              <i className="fas fa-star text-slate-300 text-2xl" aria-hidden="true"></i>
            </div>
            <p className="text-slate-500 font-medium">
              {debouncedSearch || filterStatus !== "all" ? "No reviews match your filter." : "No reviews yet."}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {debouncedSearch || filterStatus !== "all"
                ? "Try adjusting your search or filter."
                : "Guest reviews will appear here once submitted."}
            </p>
            {(debouncedSearch || filterStatus !== "all") && (
              <button onClick={() => { setSearch(""); setFilterStatus("all"); }}
                className="mt-4 text-sm text-sky-600 hover:text-sky-700 font-medium">
                <i className="fas fa-times mr-1.5" aria-hidden="true"></i>Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200">
              {paginated.map(r => (
                <div key={r.id} className={`px-5 py-4 flex flex-col md:flex-row md:items-start gap-4 ${saving === r.id ? "opacity-50 pointer-events-none" : ""}`}>
                  {/* Left: guest info + review */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900 text-sm">{r.guestName}</span>
                      <span className="text-yellow-400 text-xs">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.status}
                      </span>
                      {r.featured && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1">
                          <i className="fas fa-heart text-[10px]" aria-hidden="true"></i> Featured
                        </span>
                      )}
                      {r.room && <span className="text-xs text-slate-400">{r.room}</span>}
                      <span className="text-xs text-slate-300 ml-auto">{r.date}</span>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">&ldquo;{r.comment}&rdquo;</p>
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
                    <button onClick={() => setDeleteConfirm(r.id)}
                      className="text-xs px-3 py-1.5 bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg font-medium">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <p className="text-xs text-slate-500">Page {safePage} of {totalPages}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                    className="px-4 py-2.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
                    <i className="fas fa-chevron-left text-[10px] mr-1" aria-hidden="true"></i>Prev
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                    className="px-4 py-2.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
                    Next<i className="fas fa-chevron-right text-[10px] ml-1" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} label="Confirm delete">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fas fa-trash text-red-500" aria-hidden="true"></i>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Delete Review</h3>
              <p className="text-sm text-slate-500">This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={() => remove(deleteConfirm)}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg inline-flex items-center gap-2">
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Full-page site preview modal ────────────────────────────────────────────

function SitePreviewModal({ open, onClose }) {
  const [page, setPage]       = useState('/');
  const [iframeKey, setKey]   = useState(0);

  if (!open) return null;

  const pages = [
    { label: 'Home Page', path: '/' },
    { label: 'Resort Page', path: '/resort' },
    { label: 'Rooms Page', path: '/rooms' },
    { label: 'Gallery Page', path: '/gallery' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-brand text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <i className="fas fa-eye text-sm" aria-hidden="true"></i>
          <span className="font-semibold text-sm">Site Preview</span>
        </div>

        {/* Page tabs */}
        <div className="flex items-center gap-1 ml-4 bg-white/10 rounded-lg p-1">
          {pages.map(p => (
            <button
              key={p.path}
              onClick={() => { setPage(p.path); setKey(k => k + 1); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                page === p.path ? 'bg-white text-brand' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* URL bar */}
        <div className="flex-1 mx-3">
          <div className="bg-white/10 text-white/80 text-xs px-3 py-1.5 rounded-lg font-mono truncate">
            localhost:5173{page}
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={() => setKey(k => k + 1)}
          title="Refresh preview"
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
        >
          <i className="fas fa-rotate-right text-sm" aria-hidden="true"></i>
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-lg hover:bg-white/10 flex items-center justify-center transition"
          title="Close preview"
          aria-label="Close"
        >
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      {/* iframe */}
      <iframe
        key={iframeKey}
        src={page}
        title="Site preview"
        className="flex-1 w-full bg-white border-0"
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminContent() {
  // Tab state — both outer (Pages | Announcements) and inner Pages
  // sub-tabs (Page Editor | Gallery | Contact | Reviews) live in the
  // same `?tab=` query param so dashboard / bell deep-links land on
  // the right surface and shared URLs survive a page refresh.
  //   ?tab=announcements   → outer = Announcements
  //   ?tab=gallery|contact|reviews → outer = Pages, inner = matching
  //   no param / ?tab=pages → outer = Pages, inner = Page Editor (0)
  const INNER_TAB_KEYS = ['pages', 'gallery', 'contact', 'reviews'];
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const outerTab = tabParam === 'announcements' ? 'announcements' : 'pages';
  const setOuterTab = (key) => {
    if (key === 'pages') setSearchParams({});
    else setSearchParams({ tab: key });
  };

  // Derive inner tab index from the URL so direct links work, then
  // mirror it into local state for click-driven updates. The effect
  // below keeps state in sync if the URL changes (back/forward nav,
  // outer-tab click resetting params).
  const innerIdxFromUrl = Math.max(0, INNER_TAB_KEYS.indexOf(tabParam));
  const [activeTab,   setActiveTab]   = useState(innerIdxFromUrl);
  useEffect(() => { setActiveTab(innerIdxFromUrl); }, [innerIdxFromUrl]);
  const setInnerTab = (i) => {
    setActiveTab(i);
    const key = INNER_TAB_KEYS[i];
    if (key === 'pages') setSearchParams({});
    else setSearchParams({ tab: key });
  };
  const [content,     setContent]     = useState(loadContent);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, showToast, clearToast, toastType] = useToast();

  // Counts for tab badges
  const [imageCount,   setImageCount]   = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [reviewCount,  setReviewCount]  = useState(0);

  const TABS = [
    { label: "Page Editor", icon: "fa-pen-fancy" },
    { label: "Gallery",     icon: "fa-images",   count: imageCount },
    { label: "Contact",     icon: "fa-envelope",  count: contactCount },
    { label: "Reviews",     icon: "fa-star",      count: reviewCount },
  ];

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
    saveContent(next);
    showToast("Publishing to website...", "info");
    updateAdminContent({ [`page_${key}`]: val })
      .then(() => { showToast("Published! Changes are now live.", "success"); })
      .catch(() => { showToast("Failed to publish.", "error"); });
  };

  const OUTER_TABS = [
    { key: 'pages',         icon: 'fa-palette',  label: 'Pages'        },
    { key: 'announcements', icon: 'fa-bullhorn', label: 'Announcements' },
  ];

  // Announcements tab — delegate to the existing OwnerAnnouncements page.
  if (outerTab === 'announcements') {
    return (
      <>
        <TabBar tabs={OUTER_TABS} active={outerTab} onChange={setOuterTab} />
        <OwnerAnnouncements />
      </>
    );
  }

  return (
    <>
      <TabBar tabs={OUTER_TABS} active={outerTab} onChange={setOuterTab} />
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Page header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <i className="fas fa-palette text-indigo-600" aria-hidden="true"></i>
            </span>
            Content Management
          </h2>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Manage your website content, gallery, reviews, and contact submissions.</p>
        </div>
        <button onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition shadow-sm">
          <i className="fas fa-eye text-xs" aria-hidden="true"></i> Preview Site
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl shadow-sm p-2 flex items-center gap-1 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button key={tab.label} onClick={() => setInnerTab(i)}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === i
                ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}>
            <i className={`fas ${tab.icon} text-xs`} aria-hidden="true"></i>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === i ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <SitePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} />

      {/* Page Editor */}
      {activeTab === 0 && (
        <div className="space-y-6">

          {/* ── Navbar (top of every page) ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center">
                <i className="fas fa-bars text-brand text-[10px]" aria-hidden="true"></i>
              </span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Navigation Bar</h2>
              <span className="text-[10px] text-slate-300 font-normal normal-case ml-1">top of every page</span>
            </div>
            <NavbarEditor content={content.navbar} onSave={update("navbar")} />
          </div>

          {/* ── Home Page ── */}
          <div className="border-t border-dashed border-slate-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-blue-50 flex items-center justify-center">
                <i className="fas fa-home text-brand text-[10px]" aria-hidden="true"></i>
              </span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Home Page</h2>
              <span className="text-[10px] text-slate-300 font-normal normal-case ml-1">/</span>
            </div>
            <div className="space-y-3">
              <HomeHeroEditor    content={content.home_hero}    onSave={update("home_hero")} />
              {/* HomeResortsEditor (PLURAL) removed — was a legacy
                  multi-resort block Home.jsx never consumed. See
                  defaults comment. The SINGULAR home_resort editor
                  below is the actual "About the resort" card that
                  ships on Home. */}
              <HomeResortEditor  content={content.home_resort}  onSave={update("home_resort")} />
              <HomeWhyEditor     content={content.home_why}     onSave={update("home_why")} />
              <HomeCTAEditor     content={content.home_cta}     onSave={update("home_cta")} />
            </div>
          </div>

          {/* ── Resort Page ── */}
          <div className="border-t border-dashed border-slate-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-sky-50 flex items-center justify-center">
                <i className="fas fa-umbrella-beach text-brand text-[10px]" aria-hidden="true"></i>
              </span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Resort Page</h2>
              <span className="text-[10px] text-slate-300 font-normal normal-case ml-1">/resort</span>
            </div>
            <div className="space-y-3">
              <ResortHeroEditor          content={content.resort_hero}       onSave={update("resort_hero")} />
              <ResortAboutEditor         content={content.resort_about}      onSave={update("resort_about")} />
              <ResortRoomsSectionEditor  content={content.resort_rooms}      onSave={update("resort_rooms")} />
              <ResortAmenitiesEditor />
              <ResortReviewsEditor       content={content.resort_reviews}    onSave={update("resort_reviews")} />
              <ResortContactEditor       content={content.resort_contact}    onSave={update("resort_contact")} />
              <ResortNewsletterEditor    content={content.resort_newsletter} onSave={update("resort_newsletter")} />
            </div>
          </div>

          {/* ── Rooms Page ── */}
          <div className="border-t border-dashed border-slate-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-indigo-50 flex items-center justify-center">
                <i className="fas fa-bed text-brand text-[10px]" aria-hidden="true"></i>
              </span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Rooms Page</h2>
              <span className="text-[10px] text-slate-300 font-normal normal-case ml-1">/rooms</span>
            </div>
            <div className="space-y-3">
              <RoomsHeroEditor content={content.rooms_hero} onSave={update("rooms_hero")} />
            </div>
          </div>

          {/* ── Gallery Page ── */}
          <div className="border-t border-dashed border-slate-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-amber-50 flex items-center justify-center">
                <i className="fas fa-images text-brand text-[10px]" aria-hidden="true"></i>
              </span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Gallery Page</h2>
              <span className="text-[10px] text-slate-300 font-normal normal-case ml-1">/gallery</span>
            </div>
            <div className="space-y-3">
              <GalleryHeroEditor content={content.gallery_hero} onSave={update("gallery_hero")} />
            </div>
          </div>

          {/* ── Footer (bottom of every page) ── */}
          <div className="border-t border-dashed border-slate-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center">
                <i className="fas fa-shoe-prints text-brand text-[10px]" aria-hidden="true"></i>
              </span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Footer</h2>
              <span className="text-[10px] text-slate-300 font-normal normal-case ml-1">bottom of every page</span>
            </div>
            <FooterEditor content={content.footer} onSave={update("footer")} />
          </div>
        </div>
      )}

      {activeTab === 1 && <GalleryTab imageCount={imageCount} setImageCount={setImageCount} />}
      {activeTab === 2 && <ContactSubmissionsTab contactCount={contactCount} setContactCount={setContactCount} />}
      {activeTab === 3 && <ReviewsTab content={content.resort_reviews} onSave={update("resort_reviews")} reviewCount={reviewCount} setReviewCount={setReviewCount} />}
    </div>
    </>
  );
}
