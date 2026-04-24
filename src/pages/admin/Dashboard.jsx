import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";
import { getPromoCodes, getNewsletterSubscribers } from "../../lib/adminApi.js";

// Operational KPI dashboard for admin. Aligns with the tactical-tier
// guidance in the kpi-dashboard-design skill: 4 headline KPIs that
// are real-time (fed from the 20s-polling useStaffNotifications hook
// AdminShell already runs), each click-through to the drilldown
// surface admin actually has permission for. Revenue / occupancy
// dashboards are intentionally absent — those are owner-only per
// docs/roles.xlsx and live in /owner/reports.

// ── Small presentational building blocks ──────────────────────────
function KpiCard({ to, icon, label, value, tone = "neutral", sublabel }) {
  const toneBg = {
    neutral: "bg-white",
    urgent:  "bg-rose-50 border-rose-200",
    warn:    "bg-amber-50 border-amber-200",
    info:    "bg-sky-50 border-sky-200",
    good:    "bg-emerald-50 border-emerald-200",
  }[tone];
  const toneIcon = {
    neutral: "bg-slate-100 text-slate-600",
    urgent:  "bg-rose-100 text-rose-600",
    warn:    "bg-amber-100 text-amber-700",
    info:    "bg-sky-100 text-sky-700",
    good:    "bg-emerald-100 text-emerald-700",
  }[tone];
  const toneValue = {
    neutral: "text-slate-900",
    urgent:  "text-rose-700",
    warn:    "text-amber-800",
    info:    "text-sky-800",
    good:    "text-emerald-800",
  }[tone];

  const inner = (
    <div className={`p-5 rounded-xl border shadow-sm transition hover:shadow-md ${toneBg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${toneIcon}`}>
          <i className={`fas ${icon}`} />
        </div>
        {to && (
          <i className="fas fa-arrow-right text-slate-300 group-hover:text-slate-500 transition" />
        )}
      </div>
      <div className={`text-3xl font-semibold ${toneValue}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
      {sublabel && <div className="mt-1 text-xs text-slate-400">{sublabel}</div>}
    </div>
  );

  return to ? (
    <Link to={to} className="group block">{inner}</Link>
  ) : (
    <div>{inner}</div>
  );
}

function SectionCard({ title, icon, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <i className={`fas ${icon} text-slate-400 text-sm`} />}
          <h2 className="font-semibold text-slate-800">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function OpsStat({ label, value, tone = "neutral", icon }) {
  const toneColor = {
    neutral: "text-slate-700",
    urgent:  "text-rose-600",
    warn:    "text-amber-600",
    good:    "text-emerald-600",
  }[tone];
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-3">
        {icon && <i className={`fas ${icon} text-slate-400 w-4 text-center`} />}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className={`text-lg font-semibold ${toneColor}`}>{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const { counts } = useNotifications();

  // Two extra counts pulled on mount — not hot-polling, these change
  // rarely enough that a once-on-mount fetch is right. If the admin
  // keeps the dashboard open for hours, a refresh re-pulls.
  const [promoActive, setPromoActive] = useState(null);
  const [subscribersTotal, setSubscribersTotal] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      getPromoCodes().then((r) => r?.data?.data ?? r?.data ?? []),
      getNewsletterSubscribers().then((r) => r?.data?.data ?? r?.data ?? []),
    ]).then(([promoRes, subsRes]) => {
      if (!alive) return;
      if (promoRes.status === "fulfilled") {
        const active = (promoRes.value || []).filter(
          (p) => p.is_active !== false && p.active !== false
        ).length;
        setPromoActive(active);
      } else {
        setPromoActive(0);
      }
      if (subsRes.status === "fulfilled") {
        setSubscribersTotal((subsRes.value || []).length);
      } else {
        setSubscribersTotal(0);
      }
    });
    return () => { alive = false; };
  }, []);

  const greeting = greetForHour();

  // ── Attention list — what specifically needs admin action right now
  const attention = [];
  if (counts.unreadMessages > 0) {
    attention.push({
      id: "unread",
      icon: "fa-envelope",
      tone: "urgent",
      text: `${counts.unreadMessages} unread guest message${counts.unreadMessages !== 1 ? "s" : ""}`,
      to: "/admin/messages",
      cta: "Open Messages",
    });
  }
  if (counts.pendingReviews > 0) {
    attention.push({
      id: "pending-reviews",
      icon: "fa-star",
      tone: "warn",
      text: `${counts.pendingReviews} review${counts.pendingReviews !== 1 ? "s" : ""} pending moderation`,
      to: "/admin/reviews",
      cta: "Moderate",
    });
  }
  if (counts.newReviews > 0 && counts.pendingReviews === 0) {
    attention.push({
      id: "new-reviews",
      icon: "fa-star",
      tone: "info",
      text: `${counts.newReviews} new review${counts.newReviews !== 1 ? "s" : ""} this week`,
      to: "/admin/reviews",
      cta: "Review",
    });
  }
  if (counts.overdueCheckouts > 0) {
    attention.push({
      id: "overdue",
      icon: "fa-triangle-exclamation",
      tone: "urgent",
      text: `${counts.overdueCheckouts} checkout${counts.overdueCheckouts !== 1 ? "s" : ""} overdue — front desk is handling, flagged here for awareness`,
      to: null,
      cta: null,
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
          {greeting}, {user?.name || "Admin"}.
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Real-time operational overview. Updates every 20 seconds.
        </p>
      </div>

      {/* Row 1 — headline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          to="/admin/messages"
          icon="fa-envelope"
          label="Unread messages"
          value={counts.unreadMessages}
          tone={counts.unreadMessages > 0 ? "urgent" : "good"}
          sublabel={counts.unreadMessages > 0 ? "Reply to guests" : "Inbox clear"}
        />
        <KpiCard
          to="/admin/reviews"
          icon="fa-star"
          label="Pending reviews"
          value={counts.pendingReviews}
          tone={counts.pendingReviews > 0 ? "warn" : "good"}
          sublabel={
            counts.pendingReviews > 0
              ? "Needs moderation"
              : counts.newReviews > 0
              ? `${counts.newReviews} new this week`
              : "Nothing queued"
          }
        />
        <KpiCard
          to="/admin/promo-codes"
          icon="fa-tag"
          label="Active promo codes"
          value={promoActive == null ? "…" : promoActive}
          tone="info"
          sublabel="Currently usable by guests"
        />
        <KpiCard
          to="/admin/newsletter"
          icon="fa-paper-plane"
          label="Newsletter subscribers"
          value={subscribersTotal == null ? "…" : subscribersTotal.toLocaleString()}
          tone="neutral"
          sublabel="Total on the list"
        />
      </div>

      {/* Row 2 — two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Today at the resort — read-only operational context */}
        <SectionCard
          title="Today at the resort"
          icon="fa-calendar-day"
        >
          <OpsStat
            icon="fa-plane-arrival"
            label="Arrivals today"
            value={counts.todayArrivals}
            tone={counts.todayArrivals > 0 ? "good" : "neutral"}
          />
          <OpsStat
            icon="fa-clock"
            label={`Checkouts in <30 min`}
            value={counts.soonCheckouts}
            tone={counts.soonCheckouts > 0 ? "warn" : "neutral"}
          />
          <OpsStat
            icon="fa-triangle-exclamation"
            label="Overdue checkouts"
            value={counts.overdueCheckouts}
            tone={counts.overdueCheckouts > 0 ? "urgent" : "neutral"}
          />
          <p className="mt-3 text-xs text-slate-400 italic">
            Check-in and check-out are handled at the front desk — shown here for context.
          </p>
        </SectionCard>

        {/* Needs your attention */}
        <SectionCard
          title="Needs your attention"
          icon="fa-bell"
        >
          {attention.length === 0 ? (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-50 text-emerald-500 mb-3">
                <i className="fas fa-check text-xl" />
              </div>
              <p className="text-sm text-slate-600">All caught up.</p>
              <p className="text-xs text-slate-400 mt-1">
                Nothing urgent on messages, reviews, or checkouts.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((a) => (
                <li key={a.id} className="py-3 flex items-start gap-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      a.tone === "urgent"
                        ? "bg-rose-100 text-rose-600"
                        : a.tone === "warn"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    <i className={`fas ${a.icon} text-sm`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{a.text}</p>
                  </div>
                  {a.to && a.cta && (
                    <Link
                      to={a.to}
                      className="shrink-0 text-xs font-semibold text-brand hover:text-brand-dark underline underline-offset-2"
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

      {/* Row 3 — quick actions */}
      <SectionCard title="Quick actions" icon="fa-bolt">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction to="/admin/messages"    icon="fa-reply"       label="Reply to guests" />
          <QuickAction to="/admin/content"     icon="fa-pen-to-square" label="Edit website" />
          <QuickAction to="/admin/promo-codes" icon="fa-tag"         label="New promo code" />
          <QuickAction to="/admin/newsletter"  icon="fa-paper-plane" label="Send campaign" />
        </div>
      </SectionCard>
    </div>
  );
}

function QuickAction({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition"
    >
      <div className="h-8 w-8 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
        <i className={`fas ${icon} text-sm`} />
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
