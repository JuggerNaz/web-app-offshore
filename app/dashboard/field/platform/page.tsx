"use client";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import Link from "next/link";
import { Building2, ArrowRight, LayoutGrid, List, Search, ArrowUpDown, ArrowUp, ArrowDown, Layers2, Activity, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { getStoragePublicUrl } from "@/utils/storage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Filter, X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Platform {
  plat_id: number;
  title: string;
  pfield: string;
  plegs: number | null;
  process: string | null;
  ptype: string | null;
  field_name?: string;
  images?: Array<{
    id: number;
    path: string;
    meta?: {
      file_url?: string;
    };
  }>;
}

type ViewMode = "card" | "list";
type SortField = "title" | "plegs" | "process" | "ptype" | "field_name";
type SortOrder = "asc" | "desc";

// Improved Oil Platform SVG Icon Component
const OilPlatformIcon = ({ className = "w-20 h-20" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Platform deck */}
    <rect x="8" y="20" width="48" height="6" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
    {/* Main legs */}
    <line x1="14" y1="26" x2="14" y2="56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <line x1="26" y1="26" x2="26" y2="56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <line x1="38" y1="26" x2="38" y2="56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <line x1="50" y1="26" x2="50" y2="56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    {/* Derrick/Tower */}
    <path d="M28 20 L32 4 L36 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <line x1="30" y1="12" x2="34" y2="12" stroke="currentColor" strokeWidth="1.5" />
    <line x1="29" y1="16" x2="35" y2="16" stroke="currentColor" strokeWidth="1.5" />
    {/* Cross bracing */}
    <line x1="14" y1="40" x2="26" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    <line x1="26" y1="40" x2="38" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    <line x1="38" y1="40" x2="50" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    {/* Base */}
    <line x1="8" y1="56" x2="56" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

interface FilterState {
  legs: string | null;
  field: string | null;
  type: string | null;
}

export default function PlatformPage() {
  const searchParams = useSearchParams();
  const fieldId = searchParams.get("field");

  // Fetch platforms first so 'data' is available for following hooks
  const { data, error, isLoading } = useSWR(
    fieldId ? `/api/platform?field=${fieldId}` : `/api/platform`,
    fetcher
  );

  const platforms: Platform[] = useMemo(() => data?.data || [], [data]);

  const [randomImages, setRandomImages] = useState<Map<number, string>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('platform_view_mode') as ViewMode) || 'list';
    }
    return 'list';
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    legs: null,
    field: null,
    type: null,
  });

  // Fetch oil fields for the filter
  const { data: fieldsData } = useSWR("/api/library/fields-stats", fetcher);
  const oilFields = useMemo(() => fieldsData?.data || [], [fieldsData]);

  // Derive unique leg counts from current data
  const availableLegs = useMemo(() => {
    const legs = new Set<string>();
    platforms.forEach((p: Platform) => {
      if (p.plegs !== null && p.plegs !== undefined) {
        legs.add(String(p.plegs));
      }
    });
    return Array.from(legs).sort((a, b) => Number(a) - Number(b));
  }, [platforms]);

  // Derive unique platform types from current data if possible, or use standard
  const platTypes = useMemo(() => {
    if (!data?.data) return ["JACKET", "TRIPOD", "MONOPILE", "JACK-UP"];
    const types = new Set<string>();
    data.data.forEach((p: Platform) => {
      if (p.ptype) types.add(p.ptype);
    });
    return Array.from(types).sort();
  }, [data]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== null).length;
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      legs: null,
      field: null,
      type: null,
    });
  };

  // Generate random image selection for platforms with multiple images
  useEffect(() => {
    if (!data) return;

    const imageMap = new Map<number, string>();
    platforms.forEach((platform) => {
      if (platform.images && platform.images.length > 0) {
        const randomIndex = Math.floor(Math.random() * platform.images.length);
        const img = platform.images[randomIndex];
        const url = img.meta?.file_url || getStoragePublicUrl("attachments", img.path);
        imageMap.set(platform.plat_id, url);
      }
    });
    setRandomImages(imageMap);
  }, [data]);

  // Persist view mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('platform_view_mode', viewMode);
    }
  }, [viewMode]);

  // Filter and sort platforms
  const filteredAndSortedPlatforms = useMemo(() => {
    let filtered = platforms.filter((platform) => {
      // Search query filter
      const matchesSearch = platform.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          platform.field_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          `PLAT-${platform.plat_id}`.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Legs filter
      if (filters.legs && String(platform.plegs) !== filters.legs) return false;

      // Field filter
      if (filters.field && String(platform.pfield) !== filters.field) return false;

      // Type filter
      if (filters.type && platform.ptype !== filters.type) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null values
      if (aValue === null) aValue = "";
      if (bValue === null) bValue = "";

      // Convert to string for comparison
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [platforms, searchQuery, sortField, sortOrder, filters]);

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
      <p className="text-slate-500 max-w-xs mx-auto mb-6">Failed to retrieve platform data. Please check your connection.</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-black uppercase tracking-widest border-2 hover:bg-slate-50 transition-all">Retry</Button>
    </div>
  );

  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Synchronizing Fleet Data...</p>
    </div>
  );

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Layers2 className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                <span className="opacity-50">Operational</span>
                <div className="h-1 w-1 rounded-full bg-emerald-500" />
                <span className="text-blue-600/80">Asset Class</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Platform Fleet</h1>
            </div>
          </div>

          <Button asChild className="rounded-2xl h-12 px-8 font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 shadow-2xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-3 border-0">
            <Link href="/dashboard/field/platform/new">
              <Plus className="h-5 w-5 stroke-[3px]" />
              Register Platform
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
                placeholder="Search platforms, ID, or field..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus-visible:ring-blue-600/20 focus-visible:border-blue-600 transition-all text-sm font-medium"
              />
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-12 px-5 rounded-2xl border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider gap-2 transition-all",
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
              <SheetContent className="w-[340px] sm:w-[400px] rounded-l-[2rem] border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                <SheetHeader className="pb-6 border-b border-slate-100 dark:border-slate-800">
                  <SheetTitle className="text-2xl font-black tracking-tighter uppercase italic">Refine Results</SheetTitle>
                  <SheetDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Narrow down the platform network by specific criteria
                  </SheetDescription>
                </SheetHeader>

                <div className="py-8 space-y-8">
                  {/* Oil Field Filter */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Oil Field</Label>
                    <Select 
                      value={filters.field || "all"} 
                      onValueChange={(val) => setFilters(prev => ({ ...prev, field: val === "all" ? null : val }))}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold">
                        <SelectValue placeholder="All Oil Fields" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All Fields</SelectItem>
                        {oilFields.map((field: any) => (
                          <SelectItem key={field.lib_id} value={String(field.lib_id)}>
                            {field.lib_desc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Legs Filter */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Number of Legs</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {["all", ...availableLegs].map((l) => (
                        <button
                          key={`leg-${l}`}
                          onClick={() => setFilters(prev => ({ ...prev, legs: l === "all" ? null : l }))}
                          className={cn(
                            "h-10 rounded-xl text-[10px] font-black uppercase transition-all border shadow-sm",
                            (l === "all" ? filters.legs === null : filters.legs === l)
                              ? "bg-blue-600 text-white border-blue-600 scale-105"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          )}
                        >
                          {l === "all" ? "All" : l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Platform Type Filter */}
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Platform Type</Label>
                    <Select 
                      value={filters.type || "all"} 
                      onValueChange={(val) => setFilters(prev => ({ ...prev, type: val === "all" ? null : val }))}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px] tracking-wider">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value="all">All Types</SelectItem>
                        {platTypes.map((type) => (
                          <SelectItem key={type} value={type} className="uppercase text-[10px] font-bold">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <SheetFooter className="absolute bottom-8 left-6 right-6 flex-col gap-3 sm:flex-col">
                  <Button 
                    onClick={resetFilters}
                    variant="ghost" 
                    className="w-full h-12 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-black uppercase tracking-widest text-[10px] gap-2 transition-all"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset All Filters
                  </Button>
                  <Button 
                    asChild
                    className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 font-black uppercase tracking-widest text-xs"
                  >
                    <SheetTrigger>Show {filteredAndSortedPlatforms.length} Platforms</SheetTrigger>
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {activeFilterCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters}
                className="h-12 px-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Reset Filters"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
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

        {/* Card View */}
        {viewMode === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedPlatforms.map((platform) => {
              const imageUrl = randomImages.get(platform.plat_id);
              const hasImage = !!imageUrl;

              return (
                <Link
                  key={`platform-${platform.plat_id}`}
                  href={`/dashboard/field/platform/${platform.plat_id}?from=list`}
                  className="group"
                >
                  <div className="relative h-[22rem] flex flex-col rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-black/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 cursor-pointer">
                    {/* Visual Area */}
                    <div className="relative flex-1 flex items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/30 overflow-hidden">
                      {/* Animated background circles (only if no image) */}
                      {!hasImage && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-400/10 to-indigo-400/10 group-hover:scale-125 transition-transform duration-1000" />
                          <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/15 group-hover:scale-150 transition-transform duration-700" />
                        </div>
                      )}

                      {hasImage ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={imageUrl}
                            alt={platform.title}
                            fill
                            className="object-contain group-hover:scale-110 transition-transform duration-700 drop-shadow-xl"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                          />
                        </div>
                      ) : (
                        <div className="relative z-10 text-blue-600 dark:text-blue-400 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-500 drop-shadow-2xl">
                          <OilPlatformIcon className="w-20 h-20" />
                        </div>
                      )}
                    </div>

                    {/* Content Area */}
                    <div className="p-6 flex flex-col gap-4 bg-white dark:bg-slate-900 relative">
                      <div className="flex flex-col items-center justify-center min-h-[4rem]">
                        <h3 className="text-sm font-black text-center uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight">
                          {platform.title}
                        </h3>
                        {platform.field_name && (
                          <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">
                             {platform.field_name}
                          </div>
                        )}
                      </div>

                      {/* Integrated Data Row */}
                      <div className="grid grid-cols-3 gap-2 mt-auto">
                        <div className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm">
                          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">{platform.plegs ?? "0"}</span>
                          <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">LEGS</span>
                        </div>
                        <div className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 truncate max-w-full px-1">{platform.ptype || "N/A"}</span>
                          <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">TYPE</span>
                        </div>
                        <div className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 truncate max-w-full px-1">{platform.process || "N/A"}</span>
                          <span className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">PROC</span>
                        </div>
                      </div>
                    </div>

                    {/* Top Identifier Badge */}
                    <div className="absolute top-4 left-4 z-20">
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-600 text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg">
                        <Building2 className="w-3 h-3" />
                        PLATFORM ID: {platform.plat_id}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
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
                      className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      Title
                      <SortIcon field="title" />
                    </button>
                  </TableHead>
                  <TableHead className="px-6">
                    <button
                      onClick={() => handleSort("field_name")}
                      className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      Oil Field
                      <SortIcon field="field_name" />
                    </button>
                  </TableHead>
                  <TableHead className="px-6">
                    <button
                      onClick={() => handleSort("plegs")}
                      className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      Legs
                      <SortIcon field="plegs" />
                    </button>
                  </TableHead>
                  <TableHead className="px-6">
                    <button
                      onClick={() => handleSort("process")}
                      className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      Process
                      <SortIcon field="process" />
                    </button>
                  </TableHead>
                      <TableHead className="px-6 text-right">
                        <button
                          onClick={() => handleSort("ptype")}
                          className="flex items-center justify-end text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors w-full"
                        >
                          Type
                          <SortIcon field="ptype" />
                        </button>
                      </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPlatforms.map((platform) => {
                  const imageUrl = randomImages.get(platform.plat_id);
                  const hasImage = !!imageUrl;

                  return (
                    <TableRow
                      key={`platform-${platform.plat_id}`}
                      className="group cursor-pointer border-b border-slate-50 dark:border-slate-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all duration-300"
                      onClick={() => window.location.href = `/dashboard/field/platform/${platform.plat_id}?from=list`}
                    >
                      <TableCell className="px-6 py-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center group-hover:scale-105 group-hover:shadow-lg transition-all duration-500 shadow-sm">
                          {hasImage ? (
                            <div className="relative w-full h-full p-1">
                              <Image
                                src={imageUrl}
                                alt={platform.title}
                                fill
                                className="object-cover rounded-xl"
                                sizes="56px"
                              />
                            </div>
                          ) : (
                            <div className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                              <OilPlatformIcon className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                            {platform.title}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            PLAT-{platform.plat_id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">
                          {platform.field_name || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            {platform.plegs !== null ? platform.plegs : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {platform.process || "NOT SPECIFIED"}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">
                          {platform.ptype || "Standard"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredAndSortedPlatforms.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? `No platforms found matching "${searchQuery}"` : "No platforms found"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
