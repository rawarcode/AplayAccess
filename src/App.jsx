import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Resort from "./pages/Resort.jsx";

function Placeholder({ title }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-bold mb-3">{title}</h1>
        <p className="text-gray-600">Not converted yet.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/resort" element={<Resort />} />

        {/* upcoming pages */}
        <Route path="/rooms" element={<Placeholder title="Rooms" />} />
        <Route path="/gallery" element={<Placeholder title="Gallery" />} />
        <Route path="/signup" element={<Placeholder title="Sign Up" />} />
        <Route path="/forgot-password" element={<Placeholder title="Forgot Password" />} />
      </Route>
    </Routes>
  );
}
