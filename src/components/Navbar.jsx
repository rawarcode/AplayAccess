import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onResort = location.pathname === "/resort";

  // close mobile menu when route changes
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <nav className="fixed w-full z-40 bg-white/90 backdrop-blur-sm shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Brand: go to home */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🏖️</span>
              <span className="text-xl font-bold text-blue-600">Aplaya Beach Resort</span>
            </Link>
          </div>

          <div className="hidden md:flex md:items-center md:space-x-4">
            {/* When on /resort, keep section anchors */}
            {onResort ? (
              <>
                <a href="#home" className="text-blue-600 hover:text-blue-800 px-3 py-2 text-sm font-medium">Home</a>
                <a href="#rooms" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Rooms</a>
                <a href="#amenities" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Amenities</a>
                <a href="#gallery" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Gallery</a>
                <a href="#contact" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Contact</a>
              </>
            ) : (
              <>
                <Link to="/resort" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Resort</Link>
                <Link to="/rooms" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Rooms</Link>
                <Link to="/gallery" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">Gallery</Link>
              </>
            )}

            {/* Buttons (we'll wire modals from Resort page; here we keep nav simple) */}
            <Link
              to="/resort"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Book Now
            </Link>
          </div>

          <div className="-mr-2 flex items-center md:hidden">
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100"
              aria-label="Open menu"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="md:hidden bg-white shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
              Home
            </Link>
            <Link to="/resort" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
              Resort
            </Link>
            <Link to="/rooms" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
              Rooms
            </Link>
            <Link to="/gallery" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
              Gallery
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
