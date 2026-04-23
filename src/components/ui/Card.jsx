/**
 * Card — three-variant wrapper meant to replace the ad-hoc
 *   "rounded-xl border border-slate-200 bg-white shadow-sm"
 * pattern that currently repeats hundreds of times across the
 * owner / frontdesk / guest dashboard pages.
 *
 * Audit P2: the uniform card treatment was flagged as an AI-slop
 * tell — every section of every page looks like the same card grid,
 * giving the UI no visual hierarchy. Introducing three variants lets
 * callers choose a card based on its role:
 *
 *   - "primary"   — the page's main content block. Slightly thicker
 *                   border and a subtle accent stripe on the left.
 *   - "secondary" — a supporting widget / summary card. Flat, no
 *                   shadow, just a light border.
 *   - "callout"   — tinted background for highlighting an important
 *                   status or standalone summary (e.g. overdue
 *                   alerts, "you have X unread" counters). Tone
 *                   prop picks the tint: sky | amber | rose | emerald.
 *
 * Existing cards aren't being mass-migrated — that's a separate
 * pass. New UI (anything landing from here on) should prefer this.
 */

const VARIANT_CLASSES = {
  primary:
    "rounded-xl bg-white border-l-4 border-l-sky-500 border border-slate-200 shadow-md",
  secondary:
    "rounded-xl bg-slate-50 border border-slate-200",
  callout: {
    sky:     "rounded-xl bg-sky-50     border border-sky-200     text-sky-900",
    amber:   "rounded-xl bg-amber-50   border border-amber-200   text-amber-900",
    rose:    "rounded-xl bg-rose-50    border border-rose-200    text-rose-900",
    emerald: "rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900",
    violet:  "rounded-xl bg-violet-50  border border-violet-200  text-violet-900",
  },
};

export default function Card({
  variant = "primary",
  tone    = "sky",
  className = "",
  children,
  ...rest
}) {
  let base;
  if (variant === "callout") {
    base = VARIANT_CLASSES.callout[tone] ?? VARIANT_CLASSES.callout.sky;
  } else {
    base = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
  }
  return (
    <div className={`${base} ${className}`} {...rest}>
      {children}
    </div>
  );
}
