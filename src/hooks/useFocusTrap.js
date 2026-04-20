import { useEffect, useRef } from 'react';

// Keyboard-traps focus inside the referenced container while `active`
// is true. Moves initial focus to the first focusable element on mount
// and restores it to the previously-focused element on unmount so
// screen-reader users don't get dumped back at the document root.
//
// Usage:
//   const ref = useFocusTrap(open);
//   return <div ref={ref} role="dialog" aria-modal="true">...</div>
//
// NOTE: Only traps Tab/Shift+Tab. Escape-to-close is the caller's job —
// some modals want to block Escape during a network request, others
// don't. Leaving that policy to each modal keeps this hook focused.
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function useFocusTrap(active) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Save whatever was focused before we opened so we can restore it
    // when the modal closes.
    const previouslyFocused = document.activeElement;

    // Move focus inside — prefer first focusable, fall back to the
    // container itself (tabindex=-1 ensures it can receive focus).
    const focusables = container.querySelectorAll(FOCUSABLE);
    const first = focusables[0];
    if (first) {
      // Defer by a tick — React hasn't necessarily painted the modal yet
      // on the same tick this effect runs.
      queueMicrotask(() => first.focus?.());
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus?.();
    }

    function onKey(e) {
      if (e.key !== 'Tab') return;
      const focusables = container.querySelectorAll(FOCUSABLE);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      // Wrap focus at boundaries.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus?.();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus?.();
      }
    }

    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      // Restore focus to whatever opened the modal — belts-and-braces
      // check that the element still exists and is focusable.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return containerRef;
}
