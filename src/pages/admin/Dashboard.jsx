import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

// Minimal admin landing page. Intentionally shallow — admin-visible
// dashboard stats (bookings today, unread messages, pending reviews)
// will be added in a follow-up once we know which numbers admin
// should actually watch in their daily workflow. The revenue /
// occupancy stats live in /owner/reports and stay owner-only per
// docs/roles.xlsx.
const CARDS = [
  {
    to:    "/admin/messages",
    icon:  "fa-envelope",
    title: "Messages",
    blurb: "Reply to guest inquiries and moderate conversations.",
  },
  {
    to:    "/admin/content",
    icon:  "fa-globe",
    title: "Manage Website",
    blurb: "Edit public pages, announcements, and resort amenities.",
  },
  {
    to:    "/admin/reviews",
    icon:  "fa-star",
    title: "Reviews",
    blurb: "Moderate guest reviews before they appear publicly.",
  },
  {
    to:    "/admin/promo-codes",
    icon:  "fa-tag",
    title: "Promo Codes",
    blurb: "Create, update, and disable promotional codes.",
  },
  {
    to:    "/admin/newsletter",
    icon:  "fa-paper-plane",
    title: "Newsletter",
    blurb: "View subscribers and send campaign emails.",
  },
];

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">
          Welcome, {user?.name || "Admin"}.
        </h1>
        <p className="mt-2 text-slate-600">
          You're running day-to-day operations for Aplaya Beach Resort.
          Pick a section to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group p-5 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-brand transition"
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-brand/10 text-brand flex items-center justify-center">
                <i className={`fas ${card.icon}`} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900 group-hover:text-brand transition">
                  {card.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{card.blurb}</p>
              </div>
              <i className="fas fa-chevron-right text-slate-300 group-hover:text-brand transition" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
