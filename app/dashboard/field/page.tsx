"use client";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Compass, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Building2, Layers, Waves } from "lucide-react";

interface FieldWithStats {
    lib_id: string;
    lib_desc: string;
    lib_code: string;
    platform_count: number;
    pipeline_count: number;
}

export default function FieldPage() {
    const { data, error, isLoading } = useSWR("/api/library/fields-stats", fetcher);

    if (error) return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-4 text-red-500">
                <Activity className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black tracking-tight mb-2">Sync Error</h2>
            <p className="text-slate-500 max-w-xs mx-auto mb-6">Failed to retrieve field exploration data. Please check your connection.</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">Retry</Button>
        </div>
    );

    if (isLoading) return (
        <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Mapping Assets...</p>
        </div>
    );

    const fields: FieldWithStats[] = data?.data || [];

    return (
        <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
            <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 text-white dark:text-slate-900 flex items-center justify-center shadow-lg">
                            <Compass className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                                <span className="opacity-50">Exploration</span>
                                <div className="h-1 w-1 rounded-full bg-blue-500" />
                                <span className="text-slate-900 dark:text-white/80">Global Fields</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Asset Explorer</h1>
                        </div>
                    </div>
                </div>

                {/* Data Container - Grid View from dev-jitesh */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {fields.map((field) => (
                            <Link
                                key={field.lib_id}
                                href={`/dashboard/field/structures?field=${field.lib_id}`}
                                className="group"
                            >
                                <div className="relative h-[22rem] flex flex-col rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-black/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 cursor-pointer">
                                    {/* Icon / Visual Area */}
                                    <div className="relative flex-1 flex items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/30 overflow-hidden">
                                        {/* Animated background circles */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-400/10 to-teal-400/10 group-hover:scale-125 transition-transform duration-1000" />
                                            <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-blue-500/15 to-teal-500/15 group-hover:scale-150 transition-transform duration-700" />
                                        </div>

                                        {/* Main Icon */}
                                        <div className="relative z-10 text-blue-600 dark:text-blue-400 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-500 drop-shadow-2xl">
                                            <Waves className="w-16 h-16" strokeWidth={1} />
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-6 flex flex-col gap-4 bg-white dark:bg-slate-900 relative">
                                        {/* Title Section */}
                                        <div className="min-h-[3rem] flex items-center justify-center">
                                            <h3 className="text-sm font-black text-center uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight">
                                                {field.lib_desc}
                                            </h3>
                                        </div>

                                        {/* Integrated Stats Row */}
                                        <div className="flex items-center justify-between gap-2 mt-auto">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    window.location.href = `/dashboard/field/platform?field=${field.lib_id}`;
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-800/50 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all group/btn shadow-sm"
                                            >
                                                <Building2 className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{field.platform_count}</span>
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 group-hover/btn:opacity-100">PLATFORM</span>
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    window.location.href = `/dashboard/field/pipeline?field=${field.lib_id}`;
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-100/50 dark:border-teal-800/50 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all group/btn shadow-sm"
                                            >
                                                <Layers className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{field.pipeline_count}</span>
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 group-hover/btn:opacity-100">PIPELINE</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Top identifier / Badge */}
                                    <div className="absolute top-4 left-4 z-20">
                                        <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-md border border-white/10 text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg">
                                            FIELD ID: {field.lib_id}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {fields.length === 0 && !isLoading && (
                        <div className="text-center py-12">
                            <Waves className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No oil fields found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
