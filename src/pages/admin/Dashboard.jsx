import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";

// Operational KPI dashboard for admin, following the kpi-dashboard-
// design skill's tactical-tier pattern: ≤ 5 headline KPIs, real-time
// (20s poll via useStaffNotifications in AdminShell), actionable
// click-through, tone colours (emerald/amber/rose) carrying urgency.
//
// All KPIs surface capabilities admin now actually has — operations
// (bookings, billing, walk-ins) + management (messages, reviews).
// Revenue / occupancy / staff metrics stay owner-only per
// docs/roles.xlsx and live in /owner/reports.

// ── Small presentational building blocks ──────────────────────────
function KpiCard({ to, icon, label, value, tone = "neutral", sublabel }) {
  // Tone tokens — use semantic background tokens so a future palette
  // shift is one CSS edit. Soft surface comes from --color-{success,
  // warning, danger, info}-bg (defined in src/index.css @theme).
  const toneBg = {
    neutral: "bg-white",
    urgent:  "bg-danger-bg border-danger-bg",
    warn:    "bg-warning-bg border-warning-bg",
    info:    "bg-info-bg border-info-bg",
    good:    "bg-success-bg border-success-bg",
  }[tone];
  const toneIcon = {
    neutral: "bg-slate-100 text-slate-700",
    urgent:  "bg-danger-bg text-danger-fg",
    warn:    "bg-warning-bg text-warning-fg",
    info:    "bg-info-bg text-info-fg",
    good:    "bg-success-bg text-success-fg",
  }[tone];
  const toneValue = {
    neutral: "text-slate-900",
    urgent:  "text-danger-fg",
    warn:    "text-warning-fg",
    info:    "text-info-fg",
    good:    "text-success-fg",
  }[tone];

  // Stable id chains the value, label, and sublabel together so screen
  // readers announce the full unit ("3 unread messages — Reply to
  // guests") instead of just "3".
  const id = `kpi-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const inner = (
    <article
      aria-labelledby={`${id}-label`}
      aria-describedby={sublabel ? `${id}-sub` : undefined}
      className={`p-5 rounded-xl border shadow-sm transition hover:shadow-md ${toneBg}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${toneIcon}`}>
          <i className={`fas ${icon}`} aria-hidden="true" />
        </div>
        {to && (
          <i className="fas fa-arrow-right text-slate-300 group-hover:text-slate-500 transition" aria-hidden="true" />
        )}
      </div>
      <div className={`text-3xl font-semibold ${toneValue}`} aria-hidden="true">{value}</div>
      <div id={`${id}-label`} className="mt-1 text-sm text-slate-600">
        <span className="sr-only">{value} </span>{label}
      </div>
      {sublabel && <div id={`${id}-sub`} className="mt-1 text-xs text-slate-400">{sublabel}</div>}
    </article>
  );

  return to ? (
    <Link to={to} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">{inner}</Link>
  ) : (
    <div>{inner}</div>
  );
}

function SectionCard({ title, icon, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <i className={`fas ${icon} text-slate-400 text-sm`} aria-hidden="true" />}
          <h2 className="font-semibold text-slate-800">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function OpsRow({ label, value, tone = "neutral", icon, to }) {
  const toneColor = {
    neutral: "text-slate-700",
    urgent:  "text-danger-fg",
    warn:    "text-warning-fg",
    good:    "text-success-fg",
  }[tone];
  const body = (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-3">
        {icon && <i className={`fas ${icon} text-slate-400 w-4 text-center`} aria-hidden="true" />}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-lg font-semibold ${toneColor}`}>{value}</span>
        {to && <i className="fas fa-chevron-right text-slate-300 text-xs" aria-hidden="true" />}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block -mx-2 px-2 rounded hover:bg-slate-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2" aria-label={`${label}: ${value}`}>
      {body}
    </Link>
  ) : body;
}

