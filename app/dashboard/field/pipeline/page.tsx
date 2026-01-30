"use client";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import Link from "next/link";
import { Waves, ArrowRight, LayoutGrid, List, Search, ArrowUpDown, ArrowUp, ArrowDown, FileText, Activity, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Pipeline {
  pipe_id: number;
  title: string;
  pfield: string;
  plength: number | null;
  st_loc: string | null;
  end_loc: string | null;
  ptype: string | null;
}

type ViewMode = "card" | "list";
type SortField = "title" | "plength" | "st_loc" | "end_loc" | "ptype";
type SortOrder = "asc" | "desc";

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

  const { data, error, isLoading } = useSWR(
    fieldId ? `/api/pipeline?field=${fieldId}` : `/api/pipeline`,
    fetcher
  );

  const pipelines: Pipeline[] = useMemo(() => data?.data || [], [data]);

  // Persist view mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pipeline_view_mode', viewMode);
    }
  }, [viewMode]);

  // Filter and sort pipelines
  const filteredAndSortedPipelines = useMemo(() => {
    let filtered = pipelines.filter((pipeline) =>
      pipeline.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
  }, [pipelines, searchQuery, sortField, sortOrder]);

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
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">Retry</Button>
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

          <Button asChild className="rounded-xl h-12 px-6 font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl hover:opacity-90 transition-all gap-2">
            <Link href="/dashboard/field/pipeline/new">
              <Plus className="h-4 w-4" />
              Register Pipeline
            </Link>
          </Button>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search pipelines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "card" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("card")}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

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
                      <h3 className="text-sm font-black text-center uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2 leading-tight">
                        {pipeline.title}
                      </h3>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Icon</TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("title")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Title
                      <SortIcon field="title" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("plength")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Length (m)
                      <SortIcon field="plength" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("st_loc")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      From
                      <SortIcon field="st_loc" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("end_loc")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      To
                      <SortIcon field="end_loc" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("ptype")}
                      className="flex items-center hover:text-foreground transition-colors"
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
                    className="cursor-pointer hover:bg-teal-50/50 dark:hover:bg-teal-950/20"
                    onClick={() => window.location.href = `/dashboard/field/pipeline/${pipeline.pipe_id}?from=list`}
                  >
                    <TableCell>
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/20 dark:to-cyan-900/20 flex items-center justify-center">
                        <OilPipelineIcon className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{pipeline.title}</TableCell>
                    <TableCell>{pipeline.plength !== null ? pipeline.plength.toFixed(2) : "-"}</TableCell>
                    <TableCell>{pipeline.st_loc || "-"}</TableCell>
                    <TableCell>{pipeline.end_loc || "-"}</TableCell>
                    <TableCell>{pipeline.ptype || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredAndSortedPipelines.length === 0 && (
          <div className="text-center py-12">
            <Waves className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? `No pipelines found matching "${searchQuery}"` : "No pipelines found"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
