/**
 * Cross-platform "print this HTML" helper.
 *
 * Why not window.open + w.print()?
 *   The popup pattern works on desktop browsers but is unreliable on
 *   mobile:
 *     - iOS Safari + Android Chrome aggressively block popups; even
 *       when triggered by a user gesture they often open as a fresh
 *       tab with no print dialog at all.
 *     - Mobile browsers expose `window.print()` reliably only for the
 *       CURRENT tab. Calling print() on a popup opens the OS print
 *       sheet for the parent page in some browsers, or nothing in
 *       others.
 *     - Even on desktop the popup has its own quirks: ad-blockers,
 *       multi-monitor focus loss, browser-specific print-blocking
 *       extensions.
 *
 * The hidden-iframe pattern is what react-to-print and print-js use,
 * and it works on every browser tested:
 *   1. Inject a 0-size iframe into the current document.
 *   2. Write the printable HTML into the iframe's document.
 *   3. On iframe load, call iframe.contentWindow.print() — the
 *      browser opens its native print sheet for the IFRAME's
 *      content, but anchored to the parent tab. No popup, no
 *      cross-origin gymnastics.
 *   4. Clean up the iframe after the dialog dismisses.
 *
 * One subtlety: the inline-script-CSP issue documented in CLAUDE.md
 * is sidestepped here too. The iframe inherits the parent's CSP, so
 * we still don't try to embed `<script>window.print()</script>` in
 * the HTML — print() fires from the parent (this module) instead.
 *
 * @param {string} html  — full HTML document string (must include
 *                          <!doctype html><html>…</html>)
 * @param {object} [opts]
 * @param {string} [opts.title]  — sets iframe document.title which
 *                                  becomes the default print filename.
 *                                  If omitted we fall back to the
 *                                  parent document's title.
 */
export function printHtml(html, opts = {}) {
  const iframe = document.createElement('iframe');
  // Off-screen but still in-flow enough to load + print correctly.
  // display:none breaks print on some Webkit builds; 0×0 + opacity 0
  // is the safe combo.
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  iframe.style.cssText = [
    'position:fixed',
    'right:0',
    'bottom:0',
    'width:0',
    'height:0',
    'border:0',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(iframe);

  const cleanup = () => {
    // Some mobile browsers fire onafterprint immediately on dialog
    // dismiss; others delay. 1 s is enough for the dialog to close
    // before we yank the iframe out from under it.
    setTimeout(() => {
      try { iframe.remove(); } catch { /* already gone */ }
    }, 1000);
  };

  // Wait for the iframe to load before printing. Some browsers fire
  // 'load' synchronously after document.close() (file: + about:blank
  // edge cases); others fire it async. Handle both by attaching the
  // listener BEFORE writing.
  iframe.addEventListener('load', () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    try {
      if (opts.title) {
        try { win.document.title = opts.title; } catch { /* same-origin write usually fine */ }
      }
      win.focus();
      // contentWindow.print() blocks the JS thread until the user
      // dismisses the print dialog on most desktop browsers; mobile
      // browsers usually return immediately after sheet open. Either
      // way, schedule cleanup for after the dialog interaction.
      win.addEventListener('afterprint', cleanup, { once: true });
      win.print();
      // Belt-and-suspenders cleanup — afterprint isn't fired on
      // every browser.
      cleanup();
    } catch {
      cleanup();
    }
  }, { once: true });

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
}
