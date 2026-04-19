import { Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import ChatWidget from "./ChatWidget.jsx";
import PendingPaymentBanner from "./PendingPaymentBanner.jsx";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{/* pages handle their own top padding if nav is fixed */}<Outlet /></main>
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
