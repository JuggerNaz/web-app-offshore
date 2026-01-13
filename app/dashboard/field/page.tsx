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
                                <div className="relative h-64 rounded-xl overflow-hidden border border-border/50 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-950/20 dark:to-teal-950/20 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
                                    {/* Icon Area */}
                                    <div className="absolute inset-0 flex items-center justify-center p-8">
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            {/* Animated background circles */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400/20 to-teal-400/20 group-hover:scale-110 transition-transform duration-500" />
                                                <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/30 to-teal-500/30 group-hover:scale-125 transition-transform duration-700" />
                                            </div>

                                            {/* Oil field icon */}
                                            <div className="relative z-10 text-blue-600 dark:text-blue-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-300">
                                                <Waves className="w-20 h-20" strokeWidth={1.5} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Field Name */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 via-background/90 to-transparent p-6 pt-12">
                                        <h3 className="text-xl font-bold text-center mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {field.lib_desc}
                                        </h3>

                                        {/* Statistics Footer */}
                                        <div className="flex items-center justify-center gap-6 text-sm">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    window.location.href = `/dashboard/field/platform?field=${field.lib_id}`;
                                                }}
                                                className="flex items-center gap-2 bg-blue-600/90 hover:bg-blue-700 backdrop-blur-sm text-white rounded-lg px-3 py-2 border border-blue-500/30 transition-colors"
                                                title="View platforms"
                                            >
                                                <Building2 className="w-4 h-4" />
                                                <span className="font-semibold">{field.platform_count}</span>
                                                <span className="hidden sm:inline">Platform{field.platform_count !== 1 ? 's' : ''}</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    window.location.href = `/dashboard/field/pipeline?field=${field.lib_id}`;
                                                }}
                                                className="flex items-center gap-2 bg-teal-600/90 hover:bg-teal-700 backdrop-blur-sm text-white rounded-lg px-3 py-2 border border-teal-500/30 transition-colors"
                                                title="View pipelines"
                                            >
                                                <Layers className="w-4 h-4" />
                                                <span className="font-semibold">{field.pipeline_count}</span>
                                                <span className="hidden sm:inline">Pipeline{field.pipeline_count !== 1 ? 's' : ''}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-teal-600/0 group-hover:from-blue-600/5 group-hover:to-teal-600/5 transition-all duration-300" />
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
