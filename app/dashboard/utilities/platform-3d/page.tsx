"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { 
    Box, 
    Building2, 
    ArrowLeft, 
    Search, 
    Layers, 
    Activity, 
    Maximize2, 
    ChevronRight,
    Waves,
    RefreshCw,
    X,
    AlertTriangle,
    Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const Structural3DViewer = dynamic(
    () => import("./_components/Structural3DViewer").then((mod) => mod.Structural3DViewer),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl min-h-[450px]">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-2" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading 3D Engine...</p>
            </div>
        )
    }
);
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import { WincairsFallbackDialog } from "@/components/dialogs/wincairs-fallback-dialog";
import { PrintFaceDialog } from "@/components/dialogs/print-face-dialog";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";

interface Platform {
    plat_id: number;
    title: string;
    pfield: string;
    ptype: string | null;
}

interface Component {
    id: number;
    comp_id: number;
    structure_id: number;
    q_id: string;
    id_no: string;
    code: string | null;
    metadata: any;
    created_at: string | null;
    updated_at: string | null;
    created_by: string | null;
    modified_by: string | null;
}

export default function Platform3DPage() {
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
    const [isSpecOpen, setIsSpecOpen] = useState(false);

    // Component Search state for Top Header
    const [componentSearchQuery, setComponentSearchQuery] = useState("");
    const [showComponentSearchDropdown, setShowComponentSearchDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // WINCAIRS Mode state & Fallback Dialog state
    const [useWincairsMode, setUseWincairsMode] = useState(false);
    const [fallbackComponents, setFallbackComponents] = useState<any[]>([]);
    const [isFallbackDialogOpen, setIsFallbackDialogOpen] = useState(false);
    const [isPrintFaceDialogOpen, setIsPrintFaceDialogOpen] = useState(false);
    const [isResyncing3D, setIsResyncing3D] = useState(false);
    const [useWebapp3dConnection, setUseWebapp3dConnection] = useState(true);

    const [, setGlobalUrlId] = useAtom(urlId);
    const [, setGlobalUrlType] = useAtom(urlType);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowComponentSearchDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    React.useEffect(() => {
        if (selectedPlatform) {
            setGlobalUrlId(selectedPlatform.plat_id);
            setGlobalUrlType(selectedPlatform.ptype === "PIPELINE" ? "pipeline" : "platform");
        } else {
            setGlobalUrlId(0);
            setGlobalUrlType("");
        }
    }, [selectedPlatform, setGlobalUrlId, setGlobalUrlType]);

    // 1. Fetch Platforms
    const { data: platformsData, isLoading: isPlatformsLoading } = useSWR("/api/platform", fetcher);
    const platforms: Platform[] = useMemo(() => platformsData?.data || [], [platformsData]);

    // 2. Fetch Components for Selected Platform
    const { 
        data: componentsData, 
        isLoading: isComponentsLoading, 
        isValidating: isComponentsValidating, 
        mutate: mutateComponents 
    } = useSWR(
        selectedPlatform ? `/api/structure-components/${selectedPlatform.plat_id}` : null,
        fetcher
    );

    const handleResync3DCache = async () => {
        if (!selectedPlatform) return;
        setIsResyncing3D(true);
        try {
            const res = await fetch(`/api/platform/webapp-3d/${selectedPlatform.plat_id}?resync=true`, { method: "POST" });
            if (res.ok) {
                toast.success("3D cache resynchronized successfully!");
                await mutateComponents();
                if (mutateWebapp3d) await mutateWebapp3d();
            } else {
                toast.error("Failed to resynchronize 3D cache.");
            }
        } catch (e) {
            toast.error("Error resynchronizing 3D cache.");
        } finally {
            setIsResyncing3D(false);
        }
    };
    const components: Component[] = useMemo(() => {
        const all = componentsData?.data || [];
        const excludeCodes = ["IT", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD", "FA"];
        return all
            .filter((c: any) => {
                if (c.is_deleted) return false;
                const code = (c.code || "").trim().toUpperCase();
                const qIdUpper = (c.q_id || "").toUpperCase();
                const isRiserSupport = qIdUpper.includes("SUPP") || qIdUpper.includes("CLP");
                if ((excludeCodes.includes(code) || code.startsWith("FA") || code.includes("FACE")) && !isRiserSupport) {
                    return false;
                }

                if (qIdUpper.startsWith("FACE") || /^FACE[\s\-]/i.test(qIdUpper)) {
                    return false;
                }

                // Exclude intermediate member seam welds (keep only primary junction node welds)
                if (code === "WN") {
                    const md = c.metadata || c;
                    const sNode = (md.s_node || "").toString().trim().toUpperCase();
                    const fNode = (md.f_node || "").toString().trim().toUpperCase();
                    if (sNode && fNode && sNode !== fNode) return false;
                }

                // Exclude fender/boatlanding support components like FEND 1-SUPP-A2 / BL 1-SUPP-A2
                if (/^(?:FEND|BL|BOAT)\s+\d+-SUPP-/i.test(qIdUpper)) {
                    return false;
                }
                // Exclude components whose q_id ends with TERM
                if (qIdUpper.endsWith("TERM")) {
                    return false;
                }
                return true;
            })
            .map((c: any) => ({
                ...c,
                created_at: c.created_at || null,
                updated_at: c.updated_at || null,
                created_by: c.created_by || null,
                modified_by: c.modified_by || null,
            }));
    }, [componentsData]);

    // 3. Fetch Platform Details
    const { data: platformDetailData, isLoading: isPlatformDetailLoading } = useSWR(
        selectedPlatform ? `/api/platform/${selectedPlatform.plat_id}` : null,
        fetcher
    );
    const platformDetails = platformDetailData?.data;

    // Fetch WebApp 3D Coordinates (Only revalidate when user explicitly clicks Re-sync 3D Cache)
    const { data: webapp3dResponse, isLoading: isWebapp3dLoading, mutate: mutateWebapp3d } = useSWR(
        selectedPlatform ? `/api/platform/webapp-3d/${selectedPlatform.plat_id}` : null,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: true,
            refreshInterval: 0,
        }
    );
    const webapp3dData = webapp3dResponse?.data;

    // 4. Fetch Elevations
    const { data: elevationsData } = useSWR(
        selectedPlatform ? `/api/platform/elevation/${selectedPlatform.plat_id}` : null,
        fetcher
    );
    const elevations = elevationsData?.data || [];

    // 5. Fetch Structural Faces
    const { data: facesData } = useSWR(
        selectedPlatform ? `/api/platform/faces/${selectedPlatform.plat_id}` : null,
        fetcher
    );
    const faces = facesData?.data || [];

    // 6. Fetch WINCAIRS 3D Parameters (u_obj3d_param)
    const { data: wincairsData, isLoading: isWincairsLoading } = useSWR(
        selectedPlatform ? `/api/platform/obj3d-param/${selectedPlatform.plat_id}` : null,
        fetcher
    );
    const wincairsParams = useMemo(() => wincairsData?.data || [], [wincairsData]);

    const filteredPlatforms = useMemo(() => {
        return platforms.filter(p => 
            (p.title || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
            String(p.plat_id || "").includes(searchQuery || "")
        );
    }, [platforms, searchQuery]);

    const filteredComponents = useMemo(() => {
        if (!componentSearchQuery.trim()) return [];
        const query = componentSearchQuery.toLowerCase();
        return components
            .filter((c: any) => 
                (c?.q_id || "").toLowerCase().includes(query) || 
                (c?.code || "").toLowerCase().includes(query)
            )
            .slice(0, 15);
    }, [components, componentSearchQuery]);

    const handleSelectComponent = (comp: any) => {
        setSelectedComponent(comp);
        setIsSpecOpen(true);
    };

    if (selectedPlatform) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-500">
                {/* Header */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm relative z-[100]">
                    <div className="flex items-center gap-4 shrink-0">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setSelectedPlatform(null)}
                            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
                                <span className="text-blue-600">3D Explorer</span>
                                <div className="h-1 w-1 rounded-full bg-slate-300" />
                                <span>{selectedPlatform.ptype || "PLATFORM"}</span>
                            </div>
                            <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                                {selectedPlatform.title}
                            </h1>
                        </div>
                    </div>

                    {/* Component Search Bar in Top Header */}
                    <div ref={searchRef} className="relative flex-1 max-w-md mx-6">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="SEARCH COMPONENTS"
                                value={componentSearchQuery}
                                onChange={(e) => {
                                    setComponentSearchQuery(e.target.value);
                                    setShowComponentSearchDropdown(true);
                                }}
                                onFocus={() => setShowComponentSearchDropdown(true)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        if (filteredComponents.length > 0) {
                                            handleSelectComponent(filteredComponents[0]);
                                            setComponentSearchQuery("");
                                            setShowComponentSearchDropdown(false);
                                        }
                                    }
                                }}
                                className="w-full bg-slate-100 dark:bg-slate-800/80 h-10 pl-10 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 uppercase focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:normal-case placeholder:font-bold placeholder:text-slate-400 shadow-xs"
                            />
                            {componentSearchQuery && (
                                <button
                                    onClick={() => {
                                        setComponentSearchQuery("");
                                        setShowComponentSearchDropdown(false);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {showComponentSearchDropdown && componentSearchQuery.trim().length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-72 overflow-y-auto z-[1000] animate-in fade-in slide-in-from-top-2 duration-200 p-1">
                                {filteredComponents.length > 0 ? (
                                    filteredComponents.map((comp: any, sIdx: number) => (
                                        <button
                                            key={`search-top-${comp.id || comp.q_id || "item"}-${sIdx}`}
                                            onClick={() => {
                                                handleSelectComponent(comp);
                                                setComponentSearchQuery("");
                                                setShowComponentSearchDropdown(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between group transition-colors border-b border-slate-100 dark:border-slate-800/40 last:border-0"
                                        >
                                            <div>
                                                <div className="text-xs font-black text-slate-800 dark:text-slate-100">{comp.q_id}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{comp.code || "COMPONENT"}</div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-xs text-slate-400 text-center font-medium">
                                        No component found matching "{componentSearchQuery}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {/* Print Face Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPrintFaceDialogOpen(true)}
                            className="h-9 px-3 gap-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-[0_0_15px_rgba(37,99,235,0.25)] transition-all"
                            title="Print 2D CAD Structural Elevation Sketch for Selected Platform Face"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print Face</span>
                        </Button>

                        {/* Fallback Warning Badge */}
                        {useWincairsMode && fallbackComponents.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsFallbackDialogOpen(true)}
                                className="h-9 px-3 gap-1.5 rounded-xl border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-bold transition-all shadow-xs animate-in fade-in"
                                title="Click to view components using standard procedural fallback"
                            >
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                <span>{fallbackComponents.length} Fallback(s)</span>
                            </Button>
                        )}

                        <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => mutateComponents()}
                            disabled={isComponentsValidating}
                            className="h-9 px-3 gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", isComponentsValidating && "animate-spin")} />
                            <span>Sync</span>
                        </Button>

                        <Button 
                            variant="outline"
                            size="sm"
                            onClick={handleResync3DCache}
                            disabled={isResyncing3D}
                            className="h-9 px-3 gap-2 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-bold text-blue-700 dark:text-blue-300 transition-all shadow-xs"
                            title="Re-sync 3D positioning cache for all platform components"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", isResyncing3D && "animate-spin")} />
                            <span>{isResyncing3D ? "Resynchronizing..." : "Re-sync 3D Cache"}</span>
                        </Button>
                    </div>
                </div>

                {/* Viewer Container */}
                <div className="flex-1 p-6 flex gap-6 relative overflow-hidden h-[calc(100vh-130px)]">
                    <div className="flex-1 h-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] relative overflow-hidden">
                        {(isComponentsLoading || isPlatformDetailLoading) ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm z-10 rounded-[2rem]">
                                <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Constructing Structural Mesh...</p>
                            </div>
                        ) : null}
                        
                        <Structural3DViewer 
                            components={components} 
                            platformDetails={platformDetails}
                            elevations={elevations}
                            faces={faces}
                            selectedCompId={selectedComponent?.id}
                            onSelectComponent={handleSelectComponent}
                            onSync={mutateComponents}
                            isSyncing={isComponentsValidating}
                            useWincairsMode={useWincairsMode}
                            wincairsParams={wincairsParams}
                            onFallbackComponentsChange={setFallbackComponents}
                            webapp3dData={useWebapp3dConnection ? webapp3dData : null}
                        />
                    </div>

                    {isSpecOpen && selectedComponent && (
                        <div className="w-[400px] shrink-0 h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 relative">
                            {/* Close button for inline panel */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsSpecOpen(false)}
                                className="absolute top-6 right-6 z-50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                            <div className="flex-1 min-h-0 h-full flex flex-col">
                                <ComponentSpecDialog 
                                    component={selectedComponent}
                                    open={isSpecOpen}
                                    onOpenChange={setIsSpecOpen}
                                    mode="view"
                                    inline={true}
                                    onSuccess={(updatedComponent) => {
                                        mutateComponents();
                                        setSelectedComponent(updatedComponent);
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* WINCAIRS Fallback Inspector Dialog */}
                <WincairsFallbackDialog
                    open={isFallbackDialogOpen}
                    onOpenChange={setIsFallbackDialogOpen}
                    fallbackComponents={fallbackComponents}
                    platformTitle={selectedPlatform.title}
                    onSelectComponent={handleSelectComponent}
                />

                {/* Print Face Selection Dialog */}
                <PrintFaceDialog
                    isOpen={isPrintFaceDialogOpen}
                    onClose={() => setIsPrintFaceDialogOpen(false)}
                    platformTitle={selectedPlatform.title}
                    faces={faces}
                    componentLayouts={webapp3dData?.components && webapp3dData.components.length > 0 ? webapp3dData.components : (components || [])}
                    foundationMembers={webapp3dData?.foundationMembers || []}
                    elevations={elevations}
                />
            </div>
        );
    }

    return (
        <div className="flex-1 w-full flex flex-col overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-transparent animate-in fade-in duration-700">
            <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Box className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                                <span className="opacity-50">Utilities</span>
                                <div className="h-1 w-1 rounded-full bg-blue-500" />
                                <span className="text-blue-600/80">3D Models</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Platform 3D</h1>
                        </div>
                    </div>

                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Find platform by name or ID..."
                            className="pl-10 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl font-medium shadow-sm ring-0 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Grid Section */}
                {isPlatformsLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
                        <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Fleet Library...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {filteredPlatforms.map((p) => (
                            <button
                                key={p.plat_id}
                                onClick={() => setSelectedPlatform(p)}
                                className="group text-left"
                            >
                                <div className="relative h-[20rem] flex flex-col rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-black/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500">
                                    {/* Visual Area */}
                                    <div className="relative flex-1 flex items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/30 overflow-hidden">
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-400/10 to-indigo-400/10 group-hover:scale-125 transition-transform duration-1000" />
                                            <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/15 group-hover:scale-150 transition-transform duration-700" />
                                        </div>
                                        <div className="relative z-10 text-blue-600 dark:text-blue-400 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-500 drop-shadow-2xl">
                                            <Layers className="w-16 h-16 stroke-[1.5]" />
                                        </div>
                                        <div className="absolute top-4 right-4">
                                            <div className="h-10 w-10 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white dark:border-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Maximize2 className="h-5 w-5 text-blue-600" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-6 pb-8 bg-white dark:bg-slate-900 relative flex flex-col items-center">
                                        <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 border border-blue-100 dark:border-blue-800/50">
                                            {p.ptype || "Structure"}
                                        </div>
                                        <h3 className="text-sm font-black text-center uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors leading-tight mb-4">
                                            {p.title}
                                        </h3>
                                        <div className="w-full h-px bg-slate-50 dark:bg-slate-800 mb-4" />
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            View 3D Model <ChevronRight className="h-3 w-3" />
                                        </div>
                                    </div>

                                    {/* ID Badge */}
                                    <div className="absolute top-4 left-4">
                                        <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-[8px] font-black text-white uppercase tracking-[0.2em]">
                                            ID: {p.plat_id}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {filteredPlatforms.length === 0 && !isPlatformsLoading && (
                    <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in zoom-in duration-500">
                        <Waves className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No matching platform model found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
