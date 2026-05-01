import Modal from "./Modal.jsx";
import { isVideoUrl } from "../../lib/uploadApi.js";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion.js";

export default function LightboxModal({
  open,
  onClose,
  items,
  index,
  onPrev,
  onNext,
}) {
  const reducedMotion = usePrefersReducedMotion();
  if (!open) return null;
  const item = items[index];

  const isFirst = index === 0;
  const isLast = index === items.length - 1;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-4xl" label="Image lightbox">
      <div className="relative bg-black">
        {/* Close — 44x44 pt with focus-visible ring; FA glyph keeps the
            icon set consistent with the rest of the app (the previous
            raw "✕" / "‹" / "›" characters were font-dependent). */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-11 h-11 inline-flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Close"
          type="button"
        >
          <i className="fas fa-times text-base" aria-hidden="true"></i>
        </button>

        {/* Prev */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isFirst) onPrev();
          }}
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 inline-flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
            isFirst ? "opacity-40 cursor-not-allowed" : ""
          }`}
          aria-label="Previous"
          type="button"
          disabled={isFirst}
        >
          <i className="fas fa-chevron-left" aria-hidden="true"></i>
        </button>

        {/* Next */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isLast) onNext();
          }}
          className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 inline-flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
            isLast ? "opacity-40 cursor-not-allowed" : ""
          }`}
          aria-label="Next"
          type="button"
          disabled={isLast}
        >
          <i className="fas fa-chevron-right" aria-hidden="true"></i>
        </button>

        {/* Image / Video — autoPlay is gated on prefers-reduced-motion
            so vestibular-disorder users don't get an unexpected video
            launch. They still get controls to start it explicitly. */}
        <div className="flex items-center justify-center p-4">
          {isVideoUrl(item?.src) ? (
            <video
              src={item?.src}
              controls
              autoPlay={!reducedMotion}
              className="max-h-[80vh] w-auto h-auto mx-auto"
            />
          ) : (
            <img
              src={item?.src}
              alt={item?.caption || item?.alt || ""}
              className="max-h-[80vh] w-auto h-auto object-contain mx-auto"
              draggable="false"
              loading="eager"
              decoding="async"
            />
          )}
        </div>

        {/* Caption + counter. The "Use arrow keys" hint is hidden on
            coarse-pointer (touch) devices where it's just noise — the
            on-screen prev/next buttons are the actual interaction. */}
        <div className="text-white p-4 text-center bg-black/70">
          {item?.caption && <p className="text-lg">{item.caption}</p>}
          <p className="text-white/60 text-xs mt-1">
            <span>{index + 1} of {items.length}</span>
            <span className="hidden [@media(pointer:fine)]:inline"> &mdash; Use arrow keys to navigate</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}
