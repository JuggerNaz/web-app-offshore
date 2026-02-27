
"use client";

import { useAttachmentStore } from "@/stores/attachment-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";


export function AttachmentToolbar() {

    const {
        filters,
        setSearchQuery,
        setHasAttachmentsOnly,
        openSlideOver,
        selectedItems,
        clearSelection
    } = useAttachmentStore();

    if (selectedItems.size > 0) {
        return (
            <div className="flex items-center justify-between p-4 mx-6 mt-4 mb-0 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                    <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                        {selectedItems.size} selected
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 h-8"
                    >
                        Clear selection
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                        Download
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 shadow-sm">
                        Delete
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 p-6 pb-0 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 transition-all">
            {/* Top Row: Title */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Attachment Module</h1>
            </div>

            {/* Toolbar Row */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">

                {/* Search */}
                <div className="w-full md:w-96 relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input
                        placeholder="Search by name, type, or tags..."
                        value={filters.searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    {filters.searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">

                    {/* Active Filter Badges */}
                    <div className="flex items-center gap-2 overflow-x-auto max-w-[200px] no-scrollbar">
                        {/* No filters currently active here (structure/component moved to tree view or removed) */}
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />

                    {/* Filter Toggles */}
                    <Button
                        variant={!filters.hasAttachmentsOnly ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setHasAttachmentsOnly(!filters.hasAttachmentsOnly)}
                        className={cn(
                            "h-8 text-xs font-medium",
                            !filters.hasAttachmentsOnly && "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                        )}
                    >
                        Show All
                    </Button>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />

                    <Button onClick={() => openSlideOver(null)} className="h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 px-4 ml-2">
                        <Plus className="mr-2 h-4 w-4" /> Add
                    </Button>
                </div>
            </div>

            {/* Decorative Bottom Gradient/Border */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
        </div>
    );
}
