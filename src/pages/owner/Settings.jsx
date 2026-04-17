import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import Toast, { useToast } from "../../components/ui/Toast";
import { getAdminSettings, updateAdminSettings } from "../../lib/adminApi";

const PRICING_FIELDS = [
  {
    key:         "entrance_fee_day",
    label:       "Entrance Fee — Day (6AM–6PM)",
    description: "Per guest for daytime visits.",
    icon:        "fa-sun",
    prefix:      "₱",
    suffix:      "/ head",
    step:        "any",
  },
  {
    key:         "entrance_fee_night",
    label:       "Entrance Fee — Night (6PM–7AM)",
    description: "Per guest for nighttime visits.",
    icon:        "fa-moon",
    prefix:      "₱",
    suffix:      "/ head",
    step:        "any",
  },
  {
    key:         "entrance_fee_24hr",
    label:       "Entrance Fee — 24 Hours",
    description: "Per guest for full-day (24-hour) visits.",
    icon:        "fa-clock",
    prefix:      "₱",
    suffix:      "/ head",
    step:        "any",
  },
  {
    key:         "reservation_fee_pct",
    label:       "Online Reservation Fee",
    description: "Percentage of total amount collected as non-refundable down-payment for online bookings.",
    icon:        "fa-percentage",
    prefix:      "",
    suffix:      "%",
    step:        1,
  },
];

export default function OwnerSettings() {
  const [toast, showToast, clearToast, toastType] = useToast();

  const [settings,    setSettings]    = useState({});
  const [draft,       setDraft]       = useState({});
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [dirty,       setDirty]       = useState(false);
  const [loadError,   setLoadError]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  /* ---------- beforeunload guard (#6) ---------- */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /* ---------- load ---------- */
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getAdminSettings()
      .then(r => {
        const map = {};
        (r.data.data || []).forEach(s => { map[s.key] = s.value; });
        setSettings(map);
        setDraft({ ...map });
        setDirty(false);
        setLoadError(false);
        // If the API returns an updated_at, use it
        const first = (r.data.data || [])[0];
        if (first?.updated_at) {
          setLastUpdated(new Date(first.updated_at));
        }
      })
      .catch(() => {
        setLoadError(true);
        showToast("Failed to load settings.", "error");
      })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  /* ---------- handlers ---------- */
  function handleChange(key, val) {
    setDraft(d => ({ ...d, [key]: val }));
    setDirty(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    for (const f of PRICING_FIELDS) {
      const v = Number(draft[f.key]);
      if (isNaN(v) || v < 0) {
        showToast(`"${f.label}" must be a non-negative number.`, "error");
        return;
      }
      if (f.key === "reservation_fee_pct" && (v < 0 || v > 100)) {
        showToast(`"${f.label}" must be between 0 and 100.`, "error");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = Object.entries(draft).map(([key, value]) => ({ key, value: String(value) }));
      const r = await updateAdminSettings(payload);
      const map = {};
      (r.data.data || []).forEach(s => { map[s.key] = s.value; });
      setSettings(map);
      setDraft({ ...map });
      setDirty(false);
      setLastUpdated(new Date());
      showToast("Pricing settings have been updated.", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- confirm before discard (#11) ---------- */
  function handleDiscard() {
    if (!window.confirm("Discard all unsaved changes?")) return;
    setDraft({ ...settings });
    setDirty(false);
  }

  /* ---------- preview helpers ---------- */
  const feeDay   = Number(draft.entrance_fee_day ?? 0);
  const resPct   = Number(draft.reservation_fee_pct ?? 0);
  const adultCount   = 4;
  const adultTotal   = adultCount * feeDay;

  /* ---------- render ---------- */
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">

      {/* #2 — Toast at top */}
      <Toast message={toast} type={toastType} onClose={clearToast} />

      {/* #5 — Helmet */}
      <Helmet><title>Settings — Aplaya Beach Resort</title></Helmet>

      {/* #3 — Page heading with icon-badge */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <i className="fas fa-cog text-violet-600"></i>
          </span>
          Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure resort-wide pricing that applies to all guest bookings made through the website.
        </p>
      </div>

      {/* #4 — loadError retry banner */}
      {loadError && !loading && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-rose-700">
            <i className="fas fa-exclamation-triangle"></i>
            <span className="text-sm font-medium">Failed to load settings.</span>
          </div>
          <button onClick={load} className="text-sm font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5">
            <i className="fas fa-redo text-xs"></i>Retry
          </button>
        </div>
      )}

      {/* #7 — Loading skeleton */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse"></div>
          </div>
          <div className="divide-y divide-slate-100">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-200"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                  </div>
                  <div className="h-3 w-56 bg-slate-100 rounded ml-9"></div>
                </div>
                <div className="md:w-52 h-9 bg-slate-200 rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">

          {/* Pricing card — #8 violet accent */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <i className="fas fa-tags text-violet-500"></i>
              <h2 className="font-semibold text-slate-800">Pricing Configuration</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {PRICING_FIELDS.map(field => (
                <div key={field.key} className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500 text-xs">
                        <i className={`fas ${field.icon}`}></i>
                      </span>
                      <p className="font-medium text-slate-800 text-sm">{field.label}</p>
                    </div>
                    <p className="text-xs text-slate-400 ml-9">{field.description}</p>
                  </div>

                  <div className="flex items-center gap-2 md:w-52">
                    {field.prefix && (
                      <span className="text-slate-500 font-medium text-sm">{field.prefix}</span>
                    )}
                    <input
                      type="number"
                      min={0}
                      max={field.key === "reservation_fee_pct" ? 100 : undefined}
                      step={field.step}
                      value={draft[field.key] ?? ""}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 text-right"
                    />
                    {field.suffix && (
                      <span className="text-slate-500 text-sm whitespace-nowrap">{field.suffix}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info banner */}
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex gap-3 text-sm text-amber-800">
            <i className="fas fa-info-circle mt-0.5 text-amber-500 shrink-0"></i>
            <div>
              <p className="font-semibold mb-1">These values are live</p>
              <p>
                Room rates are locked in at booking time — existing bookings keep the rate they were booked at.
                Entrance fees and reservation-fee percentage reflect the current setting, so changes here apply
                to new bookings and to any check-ins that haven't collected the gate fee yet.
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-800 text-sm">Booking Summary Preview</h2>
              <p className="text-xs text-slate-400">Example day visit with {adultCount} guests</p>
            </div>
            <div className="px-6 py-5 text-sm space-y-2 text-slate-700">
              <PreviewRow
                label={`Entrance fee (${adultCount} × ₱${feeDay.toLocaleString()})`}
                value={`₱${adultTotal.toLocaleString()}`}
              />
              <PreviewRow
                label="Room rate (base)"
                value="₱—"
                note="set per room"
              />
              <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold">
                <span>Reservation fee</span>
                <span className="text-violet-600">{resPct}% of total</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            {dirty && (
              <button
                type="button"
                onClick={handleDiscard}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                Discard
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !dirty}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium"
            >
              {saving ? (
                <><i className="fas fa-spinner fa-spin"></i> Saving...</>
              ) : (
                <><i className="fas fa-save"></i> Save Changes</>
              )}
            </button>
          </div>

          {/* #10 — Last updated timestamp */}
          {lastUpdated && (
            <p className="text-xs text-slate-400 text-right mt-2">
              Last saved {lastUpdated.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function PreviewRow({ label, value, note, highlight }) {
  return (
    <div className={`flex justify-between ${highlight ? "text-orange-600" : ""}`}>
      <span>{label}{note && <span className="ml-1 text-xs text-slate-400">({note})</span>}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
