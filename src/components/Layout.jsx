import { Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import ChatWidget from "./ChatWidget.jsx";
import PendingPaymentBanner from "./PendingPaymentBanner.jsx";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip-link — hidden until keyboard-focused. Lets screen-reader
          and keyboard users jump past the navbar on every page visit
          instead of tabbing through every nav link each time. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[10000] focus:bg-sky-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-sky-700 text-sm font-semibold"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">{/* pages handle their own top padding if nav is fixed */}<Outlet /></main>
      <Footer />
      <ChatWidget />
      {/* Floating pill that follows the guest across routes if they have
          a Pending booking mid-payment. Rendered here (inside the guest
          Layout) instead of at the top-level router so it doesn't show
          on staff portals where it'd be irrelevant. */}
      <PendingPaymentBanner />
    </div>
  );
}
