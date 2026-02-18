import { Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{/* pages handle their own top padding if nav is fixed */}<Outlet /></main>
      <Footer />
    </div>
  );
}
