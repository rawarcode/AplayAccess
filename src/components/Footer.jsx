import { Link } from "react-router-dom";
import { useContent, DEFAULT_FOOTER, DEFAULT_NAVBAR } from "../context/ContentContext.jsx";

export default function Footer() {
  const siteContent = useContent();
  const ft    = siteContent?.page_footer ? { ...DEFAULT_FOOTER, ...siteContent.page_footer } : DEFAULT_FOOTER;
  const brand = siteContent?.page_navbar ? { ...DEFAULT_NAVBAR, ...siteContent.page_navbar } : DEFAULT_NAVBAR;

  const socials = [
    { key: "facebook",  label: "Facebook",  icon: "fa-facebook"  },
    { key: "instagram", label: "Instagram", icon: "fa-instagram" },
    { key: "twitter",   label: "Twitter",   icon: "fa-twitter"   },
    { key: "tiktok",    label: "TikTok",    icon: "fa-tiktok"    },
  ].filter(s => ft[s.key]);

  return (
    <footer className="bg-gray-900 text-white">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              {brand.logoImage
                ? <img src={brand.logoImage} alt={brand.siteName} className="h-12 w-auto object-contain" loading="lazy" decoding="async" />
                : <span className="text-3xl">🏖️</span>
              }
            </div>
            <p className="text-sm font-bold text-white mb-2">{brand.siteName}</p>
            <p className="text-gray-400 text-sm leading-relaxed">{ft.tagline}</p>
            {socials.length > 0 && (
              <div className="mt-5 flex gap-3">
                {socials.map(s => (
                  <a key={s.key} href={ft[s.key]} target="_blank" rel="noopener noreferrer"
                    className="w-11 h-11 rounded-full bg-white/10 hover:bg-sky-600 flex items-center justify-center transition-colors"
                    aria-label={s.label}>
                    <i className={`fab ${s.icon} text-sm`} aria-hidden="true"></i>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Resort",   to: "/resort"        },
                { label: "Rooms",    to: "/rooms"         },
                { label: "Gallery",  to: "/gallery"       },
                { label: "Book Now", to: "/resort?book=1" },
              ].map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-gray-400 hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact — FA icons (consistent with rest of site) instead
              of emoji, which renders inconsistently across OS/browser
              and is announced unpredictably by screen readers. */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-4">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-gray-400">
                <i className="fas fa-map-marker-alt text-sky-400 mt-1 shrink-0 w-4 text-center" aria-hidden="true"></i>
                <span>{ft.address}</span>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <i className="fas fa-phone text-sky-400 shrink-0 w-4 text-center" aria-hidden="true"></i>
                <span>{ft.phone}</span>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <i className="fas fa-envelope text-sky-400 shrink-0 w-4 text-center" aria-hidden="true"></i>
                <span>{ft.email}</span>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-4">Opening Hours</h3>
            <ul className="space-y-2 text-sm">
              {(ft.hours || []).map((h, i) => (
                <li key={i} className="flex justify-between text-gray-400">
                  <span>{h.day}</span>
                  <span className={h.time === "Closed" ? "text-red-400" : "text-green-400"}>{h.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar — legal links live here so every public page has
          a discoverable path to the Privacy Policy + Terms, per
          DPA § 16(b) "right to be informed." */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-gray-500 text-sm">{ft.copyright}</p>
          <nav className="flex items-center gap-4 text-xs" aria-label="Legal">
            <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
            <span className="text-gray-700" aria-hidden="true">·</span>
            <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">Terms &amp; Conditions</Link>
          </nav>
          <p className="text-gray-600 text-xs">Built with ❤️ for Aplaya</p>
        </div>
      </div>
    </footer>
  );
}
