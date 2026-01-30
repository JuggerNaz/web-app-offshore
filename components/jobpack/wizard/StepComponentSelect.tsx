"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Check } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";

interface StepComponentSelectProps {
    state: any;
    updateState: (updates: any) => void;
    onNext: () => void;
    onBack: () => void;
}

export function StepComponentSelect({ state, updateState, onNext, onBack }: StepComponentSelectProps) {
    // 1. Select Structure
    const { data: structuresData } = useSWR("/api/structures", fetcher);

    // State for local UI
    const [structureSearch, setStructureSearch] = useState("");
    const [componentSearch, setComponentSearch] = useState("");

    // The active structure being configured
    const [activeStrId, setActiveStrId] = useState<string>("");

    // Fetch components for ACTIVE structure
    const { data: componentsData, isLoading: isLoadingComponents } = useSWR(
        activeStrId ? `/api/structure-components/${activeStrId}` : null,
        fetcher
    );

    const availableStructures = (structuresData?.data || []).filter((s: any) =>
        s.str_name.toLowerCase().includes(structureSearch.toLowerCase()) ||
        s.str_type.toLowerCase().includes(structureSearch.toLowerCase())
    );

    const activeComponents = componentsData?.data || [];

    // Global State References
    const selectedStructures: string[] = state.structures || [];
    // map str_id -> [comp_id]
    const selections = state.structureSpecificComponents || {};

    // Selection for Active Structure
    const activeSelection = activeStrId ? (selections[activeStrId] || []) : [];

    // Filter components list
    const filteredComponents = activeComponents.filter((c: any) =>
        (c.name?.toLowerCase() || "").includes(componentSearch.toLowerCase()) ||
        (c.q_id?.toLowerCase() || "").includes(componentSearch.toLowerCase()) ||
        (c.code?.toLowerCase() || "").includes(componentSearch.toLowerCase())
    );

    const handleStructureClick = (id: string) => {
        // If not selected, select it
        if (!selectedStructures.includes(id)) {
            const newStructures = [...selectedStructures, id];
            updateState({ structures: newStructures });
            // Init empty array
            const newSelections = { ...selections, [id]: [] };
            updateState({ structureSpecificComponents: newSelections });
        }
        setActiveStrId(id);
    };

    const handleCheckboxToggle = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
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
            structureSpecificComponents: newSelections
        });
    };

    const toggleComponent = (compId: string) => {
        if (!activeStrId) return;
        const current = selections[activeStrId] || [];
        const isSelected = current.includes(compId);

        const newIds = isSelected
            ? current.filter((x: string) => x !== compId)
            : [...current, compId];

        const newSelections = { ...selections, [activeStrId]: newIds };
        updateState({ structureSpecificComponents: newSelections });
    };

    const toggleAllVisible = (checked: boolean) => {
        if (!activeStrId) return;
        const current = selections[activeStrId] || [];
        const visibleIds = filteredComponents.map((c: any) => c.id);

        let newIds;
        if (checked) {
            // Add all visible
            newIds = Array.from(new Set([...current, ...visibleIds]));
        } else {
            // Remove all visible
            newIds = current.filter((id: string) => !visibleIds.includes(id));
        }

        const newSelections = { ...selections, [activeStrId]: newIds };
        updateState({ structureSpecificComponents: newSelections });
    };

    const isAllVisibleSelected = filteredComponents.length > 0 && filteredComponents.every((c: any) => activeSelection.includes(c.id));
    const allValid = selectedStructures.length > 0 && selectedStructures.every(id => (selections[id]?.length || 0) > 0);
    const activeStrName = structuresData?.data?.find((s: any) => String(s.str_id) === activeStrId)?.str_name || "Unknown";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
            {/* Structure Selection */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>Select Structures ({selectedStructures.length})</Label>
                    <span className="text-xs text-slate-400">Click to configure components</span>
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
                            const count = selections[sId]?.length || 0;

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
                                        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${count > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                            {count} Comps
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {availableStructures.length === 0 && <div className="col-span-2 text-center text-slate-400 py-4 text-sm">No structures found</div>}
                    </div>
                </div>
            </div>

            {/* Component Layout */}
            <div className={`flex-1 flex flex-col border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm min-h-[350px] transition-opacity ${activeStrId ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                <div className="p-3 border-b bg-purple-50 dark:bg-purple-900/10 font-medium text-purple-800 dark:text-purple-200 flex justify-between items-center text-sm">
                    <span>Components for <span className="font-bold">{activeStrName}</span></span>
                    <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-xs">{activeSelection.length} Selected</span>
                </div>

                <div className="p-2 border-b flex justify-between items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Filter components..."
                            className="pl-8 h-9"
                            value={componentSearch}
                            onChange={(e) => setComponentSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-2 grid grid-cols-[auto_1fr_1fr_2fr] gap-4 font-medium text-xs text-slate-500 border-b uppercase tracking-wider">
                    <div className="px-2 flex items-center">
                        <Checkbox checked={isAllVisibleSelected} onCheckedChange={(c) => toggleAllVisible(c as boolean)} />
                    </div>
                    <div>QID</div>
                    <div>Type</div>
                    <div>Name</div>
                </div>

                <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                    {isLoadingComponents ? (
                        <div className="text-center py-12 text-slate-400 text-sm">Loading components for {activeStrName}...</div>
                    ) : filteredComponents.map((c: any) => (
                        <div
                            key={c.id}
                            className={`grid grid-cols-[auto_1fr_1fr_2fr] gap-4 p-2 text-sm items-center border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${activeSelection.includes(c.id) ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}
                        >
                            <div className="px-2">
                                <Checkbox checked={activeSelection.includes(c.id)} onCheckedChange={() => toggleComponent(c.id)} />
                            </div>
                            <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{c.q_id}</div>
                            <div className="text-xs badge badge-outline w-fit">{c.code}</div>
                            <div className="truncate text-slate-600 dark:text-slate-400">{c.name}</div>
                        </div>
                    ))}
                    {filteredComponents.length === 0 && !isLoadingComponents && (
                        <div className="text-center py-12 text-slate-400 text-sm">No components match your filter</div>
                    )}
                    {!activeStrId && (
                        <div className="flex h-full items-center justify-center text-slate-400 text-sm italic">
                            Select a structure above to configure components
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between pt-4 items-center">
                <Button variant="outline" onClick={onBack} size="lg">Back</Button>
                {!allValid && selectedStructures.length > 0 && <span className="text-red-500 text-sm">Each selected structure must have at least one component.</span>}
                <Button onClick={onNext} disabled={!allValid} size="lg">
                    Next Step
                </Button>
            </div>
        </div>
    );
}
