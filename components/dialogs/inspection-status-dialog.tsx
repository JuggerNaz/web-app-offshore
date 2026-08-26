"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Activity, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { cn } from "@/lib/utils";

interface Jobpack {
    id: number;
    name: string;
    metadata?: any;
}

interface InspectionStatusDialogProps {
    isOpen: boolean;
    onClose: () => void;
    platformId: number;
    platformTitle: string;
    selectedFilters: string[];
    onFiltersChange: (filters: string[]) => void;
    selectedJobpackId: number | null;
    onJobpackChange: (id: number | null) => void;
}

export function InspectionStatusDialog({
    isOpen,
    onClose,
    platformId,
    platformTitle,
    selectedFilters,
    onFiltersChange,
    selectedJobpackId,
    onJobpackChange
}: InspectionStatusDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch Jobpacks
    const { data: jobpacksData, isLoading } = useSWR(isOpen ? `/api/jobpack?has_inspection=true&pageSize=50&structure_id=${platformId}&structure_title=${encodeURIComponent(platformTitle)}` : null, fetcher);
    const jobpacks: Jobpack[] = useMemo(() => jobpacksData?.data || [], [jobpacksData]);

    const filteredJobpacks = useMemo(() => {
        if (!searchQuery.trim()) return jobpacks;
        const q = searchQuery.toLowerCase();
        return jobpacks.filter(j => 
            j.name?.toLowerCase().includes(q) || 
            String(j.id).includes(q)
        );
    }, [jobpacks, searchQuery]);

    const toggleFilter = (filter: string) => {
        if (selectedFilters.includes(filter)) {
            onFiltersChange(selectedFilters.filter(f => f !== filter));
        } else {
            onFiltersChange([...selectedFilters, filter]);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden shadow-2xl">
                <div className="px-6 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center border border-purple-100 dark:border-purple-800/50">
                                <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                    Inspection Status
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                    {platformTitle}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Status Filter Group */}
                    <div className="mt-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">
                            Display Component Status
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => toggleFilter("Completed")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border transition-all duration-200",
                                    selectedFilters.includes("Completed")
                                        ? "bg-green-50 border-green-200 text-green-700 shadow-sm dark:bg-green-950/40 dark:border-green-800/60 dark:text-green-400"
                                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/50"
                                )}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
                            </button>
                            <button
                                onClick={() => toggleFilter("Incomplete")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border transition-all duration-200",
                                    selectedFilters.includes("Incomplete")
                                        ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-400"
                                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/50"
                                )}
                            >
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Incomplete</span>
                            </button>
                            <button
                                onClick={() => toggleFilter("Pending")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border transition-all duration-200",
                                    selectedFilters.includes("Pending")
                                        ? "bg-slate-100 border-slate-300 text-slate-700 shadow-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300"
                                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/50"
                                )}
                            >
                                <Clock className="w-4 h-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">
                        Select Jobpack
                    </label>
                    <div className="relative mb-4">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search by ID or Title..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-medium shadow-sm ring-0 focus-visible:ring-2 focus-visible:ring-purple-500/20"
                        />
                    </div>

                    <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-2">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-8 h-8 border-2 border-slate-200 border-t-purple-500 rounded-full animate-spin mb-2" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Jobpacks...</p>
                            </div>
                        ) : filteredJobpacks.length > 0 ? (
                            filteredJobpacks.map((jobpack) => {
                                const isSelected = selectedJobpackId === jobpack.id;
                                // Mock progress for demonstration (since we don't have direct API stats here)
                                // We can use the jobpack id to generate a stable random progress
                                const mockCompleted = (jobpack.id * 17) % 60 + 20; // 20-80
                                const mockIncomplete = (jobpack.id * 7) % 15; // 0-15
                                const mockPending = 100 - mockCompleted - mockIncomplete;

                                return (
                                    <button
                                        key={jobpack.id}
                                        onClick={() => onJobpackChange(isSelected ? null : jobpack.id)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden",
                                            isSelected
                                                ? "bg-purple-50/50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800/50"
                                                : "bg-white border-slate-200 hover:border-purple-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-purple-800"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-3 relative z-10">
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600/80 mb-0.5">
                                                    ID: {jobpack.id}
                                                </div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                                    {jobpack.name}
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                                isSelected
                                                    ? "border-purple-500 bg-purple-500"
                                                    : "border-slate-300 dark:border-slate-700"
                                            )}>
                                                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                            </div>
                                        </div>

                                        {/* Progress Bar Area */}
                                        <div className="relative z-10 space-y-1.5">
                                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
                                                <span>Inspection Progress</span>
                                                <span>{mockCompleted}% Complete</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${mockCompleted}%` }} />
                                                <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${mockIncomplete}%` }} />
                                            </div>
                                        </div>

                                        {/* Highlight background when selected */}
                                        {isSelected && (
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60" />
                                        )}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No jobpacks found</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <Button onClick={onClose} className="rounded-xl px-8 font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-lg">
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
