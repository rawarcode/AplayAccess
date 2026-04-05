import { useState, useEffect, useCallback } from "react";
import Toast, { useToast } from "../../components/ui/Toast";
import { getAdminSettings, updateAdminSettings } from "../../lib/adminApi";

const PRICING_FIELDS = [
  {
    key:         "entrance_fee",
    label:       "Entrance Fee",
    description: "Charged per guest per visit (children 3 & below are free at check-in).",
    icon:        "fa-ticket-alt",
    prefix:      "₱",
  },
  {
    key:         "free_guest_limit",
    label:       "Free Guest Limit",
    description: "Number of guests included in the room rate before extra-guest charges apply.",
    icon:        "fa-users",
    prefix:      "",
    suffix:      "guests",
  },
  {
    key:         "extra_guest_fee",
    label:       "Extra Guest Fee",
    description: "Additional charge per person above the free guest limit.",
    icon:        "fa-user-plus",
    prefix:      "₱",
    suffix:      "/ person",
  },
  {
    key:         "reservation_fee",
    label:       "Reservation / Down-payment Fee",
    description: "Non-refundable fee collected online when a guest books. Forfeited on no-show.",
    icon:        "fa-credit-card",
    prefix:      "₱",
  },
];

export default function OwnerSettings() {
  const [toast, showToast, clearToast, toastType] = useToast();

  const [settings, setSettings] = useState({});
  const [draft,    setDraft]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [dirty,    setDirty]    = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getAdminSettings()
      .then(r => {
        const map = {};
        (r.data.data || []).forEach(s => { map[s.key] = s.value; });
        setSettings(map);
        setDraft({ ...map });
        setDirty(false);
      })
      .catch(() => showToast("Failed to load settings.", "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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
      showToast("Pricing settings have been updated.", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setDraft({ ...settings });
    setDirty(false);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">

      <div>
        <p className="text-sm text-slate-500 mt-1">
          Configure resort-wide pricing that applies to all guest bookings made through the website.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-12 flex items-center justify-center text-slate-400">
          <i className="fas fa-spinner fa-spin mr-2 text-xl"></i>
          <span>Loading settings…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <i className="fas fa-tags text-sky-500"></i>
              <h2 className="font-semibold text-slate-800">Pricing Configuration</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {PRICING_FIELDS.map(field => (
                <div key={field.key} className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-500 text-xs">
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
                      step={field.key === "free_guest_limit" ? 1 : "any"}
                      value={draft[field.key] ?? ""}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 text-right"
                    />
                    {field.suffix && (
                      <span className="text-slate-500 text-sm whitespace-nowrap">{field.suffix}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex gap-3 text-sm text-amber-800">
            <i className="fas fa-info-circle mt-0.5 text-amber-500 shrink-0"></i>
            <div>
              <p className="font-semibold mb-1">These values are live</p>
              <p>
                Changes take effect immediately for all new bookings made on the website.
                Existing confirmed bookings are not affected.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-800 text-sm">Booking Summary Preview</h2>
              <p className="text-xs text-slate-400">How pricing appears to guests for a 6-person day visit</p>
            </div>
            <div className="px-6 py-5 text-sm space-y-2 text-slate-700">
              <PreviewRow label="Day visit rate (base)" value="₱—" note="set per room in Manage Rooms" />
              <PreviewRow
                label={`Entrance fee (6 × ₱${Number(draft.entrance_fee ?? 0).toLocaleString()})`}
                value={`₱${(6 * Number(draft.entrance_fee ?? 0)).toLocaleString()}`}
              />
              {6 > Number(draft.free_guest_limit ?? 5) && (
                <PreviewRow
                  label={`Extra guests (${6 - Number(draft.free_guest_limit ?? 5)} × ₱${Number(draft.extra_guest_fee ?? 0).toLocaleString()})`}
                  value={`+ ₱${((6 - Number(draft.free_guest_limit ?? 5)) * Number(draft.extra_guest_fee ?? 0)).toLocaleString()}`}
                  highlight
                />
              )}
              <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold">
                <span>Reservation fee (charged now)</span>
                <span className="text-sky-600">₱{Number(draft.reservation_fee ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

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
              className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium"
            >
              {saving ? (
                <><i className="fas fa-spinner fa-spin"></i> Saving…</>
              ) : (
                <><i className="fas fa-save"></i> Save Changes</>
              )}
            </button>
          </div>
        </form>
      )}

      <Toast message={toast} type={toastType} onClose={clearToast} />
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
