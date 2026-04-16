import { useState, useEffect, useRef, useCallback } from "react";
import { getAdminGallery, createAdminGallery, batchFeaturedGallery, deleteAdminGallery, getAdminContacts, updateAdminContent, getAdminReviews, updateAdminReview, deleteAdminReview, getResortAmenities, createResortAmenity, updateResortAmenity, deleteResortAmenity } from "../../lib/adminApi";
import { api } from "../../lib/api";
import { RESORT_ID } from "../../lib/config.js";
import ImageUpload from "../../components/ui/ImageUpload.jsx";
import MediaPicker from "../../components/ui/MediaPicker.jsx";
import { isVideoUrl } from "../../lib/uploadApi.js";
import Modal from "../../components/modals/Modal.jsx";
import Toast, { useToast } from "../../components/ui/Toast";
import useDebounce from "../../hooks/useDebounce.js";

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
  home_hero: {
    background: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80",
    title:      "Welcome to Paradise",
    subtitle:   "Choose your perfect getaway from our collection of stunning beach resorts.",
    ctaText:    "Book Now",
  },
  home_why: {
    sectionTitle: "Why Choose Aplaya?",
    sectionSubtitle: "Everything you need for the perfect beach getaway, all in one place.",
    features: [
      { icon: "fa-umbrella-beach", title: "Beachfront Location", desc: "Direct access to pristine sandy beaches with crystal-clear waters." },
      { icon: "fa-bed", title: "Luxury Rooms", desc: "Spacious, modern accommodations with stunning ocean views." },
      { icon: "fa-utensils", title: "Fine Dining", desc: "Savor exquisite cuisine at our beachside restaurants." },
      { icon: "fa-spa", title: "Relaxation", desc: "Unwind with our world-class spa and wellness facilities." },
    ],
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
  home_cta: {
    title: "Ready for Paradise?",
    subtitle: "Book your dream beach vacation today and create memories that last a lifetime.",
    buttonText: "Book Your Stay",
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
  },
  resort_rooms: {
    sectionTitle:    "Our Accommodations",
    sectionSubtitle: "Choose from our selection of luxurious rooms and suites, each designed to provide the ultimate comfort and relaxation.",
  },
  resort_contact: {
    address:        "123 Beachfront Avenue, Coastal City, Paradise Island",
    phone:          "+1 (555) 123-4567",
    email:          "reservations@aplayabeachresort.com",
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

  return (
    <div className={`bg-white rounded-lg shadow border ${editing ? "border-[#1e3a8a]" : visible === false ? "border-slate-200 opacity-60" : "border-slate-200"} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${visible === false ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-[#1e3a8a]"}`}>
            <i className={`fas ${icon} text-sm`}></i>
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
              <i className={`fas ${visible ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
              {visible ? "Hide" : "Show"}
            </button>
          )}
          {!editing && (
            <button
              onClick={onEdit}
              className="text-xs bg-slate-100 hover:bg-[#1e3a8a] hover:text-white text-slate-600 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <i className="fas fa-pen text-xs"></i> Edit
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

function HeroPreview({ bg, title, subtitle, extra }) {
  return (
    <div className="relative rounded-lg overflow-hidden h-36 bg-slate-200 mt-4 border border-slate-200">
      {isVideoUrl(bg)
        ? <video src={bg} autoPlay muted loop playsInline className="w-full h-full object-cover" />
        : bg
          ? <img src={bg} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
          : <div className="w-full h-full bg-gradient-to-br from-slate-300 to-slate-400" />
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
      ? <img src={image} alt={name} className={`${size} w-auto object-contain`} onError={e => { e.target.style.display = "none"; }} />
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
                    <img src={form.logoImage} alt="Logo" className="h-full w-full object-contain p-1.5" onError={e => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="text-center">
                      <i className="fas fa-image text-slate-300 text-lg"></i>
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
                      <i className="fas fa-times text-[8px]"></i> Remove logo
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
              <p className="text-xs text-slate-600 flex items-center gap-1.5"><i className="fas fa-map-marker-alt text-[#1e3a8a] w-3 text-center text-[10px]"></i>{content.address || <span className="text-slate-300 italic">Not set</span>}</p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5"><i className="fas fa-phone text-[#1e3a8a] w-3 text-center text-[10px]"></i>{content.phone || <span className="text-slate-300 italic">Not set</span>}</p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5"><i className="fas fa-envelope text-[#1e3a8a] w-3 text-center text-[10px]"></i>{content.email || <span className="text-slate-300 italic">Not set</span>}</p>
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
                  <i className="fas fa-quote-left text-blue-500 text-[10px]"></i>
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
                  <i className="fas fa-phone text-sky-500 text-[10px]"></i>
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
                  <i className="fas fa-clock text-amber-500 text-[10px]"></i>
                </span>
                Opening Hours
              </h3>
              <button type="button"
                onClick={() => setForm(p => ({ ...p, hours: [...(p.hours || []), { day: "", time: "" }] }))}
                className="text-xs text-[#1e3a8a] hover:underline flex items-center gap-1">
                <i className="fas fa-plus text-[10px]"></i> Add Row
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
                      <i className="fas fa-times text-xs"></i>
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
                  <i className="fas fa-share-alt text-pink-500 text-[10px]"></i>
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
            : <img src={content.background} alt="hero bg" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
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
                    : <img src={form.background} alt="Background" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
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

// ─── HomeWhyEditor ───────────────────────────────────────────────────────────
const WHY_ICON_OPTIONS = [
  "fa-umbrella-beach", "fa-bed", "fa-utensils", "fa-spa", "fa-wifi",
  "fa-swimming-pool", "fa-cocktail", "fa-sun", "fa-ship", "fa-mountain",
  "fa-tree", "fa-car", "fa-plane", "fa-map-marked-alt", "fa-heart", "fa-star",
];

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
              <div key={i} className="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/50 p-3 text-center hover:shadow-sm transition">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-1.5">
                  <i className={`fas ${f.icon} text-[#1e3a8a] text-sm`}></i>
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
                  className="text-xs text-[#1e3a8a] hover:underline flex items-center gap-1">
                  <i className="fas fa-plus text-[10px]"></i> Add Feature
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
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Icon</label>
                      <select value={feat.icon} onChange={e => updateFeature(i, "icon", e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400">
                        {WHY_ICON_OPTIONS.map(ico => (
                          <option key={ico} value={ico}>{ico.replace("fa-", "")}</option>
                        ))}
                      </select>
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
                    <i className={`fas ${feat.icon} text-[#1e3a8a] text-sm`}></i>
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
                  onError={e => { e.target.style.display = "none"; }} />
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
                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50/30 hover:from-slate-100 hover:to-blue-50/50 text-left transition"
                  >
                    <div className="flex items-center gap-3">
                      <img src={card.image} alt={card.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={e => { e.target.style.display = "none"; }} />
                      <span className="text-sm font-medium text-slate-700">{card.name}</span>
                    </div>
                    <i className={`fas fa-chevron-${expandedCard === i ? "up" : "down"} text-xs text-slate-400`}></i>
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
                              <img src={card.image} alt="Card" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} />
                            ) : (
                              <i className="fas fa-image text-slate-300"></i>
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
                            ? <img src={card.image} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                            : <div className="w-full h-full flex items-center justify-center text-slate-300"><i className="fas fa-image text-2xl"></i></div>
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
        <div className="rounded-xl overflow-hidden bg-gradient-to-r from-blue-600 to-blue-800 p-4 text-center text-white">
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
          <div className="p-5 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl text-center text-white">
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
            : <img src={content.background} alt="hero bg" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
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
                    : <img src={form.background} alt="Background" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
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
                : <img src={content.image} alt="about" className="w-28 h-20 object-cover rounded-lg shrink-0 border border-slate-200" onError={e => { e.target.style.display = "none"; }} />
            ) : (
              <div className="w-28 h-20 rounded-lg bg-slate-200 shrink-0 flex items-center justify-center text-slate-300">
                <i className="fas fa-image text-lg"></i>
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
                    : <img src={form.image} alt="Section" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
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
          {/* About preview */}
          <div className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-3 font-medium">Live Preview</p>
            <div className="flex gap-4">
              {form.image
                ? isVideoUrl(form.image)
                  ? <video src={form.image} muted playsInline className="w-28 h-24 object-cover rounded-lg flex-shrink-0 border border-slate-200" />
                  : <img src={form.image} alt="" className="w-28 h-24 object-cover rounded-lg flex-shrink-0 border border-slate-200" onError={e => { e.target.style.display='none'; }} />
                : <div className="w-28 h-24 rounded-lg bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-300"><i className="fas fa-image text-2xl"></i></div>
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
                <div className="h-10 bg-gradient-to-br from-slate-100 to-slate-200"></div>
                <div className="p-2 space-y-1">
                  <div className="h-2.5 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-100 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-300 mt-2 italic flex items-center gap-1">
            <i className="fas fa-info-circle"></i>Individual rooms are managed in Manage Rooms
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Section Title" value={form.sectionTitle} onChange={f("sectionTitle")} />
          <Field label="Section Subtitle" value={form.sectionSubtitle} onChange={f("sectionSubtitle")} rows={2} />
          <p className="text-xs text-slate-400 italic">
            <i className="fas fa-info-circle mr-1"></i>
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
        <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}
          className="px-4 py-2 text-xs font-medium text-white bg-[#1e3a8a] rounded-lg hover:bg-[#152c6e] disabled:opacity-50 transition">
          {saving ? "Saving..." : label}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
          Cancel
        </button>
      </div>
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
            <i className="fas fa-concierge-bell text-[#1e3a8a] text-sm"></i>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Resort Amenities</p>
            <p className="text-xs text-slate-400">Resort page · /resort · hidden when empty</p>
          </div>
        </div>
        {!adding && !editingId && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1e3a8a] rounded-lg hover:bg-[#152c6e] transition">
            <i className="fas fa-plus text-xs"></i> Add Amenity
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
                      <i className="fas fa-pen text-xs"></i>
                    </button>
                    <button onClick={() => setDeleteConfirm(a.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <i className="fas fa-trash text-xs"></i>
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
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fas fa-trash text-red-500"></i>
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
                  <i className={`fas ${item.icon} text-[#1e3a8a] text-[10px]`}></i>
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
              <i className="fas fa-map-marked-alt text-slate-200 text-lg"></i>
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
                  <i className="fas fa-phone text-sky-500 text-[10px]"></i>
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
                  <i className="fas fa-map-marked-alt text-emerald-500 text-[10px]"></i>
                </span>
                Map Settings
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Map URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Google Maps Embed URL
                </label>
                <input
                  type="url"
                  value={form.map_url || ""}
                  onChange={e => f("map_url")(e.target.value)}
                  placeholder="https://maps.google.com/maps?q=...&output=embed"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
                  <p className="font-semibold"><i className="fas fa-info-circle mr-1"></i>How to get your embed URL:</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li>Go to <span className="font-medium">Google Maps</span> and search your resort</li>
                    <li>Click <span className="font-medium">Share</span> → <span className="font-medium">Embed a map</span></li>
                    <li>Copy only the <span className="font-medium">src="..."</span> URL from the iframe code</li>
                    <li>Paste it here</li>
                  </ol>
                </div>
              </div>

              {/* Directions URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  "Get Directions" Link <span className="text-slate-400 font-normal">(plain Google Maps URL shown on the map)</span>
                </label>
                <input
                  type="url"
                  value={form.directions_url || ""}
                  onChange={e => f("directions_url")(e.target.value)}
                  placeholder="https://www.google.com/maps/place/Aplaya+Beach+Resort/@14.33237,120.76971,17z"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <p className="text-xs text-slate-400 mt-1">
                  On Google Maps, search your resort → copy the URL from the browser address bar → paste here.
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Live Preview</p>
            <div className="space-y-1.5 text-sm text-slate-700">
              <p><i className="fas fa-map-marker-alt w-4 text-[#1e3a8a] mr-2"></i>{form.address || <span className="text-slate-300 italic">Address</span>}</p>
              <p><i className="fas fa-phone w-4 text-[#1e3a8a] mr-2"></i>{form.phone || <span className="text-slate-300 italic">Phone</span>}</p>
              <p><i className="fas fa-envelope w-4 text-[#1e3a8a] mr-2"></i>{form.email || <span className="text-slate-300 italic">Email</span>}</p>
            </div>
            {(form.osm_url || form.map_url) ? (
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <iframe src={form.osm_url || form.map_url} width="100%" height="200" style={{ border: 0 }} loading="lazy" title="Map preview" />
              </div>
            ) : (
              <div className="h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-sm">
                <i className="fas fa-map-marked-alt mr-2"></i>Map preview will appear here
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
                  <i className="fas fa-user text-white text-[8px]"></i>
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
        <div className="rounded-xl overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-600 p-3.5 text-white">
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
            : <img src={content.background} alt="hero bg" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
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
                    : <img src={form.background} alt="Background" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
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
            : <img src={content.background} alt="hero bg" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
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
                    : <img src={form.background} alt="Background" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="text-center"><i className="fas fa-image text-slate-300 text-lg"></i><p className="text-[9px] text-slate-300 mt-0.5">No image</p></div>
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

const CATEGORIES = ["beach", "rooms", "amenities", "dining", "events", "other"];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Gallery Tab ──────────────────────────────────────────────────────────────
function GalleryTab({ imageCount, setImageCount }) {
  const [images,      setImages]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const savedIdsRef                   = useRef(new Set());
  const [showForm,    setShowForm]    = useState(false);
  const [filterCat,   setFilterCat]   = useState("all");
  const [deleteId,    setDeleteId]    = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [addSaving,   setAddSaving]   = useState(false);
  const [toast, showToast, clearToast, toastType] = useToast();
  const [form, setForm] = useState({ image_url: "", caption: "", category: "beach", sort_order: "" });

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

  const filtered = (filterCat === "all" ? images : images.filter(i => i.category === filterCat))
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

  async function handleSave() {
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

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.image_url) { showToast("Please upload an image or video first.", "error"); return; }
    setAddSaving(true);
    try {
      const payload = {
        resort_id:  RESORT_ID,
        image_url:  form.image_url,
        caption:    form.caption || null,
        category:   form.category,
        sort_order: parseInt(form.sort_order) || images.length + 1,
      };
      const r = await createAdminGallery(payload);
      const newImages = [...images, r.data.data];
      setImages(newImages);
      setImageCount(newImages.length);
      setForm({ image_url: "", caption: "", category: "beach", sort_order: "" });
      setShowForm(false);
      showToast("Image added to gallery!", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to add image.", "error");
    } finally {
      setAddSaving(false);
    }
  };

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
            Click images below to select or deselect them.
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500">Filter:</span>
          {["all", ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterCat === cat ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-4 py-2 rounded-lg text-sm">
          <i className="fas fa-plus"></i> Add Image
        </button>
      </div>

      {showForm ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Add New Gallery Image</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Image / Video <span className="text-red-500">*</span></label>
              <div className="flex items-start gap-4">
                <div className="h-24 w-32 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {form.image_url ? (
                    isVideoUrl(form.image_url)
                      ? <video src={form.image_url} muted playsInline className="h-full w-full object-cover" />
                      : <img src={form.image_url} alt="Gallery" className="h-full w-full object-cover" onError={e => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="text-center"><i className="fas fa-cloud-upload-alt text-slate-300 text-xl"></i><p className="text-[9px] text-slate-300 mt-1">Upload</p></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <ImageUpload
                    value={form.image_url}
                    onChange={url => setForm(f => ({ ...f, image_url: url }))}
                    folder="gallery"
                    accept="image/*,video/*"
                    label="Upload Image or Video"
                  />
                  {!form.image_url && (
                    <p className="text-[10px] text-red-400">Please upload an image or video before adding.</p>
                  )}
                  {form.image_url && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "" }))}
                      className="text-[10px] text-red-400 hover:text-red-600 transition flex items-center gap-1">
                      <i className="fas fa-times text-[8px]"></i> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Caption <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="text" placeholder="Short description" value={form.caption}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={addSaving}
                className="px-4 py-2 text-sm bg-[#1e3a8a] hover:bg-[#152c6e] disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-2">
                {addSaving ? <><i className="fas fa-spinner fa-spin text-xs"></i> Adding…</> : "Add Image"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {loading ? (
        <GallerySkeleton />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 mb-4">
            <i className="fas fa-images text-slate-300 text-2xl"></i>
          </div>
          <p className="text-slate-500 font-medium">No images in this category.</p>
          <p className="text-sm text-slate-400 mt-1">Upload some images to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(img => {
            const isSelected = selectedIds.has(img.id);
            return (
              <div
                key={img.id}
                onClick={() => toggleSelect(img.id)}
                className={`group bg-white rounded-lg shadow overflow-hidden cursor-pointer relative transition-all ${
                  isSelected
                    ? "ring-3 ring-[#1e3a8a] ring-offset-2"
                    : "opacity-70 hover:opacity-90 hover:shadow-md"
                }`}
              >
                <div className="relative h-48 bg-slate-100">
                  {isVideoUrl(img.image_url) ? (
                    <video src={img.image_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={img.image_url} alt={img.caption || "Gallery"} className="w-full h-full object-cover"
                      onError={e => { e.target.src = "https://placehold.co/400x300?text=No+Image"; }} />
                  )}

                  {/* Checkmark overlay */}
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? "bg-[#1e3a8a] border-[#1e3a8a]"
                      : "bg-white/70 border-white"
                  }`}>
                    {isSelected && <i className="fas fa-check text-white text-xs"></i>}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteId(img.id); }}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow transition"
                    title="Delete image"
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                </div>

                <div className="p-3">
                  <p className="text-sm font-medium text-slate-800 truncate">{img.caption || <span className="text-slate-400 italic">No caption</span>}</p>
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

      {/* Delete modal using shared Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fas fa-trash text-red-500"></i>
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
              {deleting ? <><i className="fas fa-spinner fa-spin text-xs"></i> Deleting…</> : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Contact Submissions Tab ──────────────────────────────────────────────────
function ContactSubmissionsTab({ contactCount, setContactCount }) {
  const [contacts, setContacts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast, showToast, clearToast, toastType] = useToast();
  const [selected, setSelected] = useState(null);
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
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input ref={searchRef} type="text" placeholder="Search by name, email or subject..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-400 transition" />
          {search && (
            <button onClick={() => { setSearch(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm"></i>
            </button>
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {/* Stats header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fas fa-envelope text-sm text-[#1e3a8a]"></i>
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
                <i className="fas fa-envelope text-slate-300 text-2xl"></i>
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
                  <i className="fas fa-times mr-1.5"></i>Clear search
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
                    <tr key={c.id} className={`hover:bg-sky-50/40 transition ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}>
                      <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                      <td className="px-6 py-4 text-slate-500">{c.email}</td>
                      <td className="px-6 py-4">{c.subject}</td>
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{formatDate(c.created_at)}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => setSelected(c)}
                          className="text-[#1e3a8a] hover:underline text-sm font-medium">View</button>
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
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
                      <i className="fas fa-chevron-left text-[10px] mr-1"></i>Prev
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
                      Next<i className="fas fa-chevron-right text-[10px] ml-1"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* View modal using shared Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} maxWidth="max-w-lg">
        {selected && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 text-lg">Contact Submission</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close"><i className="fas fa-times"></i></button>
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
                <p className="text-slate-700 bg-slate-50 rounded-lg p-4 leading-relaxed">{selected.message}</p>
              </div>
            </div>
            <div className="flex justify-end mt-5 gap-2">
              <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#152c6e] text-white px-4 py-2 rounded-lg text-sm">
                <i className="fas fa-reply"></i> Reply via Email
              </a>
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Reviews Tab ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  Pending:  "bg-amber-100 text-amber-700",
};

const REVIEW_FILTERS = [
  { key: "all",      label: "All" },
  { key: "Pending",  label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
  { key: "featured", label: "Featured" },
];

function ReviewsTab({ content, onSave, reviewCount, setReviewCount }) {
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
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input ref={searchRef} type="text" placeholder="Search by guest name, comment, or room..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm placeholder:text-slate-400 transition" />
          {search && (
            <button onClick={() => { setSearch(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <i className="fas fa-times-circle text-sm"></i>
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
              <i className="fas fa-star text-slate-300 text-2xl"></i>
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
                <i className="fas fa-times mr-1.5"></i>Clear filters
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
                          <i className="fas fa-heart text-[10px]"></i> Featured
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
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
                    <i className="fas fa-chevron-left text-[10px] mr-1"></i>Prev
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
                    Next<i className="fas fa-chevron-right text-[10px] ml-1"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fas fa-trash text-red-500"></i>
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
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1e3a8a] text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <i className="fas fa-eye text-sm"></i>
          <span className="font-semibold text-sm">Site Preview</span>
        </div>

        {/* Page tabs */}
        <div className="flex items-center gap-1 ml-4 bg-white/10 rounded-lg p-1">
          {pages.map(p => (
            <button
              key={p.path}
              onClick={() => { setPage(p.path); setKey(k => k + 1); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                page === p.path ? 'bg-white text-[#1e3a8a]' : 'text-white/80 hover:text-white hover:bg-white/10'
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
          <i className="fas fa-rotate-right text-sm"></i>
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition"
          title="Close preview"
          aria-label="Close"
        >
          <i className="fas fa-times"></i>
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
  const [activeTab,   setActiveTab]   = useState(0);
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

  return (
    <div className="p-6 space-y-6">
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* Page header */}
      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <i className="fas fa-palette text-indigo-600"></i>
            </span>
            Content Management
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[46px]">Manage your website content, gallery, reviews, and contact submissions.</p>
        </div>
        <button onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#152c6e] text-white text-sm font-semibold transition shadow-sm">
          <i className="fas fa-eye text-xs"></i> Preview Site
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl shadow-sm p-2 flex items-center gap-1 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button key={tab.label} onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === i
                ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}>
            <i className={`fas ${tab.icon} text-xs`}></i>
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
                <i className="fas fa-bars text-[#1e3a8a] text-[10px]"></i>
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
                <i className="fas fa-home text-[#1e3a8a] text-[10px]"></i>
              </span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Home Page</h2>
              <span className="text-[10px] text-slate-300 font-normal normal-case ml-1">/</span>
            </div>
            <div className="space-y-3">
              <HomeHeroEditor    content={content.home_hero}    onSave={update("home_hero")} />
              <HomeResortsEditor content={content.home_resorts} onSave={update("home_resorts")} />
              <HomeWhyEditor     content={content.home_why}     onSave={update("home_why")} />
              <HomeCTAEditor     content={content.home_cta}     onSave={update("home_cta")} />
            </div>
          </div>

          {/* ── Resort Page ── */}
          <div className="border-t border-dashed border-slate-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-6 w-6 rounded-md bg-sky-50 flex items-center justify-center">
                <i className="fas fa-umbrella-beach text-[#1e3a8a] text-[10px]"></i>
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
                <i className="fas fa-bed text-[#1e3a8a] text-[10px]"></i>
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
                <i className="fas fa-images text-[#1e3a8a] text-[10px]"></i>
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
                <i className="fas fa-shoe-prints text-[#1e3a8a] text-[10px]"></i>
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
  );
}
