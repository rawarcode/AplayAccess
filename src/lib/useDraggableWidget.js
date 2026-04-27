import { useState, useRef, useEffect, useCallback } from 'react';

// 8px gutter so the bubble can't be parked flush against any viewport
// edge — keeps a tappable margin and dodges browser chrome (mobile URL
// bar, virtual home indicator, etc.).
const SAFE_MARGIN = 8;
// Default anchor in the existing widgets is `bottom-6 right-6` = 24px
// from each edge. Drag offsets are computed against this anchor so a
// freshly-mounted widget renders exactly where it used to.
const ANCHOR_OFFSET = 24;
// Treat anything under this many px as a click, not a drag — prevents
// a jittery finger from suppressing the open/close action.
const DRAG_THRESHOLD = 5;

/**
 * Drag-and-persist positioning for a floating bottom-right widget.
 *
 * The chat widgets (guest + staff) are anchored bottom-right at
 * `fixed bottom-6 right-6` and historically blocked anything else
 * placed in that corner. Rather than refactor every floating button on
 * every page to dodge the chat footprint, we let the user move the
 * widget out of the way themselves. Position is per-widget (storageKey)
 * so guest + staff can sit in different spots.
 *
 * Implementation notes:
 *  - We translate via `transform` instead of mutating `bottom`/`right`
 *    so the drag is GPU-accelerated and doesn't trigger layout per
 *    frame.
 *  - Bubble AND panel get the SAME translate so they move in lockstep.
 *    Re-anchoring the panel to the bubble's drag position would let the
 *    user park the bubble center-screen and still have the panel open
 *    in a sensible spot, but it adds a lot of edge-case math
 *    (clamping when the panel would clip left/up). For now the simple
 *    translate-both is enough; if extreme left-edge parking starts
 *    clipping the panel, switch to a smart anchor.
 *  - Pointer Events API unifies mouse + touch + pen, with
 *    setPointerCapture so `move`/`up` keep firing if the pointer
 *    leaves the bubble mid-drag.
 *  - `touchAction: 'none'` on the bubble blocks page scroll while a
 *    drag is in progress — without it, touchmove gets eaten by the
 *    scroller and the bubble follows for ~80ms then snaps back.
 */
export function useDraggableWidget(storageKey, bubbleSize = 56) {
  const STORAGE = `aplaya_widget_pos_${storageKey}`;

  const [offset, setOffset] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        return saved;
      }
    } catch { /* corrupt JSON — fall through to default */ }
    return { x: 0, y: 0 };
  });

  // Per-pointer drag bookkeeping. Held in a ref so we don't re-render
  // on every move event — only on actual offset changes.
  const dragState = useRef({
    pointerId: null,
    startX: 0, startY: 0,
    baseX: 0, baseY: 0,
    moved: false,
  });
  // Set true at pointerup IF the user actually dragged. Read by the
  // bubble's onClick to skip the open/close toggle that would
  // otherwise fire as the synthetic click after pointerup. Reset on
  // the next tick so subsequent real clicks work.
  const wasDragged = useRef(false);

  const clamp = useCallback(({ x, y }) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Bubble's bottom-left at default sits at
    //   (vw - ANCHOR_OFFSET - bubbleSize, vh - ANCHOR_OFFSET).
    // Translate moves it by (x, y). Constrain so the bubble stays
    // entirely within [SAFE_MARGIN, viewport - SAFE_MARGIN].
    const minX = -(vw - ANCHOR_OFFSET - bubbleSize - SAFE_MARGIN);
    const maxX = ANCHOR_OFFSET - SAFE_MARGIN; // small positive nudge ok
    const minY = -(vh - ANCHOR_OFFSET - bubbleSize - SAFE_MARGIN);
    const maxY = ANCHOR_OFFSET - SAFE_MARGIN;
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  }, [bubbleSize]);

  // Re-clamp on resize so a position that was valid at desktop width
  // doesn't leave the bubble off-screen after rotating to portrait or
  // shrinking the window.
  useEffect(() => {
    function onResize() { setOffset(prev => clamp(prev)); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const onPointerDown = useCallback((e) => {
    // Left mouse / primary touch only — right-click and middle-click
    // shouldn't initiate a drag.
    if (e.button !== undefined && e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* some browsers refuse capture on disabled elements */ }
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      baseX: offset.x, baseY: offset.y,
      moved: false,
    };
  }, [offset.x, offset.y]);

  const onPointerMove = useCallback((e) => {
    const s = dragState.current;
    if (s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    s.moved = true;
    setOffset(clamp({ x: s.baseX + dx, y: s.baseY + dy }));
  }, [clamp]);

  const onPointerUp = useCallback((e) => {
    const s = dragState.current;
    if (s.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (s.moved) {
      // Persist using the freshest offset value (state setter runs
      // after the move pump, so reading state directly here is safe).
      try { localStorage.setItem(STORAGE, JSON.stringify(offset)); } catch { /* quota / disabled storage */ }
      wasDragged.current = true;
      // Reset on the next macrotask so the synthetic click that
      // browsers fire after pointerup gets suppressed, but the very
      // next user click goes through.
      setTimeout(() => { wasDragged.current = false; }, 0);
    }
    dragState.current.pointerId = null;
  }, [STORAGE, offset]);

  // Spread onto the bubble. Caller still attaches its own onClick.
  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  // Caller spreads `style` onto BOTH bubble and panel root so they
  // translate in lockstep. `touchAction: none` only matters on the
  // bubble (the draggable element); harmless on the panel.
  const style = {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    touchAction: 'none',
  };

  return { handlers, style, wasDragged };
}