// ── Main component ────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const { counts } = useNotifications();

  const greeting = greetForHour();

  // ── Attention list — what specifically needs admin action right now
  const attention = [];
  if (counts.overdueCheckouts > 0) {
    attention.push({
      id: "overdue",
      icon: "fa-triangle-exclamation",
      tone: "urgent",
      text: `${counts.overdueCheckouts} checkout${counts.overdueCheckouts !== 1 ? "s" : ""} overdue`,
      to: "/admin/bookings?status=Checked+In",
      cta: "Review",
    });
  }
  if (counts.todayArrivals > 0) {
    attention.push({
      id: "arrivals",
      icon: "fa-plane-arrival",
      tone: "info",
      text: `${counts.todayArrivals} guest${counts.todayArrivals !== 1 ? "s" : ""} arriving today`,
      to: "/admin/bookings?status=Confirmed",
      cta: "Open Bookings",
    });
  }
  if (counts.unreadMessages > 0) {
    attention.push({
      id: "unread",
      icon: "fa-envelope",
      tone: "urgent",
      text: `${counts.unreadMessages} unread guest message${counts.unreadMessages !== 1 ? "s" : ""}`,
      to: "/admin/messages",
      cta: "Reply",
    });
  }
  if (counts.pendingReviews > 0) {
    attention.push({
      id: "pending-reviews",
      icon: "fa-star",
      tone: "warn",
      text: `${counts.pendingReviews} review${counts.pendingReviews !== 1 ? "s" : ""} pending moderation`,
      to: "/admin/content?tab=reviews",
      cta: "Moderate",
    });
  }
  if (counts.newReviews > 0 && counts.pendingReviews === 0) {
    attention.push({
      id: "new-reviews",
      icon: "fa-star",
      tone: "info",
      text: `${counts.newReviews} new review${counts.newReviews !== 1 ? "s" : ""} this week`,
      to: "/admin/content?tab=reviews",
      cta: "Review",
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
          {greeting}, {user?.name || "Admin"}.
        </h1>
      </div>

      {/* Row 1 — headline KPIs. Each one is a live operational count
          that drops to zero when there is nothing to act on. Sublabels
          stay honest when the number is 0 (no false "nothing booked
          yet" when guests already arrived earlier). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          to="/admin/bookings?status=Confirmed"
          icon="fa-plane-arrival"
          label="Awaiting check-in"
          value={counts.todayArrivals}
          tone={counts.todayArrivals > 0 ? "info" : "neutral"}
          sublabel={
            counts.todayArrivals > 0
              ? `${counts.todayArrivals} guest${counts.todayArrivals !== 1 ? "s" : ""} still to arrive today`
              : counts.arrivedToday > 0
                ? `All ${counts.arrivedToday} guest${counts.arrivedToday !== 1 ? "s" : ""} for today checked in`
                : "No arrivals scheduled today"
          }
        />
        <KpiCard
          to="/admin/bookings?status=Checked+In"
          icon="fa-bed"
          label="Currently in-house"
          value={counts.currentlyInHouse}
          tone={counts.currentlyInHouse > 0 ? "info" : "neutral"}
          sublabel={
            counts.currentlyInHouse > 0
              ? `${counts.currentlyInHouse} room${counts.currentlyInHouse !== 1 ? "s" : ""} occupied right now`
              : "No active stays"
          }
        />
        <KpiCard
          to="/admin/bookings?status=Checked+In"
          icon="fa-triangle-exclamation"
          label="Overdue checkouts"
          value={counts.overdueCheckouts}
          tone={counts.overdueCheckouts > 0 ? "urgent" : "good"}
          sublabel={counts.overdueCheckouts > 0 ? "Past checkout time" : "Nothing overdue"}
        />
        <KpiCard
          to="/admin/messages"
          icon="fa-envelope"
          label="Unread messages"
          value={counts.unreadMessages}
          tone={counts.unreadMessages > 0 ? "urgent" : "good"}
          sublabel={counts.unreadMessages > 0 ? "Reply to guests" : "Inbox clear"}
        />
      </div>

      {/* Row 2 — two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Today at the resort — operational rollup. "Awaiting check-in"
            and "Already arrived" together account for every guest with a
            checkIn date of today, so the two numbers always make sense
            side by side. */}
        <SectionCard title="Today at the resort" icon="fa-calendar-day">
          <OpsRow
            icon="fa-plane-arrival"
            label="Awaiting check-in"
            value={counts.todayArrivals}
            tone={counts.todayArrivals > 0 ? "good" : "neutral"}
            to={counts.todayArrivals > 0 ? "/admin/bookings?status=Confirmed" : null}
          />
          <OpsRow
            icon="fa-circle-check"
            label="Already arrived"
            value={counts.arrivedToday}
            tone="neutral"
            to={counts.arrivedToday > 0 ? "/admin/bookings?status=Checked+In" : null}
          />
          <OpsRow
            icon="fa-bed"
            label="Currently in-house"
            value={counts.currentlyInHouse}
            tone="neutral"
            to={counts.currentlyInHouse > 0 ? "/admin/bookings?status=Checked+In" : null}
          />
          <OpsRow
            icon="fa-clock"
            label={`Checkouts in <30 min`}
            value={counts.soonCheckouts}
            tone={counts.soonCheckouts > 0 ? "warn" : "neutral"}
            to={counts.soonCheckouts > 0 ? "/admin/bookings?status=Checked+In" : null}
          />
          <OpsRow
            icon="fa-triangle-exclamation"
            label="Overdue checkouts"
            value={counts.overdueCheckouts}
            tone={counts.overdueCheckouts > 0 ? "urgent" : "neutral"}
            to={counts.overdueCheckouts > 0 ? "/admin/bookings?status=Checked+In" : null}
          />
        </SectionCard>

        {/* Needs your attention */}
        <SectionCard title="Needs your attention" icon="fa-bell">
          {attention.length === 0 ? (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-success-bg text-success-fg mb-3">
                <i className="fas fa-check text-xl" aria-hidden="true" />
              </div>
              <p className="text-sm text-slate-600">All caught up.</p>
              <p className="text-xs text-slate-400 mt-1">
                Nothing urgent across bookings, messages, or reviews.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((a) => (
                <li key={a.id} className="py-3 flex items-start gap-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      a.tone === "urgent"
                        ? "bg-danger-bg text-danger-fg"
                        : a.tone === "warn"
                        ? "bg-warning-bg text-warning-fg"
                        : "bg-info-bg text-info-fg"
                    }`}
                  >
                    <i className={`fas ${a.icon} text-sm`} aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{a.text}</p>
                  </div>
                  {a.to && a.cta && (
                    <Link
                      to={a.to}
                      className="shrink-0 inline-flex items-center min-h-9 px-2 py-1 rounded text-xs font-semibold text-brand hover:text-brand-dark underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                      aria-label={`${a.cta} — ${a.text}`}
                    >
                      {a.cta}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Row 3 — only Walk-In stays. The other "quick actions"
          (Manage bookings, Collect payment, Edit website) duplicated
          sidebar nav items one click away. Walk-In earns its place
          because it's reached via the '+ New Walk-in' button INSIDE
          Bookings, not the sidebar — surfacing it on the dashboard
          saves an extra hop when admin is covering the counter. */}
      <SectionCard title="Quick actions" icon="fa-bolt">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction to="/admin/walk-in" icon="fa-person-walking-arrow-right" label="New walk-in" />
        </div>
      </SectionCard>
    </div>
  );
}

function QuickAction({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 min-h-11 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <div className="h-8 w-8 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
        <i className={`fas ${icon} text-sm`} aria-hidden="true" />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </Link>
  );
}

function greetForHour() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
