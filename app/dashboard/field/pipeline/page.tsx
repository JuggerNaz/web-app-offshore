"use client";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import Link from "next/link";
import { Waves, ArrowRight, LayoutGrid, List, Search, ArrowUpDown, ArrowUp, ArrowDown, FileText, Activity, Plus, Filter, X, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Pipeline {
  pipe_id: number;
  title: string;
  pfield: string;
  field_name: string;
  plength: number | null;
  st_loc: string | null;
  end_loc: string | null;
  ptype: string | null;
  process: string | null;
  line_diam: number | null;
}

type ViewMode = "card" | "list";
type SortField = "title" | "field_name" | "plength" | "st_loc" | "end_loc" | "ptype";
type SortOrder = "asc" | "desc";

interface FilterState {
  field: string | null;
  startLoc: string | null;
  endLoc: string | null;
  diameter: string | null;
  process: string | null;
}

// Improved Oil Pipeline SVG Icon Component
const OilPipelineIcon = ({ className = "w-20 h-20" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main pipeline tubes */}
    <rect x="4" y="26" width="56" height="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" rx="2" />
    <rect x="4" y="34" width="56" height="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" rx="2" />
    {/* Valves/Joints */}
    <circle cx="16" cy="32" r="5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
    <circle cx="32" cy="32" r="5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
    <circle cx="48" cy="32" r="5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
    {/* Support stands */}
    <path d="M12 38 L12 48 M20 38 L20 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M28 38 L28 48 M36 38 L36 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M44 38 L44 48 M52 38 L52 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Base supports */}
    <line x1="10" y1="48" x2="22" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="26" y1="48" x2="38" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="42" y1="48" x2="54" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function PipelinePage() {
  const searchParams = useSearchParams();
  const fieldId = searchParams.get("field");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pipeline_view_mode') as ViewMode) || 'list';
    }
    return 'list';
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    field: null,
    startLoc: null,
    endLoc: null,
    diameter: null,
    process: null,
  });

  const { data, error, isLoading } = useSWR(
    fieldId ? `/api/pipeline?field=${fieldId}` : `/api/pipeline`,
    fetcher
  );

  const pipelines: Pipeline[] = useMemo(() => data?.data || [], [data]);

  // Fetch oil fields for the filter
  const { data: fieldsData } = useSWR("/api/library/fields-stats", fetcher);
  const oilFields = useMemo(() => fieldsData?.data || [], [fieldsData]);

  // Derive unique Start Locations
  const availableStartLocs = useMemo(() => {
    const locs = new Set<string>();
    pipelines.forEach((p) => {
      if (p.st_loc && p.st_loc.trim()) locs.add(p.st_loc.trim());
    });
    return Array.from(locs).sort();
  }, [pipelines]);

  // Derive unique End Locations
  const availableEndLocs = useMemo(() => {
    const locs = new Set<string>();
    pipelines.forEach((p) => {
      if (p.end_loc && p.end_loc.trim()) locs.add(p.end_loc.trim());
    });
    return Array.from(locs).sort();
  }, [pipelines]);

  // Derive unique Line Diameters
  const availableDiameters = useMemo(() => {
    const diams = new Set<string>();
    pipelines.forEach((p) => {
      if (p.line_diam !== null && p.line_diam !== undefined && p.line_diam > 0) {
        diams.add(String(p.line_diam));
      }
    });
    return Array.from(diams).sort((a, b) => Number(a) - Number(b));
  }, [pipelines]);

  // Derive unique Processes
  const availableProcesses = useMemo(() => {
    const procs = new Set<string>();
    pipelines.forEach((p) => {
      if (p.process && p.process.trim()) procs.add(p.process.trim());
    });
    return Array.from(procs).sort();
  }, [pipelines]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== null).length;
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      field: null,
      startLoc: null,
      endLoc: null,
      diameter: null,
      process: null,
    });
  };

  // Persist view mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pipeline_view_mode', viewMode);
    }
  }, [viewMode]);

  // Filter and sort pipelines
  const filteredAndSortedPipelines = useMemo(() => {
    let filtered = pipelines.filter((pipeline) => {
      // Search query filter
      const matchesSearch = pipeline.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pipeline.field_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pipeline.st_loc?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pipeline.end_loc?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          `PIPE-${pipeline.pipe_id}`.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Oil Field filter
      if (filters.field && String(pipeline.pfield) !== filters.field && pipeline.field_name !== filters.field) {
        return false;
      }

      // Start Location filter
      if (filters.startLoc && pipeline.st_loc?.trim() !== filters.startLoc) {
        return false;
      }

      // End Location filter
      if (filters.endLoc && pipeline.end_loc?.trim() !== filters.endLoc) {
        return false;
      }

      // Diameter filter
      if (filters.diameter && String(pipeline.line_diam) !== filters.diameter) {
        return false;
      }

      // Process filter
      if (filters.process && pipeline.process?.trim() !== filters.process) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null values
      if (aValue === null) aValue = "";
      if (bValue === null) bValue = "";

      // Convert to string for comparison (except for numbers)
      if (sortField === "plength") {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [pipelines, searchQuery, sortField, sortOrder, filters]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-4 text-red-500">
        <Activity className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-black tracking-tight mb-2">Sync Error</h2>
      <p className="text-slate-500 max-w-xs mx-auto mb-6">Failed to retrieve pipeline data. Please check your connection.</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-black uppercase tracking-widest border-2 hover:bg-teal-50 dark:hover:bg-teal-950 transition-all">Retry</Button>
    </div>
  );

  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Synchronizing Pipeline Network...</p>
    </div>
  );

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                <span className="opacity-50">Operational</span>
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-blue-600/80">Asset Class</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Pipeline Network</h1>
            </div>
          </div>

          <Button asChild className="rounded-2xl h-12 px-8 font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 shadow-2xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-3 border-0">
            <Link href={fieldId ? `/dashboard/field/pipeline/new?field=${fieldId}` : "/dashboard/field/pipeline/new"}>
              <Plus className="h-5 w-5 stroke-[3px]" />
              Register Pipeline
            </Link>
          </Button>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center">
          {/* Search & Filter */}
          <div className="flex flex-1 items-center gap-2 w-full">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <Input
                type="text"
                placeholder="Search pipelines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus-visible:ring-blue-600/20 focus-visible:border-blue-600 transition-all text-sm font-medium"
              />
            </div>

            {/* Filter Drawer Trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-12 px-5 rounded-2xl border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider gap-2 transition-all shrink-0",
                    activeFilterCount > 0 && "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  )}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center bg-blue-600 text-white border-none text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[340px] sm:w-[400px] rounded-l-[2rem] border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                <SheetHeader className="pb-6 border-b border-slate-100 dark:border-slate-800">
                  <SheetTitle className="text-2xl font-black tracking-tighter uppercase italic">Refine Results</SheetTitle>
                  <SheetDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Narrow down pipeline network by specific criteria
                  </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(100vh-180px)] pr-1 custom-scrollbar">
                  {/* Oil Field Filter */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Oil Field</Label>
                    <Select 
                      value={filters.field || "all"} 
                      onValueChange={(val) => setFilters(prev => ({ ...prev, field: val === "all" ? null : val }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold text-xs">
                        <SelectValue placeholder="All Oil Fields" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All Oil Fields</SelectItem>
                        {oilFields.map((field: any) => (
                          <SelectItem key={field.lib_id} value={String(field.lib_id)}>
                            {field.lib_desc} ({field.lib_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Start Location Filter */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Start Location</Label>
                    <Select 
                      value={filters.startLoc || "all"} 
                      onValueChange={(val) => setFilters(prev => ({ ...prev, startLoc: val === "all" ? null : val }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold text-xs">
                        <SelectValue placeholder="All Start Locations" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All Start Locations</SelectItem>
                        {availableStartLocs.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* End Location Filter */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">End Location</Label>
                    <Select 
                      value={filters.endLoc || "all"} 
                      onValueChange={(val) => setFilters(prev => ({ ...prev, endLoc: val === "all" ? null : val }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold text-xs">
                        <SelectValue placeholder="All End Locations" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All End Locations</SelectItem>
                        {availableEndLocs.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Line Diameter Filter */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Diameter (mm)</Label>
                    <Select 
                      value={filters.diameter || "all"} 
                      onValueChange={(val) => setFilters(prev => ({ ...prev, diameter: val === "all" ? null : val }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold text-xs">
                        <SelectValue placeholder="All Diameters" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All Diameters</SelectItem>
                        {availableDiameters.map((diam) => (
                          <SelectItem key={diam} value={diam}>
                            {diam} mm
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Process Filter */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Process</Label>
                    <Select 
                      value={filters.process || "all"} 
                      onValueChange={(val) => setFilters(prev => ({ ...prev, process: val === "all" ? null : val }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold text-xs">
                        <SelectValue placeholder="All Processes" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All Processes</SelectItem>
                        {availableProcesses.map((proc) => (
                          <SelectItem key={proc} value={proc}>
                            {proc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <SheetFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-row gap-3">
                  <Button 
                    variant="outline" 
                    onClick={resetFilters} 
                    disabled={activeFilterCount === 0}
                    className="flex-1 h-11 rounded-xl font-bold uppercase tracking-wider text-xs gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {/* View Toggle */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 self-stretch sm:self-auto">
            <button
              onClick={() => setViewMode("card")}
              className={cn(
                "flex items-center justify-center px-4 h-10 rounded-lg transition-all gap-2 text-xs font-bold uppercase tracking-wider",
                viewMode === "card"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className={cn("hidden lg:block", viewMode !== "card" && "hidden")}>Cards</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center justify-center px-4 h-10 rounded-lg transition-all gap-2 text-xs font-bold uppercase tracking-wider",
                viewMode === "list"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
              title="Table View"
            >
              <List className="w-4 h-4" />
              <span className={cn("hidden lg:block", viewMode !== "list" && "hidden")}>Table</span>
            </button>
          </div>
        </div>

        {/* Active Filter Pills Bar */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Active Filters:</span>
            {filters.field && (
              <Badge variant="secondary" className="gap-1.5 py-1 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 font-bold text-[10px]">
                Field: {oilFields.find((f: any) => String(f.lib_id) === filters.field)?.lib_desc || filters.field}
                <X className="w-3 h-3 cursor-pointer hover:opacity-75" onClick={() => setFilters(prev => ({ ...prev, field: null }))} />
              </Badge>
            )}
            {filters.startLoc && (
              <Badge variant="secondary" className="gap-1.5 py-1 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 font-bold text-[10px]">
                Start: {filters.startLoc}
                <X className="w-3 h-3 cursor-pointer hover:opacity-75" onClick={() => setFilters(prev => ({ ...prev, startLoc: null }))} />
              </Badge>
            )}
            {filters.endLoc && (
              <Badge variant="secondary" className="gap-1.5 py-1 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 font-bold text-[10px]">
                End: {filters.endLoc}
                <X className="w-3 h-3 cursor-pointer hover:opacity-75" onClick={() => setFilters(prev => ({ ...prev, endLoc: null }))} />
              </Badge>
            )}
            {filters.diameter && (
              <Badge variant="secondary" className="gap-1.5 py-1 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 font-bold text-[10px]">
                Diameter: {filters.diameter} mm
                <X className="w-3 h-3 cursor-pointer hover:opacity-75" onClick={() => setFilters(prev => ({ ...prev, diameter: null }))} />
              </Badge>
            )}
            {filters.process && (
              <Badge variant="secondary" className="gap-1.5 py-1 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 font-bold text-[10px]">
                Process: {filters.process}
                <X className="w-3 h-3 cursor-pointer hover:opacity-75" onClick={() => setFilters(prev => ({ ...prev, process: null }))} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0 px-2">
              Clear All
            </Button>
          </div>
        )}

        {/* Card View */}
        {viewMode === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedPipelines.map((pipeline) => (
              <Link
                key={`pipeline-${pipeline.pipe_id}`}
                href={`/dashboard/field/pipeline/${pipeline.pipe_id}?from=list`}
                className="group"
              >
                <div className="relative h-[22rem] flex flex-col rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-black/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 cursor-pointer">
                  {/* Visual Area */}
                  <div className="relative flex-1 flex items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/30 overflow-hidden text-teal-600 dark:text-teal-400">
                    {/* Animated background circles */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-40 h-40 rounded-full bg-gradient-to-br from-teal-400/10 to-cyan-400/10 group-hover:scale-125 transition-transform duration-1000" />
                      <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-teal-500/15 to-cyan-500/15 group-hover:scale-150 transition-transform duration-700" />
                    </div>

                    {/* Main Icon */}
                    <div className="relative z-10 text-teal-600 dark:text-teal-400 group-hover:text-teal-500 group-hover:scale-110 transition-all duration-500 drop-shadow-2xl">
                      <OilPipelineIcon className="w-20 h-20" />
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-6 flex flex-col gap-4 bg-white dark:bg-slate-900 relative">
                    {/* Title Section */}
                    <div className="min-h-[3rem] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <h3 className="text-sm font-black text-center uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2 leading-tight">
                          {pipeline.title}
                        </h3>
                        {pipeline.field_name && (
                          <div className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                            {pipeline.field_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Integrated Data Row */}
                    <div className="grid grid-cols-3 gap-2 mt-auto">
                      <div className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400">{pipeline.plength?.toFixed(0) || "0"}m</span>
                        <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">LEN</span>
                      </div>
                      <div className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <span className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 truncate max-w-full px-1">{pipeline.st_loc || "N/A"}</span>
                        <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">FROM</span>
                      </div>
                      <div className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <span className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 truncate max-w-full px-1">{pipeline.end_loc || "N/A"}</span>
                        <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">TO</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Identifier Badge */}
                  <div className="absolute top-4 left-4 z-20">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-teal-600 text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg">
                      <Waves className="w-3 h-3" />
                      PIPELINE ID: {pipeline.pipe_id}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Table View */}
        {viewMode === "list" && (
          <div className="rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 h-16">
                  <TableHead className="w-[80px] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Icon</TableHead>
                  <TableHead className="px-6">
                    <button
                      onClick={() => handleSort("title")}
                      className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-teal-600 transition-colors"
                    >
                      Title
                      <SortIcon field="title" />
                    </button>
                  </TableHead>
                  <TableHead className="px-6">
                    <button
                      onClick={() => handleSort("field_name")}
                      className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-teal-600 transition-colors"
                    >
                      Oil Field
                      <SortIcon field="field_name" />
                    </button>
                  </TableHead>
                  <TableHead className="px-6">
                    <button
                      onClick={() => handleSort("plength")}
                      className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-teal-600 transition-colors"
                    >
                      Length
                      <SortIcon field="plength" />
                    </button>
                  </TableHead>
                  <TableHead className="px-6">
                    <button
                      onClick={() => handleSort("st_loc")}
                      className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-teal-600 transition-colors"
                    >
                      Route
                      <SortIcon field="st_loc" />
                    </button>
                  </TableHead>
                  <TableHead className="px-6 text-right">
                    <button
                      onClick={() => handleSort("ptype")}
                      className="flex items-center justify-end text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-teal-600 transition-colors w-full"
                    >
                      Type
                      <SortIcon field="ptype" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPipelines.map((pipeline) => (
                  <TableRow
                    key={`pipeline-${pipeline.pipe_id}`}
                    className="group cursor-pointer border-b border-slate-50 dark:border-slate-800/50 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition-all duration-300"
                    onClick={() => window.location.href = `/dashboard/field/pipeline/${pipeline.pipe_id}?from=list`}
                  >
                    <TableCell className="px-6 py-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center group-hover:scale-105 group-hover:shadow-lg transition-all duration-500 shadow-sm">
                        <div className="text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
                          <OilPipelineIcon className="w-8 h-8" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors uppercase tracking-tight">
                          {pipeline.title}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          PIPE-{pipeline.pipe_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">
                        {pipeline.field_name || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                          {pipeline.plength !== null ? `${pipeline.plength.toFixed(1)}m` : "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">FROM</span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{pipeline.st_loc || "-"}</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">TO</span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{pipeline.end_loc || "-"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {pipeline.ptype || "Standard"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredAndSortedPipelines.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in zoom-in duration-500">
            <Waves className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
              {searchQuery || activeFilterCount > 0 ? "No pipelines match the selected criteria" : "No pipelines found"}
            </p>
            {(searchQuery || activeFilterCount > 0) && (
              <Button 
                variant="link" 
                onClick={() => { setSearchQuery(""); resetFilters(); }}
                className="mt-2 text-blue-600 font-bold"
              >
                Clear search & filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
