"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MoveRight, MoveLeft, Search, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Input } from "@/components/ui/input";

interface StepCompTypeSelectProps {
    state: any;
    updateState: (updates: any) => void;
    onNext: () => void;
    onBack: () => void;
}

export function StepCompTypeSelect({ state, updateState, onNext, onBack }: StepCompTypeSelectProps) {
    // 1. Select Structures
    const { data: structuresData } = useSWR("/api/structures", fetcher);
    // 2. Select Types
    const { data: termsData, isLoading: isLoadingTypes } = useSWR("/api/components", fetcher);

    const [structureSearch, setStructureSearch] = useState("");
    const [search, setSearch] = useState("");

    // The structure currently being configured (highlighted)
    const [activeStrId, setActiveStrId] = useState<string>("");

    const allTypes = termsData?.data || [];
    const selectedStructures: string[] = state.structures || [];

    // Map of str_id -> [codes]
    const selections = state.structureComponentSelections || {};

    const availableStructures = (structuresData?.data || []).filter((s: any) =>
        s.str_name.toLowerCase().includes(structureSearch.toLowerCase()) ||
        s.str_type.toLowerCase().includes(structureSearch.toLowerCase())
    );

    // Get types for the ACTIVE structure
    const activeSelectedTypes = activeStrId ? (selections[activeStrId] || []) : [];

    const availableList = allTypes.filter((t: any) => !activeSelectedTypes.includes(t.code) && (
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase())
    ));

    const selectedList = allTypes.filter((t: any) => activeSelectedTypes.includes(t.code));

    const handleStructureClick = (id: string) => {
        // Toggle selection if not selected, or just set active
        if (!selectedStructures.includes(id)) {
            const newStructures = [...selectedStructures, id];
            updateState({ structures: newStructures });
            // Also init empty array for it
            const newSelections = { ...selections, [id]: [] };
            updateState({ structureComponentSelections: newSelections });
        }

        setActiveStrId(id);
    };

    const handleCheckboxToggle = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // prevent card click
        const isSelected = selectedStructures.includes(id);

        let newStructures;
        let newSelections = { ...selections };

        if (isSelected) {
            newStructures = selectedStructures.filter(x => x !== id);
            delete newSelections[id];
            if (activeStrId === id) setActiveStrId("");
        } else {
            newStructures = [...selectedStructures, id];
            newSelections[id] = [];
            setActiveStrId(id);
        }

        updateState({
            structures: newStructures,
            structureComponentSelections: newSelections
        });
    };

    const updateActiveTypes = (newTypes: string[]) => {
        if (!activeStrId) return;
        const newSelections = { ...selections, [activeStrId]: newTypes };
        updateState({ structureComponentSelections: newSelections });
        // NOTE: We also keep global componentTypes in sync or deprecated. 
        // For backwards compatibility, we might update componentTypes with a union of all, 
        // but the API will prioritize structureComponentSelections.
    };

    const handleAdd = (code: string) => {
        updateActiveTypes([...activeSelectedTypes, code]);
    };

    const handleRemove = (code: string) => {
        updateActiveTypes(activeSelectedTypes.filter((c: string) => c !== code));
    };

    const handleAddAll = () => {
        const visibleCodes = availableList.map((t: any) => t.code);
        updateActiveTypes([...activeSelectedTypes, ...visibleCodes]);
    };

    const handleRemoveAll = () => {
        updateActiveTypes([]);
    };

    // Ensure all selected structures have at least one type
    const allValid = selectedStructures.length > 0 && selectedStructures.every(id => (selections[id]?.length || 0) > 0);
    const activeStrName = structuresData?.data?.find((s: any) => String(s.str_id) === activeStrId)?.str_name || "Unknown";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
            {/* Structure Selection */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>Select Structures ({selectedStructures.length})</Label>
                    <span className="text-xs text-slate-400">Click to configure types</span>
                </div>
                <div className="border rounded-xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col h-48 shadow-sm">
                    <div className="p-2 border-b bg-slate-50 dark:bg-slate-950">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search structures..."
                                value={structureSearch}
                                onChange={e => setStructureSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 grid grid-cols-1 md:grid-cols-2 gap-2 custom-scrollbar">
                        {availableStructures.map((s: any) => {
                            const sId = String(s.str_id);
                            const isSel = selectedStructures.includes(sId);
                            const isActive = activeStrId === sId;
                            const typeCount = selections[sId]?.length || 0;

                            return (
                                <div
                                    key={sId}
                                    onClick={() => handleStructureClick(sId)}
                                    className={`p-2 rounded border cursor-pointer flex items-center gap-3 text-sm transition-all ${isActive ? "ring-2 ring-blue-500 border-transparent bg-blue-50 dark:bg-blue-900/30" :
                                        isSel ? "border-blue-200 bg-slate-50 dark:border-blue-800" : "hover:bg-slate-50 border-slate-200"
                                        }`}
                                >
                                    <div
                                        className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${isSel ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"}`}
                                        onClick={(e) => handleCheckboxToggle(e, sId)}
                                    >
                                        {isSel && <Check className="h-3 w-3" />}
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <span className="font-medium">{s.str_name}</span>
                                        <span className="text-xs opacity-70">{s.str_type}</span>
                                    </div>
                                    {isSel && (
                                        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeCount > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                            {typeCount} Types
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {availableStructures.length === 0 && <div className="col-span-2 text-center text-slate-400 py-4 text-sm">No structures found</div>}
                    </div>
                </div>
            </div>

            {/* Component Type Selection */}
            <div className={`flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 min-h-[300px] transition-opacity ${activeStrId ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                {/* Available Types */}
                <div className="flex flex-col gap-2 border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                    <div className="p-3 border-b bg-slate-50 dark:bg-slate-800 font-medium text-sm">
                        Available Types
                    </div>
                    <div className="p-2 border-b">
                        <Input placeholder="Search types..." value={search} onChange={e => setSearch(e.target.value)} className="h-8" />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {isLoadingTypes ? (
                            <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                        ) : availableList.map((t: any) => (
                            <div key={t.code} onClick={() => handleAdd(t.code)} className="p-2 rounded border hover:bg-slate-100 cursor-pointer flex justify-between items-center group text-sm">
                                <span>{t.name} <span className="text-slate-400 text-xs">({t.code})</span></span>
                                <MoveRight className="h-4 w-4 opacity-0 group-hover:opacity-100 text-slate-400" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-row md:flex-col items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleAddAll}>&rarr;</Button>
                    <Button variant="outline" size="sm" onClick={handleRemoveAll}>&larr;</Button>
                </div>

                {/* Selected Types */}
                <div className="flex flex-col gap-2 border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm border-purple-200 dark:border-purple-900">
                    <div className="p-3 border-b bg-purple-50 dark:bg-purple-900/30 font-medium text-purple-700 text-sm flex justify-between items-center">
                        <span>Selected for <span className="font-bold underline">{activeStrName}</span></span>
                        <span className="text-xs bg-purple-200 dark:bg-purple-800 px-2 py-0.5 rounded-full">{selectedList.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {selectedList.length === 0 && <div className="p-4 text-center text-slate-400 text-xs italic">No types selected for this structure</div>}
                        {selectedList.map((t: any) => (
                            <div key={t.code} onClick={() => handleRemove(t.code)} className="p-2 rounded border bg-purple-50/50 hover:bg-red-50 cursor-pointer flex justify-between items-center group text-sm">
                                <span className="text-purple-900 dark:text-purple-100">{t.name}</span>
                                <MoveLeft className="h-4 w-4 opacity-0 group-hover:opacity-100 text-red-500" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-4 items-center">
                <Button variant="outline" onClick={onBack} size="lg">Back</Button>
                {!allValid && selectedStructures.length > 0 && <span className="text-red-500 text-sm">Each selected structure must have at least one type.</span>}
                <Button onClick={onNext} disabled={!allValid} size="lg">
                    Next Step
                </Button>
            </div>
        </div>
    );
}
