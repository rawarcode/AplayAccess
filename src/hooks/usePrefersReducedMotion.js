import { useEffect, useState } from "react";

// Live read of prefers-reduced-motion. Subscribes so OS-level toggles
// take effect immediately (without a page refresh) — useful when a
// hero video should stop autoplaying the moment the user flips
// reduce-motion in system settings.
//
// Returns false during SSR (no window/matchMedia) — the consumer
// then renders the motion-on path on the server, hydration syncs to
// the real preference on first effect.
export default function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}
