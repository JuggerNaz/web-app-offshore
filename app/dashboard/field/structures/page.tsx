"use client";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import Link from "next/link";
import { Building2, Waves, ArrowRight, LayoutGrid, List, Search, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { getStoragePublicUrl } from "@/utils/storage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

interface Pipeline {
    pipe_id: number;
    title: string;
    pfield: string;
    plength: number | null;
    st_loc: string | null;
    end_loc: string | null;
    ptype: string | null;
}

interface FieldInfo {
    lib_id: string;
    lib_desc: string;
}

type ViewMode = "card" | "list";

export default function StructuresPage() {
    const searchParams = useSearchParams();
    const fieldId = searchParams.get("field");
    const [randomImages, setRandomImages] = useState<Map<number, string>>(new Map());
    const [viewMode, setViewMode] = useState<ViewMode>("card");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: platformsData, error: platformsError, isLoading: platformsLoading } = useSWR(
        fieldId ? `/api/platform?field=${fieldId}` : null,
        fetcher
    );

    const { data: pipelinesData, error: pipelinesError, isLoading: pipelinesLoading } = useSWR(
        fieldId ? `/api/pipeline?field=${fieldId}` : null,
        fetcher
    );

    const { data: fieldData } = useSWR(
        fieldId ? `/api/library/field/${fieldId}` : null,
        fetcher
    );

    const platforms: Platform[] = useMemo(() => platformsData?.data || [], [platformsData]);
    const pipelines: Pipeline[] = useMemo(() => pipelinesData?.data || [], [pipelinesData]);
    const field: FieldInfo | null = fieldData?.data || null;

    // Generate random image selection for platforms with multiple images
    useEffect(() => {
        if (!platformsData) return;

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
    }, [platformsData]);

    // Filter structures based on search query
    const filteredPlatforms = platforms.filter((platform) =>
        platform.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredPipelines = pipelines.filter((pipeline) =>
        pipeline.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (platformsError || pipelinesError) {
        return (
            <div className="flex-1 w-full flex items-center justify-center">
                <div className="text-red-500">Failed to load structures</div>
            </div>
        );
    }

    if (platformsLoading || pipelinesLoading) {
        return (
            <div className="flex-1 w-full flex items-center justify-center">
                <div className="animate-pulse text-lg">Loading structures...</div>
            </div>
        );
    }

    const totalStructures = filteredPlatforms.length + filteredPipelines.length;

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

    return (
        <div className="flex-1 w-full p-6">
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <Link
                        href="/dashboard/field"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Fields
                    </Link>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{field?.lib_desc || "Field Structures"}</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
                    {field?.lib_desc || "Field"} Structures
                </h1>
                <p className="text-muted-foreground mt-2">
                    {totalStructures} structure{totalStructures !== 1 ? 's' : ''} ({filteredPlatforms.length} platform{filteredPlatforms.length !== 1 ? 's' : ''}, {filteredPipelines.length} pipeline{filteredPipelines.length !== 1 ? 's' : ''})
                </p>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search structures..."
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
                        title="List View"
                    >
                        <List className="w-4 h-4" />
                    </Button>
                </div>

                {/* Create New Actions */}
                <div className="flex gap-2">
                    <Link href="/dashboard/field/platform/new">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" title="New Platform">
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">New Platform</span>
                        </Button>
                    </Link>
                    <Link href="/dashboard/field/pipeline/new">
                        <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2" title="New Pipeline">
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">New Pipeline</span>
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Card View */}
            {viewMode === "card" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* Platform Cards */}
                    {filteredPlatforms.map((platform) => {
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

                                    {/* Platform Stats */}
                                    <div className="bg-background border-t border-border/30 p-3 text-sm">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
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

                    {/* Pipeline Cards */}
                    {filteredPipelines.map((pipeline) => (
                        <Link
                            key={`pipeline-${pipeline.pipe_id}`}
                            href={`/dashboard/field/pipeline/${pipeline.pipe_id}`}
                            className="group"
                        >
                            <div className="relative h-80 rounded-xl overflow-hidden border border-border/50 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer flex flex-col">
                                {/* Structure Type Badge */}
                                <div className="absolute top-3 left-3 z-10">
                                    <div className="flex items-center gap-2 bg-teal-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
                                        <Waves className="w-3.5 h-3.5" />
                                        <span>PIPELINE</span>
                                    </div>
                                </div>

                                {/* Icon Area */}
                                <div className="flex-1 flex items-center justify-center p-6 relative">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        {/* Animated background circles */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-400/20 to-cyan-400/20 group-hover:scale-110 transition-transform duration-500" />
                                            <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-500/30 group-hover:scale-125 transition-transform duration-700" />
                                        </div>

                                        {/* Oil Pipeline icon */}
                                        <div className="relative z-10 text-teal-600 dark:text-teal-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors duration-300">
                                            <OilPipelineIcon />
                                        </div>
                                    </div>

                                    {/* Title Overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent p-4">
                                        <h3 className="text-lg font-bold text-white group-hover:text-teal-200 transition-colors line-clamp-2">
                                            {pipeline.title}
                                        </h3>
                                    </div>
                                </div>

                                {/* Pipeline Stats */}
                                <div className="bg-background border-t border-border/30 p-3 text-sm">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                        {pipeline.plength !== null && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Length:</span>
                                                <span className="font-semibold">{pipeline.plength.toFixed(2)} m</span>
                                            </div>
                                        )}
                                        {pipeline.st_loc && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">From:</span>
                                                <span className="font-semibold truncate max-w-[80px]" title={pipeline.st_loc}>
                                                    {pipeline.st_loc}
                                                </span>
                                            </div>
                                        )}
                                        {pipeline.end_loc && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">To:</span>
                                                <span className="font-semibold truncate max-w-[80px]" title={pipeline.end_loc}>
                                                    {pipeline.end_loc}
                                                </span>
                                            </div>
                                        )}
                                        {pipeline.ptype && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-muted-foreground">Type:</span>
                                                <span className="font-semibold truncate max-w-[80px]" title={pipeline.ptype}>
                                                    {pipeline.ptype}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-teal-600/0 to-cyan-600/0 group-hover:from-teal-600/5 group-hover:to-cyan-600/5 transition-all duration-300 pointer-events-none" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
                <div className="space-y-3">
                    {/* Platform List Items */}
                    {filteredPlatforms.map((platform) => {
                        const imageUrl = randomImages.get(platform.plat_id);
                        const hasImage = !!imageUrl;

                        return (
                            <Link
                                key={`platform-${platform.plat_id}`}
                                href={`/dashboard/field/platform/${platform.plat_id}`}
                                className="group block"
                            >
                                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/10 dark:to-indigo-950/10 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200">
                                    {/* Icon/Image */}
                                    <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
                                        {hasImage ? (
                                            <div className="relative w-full h-full">
                                                <Image
                                                    src={imageUrl}
                                                    alt={platform.title}
                                                    fill
                                                    className="object-cover"
                                                    sizes="64px"
                                                />
                                            </div>
                                        ) : (
                                            <OilPlatformIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="inline-flex items-center gap-1 bg-blue-600/90 text-white px-2 py-0.5 rounded text-xs font-semibold">
                                                <Building2 className="w-3 h-3" />
                                                PLATFORM
                                            </span>
                                            <h3 className="font-bold text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                                {platform.title}
                                            </h3>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                            {platform.plegs !== null && (
                                                <span>Legs: <strong className="text-foreground">{platform.plegs}</strong></span>
                                            )}
                                            {platform.process && (
                                                <span>Process: <strong className="text-foreground">{platform.process}</strong></span>
                                            )}
                                            {platform.ptype && (
                                                <span>Type: <strong className="text-foreground">{platform.ptype}</strong></span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
                                </div>
                            </Link>
                        );
                    })}

                    {/* Pipeline List Items */}
                    {filteredPipelines.map((pipeline) => (
                        <Link
                            key={`pipeline-${pipeline.pipe_id}`}
                            href={`/dashboard/field/pipeline/${pipeline.pipe_id}`}
                            className="group block"
                        >
                            <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-gradient-to-r from-teal-50/50 to-cyan-50/50 dark:from-teal-950/10 dark:to-cyan-950/10 hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700 transition-all duration-200">
                                {/* Icon */}
                                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/20 dark:to-cyan-900/20 flex items-center justify-center">
                                    <OilPipelineIcon className="w-10 h-10 text-teal-600 dark:text-teal-400" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="inline-flex items-center gap-1 bg-teal-600/90 text-white px-2 py-0.5 rounded text-xs font-semibold">
                                            <Waves className="w-3 h-3" />
                                            PIPELINE
                                        </span>
                                        <h3 className="font-bold text-base group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                                            {pipeline.title}
                                        </h3>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                        {pipeline.plength !== null && (
                                            <span>Length: <strong className="text-foreground">{pipeline.plength.toFixed(2)} m</strong></span>
                                        )}
                                        {pipeline.st_loc && (
                                            <span>From: <strong className="text-foreground">{pipeline.st_loc}</strong></span>
                                        )}
                                        {pipeline.end_loc && (
                                            <span>To: <strong className="text-foreground">{pipeline.end_loc}</strong></span>
                                        )}
                                        {pipeline.ptype && (
                                            <span>Type: <strong className="text-foreground">{pipeline.ptype}</strong></span>
                                        )}
                                    </div>
                                </div>

                                {/* Arrow */}
                                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors flex-shrink-0" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {totalStructures === 0 && (
                <div className="text-center py-12">
                    <Building2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                        {searchQuery ? `No structures found matching "${searchQuery}"` : "No structures found for this field"}
                    </p>
                </div>
            )}
        </div>
    );
}
