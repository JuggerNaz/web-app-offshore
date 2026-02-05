"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Loader2, Check } from "lucide-react";

interface StepInspectionProps {
    state: any;
    updateState: (updates: any) => void;
    onNext: () => void;
    onBack: () => void;
    isSubmitting: boolean;
}

export function StepInspection({ state, updateState, onNext, onBack, isSubmitting }: StepInspectionProps) {
    // 1. Fetch Data
    const { data: structuresData } = useSWR("/api/structures", fetcher);
    const { data: inspTypesData } = useSWR("/api/inspection-types", fetcher);

    const inspTypes = inspTypesData?.data || [];

    // State for local UI
    const [structureSearch, setStructureSearch] = useState("");
    const [activeStrId, setActiveStrId] = useState<string>("");

    // Global State References
    // We rely on state.structures having been populated in previous steps
    const selectedStructures: string[] = state.structures || [];

    // map str_id -> [insp_code]
    const selections = state.structureSpecificInspectionTypes || {};

    const availableStructures = (structuresData?.data || []).filter((s: any) =>
        selectedStructures.some(id => String(id) === String(s.str_id)) && (
            s.str_name.toLowerCase().includes(structureSearch.toLowerCase()) ||
            s.str_type.toLowerCase().includes(structureSearch.toLowerCase())
        )
    );

    // If no active Structure, pick the first one on mount (optional, helps UX)
    React.useEffect(() => {
        if (!activeStrId && availableStructures.length > 0) {
            setActiveStrId(String(availableStructures[0].str_id));
        }
    }, [availableStructures, activeStrId]);

    const activeSelection = activeStrId ? (selections[activeStrId] || []) : [];
    const activeStrName = structuresData?.data?.find((s: any) => String(s.str_id) === activeStrId)?.str_name || "Unknown";

    const handleStructureClick = (id: string) => {
        setActiveStrId(id);
    };

    const toggleInspectionType = (code: string) => {
        if (!activeStrId) return;
        const current = selections[activeStrId] || [];
        const isSelected = current.includes(code);

        const newTypes = isSelected
            ? current.filter((x: string) => x !== code)
            : [...current, code];

        const newSelections = { ...selections, [activeStrId]: newTypes };
        updateState({ structureSpecificInspectionTypes: newSelections });
    };

    // Apply to ALL selected structures
    const applyToAll = () => {
        if (!activeStrId) return;
        const currentTypes = selections[activeStrId] || [];

        const newSelections = { ...selections };
        selectedStructures.forEach(strId => {
            newSelections[strId] = [...currentTypes];
        });
        updateState({ structureSpecificInspectionTypes: newSelections });
    };

    const allValid = selectedStructures.length > 0 && selectedStructures.every(id => (selections[id]?.length || 0) > 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold">Select Inspection Type</h2>
                    <p className="text-slate-500 text-sm">Define inspection methodology for each selected structure.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={applyToAll} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    Apply Current Selection to All
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 flex-1 min-h-[300px]">
                {/* Structure List */}
                <div className="border rounded-xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col shadow-sm">
                    <div className="p-3 border-b bg-slate-50 dark:bg-slate-950 font-medium text-sm text-slate-700 dark:text-slate-300">
                        Structures ({selectedStructures.length})
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {availableStructures.map((s: any) => {
                            const sId = String(s.str_id);
                            const isActive = activeStrId === sId;
                            const count = selections[sId]?.length || 0;

                            return (
                                <div
                                    key={sId}
                                    onClick={() => handleStructureClick(sId)}
                                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between text-sm transition-all ${isActive ? "ring-2 ring-blue-500 border-transparent bg-blue-50 dark:bg-blue-900/30" :
                                        "hover:bg-slate-50 border-slate-200"
                                        }`}
                                >
                                    <div>
                                        <div className="font-medium">{s.str_name}</div>
                                        <div className="text-xs opacity-70">{s.str_type}</div>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${count > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                        {count} Methods
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Inspection Types Grid */}
                <div className={`border rounded-xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col shadow-sm transition-opacity ${activeStrId ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                    <div className="p-3 border-b bg-green-50 dark:bg-green-900/10 font-medium text-green-800 dark:text-green-200 text-sm flex justify-between items-center">
                        <span>Inspection Types for <span className="font-bold">{activeStrName}</span></span>
                        <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-xs">{activeSelection.length} Selected</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {inspTypes.map((t: any) => {
                                const isSelected = activeSelection.includes(t.code || t.type);
                                return (
                                    <div
                                        key={t.code || t.id}
                                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-slate-200 hover:border-blue-300"}`}
                                        onClick={() => toggleInspectionType(t.code || t.type)}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "bg-green-500 border-green-500 text-white" : "border-slate-300"}`}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate" title={t.descrip || t.name}>{t.descrip || t.name || t.type}</div>
                                            <div className="text-xs text-slate-500 font-mono">{t.code || t.id}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border text-sm">
                <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider">Work Pack</div>
                    <div className="font-medium font-mono">{state.inspno}</div>
                </div>
                <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider">Contractor</div>
                    <div className="font-medium truncate">{state.contractor?.lib_desc || state.contractor?.lib_name}</div>
                </div>
                <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider">Mode</div>
                    <div className="font-medium badge">{state.mode}</div>
                </div>
                <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider">Total Structs</div>
                    <div className="font-medium">{selectedStructures.length}</div>
                </div>
            </div>

            <div className="flex justify-between pt-4 flex-1 items-end">
                <Button variant="outline" onClick={onBack} size="lg" disabled={isSubmitting}>Back</Button>
                <div className="flex items-center gap-4">
                    {!allValid && selectedStructures.length > 0 && <span className="text-red-500 text-sm hidden md:inline">Each structure must have inspection methods.</span>}
                    <Button onClick={onNext} disabled={!allValid || isSubmitting} size="lg" className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]">
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Work Pack"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
