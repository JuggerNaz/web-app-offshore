"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, Loader2, Search, Waves, X } from "lucide-react";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ScrollSentinel } from "@/components/data-table/scroll-sentinel";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface StructureOption {
  id: number;
  title: string;
  type: "PLATFORM" | "PIPELINE";
  fieldName?: string | null;
}

interface StructurePickerProps {
  /** Currently selected structure id (optional — the picker can also be used purely as an "add" control). */
  value?: number | string | null;
  /** Called with the picked structure, or null when the selection is cleared. */
  onChange: (structure: StructureOption | null) => void;
  className?: string;
  placeholder?: string;
}

interface PlatformRow {
  plat_id: number;
  title: string;
  pfield?: string | null;
  field_name?: string | null;
  pdesc?: string | null;
}

interface PipelineRow {
  pipe_id: number;
  title: string;
  pfield?: string | null;
  field_name?: string | null;
  pdesc?: string | null;
}

/**
 * Compact searchable picker across platforms and pipelines. Both lists are
 * paged server-side via /api/platform and /api/pipeline (?q= title search,
 * 50 rows per page) so no call site needs to fetch the whole fleet.
 */
export function StructurePicker({
  value = null,
  onChange,
  className,
  placeholder,
}: StructurePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const {
    items: platformItems,
    totalItems: platformTotal,
    isLoading: platformsLoading,
    isEmpty: platformsEmpty,
    hasNextPage: platformsHasNextPage,
    isFetchingNextPage: platformsFetchingNext,
    fetchNextPage: fetchNextPlatforms,
  } = useInfiniteList<PlatformRow>({
    queryKey: ["structure-picker", "platforms", debouncedSearch],
    getPageUrl: (page) =>
      `/api/platform?page=${page}&pageSize=50${
        debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ""
      }`,
    enabled: open,
  });

  const {
    items: pipelineItems,
    totalItems: pipelineTotal,
    isLoading: pipelinesLoading,
    isEmpty: pipelinesEmpty,
    hasNextPage: pipelinesHasNextPage,
    isFetchingNextPage: pipelinesFetchingNext,
    fetchNextPage: fetchNextPipelines,
  } = useInfiniteList<PipelineRow>({
    queryKey: ["structure-picker", "pipelines", debouncedSearch],
    getPageUrl: (page) =>
      `/api/pipeline?page=${page}&pageSize=50${
        debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ""
      }`,
    enabled: open,
  });

  const selectedTitle = useMemo(() => {
    if (value === null || value === undefined || value === "") return null;
    const plat = platformItems.find((p) => String(p.plat_id) === String(value));
    if (plat) return plat.title;
    const pipe = pipelineItems.find((p) => String(p.pipe_id) === String(value));
    if (pipe) return pipe.title;
    return null;
  }, [value, platformItems, pipelineItems]);

  const pick = (structure: StructureOption) => {
    onChange(structure);
    setSearchQuery("");
    setOpen(false);
  };

  const hasSearch = debouncedSearch.trim().length > 0;
  const isBothEmpty = platformsEmpty && pipelinesEmpty && !platformsLoading && !pipelinesLoading;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!open) setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder={placeholder || "Search platforms & pipelines..."}
                className="pl-9 pr-8 h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    setOpen(true);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {selectedTitle && (
              <Badge
                variant="secondary"
                className="shrink-0 gap-1 py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase max-w-[160px]"
              >
                <span className="truncate">{selectedTitle}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                  className="hover:text-red-500 transition-colors shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[650px] p-1.5 max-h-80 overflow-y-auto custom-scrollbar z-50 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl"
        >
          {/* Platforms group */}
          <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-blue-500" />
              Platforms
            </span>
            {typeof platformTotal === "number" && (
              <span className="font-bold text-slate-400">({platformTotal})</span>
            )}
          </div>
          {platformsLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              Loading platforms...
            </div>
          ) : platformItems.length > 0 ? (
            platformItems.map((p) => (
              <button
                key={`picker-plat-${p.plat_id}`}
                type="button"
                onClick={() =>
                  pick({
                    id: p.plat_id,
                    title: p.title,
                    type: "PLATFORM",
                    fieldName: p.field_name ?? p.pfield ?? null,
                  })
                }
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer"
              >
                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {p.title}
                  </span>
                  {(p.field_name || p.pfield || p.pdesc) && (
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                      {[p.field_name || p.pfield, p.pdesc].filter(Boolean).join(" • ")}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-black uppercase text-slate-400 shrink-0">
                  PLAT-{p.plat_id}
                </span>
              </button>
            ))
          ) : (
            platformsEmpty && (
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                No platforms found
              </div>
            )
          )}
          {!platformsLoading && platformItems.length > 0 && (
            <ScrollSentinel
              hasNextPage={platformsHasNextPage}
              isFetchingNextPage={platformsFetchingNext}
              onLoadMore={fetchNextPlatforms}
              loadedCount={platformItems.length}
              totalItems={platformTotal}
            />
          )}

          {/* Pipelines group */}
          <div className="px-3 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Waves className="h-3 w-3 text-teal-500" />
              Pipelines
            </span>
            {typeof pipelineTotal === "number" && (
              <span className="font-bold text-slate-400">({pipelineTotal})</span>
            )}
          </div>
          {pipelinesLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-500" />
              Loading pipelines...
            </div>
          ) : pipelineItems.length > 0 ? (
            pipelineItems.map((p) => (
              <button
                key={`picker-pipe-${p.pipe_id}`}
                type="button"
                onClick={() =>
                  pick({
                    id: p.pipe_id,
                    title: p.title,
                    type: "PIPELINE",
                    fieldName: p.field_name ?? p.pfield ?? null,
                  })
                }
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer"
              >
                <Waves className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400">
                    {p.title}
                  </span>
                  {(p.field_name || p.pfield || p.pdesc) && (
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                      {[p.field_name || p.pfield, p.pdesc].filter(Boolean).join(" • ")}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-black uppercase text-slate-400 shrink-0">
                  PIPE-{p.pipe_id}
                </span>
              </button>
            ))
          ) : (
            pipelinesEmpty && (
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                No pipelines found
              </div>
            )
          )}
          {!pipelinesLoading && pipelineItems.length > 0 && (
            <ScrollSentinel
              hasNextPage={pipelinesHasNextPage}
              isFetchingNextPage={pipelinesFetchingNext}
              onLoadMore={fetchNextPipelines}
              loadedCount={pipelineItems.length}
              totalItems={pipelineTotal}
            />
          )}

          {/* Empty state hint */}
          {hasSearch && isBothEmpty && (
            <div className="p-4 text-center space-y-1.5 border-t border-slate-100 dark:border-slate-800 mt-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                No structures match &ldquo;<span className="text-slate-900 dark:text-white font-bold">{searchQuery}</span>&rdquo;
              </p>
              <p className="text-[11px] text-slate-400">
                Check the spelling or clear search to browse all structures.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setOpen(true);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline pt-1 inline-block cursor-pointer"
              >
                Clear search & show all
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
