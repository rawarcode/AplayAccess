import { Link } from "react-router-dom";

const resorts = [
  {
    name: "Aplaya Beach Resort Cavite",
    desc: "Experience luxury and breathtaking ocean views at our flagship resort.",
    badge: { text: "Popular", className: "bg-blue-600" },
    img: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=2070&q=80",
    to: "/resort",
  },
  {
    name: "Aplaya Beach Resort Cebu",
    desc: "Relax in our serene bay-side location with world-class amenities.",
    img: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=80",
    to: "/aplaya-cebu",
    comingSoon: true,
  },
  {
    name: "Aplaya Beach Resort Bohol",
    desc: "Dive into adventure with our exclusive coral reef access and diving center.",
    img: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2000&q=80",
    to: "/aplaya-bohol",
    comingSoon: true,
  },
];

function ResortCard({ resort }) {
  const isComingSoon = resort.comingSoon === true;

  return (
    <div className={`bg-white rounded-xl overflow-hidden shadow-md transition duration-300 ${isComingSoon ? "opacity-75" : "hover:-translate-y-2 hover:shadow-xl"}`}>
      <div className="relative">
        <img
          src={resort.img}
          alt={resort.name}
          className="w-full h-64 object-cover"
          loading="lazy"
        />
        {/* Coming Soon badge overrides any existing badge */}
        {isComingSoon ? (
          <div className="absolute top-4 right-4 bg-gray-500 text-white px-3 py-1 rounded-md text-sm font-medium">
            Coming Soon
          </div>
        ) : resort.badge ? (
          <div className={`absolute top-4 right-4 ${resort.badge.className} text-white px-3 py-1 rounded-md text-sm font-medium`}>
            {resort.badge.text}
          </div>
        ) : null}
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{resort.name}</h3>
        <p className="text-gray-600 mb-4">{resort.desc}</p>

        {isComingSoon ? (
          <span className="w-full bg-gray-300 text-gray-500 px-4 py-2 rounded-md text-sm font-medium cursor-not-allowed text-center block">
            Coming Soon
          </span>
        ) : (
          <Link
            to={resort.to}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition text-center block"
          >
            Explore {resort.name}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="font-sans">
      {/* Hero */}
      <section
        className="min-h-screen flex items-center justify-center text-center relative"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2073&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Welcome to Paradise
          </h1>
          <p className="text-xl md:text-2xl mb-8">
            Choose your perfect getaway from our collection of stunning beach
            resorts.
          </p>
        </div>
      </section>

      {/* Resorts */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Our Beach Resorts
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Select the resort that matches your dream vacation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {resorts.map((r) => (
              <ResortCard key={r.to} resort={r} />
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
