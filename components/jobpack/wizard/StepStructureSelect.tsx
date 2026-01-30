"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoveRight, MoveLeft, Search, Filter } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";

interface StepStructureSelectProps {
    state: any;
    updateState: (updates: any) => void;
    onNext: () => void;
    onBack: () => void;
}

export function StepStructureSelect({ state, updateState, onNext, onBack }: StepStructureSelectProps) {
    const { data: structuresData, isLoading } = useSWR("/api/structures", fetcher);

    const [availableSearch, setAvailableSearch] = useState("");
    const [selectedStructures, setSelectedStructures] = useState<any[]>(
        // Init from state.structures (ids) by finding them in data?
        // We store only IDs in state, but need objects for display.
        // We will sync on mount if needed, or just filter.
        []
    );

    // Sync state ids to local if available
    // Actually, better to derive from state. 
    // But we need the full objects for the 'Selected' list.
    // We can just filter 'allStructures' by expected IDs.

    const allStructures = structuresData?.data || [];

    // IDs currently selected in State
    const selectedIds = state.structures || [];

    // Derived lists
    const availableList = allStructures.filter((s: any) => !selectedIds.some(id => String(id) === String(s.str_id)) &&
        (s.str_name.toLowerCase().includes(availableSearch.toLowerCase()) ||
            String(s.str_id).includes(availableSearch))
    );

    const selectedList = allStructures.filter((s: any) => selectedIds.some(id => String(id) === String(s.str_id)));

    const handleAdd = (strId: string | number) => {
        updateState({ structures: [...selectedIds, String(strId)] });
    };

    const handleRemove = (strId: string | number) => {
        updateState({ structures: selectedIds.filter((id: string) => String(id) !== String(strId)) });
    };

    const handleAddAll = () => {
        // Add all currently visible available items
        const visibleIds = availableList.map((s: any) => String(s.str_id));
        updateState({ structures: [...selectedIds, ...visibleIds] });
    };

    const handleRemoveAll = () => {
        updateState({ structures: [] });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
            <div>
                <h2 className="text-xl font-bold">Select Structures</h2>
                <p className="text-slate-500">Choose the structures for this work pack.</p>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 min-h-[400px]">

                {/* Available */}
                <div className="flex flex-col gap-2 border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                    <div className="p-3 border-b bg-slate-50 dark:bg-slate-800 font-medium flex justify-between items-center">
                        <span>Available ({availableList.length})</span>
                    </div>
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search..."
                                className="pl-8"
                                value={availableSearch}
                                onChange={(e) => setAvailableSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {isLoading ? (
                            <div className="text-center py-8 text-slate-400">Loading...</div>
                        ) : availableList.map((s: any) => (
                            <div
                                key={s.str_id}
                                onClick={() => handleAdd(s.str_id)}
                                className="p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors group"
                            >
                                <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                    {s.str_type === 'PLATFORM' ? 'PL' : 'PP'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm truncate">{s.str_name}</h4>
                                    <p className="text-xs text-slate-400">{s.field_name}</p>
                                </div>
                                <MoveRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                        ))}
                        {availableList.length === 0 && !isLoading && (
                            <div className="text-center py-8 text-slate-400 text-sm">No structures found</div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-row md:flex-col items-center justify-center gap-2 p-2">
                    <Button variant="outline" size="sm" onClick={handleAddAll} title="Add All Visible">
                        <span className="md:hidden">Add All</span>
                        <span className="hidden md:block">Add All &rarr;</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRemoveAll} title="Remove All" disabled={selectedIds.length === 0}>
                        <span className="md:hidden">Clear</span>
                        <span className="hidden md:block">&larr; Remove All</span>
                    </Button>
                </div>

                {/* Selected */}
                <div className="flex flex-col gap-2 border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm border-blue-200 dark:border-blue-900">
                    <div className="p-3 border-b bg-blue-50 dark:bg-blue-900/30 font-medium flex justify-between items-center text-blue-700 dark:text-blue-300">
                        <span>Selected ({selectedList.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {selectedList.map((s: any) => (
                            <div
                                key={s.str_id}
                                onClick={() => handleRemove(s.str_id)}
                                className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer flex items-center gap-3 transition-colors group"
                            >
                                <MoveLeft className="h-4 w-4 text-slate-300 group-hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" />
                                <div className="h-8 w-8 rounded bg-white flex items-center justify-center text-xs font-bold text-blue-600">
                                    {s.str_type === 'PLATFORM' ? 'PL' : 'PP'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm truncate text-blue-900 dark:text-blue-100">{s.str_name}</h4>
                                </div>
                            </div>
                        ))}
                        {selectedList.length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-sm">No structures selected</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={onBack} size="lg">Back</Button>
                <Button onClick={onNext} disabled={selectedIds.length === 0} size="lg">
                    Next Step
                </Button>
            </div>
        </div>
    );
}
