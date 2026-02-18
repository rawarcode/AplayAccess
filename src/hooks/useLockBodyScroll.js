import { useEffect } from "react";

export default function useLockBodyScroll(locked) {
  useEffect(() => {
    document.body.style.overflow = locked ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [locked]);
}
