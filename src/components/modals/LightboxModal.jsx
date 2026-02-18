import Modal from "./Modal.jsx";

export default function LightboxModal({
  open,
  onClose,
  items,
  index,
  onPrev,
  onNext,
}) {
  if (!open) return null;
  const item = items[index];

  const isFirst = index === 0;
  const isLast = index === items.length - 1;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-4xl">
      <div className="relative bg-black">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-full bg-black/50 text-white px-3 py-2 hover:bg-black/80"
          aria-label="Close"
          type="button"
        >
          ✕
        </button>

        {/* Prev */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isFirst) onPrev();
          }}
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 text-white px-3 py-2 hover:bg-black/80 ${
            isFirst ? "opacity-40 cursor-not-allowed" : ""
          }`}
          aria-label="Previous"
          type="button"
          disabled={isFirst}
        >
          ‹
        </button>

        {/* Next */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isLast) onNext();
          }}
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 text-white px-3 py-2 hover:bg-black/80 ${
            isLast ? "opacity-40 cursor-not-allowed" : ""
          }`}
          aria-label="Next"
          type="button"
          disabled={isLast}
        >
          ›
        </button>

        {/* Image */}
        <div className="flex items-center justify-center p-4">
          <img
            src={item?.src}
            alt={item?.caption || item?.alt || ""}
            className="max-h-[80vh] w-auto h-auto object-contain mx-auto"
            draggable="false"
          />
        </div>

        {/* Caption */}
        <div className="text-white p-4 text-center text-lg bg-black/70">
          {item?.caption || ""}
        </div>
      </div>
    </Modal>
  );
}