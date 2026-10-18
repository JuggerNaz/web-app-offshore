"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Loader2, Search, Waves, X } from "lucide-react";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ScrollSentinel } from "@/components/data-table/scroll-sentinel";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
}

interface PipelineRow {
  pipe_id: number;
  title: string;
  pfield?: string | null;
  field_name?: string | null;
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

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={placeholder || "Search platforms & pipelines..."}
            className="pl-9 pr-8 h-9 rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setOpen(true);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
              onClick={() => onChange(null)}
              className="hover:text-red-500 transition-colors shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl max-h-80 overflow-y-auto custom-scrollbar p-1">
          {/* Platforms group */}
          <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-blue-500" />
            Platforms
            {typeof platformTotal === "number" && (
              <span className="font-bold text-slate-300 dark:text-slate-600">({platformTotal})</span>
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
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {p.title}
                  </span>
                  {(p.field_name || p.pfield) && (
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                      {p.field_name || p.pfield}
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
          <div className="px-3 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Waves className="h-3 w-3 text-teal-500" />
            Pipelines
            {typeof pipelineTotal === "number" && (
              <span className="font-bold text-slate-300 dark:text-slate-600">({pipelineTotal})</span>
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
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
              >
                <Waves className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {p.title}
                  </span>
                  {(p.field_name || p.pfield) && (
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                      {p.field_name || p.pfield}
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
        </div>
      )}
    </div>
  );
}
