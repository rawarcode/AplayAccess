// src/components/ui/HourGridPicker.jsx
//
// 24-hour start-time picker rendered as a 2-row grid (AM / PM) with
// quick-pick chips and a live summary sentence. Replaces a native
// <select> that produced 24 near-identical rows ("X:00 AM → X:00 AM
// next day"). Used by BookingModal (online) and WalkIn (frontdesk).
//
// Design notes:
//  - One cell per hour: shows just "6" / "12" etc., the AM/PM row header
//    carries the period. Tooltips + aria-label still speak the full time.
//  - Quick picks (6 AM / 12 PM / 6 PM) cover ~90% of bookings so most
//    users never touch the full grid.
//  - The summary sentence below updates live so the full start/end
//    window is always one glance away — no need to repeat it on every
//    grid cell.
//  - Mobile: 6-col grid (AM and PM each wrap to 2 rows). Desktop (sm+):
//    12-col grid so each period fits on one row.
//
// Accessibility:
//  - Wrapping <div role="group" aria-labelledby={labelId}> gives SRs
//    the field name even though we're not using a single form control.
//  - Each cell is a real <button aria-pressed={active}> so Tab /
//    Space / Enter all work natively.
//  - Row headers are aria-hidden (icon + "AM"/"PM") — the cell's
//    own aria-label carries the period so nothing is lost to SRs.

const AM_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const PM_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const QUICK_PICKS = [6, 12, 18]; // 6 AM / 12 PM / 6 PM

function hourLabel12(h) {
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

function cellLabel(h) {
  return h % 12 === 0 ? "12" : String(h % 12);
}

// Tailwind JIT strips class names that aren't literal strings, so
// map the accent prop to full static class strings.
const ACCENT = {
  blue: {
    cell:  "border-blue-500 bg-blue-50 text-blue-700",
    chip:  "border-blue-500 bg-blue-500 text-white",
    ring:  "focus:ring-blue-400/60",
  },
  sky: {
    cell:  "border-sky-500 bg-sky-50 text-sky-700",
    chip:  "border-sky-500 bg-sky-500 text-white",
    ring:  "focus:ring-sky-400/60",
  },
};

export default function HourGridPicker({
  value,
  onChange,
  accent = "blue",
  labelId,
}) {
  const v = Number(value ?? 6);
  const timeLabel = hourLabel12(v);
  const theme = ACCENT[accent] ?? ACCENT.blue;

  const cellBase     = `min-w-[40px] h-10 rounded-md border text-xs font-medium transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-1 ${theme.ring}`;
  const cellInactive = "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50";

  const renderRow = (hours, icon, iconColor, labelText) => (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 w-11 shrink-0 text-[11px] font-medium text-slate-500 uppercase tracking-wide" aria-hidden="true">
        <i className={`fas ${icon} ${iconColor}`}></i>
        <span>{labelText}</span>
      </div>
      <div className="flex-1 grid grid-cols-6 sm:grid-cols-12 gap-1">
        {hours.map((h) => {
          const active = h === v;
          return (
            <button
              key={h}
              type="button"
              aria-pressed={active}
              aria-label={hourLabel12(h)}
              onClick={() => onChange(h)}
              className={`${cellBase} ${active ? theme.cell : cellInactive}`}
            >
              {cellLabel(h)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-3">
      <div className="space-y-2">
        {renderRow(AM_HOURS, "fa-sun",  "text-amber-400",  "AM")}
        {renderRow(PM_HOURS, "fa-moon", "text-indigo-400", "PM")}
      </div>

      {/* Quick picks */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 mr-0.5">Quick</span>
        {QUICK_PICKS.map((h) => {
          const active = h === v;
          return (
            <button
              key={h}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(h)}
              className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
                active ? theme.chip : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {hourLabel12(h)}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex items-start gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
        <i className="fas fa-circle-info text-slate-400 mt-0.5" aria-hidden="true"></i>
        <div>
          Your 24-hour stay:{" "}
          <span className="font-semibold">{timeLabel}</span> today
          <span className="mx-1 text-slate-400">→</span>
          <span className="font-semibold">{timeLabel}</span> tomorrow
        </div>
      </div>
    </div>
  );
}
