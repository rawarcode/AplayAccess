import { useEffect, useState } from "react";

/**
 * Avatar — renders user.avatar URL when present, falls back to a
 * coloured initials circle when:
 *   - src is empty/null
 *   - src loads but errors (404, blocked, CORS, network drop)
 *
 * Each consumer passes the size + colour classes they want (Tailwind
 * compiler can't see classes built from interpolated strings, so the
 * full class names live at the call site). The component layers
 * `rounded-full` and content alignment on top.
 *
 * The errored flag resets whenever `src` changes — so when a user
 * replaces their avatar with a new (working) URL, the new one gets
 * a fresh chance to load instead of staying stuck on initials.
 */
export default function Avatar({
  src,
  name,
  className = "h-8 w-8",
  fallbackClassName = "bg-slate-200 text-slate-700 text-sm font-semibold",
  alt,
}) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  const initials =
    (name || "")
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  if (src && !errored) {
    return (
      <img
        src={src}
        alt={alt || name || "Profile"}
        onError={() => setErrored(true)}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center ${className} ${fallbackClassName}`}
      aria-label={alt || name || "Profile"}
    >
      {initials}
    </div>
  );
}
