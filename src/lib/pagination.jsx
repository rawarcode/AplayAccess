/**
 * Shared pagination helpers + UI bar for listing pages.
 *
 * Origin: lifted out of pages/owner/Users.jsx so the same shape can be
 * reused across the table-port queue (Bookings, Billing, Transactions,
 * History, Newsletter, etc.) without copy-pasting the ellipsis math
 * and the prev/next/numeric layout.
 *
 * Usage:
 *   import { usePagination, PaginationBar } from '../../lib/pagination';
 *
 *   const { page, setPage, paginated, totalPages, safePage, info } =
 *     usePagination(filtered, 25);
 *
 *   useEffect(() => setPage(1), [filterStatus, search]); // reset on filter
 *
 *   {paginated.map(...)}
 *   <PaginationBar safePage={safePage} totalPages={totalPages}
 *                  onPageChange={setPage} info={info} />
 */
import { useMemo, useState } from 'react';

/**
 * Page-number list with ellipses.
 * Few pages → just [1..N]. Many pages → [1, ..., current-1, current,
 * current+1, ..., N] with '...' placeholders where there's a gap > 1.
 */
export function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push('...');
    result.push(p);
    prev = p;
  }
  return result;
}

/**
 * Pagination state + slice computation.
 *
 * `safePage` clamps the current page to [1, totalPages] so a filter
 * change that shrinks the list (e.g. you were on page 10 of 12, then
 * a search narrows to 3 pages) doesn't leave you on a non-existent
 * page rendering nothing. Caller still typically resets to 1 on
 * filter change for the cleaner "back to top" UX, but safePage is
 * defense-in-depth.
 */
export function usePagination(items, pageSize = 25) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );
  const start = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end   = Math.min(safePage * pageSize, items.length);
  const info  = { start, end, total: items.length };
  return { page, setPage, paginated, totalPages, safePage, info, pageSize };
}

/**
 * Numeric pagination bar with prev/next chevrons + ellipses.
 *
 * Hides itself when totalPages <= 1 so the caller doesn't have to
 * conditionally render it. Tap targets are 40px (h-10/w-10) to clear
 * WCAG 2.5.8 AA on phones.
 */
export function PaginationBar({ safePage, totalPages, onPageChange, info }) {
  if (totalPages <= 1) return null;
  return (
    <div className="px-4 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        Showing {info.start}{'–'}{info.end} of {info.total}
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          aria-label="Previous page"
          className="h-10 w-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition"
        >
          <i className="fas fa-chevron-left text-xs" aria-hidden="true"></i>
        </button>
        {getPageNumbers(safePage, totalPages).map((n, i) =>
          n === '...' ? (
            <span
              key={`ellipsis-${i}`}
              className="h-8 min-w-[2rem] flex items-center justify-center text-xs text-slate-400 select-none"
              aria-hidden="true"
            >
              &hellip;
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              aria-label={`Go to page ${n}`}
              aria-current={n === safePage ? 'page' : undefined}
              className={`h-10 min-w-[2.5rem] px-2 rounded-lg text-sm font-semibold transition ${
                n === safePage
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          aria-label="Next page"
          className="h-10 w-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition"
        >
          <i className="fas fa-chevron-right text-xs" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}
