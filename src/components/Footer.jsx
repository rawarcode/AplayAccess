export default function Footer() {
    return (
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Aplaya Beach Resort</h3>
              <p className="text-gray-400 text-sm">
                Your perfect tropical getaway offering luxury accommodations, world-class amenities, and unforgettable experiences.
              </p>
            </div>
  
            <div>
              <h3 className="text-lg font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#home" className="text-gray-400 hover:text-white">Home</a></li>
                <li><a href="#rooms" className="text-gray-400 hover:text-white">Rooms & Suites</a></li>
                <li><a href="#amenities" className="text-gray-400 hover:text-white">Amenities</a></li>
                <li><a href="#gallery" className="text-gray-400 hover:text-white">Gallery</a></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white">Contact Us</a></li>
              </ul>
            </div>
  
            <div>
              <h3 className="text-lg font-bold mb-4">Contact Info</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex items-start gap-2"><span className="text-blue-500">📍</span>123 Beachfront Avenue, Coastal City</li>
                <li className="flex items-center gap-2"><span className="text-blue-500">📞</span>+1 (555) 123-4567</li>
                <li className="flex items-center gap-2"><span className="text-blue-500">✉️</span>reservations@aplayabeachresort.com</li>
              </ul>
            </div>
  
            <div>
              <h3 className="text-lg font-bold mb-4">Opening Hours</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex justify-between"><span>Monday - Friday</span><span>9:00 AM - 6:00 PM</span></li>
                <li className="flex justify-between"><span>Saturday</span><span>10:00 AM - 4:00 PM</span></li>
                <li className="flex justify-between"><span>Sunday</span><span>Closed</span></li>
              </ul>
            </div>
          </div>
  
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">© 2023 Aplaya Beach Resort. All rights reserved.</p>
            <div className="flex space-x-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white">Facebook</a>
              <a href="#" className="hover:text-white">Twitter</a>
              <a href="#" className="hover:text-white">Instagram</a>
              <a href="#" className="hover:text-white">Tripadvisor</a>
            </div>
          </div>
        </div>
      </footer>
    );
  }
  