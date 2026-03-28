export default function PortalTransition({ label }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#1e3a8a] flex flex-col items-center justify-center">
      <i className="fas fa-umbrella-beach text-white text-5xl mb-6 animate-bounce"></i>
      <p className="text-white text-2xl font-light tracking-wide mb-2">AplayAccess</p>
      <p className="text-blue-200 text-sm mb-8">{label}</p>
      <div className="flex gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-300 animate-[bounce_1s_ease-in-out_0s_infinite]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-blue-300 animate-[bounce_1s_ease-in-out_0.2s_infinite]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-blue-300 animate-[bounce_1s_ease-in-out_0.4s_infinite]"></span>
      </div>
    </div>
  );
}
