"use client";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Compass, Activity, Building2, Layers, Waves, Search, LayoutGrid, List, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface FieldWithStats {
    lib_id: string;
    lib_desc: string;
    lib_code: string;
    platform_count: number;
    pipeline_count: number;
}

export default function FieldPage() {
    const { data, error, isLoading } = useSWR("/api/library/fields-stats", fetcher);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [sortConfig, setSortConfig] = useState<{ key: keyof FieldWithStats | null, direction: 'asc' | 'desc' }>({ key: 'lib_id', direction: 'asc' });

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

    const handleSort = (key: keyof FieldWithStats) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const fields: FieldWithStats[] = data?.data || [];
    
    // Sort and filter fields
    const filteredFields = [...fields]
        .filter(field => 
            field.lib_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
            field.lib_desc.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig.key) return 0;
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
            <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 text-white dark:text-slate-900 flex items-center justify-center shadow-lg shrink-0">
                            <Compass className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                                <span className="opacity-50">Exploration</span>
                                <div className="h-1 w-1 rounded-full bg-blue-500" />
                                <span className="text-slate-900 dark:text-white/80">Global Fields</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Field Overview</h1>
                        </div>
                    </div>

                    {/* Toolbar Section (Search + Switch) */}
                    <div className="flex items-center gap-3 flex-1 max-w-2xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search field by ID or description..."
                                className="pl-10 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-medium shadow-sm ring-0 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm h-12">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={cn(
                                    "flex items-center gap-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    viewMode === "grid" 
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                )}
                            >
                                <LayoutGrid className="h-4 w-4" />
                                <span className="hidden sm:inline">Cards</span>
                            </button>
                            <button
                                onClick={() => setViewMode("table")}
                                className={cn(
                                    "flex items-center gap-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    viewMode === "table" 
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                )}
                            >
                                <List className="h-4 w-4" />
                                <span className="hidden sm:inline">Table</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Data View */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredFields.map((field) => (
                                <Link
                                    key={field.lib_id}
                                    href={`/dashboard/field/structures?field=${field.lib_id}`}
                                    className="group"
                                >
                                    <div className="relative h-[22rem] flex flex-col rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-black/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 cursor-pointer">
                                        <div className="relative flex-1 flex items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/30 overflow-hidden">
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-400/10 to-teal-400/10 group-hover:scale-125 transition-transform duration-1000" />
                                                <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-blue-500/15 to-teal-500/15 group-hover:scale-150 transition-transform duration-700" />
                                            </div>
                                            <div className="relative z-10 text-blue-600 dark:text-blue-400 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-500 drop-shadow-2xl text-center">
                                                <Waves className="w-16 h-16 mx-auto mb-2" strokeWidth={1} />
                                            </div>
                                        </div>

                                        <div className="p-6 flex flex-col gap-4 bg-white dark:bg-slate-900 relative">
                                            <div className="min-h-[3rem] flex items-center justify-center">
                                                <h3 className="text-sm font-black text-center uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight">
                                                    {field.lib_desc}
                                                </h3>
                                            </div>

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

                                        <div className="absolute top-4 left-4 z-20">
                                            <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-md border border-white/10 text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg">
                                                ID: {field.lib_id}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-2 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                        <TableHead 
                                            className="w-[120px] cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => handleSort('lib_id')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Field ID
                                                {sortConfig.key === 'lib_id' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead 
                                            className="cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => handleSort('lib_desc')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Field Description
                                                {sortConfig.key === 'lib_desc' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead 
                                            className="text-center cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => handleSort('platform_count')}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                Platforms
                                                {sortConfig.key === 'platform_count' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead 
                                            className="text-center cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => handleSort('pipeline_count')}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                Pipelines
                                                {sortConfig.key === 'pipeline_count' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-right pr-8">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredFields.map((field) => (
                                        <TableRow 
                                            key={field.lib_id}
                                            className="group border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <TableCell className="font-black text-[10px] tracking-widest uppercase text-slate-400">
                                                {field.lib_id}
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-800 dark:text-slate-200">
                                                {field.lib_desc}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Link 
                                                    href={`/dashboard/field/platform?field=${field.lib_id}`}
                                                    className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    {field.platform_count}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Link 
                                                    href={`/dashboard/field/pipeline?field=${field.lib_id}`}
                                                    className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-black text-[10px] uppercase hover:bg-teal-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    {field.pipeline_count}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button
                                                    asChild
                                                    variant="ghost" 
                                                    size="sm"
                                                    className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                                >
                                                    <Link href={`/dashboard/field/structures?field=${field.lib_id}`}>
                                                        Structures <ChevronRight className="h-3 w-3" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {filteredFields.length === 0 && !isLoading && (
                        <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in zoom-in duration-500">
                            <Waves className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No matching field found</p>
                            <Button 
                                variant="link" 
                                onClick={() => setSearchTerm("")}
                                className="mt-2 text-blue-600 font-bold"
                            >
                                Clear search
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
