"use client";

import { useCallback, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScrollSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** Rows loaded so far. */
  loadedCount?: number;
  /** Total rows server-side, when known. */
  totalItems?: number | null;
  /** Show nothing at all when there is nothing more to load. Default true. */
  hideWhenDone?: boolean;
}

/**
 * Scroll-to-load trigger. Observes itself and calls `onLoadMore` when it
 * enters the viewport. Renders a spinner while fetching, an inline
 * "Load more" button as a manual fallback (touchscreens, short lists), and a
 * compact "Showing X of Y" footer once known.
 */
export function ScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  loadedCount,
  totalItems,
  hideWhenDone = true,
}: ScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) onLoadMore();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (!hasNextPage) {
    if (hideWhenDone) return null;
    return (
      <div className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
        {typeof loadedCount === "number" && typeof totalItems === "number"
          ? `Showing all ${loadedCount} of ${totalItems}`
          : "End of list"}
      </div>
    );
  }

  return (
    <div ref={sentinelRef} className="flex flex-col items-center justify-center gap-2 py-4">
      {isFetchingNextPage ? (
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="uppercase tracking-widest text-xs font-bold">Loading more…</span>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleLoadMore} className="rounded-lg">
          Load more
        </Button>
      )}
      {typeof loadedCount === "number" && typeof totalItems === "number" && totalItems > 0 ? (
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          Showing {loadedCount} of {totalItems}
        </span>
      ) : null}
    </div>
  );
}
