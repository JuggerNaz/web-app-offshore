"use client";

import React, { useState, useMemo } from "react";
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
    Waves
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Structural3DViewer } from "./_components/Structural3DViewer";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";

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

    // 1. Fetch Platforms
    const { data: platformsData, isLoading: isPlatformsLoading } = useSWR("/api/platform", fetcher);
    const platforms: Platform[] = useMemo(() => platformsData?.data || [], [platformsData]);

    // 2. Fetch Components for Selected Platform
    const { data: componentsData, isLoading: isComponentsLoading } = useSWR(
        selectedPlatform ? `/api/structure-components/${selectedPlatform.plat_id}` : null,
        fetcher
    );
    const components: Component[] = useMemo(() => {
        const all = componentsData?.data || [];
        return all.filter((c: any) => !c.is_deleted).map((c: any) => ({
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

    const filteredPlatforms = useMemo(() => {
        return platforms.filter(p => 
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.plat_id.toString().includes(searchQuery)
        );
    }, [platforms, searchQuery]);

    const handleSelectComponent = (comp: any) => {
        setSelectedComponent(comp);
        setIsSpecOpen(true);
    };

    if (selectedPlatform) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-500">
                {/* Header */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
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

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</span>
                            <span className="text-xs font-bold text-emerald-500 uppercase tracking-tight flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                Interactive
                            </span>
                        </div>
                    </div>
                </div>

                {/* Viewer Container */}
                <div className="flex-1 p-6 relative">
                    {(isComponentsLoading || isPlatformDetailLoading) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm z-10">
                            <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Constructing Structural Mesh...</p>
                        </div>
                    ) : null}
                    
                    <Structural3DViewer 
                        components={components} 
                        platformDetails={platformDetails}
                        onSelectComponent={handleSelectComponent}
                    />
                </div>

                {/* Component Spec Dialog */}
                <ComponentSpecDialog 
                    component={selectedComponent}
                    open={isSpecOpen}
                    onOpenChange={setIsSpecOpen}
                    mode="view"
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
