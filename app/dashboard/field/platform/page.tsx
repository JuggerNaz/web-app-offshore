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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Platform {
  plat_id: number;
  title: string;
  pfield: string;
  plegs: number | null;
  process: string | null;
  ptype: string | null;
  images?: Array<{
    id: number;
    path: string;
    meta?: {
      file_url?: string;
    };
  }>;
}

type ViewMode = "card" | "list";
type SortField = "title" | "plegs" | "process" | "ptype";
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

export default function PlatformPage() {
  const searchParams = useSearchParams();
  const fieldId = searchParams.get("field");
  const [randomImages, setRandomImages] = useState<Map<number, string>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('platformViewMode') as ViewMode) || 'card';
    }
    return 'card';
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const { data, error, isLoading } = useSWR(
    fieldId ? `/api/platform?field=${fieldId}` : `/api/platform`,
    fetcher
  );

  const platforms: Platform[] = data?.data || [];

  // Generate random image selection for platforms with multiple images
  useEffect(() => {
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
  }, [platforms]);

  // Persist view mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('platformViewMode', viewMode);
    }
  }, [viewMode]);

  // Filter and sort platforms
  const filteredAndSortedPlatforms = useMemo(() => {
    let filtered = platforms.filter((platform) =>
      platform.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
  }, [platforms, searchQuery, sortField, sortOrder]);

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
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">Retry</Button>
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

          <Button asChild className="rounded-xl h-12 px-6 font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl hover:opacity-90 transition-all gap-2">
            <Link href="/dashboard/field/platform/new">
              <Plus className="h-4 w-4" />
              Register Platform
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
              placeholder="Search platforms..."
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
            {filteredAndSortedPlatforms.map((platform) => {
              const imageUrl = randomImages.get(platform.plat_id);
              const hasImage = !!imageUrl;

              return (
                <Link
                  key={`platform-${platform.plat_id}`}
                  href={`/dashboard/field/platform/${platform.plat_id}`}
                  className="group"
                >
                  <div className="relative h-80 rounded-xl overflow-hidden border border-border/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer flex flex-col">
                    {/* Structure Type Badge */}
                    <div className="absolute top-3 left-3 z-10">
                      <div className="flex items-center gap-2 bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>PLATFORM</span>
                      </div>
                    </div>

                    {/* Image or Icon Area */}
                    <div className="flex-1 flex items-center justify-center p-6 relative">
                      {hasImage ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={imageUrl}
                            alt={platform.title}
                            fill
                            className="object-contain group-hover:scale-110 transition-transform duration-500"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                          />
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center">
                          {/* Animated background circles */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-400/20 group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 group-hover:scale-125 transition-transform duration-700" />
                          </div>

                          {/* Oil Platform icon */}
                          <div className="relative z-10 text-blue-600 dark:text-blue-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">
                            <OilPlatformIcon />
                          </div>
                        </div>
                      )}

                      {/* Title Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent p-4">
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-200 transition-colors line-clamp-2">
                          {platform.title}
                        </h3>
                      </div>
                    </div>

                    {/* Platform Details - Always at bottom */}
                    <div className="bg-background border-t border-border/30 p-4">
                      {/* Platform Stats */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {platform.plegs !== null && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Legs:</span>
                            <span className="font-semibold">{platform.plegs}</span>
                          </div>
                        )}
                        {platform.process && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Process:</span>
                            <span className="font-semibold truncate max-w-[100px]" title={platform.process}>
                              {platform.process}
                            </span>
                          </div>
                        )}
                        {platform.ptype && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Type:</span>
                            <span className="font-semibold truncate max-w-[80px]" title={platform.ptype}>
                              {platform.ptype}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-indigo-600/0 group-hover:from-blue-600/5 group-hover:to-indigo-600/5 transition-all duration-300 pointer-events-none" />
                  </div>
                </Link>
              );
            })}
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
                      onClick={() => handleSort("plegs")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Legs
                      <SortIcon field="plegs" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("process")}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      Process
                      <SortIcon field="process" />
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
                {filteredAndSortedPlatforms.map((platform) => {
                  const imageUrl = randomImages.get(platform.plat_id);
                  const hasImage = !!imageUrl;

                  return (
                    <TableRow
                      key={`platform-${platform.plat_id}`}
                      className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                      onClick={() => window.location.href = `/dashboard/field/platform/${platform.plat_id}`}
                    >
                      <TableCell>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
                          {hasImage ? (
                            <div className="relative w-full h-full">
                              <Image
                                src={imageUrl}
                                alt={platform.title}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            </div>
                          ) : (
                            <OilPlatformIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{platform.title}</TableCell>
                      <TableCell>{platform.plegs !== null ? platform.plegs : "-"}</TableCell>
                      <TableCell>{platform.process || "-"}</TableCell>
                      <TableCell>{platform.ptype || "-"}</TableCell>
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
