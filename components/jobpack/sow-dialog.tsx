"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Plus, Search, Trash2, X, AlertTriangle, Check, Columns, CheckCircle, AlertCircle, Circle, ShieldCheck, Layers, Filter, CheckCircle2, XCircle, Clock, Settings2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOW, SOWItem, ReportNumber, InspectionStatus } from "@/types/sow";
import { cn } from "@/lib/utils";

interface SOWDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobpackId: number;
    jobpackTitle?: string;
    structure: {
        id: number;
        type: "PLATFORM" | "PIPELINE";
        title: string;
    };
    availableStructures?: Array<{
        id: number;
        type: "PLATFORM" | "PIPELINE";
        title: string;
    }>;
    onSwitchStructure?: (structure: { id: number; type: "PLATFORM" | "PIPELINE"; title: string }) => void;
    inspectionTypes: Array<{
        id: number;
        code: string;
        name: string;
    }>;
    components: Array<{
        id: number;
        qid: string;
        type: string;
        elv_1?: number;
        elv_2?: number;
        s_node?: string;
        f_node?: string;
        s_leg?: string;
        f_leg?: string;
    }>;
    onSave?: () => void;
}

export function SOWDialog({
    open,
    onOpenChange,
    jobpackId,
    jobpackTitle,
    structure,
    availableStructures,
    onSwitchStructure,
    inspectionTypes,
    components,
    onSave,
}: SOWDialogProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sow, setSOW] = useState<SOW | null>(null);
    const [sowItems, setSOWItems] = useState<SOWItem[]>([]);
    const [reportNumbers, setReportNumbers] = useState<ReportNumber[]>([]);
    const [reportInput, setReportInput] = useState("");
    const [contractorRefInput, setContractorRefInput] = useState("");
    const [componentSearch, setComponentSearch] = useState("");
    const [newElevationInput, setNewElevationInput] = useState<Record<number, string>>({}); // Per-component input state
    const [autoSplitIntervals, setAutoSplitIntervals] = useState<Record<number, string>>({}); // Per-component auto-split interval state
    const [activeReportNumber, setActiveReportNumber] = useState<string | null>(null);
    // Map of ReportNumber -> Set of Component IDs
    const [selectedComponentsMap, setSelectedComponentsMap] = useState<Record<string, Set<number>>>({});

    // Computed selected components for current view
    const selectedComponents = selectedComponentsMap[activeReportNumber || 'null'] || new Set<number>();

    // Track which components should be split by elevation: component_id -> boolean
    const [componentSplitByElevation, setComponentSplitByElevation] = useState<Record<number, boolean>>({});

    // State for per-component breakpoints: component_id -> array of numbers (split points)
    const [componentBreakpoints, setComponentBreakpoints] = useState<Record<number, number[]>>({});

    // State for per-component splits: component_id -> array of ranges
    const [componentSplits, setComponentSplits] = useState<Record<number, Array<{ start: number; end: number }>>>({});

    // Selection state: Set of unique keys "reportNumber:componentId:inspectionTypeId:elv1:elv2"
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Split Configuration State
    const [splitConfigOpen, setSplitConfigOpen] = useState(false);
    const [activeSplitComponent, setActiveSplitComponent] = useState<SOWDialogProps['components'][0] | null>(null);

    // Copy Scope Dialog State
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [pendingReportToAdd, setPendingReportToAdd] = useState<ReportNumber | null>(null);

    // Filter out excluded inspection types and ensure valid data
    const filteredInspectionTypes = inspectionTypes.filter(t => {
        if (!t.code || !t.name) return false;

        const code = t.code.trim().toUpperCase();
        const name = t.name.trim();

        // Check for empty strings, 'NULL', 'undefined'
        if (code === '' || code === 'NULL' || name === '' || name.toUpperCase() === 'NULL' || name.toUpperCase() === 'UNDEFINED') return false;

        // Must contain at least one LETTER (a-z). Prevents "123", "...", etc.
        if (!/[a-zA-Z]/.test(name)) return false;

        // Aggressive Substring Filtering for Code and Name
        const nameUpper = name.toUpperCase();
        const codeUpper = code.toUpperCase();

        // Keywords that indicate a non-SOW type (Calibration, Logs, Summary, Setup, etc.)
        const excludedKeywords = [
            'EXSUM', 'LOG', 'CALIB', 'SUMMARY',
            'UTCLB', 'CPCLB', 'ROVCLB',
            'SETUP', 'CHECK', 'TEST_PIECE'
        ];

        if (excludedKeywords.some(keyword => codeUpper.includes(keyword))) return false;
        if (excludedKeywords.some(keyword => nameUpper.includes(keyword))) return false;

        return true;
    });

    // State for searching selected components
    const [selectedComponentSearch, setSelectedComponentSearch] = useState("");



    // Initial load
    useEffect(() => {
        if (open && structure) {
            loadSOW();
        }
    }, [open, structure]);

    const loadSOW = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `/api/sow?jobpack_id=${jobpackId}&structure_id=${structure.id}`
            );
            const { data } = await response.json();

            if (data) {
                setSOW(data);
                const items = data.items || [];
                setSOWItems(items);
                const reports = data.report_numbers || [];
                setReportNumbers(reports);

                // Set active report
                if (reports.length > 0 && !activeReportNumber) {
                    setActiveReportNumber(reports[0].number);
                } else if (reports.length === 0) {
                    setActiveReportNumber(null);
                }

                // Reconstruct selections
                const newSelectedItems = new Set<string>();
                const newSplits: Record<number, Array<{ start: number; end: number }>> = {};
                const newSelectedComponentsMap: Record<string, Set<number>> = {};
                const componentSplitsEnabled: Record<number, boolean> = {};
                const newBreakpoints: Record<number, Set<number>> = {};

                items.forEach((item: any) => {
                    const rpt = item.report_number || 'null';

                    if (!newSelectedComponentsMap[rpt]) {
                        newSelectedComponentsMap[rpt] = new Set();
                    }
                    newSelectedComponentsMap[rpt].add(item.component_id);

                    const keyPrefix = `${rpt}:${item.component_id}:${item.inspection_type_id}`;

                    if (item.elevation_required && item.elevation_data?.length > 0) {
                        componentSplitsEnabled[item.component_id] = true;

                        if (!newBreakpoints[item.component_id]) {
                            newBreakpoints[item.component_id] = new Set();
                        }

                        item.elevation_data.forEach((range: any) => {
                            const start = range.start ?? 0;
                            const end = range.end ?? 0;
                            newSelectedItems.add(`${keyPrefix}:${start}:${end}`);

                            // Collect breakpoints
                            newBreakpoints[item.component_id].add(start);
                            newBreakpoints[item.component_id].add(end);

                            if (!newSplits[item.component_id]) {
                                newSplits[item.component_id] = [];
                            }
                            const exists = newSplits[item.component_id].some(r => r.start === start && r.end === end);
                            if (!exists) {
                                newSplits[item.component_id].push({ start, end });
                            }
                        });
                    } else {
                        newSelectedItems.add(`${keyPrefix}:0:0`);
                    }
                });

                // Convert sets to arrays for breakpoints
                const finalBreakpoints: Record<number, number[]> = {};
                Object.keys(newBreakpoints).forEach(key => {
                    const k = Number(key);
                    finalBreakpoints[k] = Array.from(newBreakpoints[k]).sort((a, b) => a - b);
                });

                setSelectedItems(newSelectedItems);
                setSelectedComponentsMap(newSelectedComponentsMap);
                setComponentSplits(newSplits);
                setComponentSplitByElevation(componentSplitsEnabled);
                setComponentBreakpoints(finalBreakpoints);
            } else {
                setSOW(null);
                setSOWItems([]);
                setReportNumbers([]);
                setSelectedItems(new Set());
                setComponentSplits({});
                setSelectedComponentsMap({});
                setActiveReportNumber(null);
            }
        } catch (error) {
            console.error("Error loading SOW:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddReportNumber = () => {
        if (!reportInput.trim()) return;
        const num = reportInput.trim();
        if (reportNumbers.some((r: ReportNumber) => r.number === num)) {
            alert("Report number already exists");
            return;
        }

        const newReport: ReportNumber = {
            number: num,
            contractor_ref: contractorRefInput.trim() || undefined,
            date: new Date().toISOString().split("T")[0],
        };

        if (reportNumbers.length > 0) {
            setPendingReportToAdd(newReport);
            setCopyDialogOpen(true);
        } else {
            setReportNumbers([...reportNumbers, newReport]);
            setReportInput("");
            setContractorRefInput("");
            setActiveReportNumber(newReport.number);
            // Initialize empty set for new report
            setSelectedComponentsMap(prev => ({
                ...prev,
                [newReport.number]: new Set()
            }));
        }
    };

    const handleConfirmCopyScope = (mode: 'empty' | 'copy' | 'copy_pending', sourceReport?: string) => {
        if (!pendingReportToAdd) return;

        setReportNumbers([...reportNumbers, pendingReportToAdd]);
        setReportInput("");
        setContractorRefInput("");
        setActiveReportNumber(pendingReportToAdd.number);

        const targetReport = pendingReportToAdd.number;
        const newComponentsSet = new Set<number>();

        if (mode !== 'empty' && sourceReport) {
            setSelectedItems(prev => {
                const newSet = new Set(prev);
                Array.from(prev).forEach(key => {
                    // Check if key belongs to sourceReport
                    const parts = key.split(':');
                    if (parts[0] === sourceReport) {
                        const componentId = Number(parts[1]);
                        const suffix = parts.slice(1).join(':');
                        const newKey = `${targetReport}:${suffix}`;

                        let shouldCopy = true;
                        if (mode === 'copy_pending') {
                            const item = sowItems.find(i =>
                                i.report_number === sourceReport &&
                                i.component_id == componentId &&
                                i.inspection_type_id == Number(parts[2])
                            );

                            if (item) {
                                if (item.status === 'completed') shouldCopy = false;
                                if (shouldCopy && item.elevation_required && item.elevation_data) {
                                    const start = Number(parts[3]);
                                    const end = Number(parts[4]);
                                    const range = item.elevation_data.find((d: any) => d.start === start && d.end === end);
                                    if (range && range.status === 'completed') shouldCopy = false;
                                }
                            }
                        }

                        if (shouldCopy) {
                            newSet.add(newKey);
                            newComponentsSet.add(componentId);
                        }
                    }
                });
                return newSet;
            });
        }

        setSelectedComponentsMap(prev => ({
            ...prev,
            [targetReport]: newComponentsSet
        }));

        setCopyDialogOpen(false);
        setPendingReportToAdd(null);
    };

    const handleRemoveReportNumber = (index: number) => {
        const removedReport = reportNumbers[index].number;
        setReportNumbers(reportNumbers.filter((_: ReportNumber, i: number) => i !== index));
        if (activeReportNumber === removedReport) {
            setActiveReportNumber(null);
        }
        // Cleanup map
        setSelectedComponentsMap(prev => {
            const next = { ...prev };
            delete next[removedReport];
            return next;
        });
    };

    const handleAddComponent = (componentId: number) => {
        const rpt = activeReportNumber || 'null';
        setSelectedComponentsMap(prev => {
            const currentSet = new Set(prev[rpt] || []);
            currentSet.add(componentId);
            return {
                ...prev,
                [rpt]: currentSet
            };
        });
    };

    const handleRemoveComponent = (componentId: number) => {
        const rpt = activeReportNumber || 'null';
        setSelectedComponentsMap(prev => {
            const currentSet = new Set(prev[rpt] || []);
            currentSet.delete(componentId);
            return {
                ...prev,
                [rpt]: currentSet
            };
        });

        // Also clear selections and splits for this report-component
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            Array.from(newSet).forEach(key => {
                if (key.startsWith(`${rpt}:${componentId}:`)) {
                    newSet.delete(key);
                }
            });
            return newSet;
        });

        // Note: Splits are currently Global per component ID in this implementation.
        // If we remove component from view, we don't necessarily delete the split config?
        // Let's leave split config alone as it might be used by other reports.
    };

    const handleAddComponentBreakpoint = (componentId: number, elevation: number) => {
        if (isNaN(elevation)) return;

        // Verify elevation is within component bounds
        const comp = components.find(c => c.id === componentId);
        if (comp && comp.elv_1 != null && comp.elv_2 != null) {
            const cElv1 = typeof comp.elv_1 === 'string' ? parseFloat(comp.elv_1) : comp.elv_1;
            const cElv2 = typeof comp.elv_2 === 'string' ? parseFloat(comp.elv_2) : comp.elv_2;
            const min = Math.min(cElv1, cElv2);
            const max = Math.max(cElv1, cElv2);

            if (elevation <= min || elevation >= max) {
                // Ignore out of bounds
                alert(`Elevation must be between ${min}m and ${max}m`);
                return;
            }
        }

        setComponentBreakpoints(prev => {
            const current = prev[componentId] || [];
            if (current.includes(elevation)) return prev;
            return {
                ...prev,
                [componentId]: [...current, elevation].sort((a, b) => a - b)
            };
        });
    };

    const handleRemoveComponentBreakpoint = (componentId: number, elevation: number) => {
        setComponentBreakpoints(prev => {
            const current = prev[componentId] || [];
            return {
                ...prev,
                [componentId]: current.filter(e => e !== elevation)
            };
        });
    };

    const toggleSelection = (componentId: number, inspectionTypeId: number, elv1: number, elv2: number) => {
        const rpt = activeReportNumber || 'null';
        const key = `${rpt}:${componentId}:${inspectionTypeId}:${elv1}:${elv2}`; // Composite key

        setSelectedItems(prev => {
            const newSet = new Set(prev);

            // Logic: Exclusive selection (Whole vs Split)
            // If toggling "Whole Component" (0:0) -> ON:
            //    - Clear all specific split ranges for this Component+Type
            // If toggling "Split Range" (X:Y) -> ON:
            //    - Clear "Whole Component" (0:0) for this Component+Type

            if (newSet.has(key)) {
                // Deselecting is simple
                newSet.delete(key);
            } else {
                // Selecting
                newSet.add(key);

                if (elv1 === 0 && elv2 === 0) {
                    // Selected "Whole", remove any splits
                    Array.from(prev).forEach(k => {
                        if (k.startsWith(`${rpt}:${componentId}:${inspectionTypeId}:`) && k !== key) {
                            newSet.delete(k);
                        }
                    });
                } else {
                    // Selected a split, remove "Whole" if exists
                    const wholeKey = `${rpt}:${componentId}:${inspectionTypeId}:0:0`;
                    if (newSet.has(wholeKey)) {
                        newSet.delete(wholeKey);
                    }
                }
            }
            return newSet;
        });
    };

    const isSelected = (componentId: number, inspectionTypeId: number, elv1: number, elv2: number): boolean => {
        const rpt = activeReportNumber || 'null';
        const key = `${rpt}:${componentId}:${inspectionTypeId}:${elv1}:${elv2}`;
        return selectedItems.has(key);
    };

    const getItemStatus = (componentId: number, inspectionTypeId: number, elv1: number, elv2: number): InspectionStatus => {
        const rpt = activeReportNumber || 'null';
        // Find item in sowItems matching this keys
        const item = sowItems.find(i =>
            (i.report_number || 'null') === rpt &&
            i.component_id === componentId &&
            i.inspection_type_id === inspectionTypeId &&
            (
                (!i.elevation_required) ||
                (i.elevation_required && i.elevation_data?.some((d: any) => d.start === elv1 && d.end === elv2))
            )
        );

        if (!item) return "pending";

        if (item.elevation_required) {
            const data = item.elevation_data?.find((d: any) => d.start === elv1 && d.end === elv2);
            return data?.status || "pending";
        }

        return item.status || "pending";
    };

    const getStatusIcon = (status: InspectionStatus) => {
        switch (status) {
            case "completed":
                return <CheckCircle className="h-3 w-3 text-green-600" />;
            case "incomplete":
                return <AlertCircle className="h-3 w-3 text-red-600" />;
            default:
                return <Circle className="h-3 w-3 text-gray-400" />;
        }
    };

    const getStatusColor = (status: InspectionStatus) => {
        switch (status) {
            case "completed":
                return "bg-green-50 border-green-200";
            case "incomplete":
                return "bg-red-50 border-red-200";
            default:
                return "bg-gray-50 border-gray-200";
        }
    };

    const handleSave = async () => {
        // Validation: Ensure at least one report number exists
        if (reportNumbers.length === 0) {
            alert("Please add at least one Report Number before saving.");
            return;
        }

        // Warning: Pending report number typed but not added
        if (reportInput.trim()) {
            const confirmSave = confirm(`You have typed a report number "${reportInput}" but haven't added it (clicked +). It will NOT be saved.\n\nDo you want to continue saving?`);
            if (!confirmSave) return;
        }

        setSaving(true);
        try {
            // Step 1: Create or update SOW header
            let sowId = sow?.id;

            if (!sowId) {
                const sowResponse = await fetch("/api/sow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jobpack_id: jobpackId,
                        structure_id: structure.id,
                        structure_type: structure.type,
                        structure_title: structure.title,
                        report_numbers: reportNumbers,
                        metadata: {
                            created_by: "system" // Placeholder
                        }
                    }),
                });

                const { data: newSOW } = await sowResponse.json();
                sowId = newSOW.id;
                setSOW(newSOW);
            } else {
                // Update existing SOW header
                await fetch("/api/sow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: sowId,
                        report_numbers: reportNumbers,
                        metadata: {
                            ...sow?.metadata,
                            updated_by: "system"
                        }
                    }),
                });
            }

            // Step 2: Group selected items by Report + Component + InspectionType
            // Key: "reportNumber:componentId:inspectionTypeId" -> Value: Array of ranges
            const groupedSelections: Record<string, Array<{ start: number; end: number }>> = {};

            Array.from(selectedItems).forEach(key => {
                const parts = key.split(":");
                // Handle potentially varied key lengths if I messed up earlier? No, strictly 5 parts.
                const rptStr = parts[0];
                const compIdStr = parts[1];
                const typeIdStr = parts[2];
                const elv1Str = parts[3];
                const elv2Str = parts[4];

                const groupKey = `${rptStr}:${compIdStr}:${typeIdStr}`;

                if (!groupedSelections[groupKey]) {
                    groupedSelections[groupKey] = [];
                }

                groupedSelections[groupKey].push({
                    start: Number(elv1Str),
                    end: Number(elv2Str)
                });
            });

            // Step 3: Process Upserts
            for (const [groupKey, ranges] of Object.entries(groupedSelections)) {
                const [rptStr, compIdStr, typeIdStr] = groupKey.split(":");
                const componentId = Number(compIdStr);
                const inspectionTypeId = Number(typeIdStr);
                const reportNumber = rptStr === 'null' ? null : rptStr;

                const component = components.find(c => c.id === componentId);
                const inspection = inspectionTypes.find(i => i.id === inspectionTypeId);

                if (!component || !inspection) continue;

                // Determine logic: 
                // Checks if ranges contains { start: 0, end: 0 } which signifies "Whole Component"
                const hasWholeSelection = ranges.some(r => r.start === 0 && r.end === 0);

                // If "Whole" is selected, we force elevation_required = false, regardless of visual split state.
                // If NOT "Whole", but we have other ranges, then elevation_required = true.
                const isSplitLogic = !hasWholeSelection && ranges.length > 0;

                // Construct elevation data
                let elevationData: any[] = [];
                if (isSplitLogic) {
                    // Store strict ranges
                    elevationData = ranges.map(r => ({
                        elevation: `${r.start.toFixed(1)}m - ${r.end.toFixed(1)}m`,
                        start: r.start,
                        end: r.end,
                        status: "pending",
                        inspection_count: 0
                    }));
                } else {
                    elevationData = [];
                }

                const existingItem = sowItems.find(
                    item => item.component_id === componentId &&
                        item.inspection_type_id === inspectionTypeId &&
                        (item.report_number === reportNumber || (item.report_number == null && reportNumber == null))
                );

                // API Call to Upsert Item
                const itemResponse = await fetch("/api/sow/items", {
                    method: existingItem ? "POST" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...(existingItem ? { id: existingItem.id } : {
                            sow_id: sowId,
                            component_id: componentId,
                            inspection_type_id: inspectionTypeId,
                        }),
                        component_qid: component.qid,
                        component_type: component.type,
                        inspection_code: inspection.code,
                        inspection_name: inspection.name,
                        elevation_required: isSplitLogic,
                        elevation_data: elevationData,
                        status: existingItem ? existingItem.status : "pending",
                        report_number: reportNumber
                    }),
                });

                if (!itemResponse.ok) {
                    console.error(`Failed to save item: ${groupKey}`);
                    throw new Error(`Failed to save item for component ${component.qid}`);
                }
            }

            // Step 4: Remove items that are no longer selected at all
            // If a component-type pair (for a specific report) is NOT in groupedSelections, it should be deleted.
            for (const item of sowItems) {
                const rpt = item.report_number || 'null';
                const groupKey = `${rpt}:${item.component_id}:${item.inspection_type_id}`;
                if (!groupedSelections[groupKey]) {
                    await fetch(`/api/sow/items?id=${item.id}`, {
                        method: "DELETE",
                    });
                }
            }

            await loadSOW(); // Reload to get fresh IDs

            if (onSave) {
                onSave();
            }

            alert("SOW saved successfully!");
        } catch (error) {
            console.error("Error saving SOW:", error);
            alert("Error saving SOW. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const filteredSowItems = sowItems.filter(i => (i.report_number || 'null') === (activeReportNumber || 'null'));

    const stats = {
        total: filteredSowItems.length,
        completed: filteredSowItems.filter((i) => i.status === "completed").length,
        incomplete: filteredSowItems.filter((i) => i.status === "incomplete").length,
        pending: filteredSowItems.filter((i) => i.status === "pending").length,
    };

    const filteredComponents = components.filter(comp => {
        if (!componentSearch) return !selectedComponents.has(comp.id);
        const search = componentSearch.toLowerCase();
        return (
            !selectedComponents.has(comp.id) &&
            ((comp.qid?.toLowerCase().includes(search)) || (comp.type?.toLowerCase().includes(search)))
        );
    });

    const selectedComponentsList = Array.from(selectedComponents)
        .map(id => components.find(c => c.id === id))
        .filter(Boolean);

    // Filter selected components based on search
    const filteredSelectedComponents = selectedComponentsList.filter(c =>
        !selectedComponentSearch ||
        c!.qid.toLowerCase().includes(selectedComponentSearch.toLowerCase()) ||
        c!.type.toLowerCase().includes(selectedComponentSearch.toLowerCase())
    );





    // Debug logging
    console.log("SOW Dialog Debug:", {
        totalComponents: components.length,
        selectedCount: selectedComponents.size,
        filteredCount: filteredComponents.length,
        components: components.slice(0, 3), // First 3 for debugging
    });

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[95vw] max-h-[96vh] w-[95vw] h-[96vh] flex flex-col p-0 bg-[#f8fafc] overflow-hidden rounded-[20px] shadow-2xl border-none outline-none ring-0">
                    <DialogHeader className="px-8 py-6 bg-white border-b border-slate-100 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <span className="w-fit px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 text-[10px] font-bold uppercase tracking-widest text-blue-600 border border-blue-100">
                                    WORK SCOPE • DEFINED STRUCTURES
                                </span>
                                <div className="flex items-center gap-3 mt-1">
                                    {availableStructures && availableStructures.length > 1 ? (
                                        <div className="group relative">
                                            <DialogTitle className="sr-only">Scope of Work</DialogTitle>
                                            <Select
                                                value={`${structure.type}-${structure.id}`}
                                                onValueChange={(value) => {
                                                    const [type, idStr] = value.split("-");
                                                    const newStruct = availableStructures.find(s => s.id === Number(idStr) && s.type === type);
                                                    if (newStruct && onSwitchStructure) {
                                                        onSwitchStructure(newStruct);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-fit h-auto p-0 border-none shadow-none font-bold text-3xl text-slate-900 bg-transparent hover:text-blue-600 transition-colors gap-3 focus:ring-0">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                                            <ShieldCheck className="h-6 w-6 text-white" />
                                                        </div>
                                                        <SelectValue placeholder="Select Structure" />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent align="start" className="min-w-[300px] p-2 rounded-xl shadow-xl border-slate-100">
                                                    {availableStructures.map(s => (
                                                        <SelectItem key={`${s.type}-${s.id}`} value={`${s.type}-${s.id}`} className="font-semibold text-base py-3 rounded-lg focus:bg-slate-50">
                                                            {s.title} <span className="text-slate-400 text-xs ml-2 font-normal uppercase tracking-wider">{s.type}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <DialogTitle className="flex items-center gap-3 text-3xl font-bold text-slate-900">
                                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                                <ShieldCheck className="h-6 w-6 text-white" />
                                            </div>
                                            {structure.title}
                                        </DialogTitle>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right px-4 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Job Pack Reference</div>
                                    <div className="text-sm font-bold text-slate-700 font-mono">{jobpackTitle || `ID: ${jobpackId}`}</div>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex items-center justify-center h-full bg-[#f8fafc]">
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative">
                                    <div className="h-16 w-16 rounded-full border-4 border-slate-100"></div>
                                    <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                                </div>
                                <span className="text-slate-500 font-medium animate-pulse tracking-wide uppercase text-xs">Loading Scope Configuration...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden p-8 gap-8">

                            {/* Report Numbers & Stats Row */}
                            {/* Top Controls Row: Reports & Stats Compacted */}
                            <div className="flex items-stretch gap-4 shrink-0 h-[100px]">
                                {/* Report Numbers Card */}
                                <div className="flex-[2] bg-white rounded-2xl shadow-sm border border-slate-100 p-3 flex flex-col justify-between overflow-hidden">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5 text-blue-500" />
                                            Report References
                                        </label>
                                        {reportNumbers.length > 0 && (
                                            <Badge variant="secondary" className="text-[9px] h-5 px-1.5 font-semibold bg-slate-50 text-slate-500">
                                                {reportNumbers.length} ACTIVE
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex gap-2 mb-2">
                                        <div className="relative flex-1 group/input">
                                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 text-xs font-mono">#</span>
                                            <Input
                                                placeholder="Report No..."
                                                value={reportInput}
                                                onChange={(e) => setReportInput(e.target.value)}
                                                className="pl-6 h-8 text-xs rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 transition-all font-medium placeholder:text-slate-400"
                                                onKeyDown={(e) => e.key === "Enter" && handleAddReportNumber()}
                                            />
                                        </div>
                                        <Input
                                            placeholder="Contr. Ref"
                                            value={contractorRefInput}
                                            onChange={(e) => setContractorRefInput(e.target.value)}
                                            className="w-24 h-8 text-xs rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400"
                                            onKeyDown={(e) => e.key === "Enter" && handleAddReportNumber()}
                                        />
                                        <Button
                                            onClick={handleAddReportNumber}
                                            size="icon"
                                            className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 shadow-sm text-white border-0 shrink-0"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                                        {reportNumbers.length === 0 ? (
                                            <span className="text-[10px] text-slate-400 italic pl-1">No reports added.</span>
                                        ) : (
                                            reportNumbers.map((report, index) => (
                                                <div
                                                    key={index}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-all whitespace-nowrap cursor-pointer ${activeReportNumber === report.number
                                                        ? "bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-500/10"
                                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-200"
                                                        }`}
                                                    onClick={() => setActiveReportNumber(report.number)}
                                                >
                                                    <span>{report.number}</span>
                                                    {report.contractor_ref && <span className="text-slate-400 border-l border-slate-200 pl-1 ml-0.5">{report.contractor_ref}</span>}
                                                    <X
                                                        className="h-3 w-3 text-slate-300 hover:text-rose-500 cursor-pointer ml-1"
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveReportNumber(index); }}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Stats Panel - Compact Horizontal */}
                                {/* Stats Panel - Compact Horizontal Row */}
                                <div className="flex-[2] flex items-center gap-2 h-full">
                                    {[
                                        { label: "Selected", value: stats.total, color: "text-slate-700", bg: "bg-white", border: "border-slate-200", icon: Filter },
                                        { label: "Pending", value: stats.pending, color: "text-blue-600", bg: "bg-blue-50/30", border: "border-blue-100", icon: Clock },
                                        { label: "Incomplete", value: stats.incomplete, color: "text-rose-600", bg: "bg-rose-50/30", border: "border-rose-100", icon: XCircle },
                                        { label: "Done", value: stats.completed, color: "text-emerald-600", bg: "bg-emerald-50/30", border: "border-emerald-100", icon: CheckCircle2 }
                                    ].map((stat, i) => (
                                        <div key={i} className={`flex-1 min-w-0 ${stat.bg} px-2 py-2 rounded-xl border ${stat.border} flex flex-col justify-center h-full`}>
                                            <div className="flex justify-between items-center w-full mb-0.5">
                                                <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider truncate">{stat.label}</span>
                                                <stat.icon className="h-2.5 w-2.5 text-slate-400 opacity-50 flex-shrink-0" />
                                            </div>
                                            <div className={`text-lg font-bold leading-none ${stat.color} truncate`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 flex gap-6 min-h-0">
                                {/* Left Panel: Component Selection */}
                                <div className="w-[380px] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden shrink-0">
                                    <div className="p-5 border-b border-slate-50 relative bg-white z-10">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-extrabold text-slate-800 text-sm tracking-wide bg-slate-50 px-3 py-1 rounded-full border border-slate-100 flex items-center gap-2">
                                                <Layers className="h-3.5 w-3.5 text-slate-500" />
                                                AVAILABLE COMPONENTS
                                            </h3>
                                            <Badge variant="secondary" className="rounded-md bg-blue-50 text-blue-600 font-bold border-blue-100 text-[10px] px-2">
                                                {components.length} TOTAL
                                            </Badge>
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                            </div>
                                            <Input
                                                placeholder="Search by QID or Type..."
                                                value={componentSearch}
                                                onChange={(e) => setComponentSearch(e.target.value)}
                                                className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/50">
                                        {filteredComponents.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                                                <div className="bg-white h-16 w-16 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                                                    <Search className="h-6 w-6 text-slate-300" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-600">No components found</p>
                                                <p className="text-xs text-slate-400 mt-1 max-w-[180px]">Try adjusting your search terms or checking the filters</p>
                                            </div>
                                        ) : (
                                            filteredComponents.map((comp, idx) => (
                                                <div
                                                    key={comp.id}
                                                    className="group relative bg-white p-3 rounded-lg border border-slate-100 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all duration-200 flex flex-col gap-1"
                                                    onClick={() => handleAddComponent(comp.id)}
                                                >
                                                    <div className="absolute top-4 right-4 h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-sm">
                                                        <Plus className="h-5 w-5" />
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded bg-slate-50 flex items-center justify-center font-bold text-[10px] text-slate-400 font-mono border border-slate-100 shrink-0">
                                                            {idx + 1}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                                                <div className="font-bold text-sm text-slate-800 group-hover:text-blue-700 transition-colors whitespace-nowrap">
                                                                    {comp.qid}
                                                                </div>
                                                                <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap">
                                                                    {comp.type}
                                                                </div>

                                                                {(comp.s_node || comp.f_node) && (
                                                                    <div className="flex items-center gap-1 text-[9px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap">
                                                                        <span className="text-slate-400">N:</span>
                                                                        {comp.s_node || '?'} <span className="text-slate-300">→</span> {comp.f_node || '?'}
                                                                    </div>
                                                                )}
                                                                {(comp.s_leg || comp.f_leg) && (
                                                                    <div className="flex items-center gap-1 text-[9px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap">
                                                                        <span className="text-slate-400">L:</span>
                                                                        {comp.s_leg || '?'} <span className="text-slate-300">→</span> {comp.f_leg || '?'}
                                                                    </div>
                                                                )}

                                                                {comp.elv_1 !== undefined && (
                                                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500 whitespace-nowrap ml-auto mr-6">
                                                                        {comp.elv_1}m {comp.elv_2 !== undefined ? `- ${comp.elv_2}m` : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                {/* Right Panel: Matrix with Vertical Headers */}
                                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                    {/* Elevation Split Toggle and Controls */}
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center gap-4">
                                        <div className="flex flex-col">
                                            <div className="text-sm font-bold text-slate-800 tracking-wide uppercase flex items-center gap-2">
                                                <Settings2 className="h-4 w-4 text-blue-500" />
                                                Scope Matrix
                                            </div>
                                        </div>

                                        {/* Selected Components Search */}
                                        {selectedComponentsList.length > 0 && (
                                            <div className="relative group max-w-[200px] w-full">
                                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                                    <Search className="h-3 w-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                                </div>
                                                <Input
                                                    placeholder="Filter Matrix..."
                                                    value={selectedComponentSearch}
                                                    onChange={(e) => setSelectedComponentSearch(e.target.value)}
                                                    className="pl-8 h-8 rounded-lg bg-white border-slate-200 text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {selectedComponentsList.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-slate-300 bg-slate-50/20">
                                            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl">
                                                <Layers className="h-16 w-16 mx-auto mb-4 opacity-50 text-slate-400" />
                                                <p className="text-lg font-bold text-slate-600">No components selected</p>
                                                <p className="text-sm mt-2 text-slate-400">Select components from the left panel to build your matrix</p>
                                            </div>
                                        </div>
                                    ) : filteredInspectionTypes.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-slate-300 bg-slate-50/20">
                                            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl">
                                                <Filter className="h-16 w-16 mx-auto mb-4 opacity-50 text-rose-300" />
                                                <p className="text-lg font-bold text-slate-600">No applicable SOW types</p>
                                                <p className="text-sm mt-2 text-slate-400">There are no valid inspection types available for this structure.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-auto custom-scrollbar">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                                                    <tr>
                                                        <th className="p-2 text-left font-bold text-slate-600 border-r border-b border-slate-200 w-[240px] sticky left-0 bg-slate-50 z-30 shadow-[4px_0_16px_-4px_rgba(0,0,0,0.05)]">
                                                            Component Details
                                                        </th>
                                                        {filteredInspectionTypes.map((inspection) => (
                                                            <th key={inspection.id} className="p-1 border-b border-slate-200 min-w-[50px] relative group hover:bg-blue-50/50 transition-colors bg-slate-50">
                                                                <div className="writing-mode-vertical text-[10px] uppercase font-bold text-slate-500 whitespace-normal leading-snug transform rotate-180 py-2 h-32 w-full flex items-center justify-center text-center tracking-wider" style={{ writingMode: 'vertical-rl' }} title={`${inspection.code} - ${inspection.name}`}>
                                                                    {inspection.name}
                                                                </div>
                                                                <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredSelectedComponents.map((component) => {
                                                        // Check if split is enabled for this specific component
                                                        const isSplit = componentSplitByElevation[component!.id];

                                                        // Calculate ranges if split is enabled for this component
                                                        let componentRanges: Array<{ start: number; end: number }> = [];
                                                        const breakpoints = componentBreakpoints[component!.id] || [];

                                                        // Ensure strict number parsing
                                                        const cElv1 = typeof component!.elv_1 === 'string' ? parseFloat(component!.elv_1) : component!.elv_1 ?? 0;
                                                        const cElv2 = typeof component!.elv_2 === 'string' ? parseFloat(component!.elv_2) : component!.elv_2 ?? 0;

                                                        if (isSplit && component!.elv_1 != null && component!.elv_2 != null) {
                                                            const minElv = Math.min(cElv1, cElv2);
                                                            const maxElv = Math.max(cElv1, cElv2);

                                                            const relevantBreakpoints = breakpoints
                                                                .filter(elv => elv > minElv && elv < maxElv)
                                                                .sort((a, b) => a - b);

                                                            const allPoints = [minElv, ...relevantBreakpoints, maxElv];

                                                            // Create ranges from bottom to top (min -> max)
                                                            for (let i = 0; i < allPoints.length - 1; i++) {
                                                                componentRanges.push({ start: allPoints[i], end: allPoints[i + 1] });
                                                            }

                                                            // Reverse to show higher elevations at the top of the table (Start with Top, End with Bottom)?
                                                            // USER REQUEST: "list ... from elevation -2 to -29... like from bottom to top"
                                                            // Interpreted as: Visual order should match physical structure (Top of leg at top of list).
                                                            // Current: [-29, -24] (Bottom segment) is first.
                                                            // Desired: [-7, -2] (Top segment) should be first?
                                                            // "elevation -2 to -29" -> Start at -2 (Top) go down to -29 (Bottom).
                                                            componentRanges.reverse();
                                                        }

                                                        // If no valid split ranges or split is disabled, use single full range
                                                        if (componentRanges.length === 0) {
                                                            componentRanges = [{ start: cElv1, end: cElv2 }];
                                                        }

                                                        // We render a MAIN ROW for the "Whole Component" always.
                                                        // Then if split, we render the split rows below.

                                                        // "Whole Component" range is visually 0m or just "Whole"
                                                        // Use 0-0 for logic key if we stick to existing convention, but visually show proper elevation.

                                                        const wholeComponentRange = { start: 0, end: 0 };
                                                        const cElv1Str = typeof component!.elv_1 === 'string' ? parseFloat(component!.elv_1) : component!.elv_1;
                                                        const cElv2Str = typeof component!.elv_2 === 'string' ? parseFloat(component!.elv_2) : component!.elv_2;
                                                        const minElv = Math.min(cElv1Str || 0, cElv2Str || 0);
                                                        const maxElv = Math.max(cElv1Str || 0, cElv2Str || 0);

                                                        return (
                                                            <React.Fragment key={component!.id}>
                                                                {/* MAIN ROW: Represents the "Whole Component" scope */}
                                                                <tr className="border-b border-slate-100 hover:bg-slate-50 group/row transition-colors">
                                                                    <td className="p-4 border-r border-slate-100 sticky left-0 bg-white group-hover/row:bg-slate-50 z-10 w-[240px] align-top shadow-[4px_0_16px_-4px_rgba(0,0,0,0.05)]">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="font-bold text-sm truncate" title={component!.qid || ''}>{component!.qid}</div>
                                                                                    <button
                                                                                        onClick={() => handleRemoveComponent(component!.id)}
                                                                                        className="text-red-600 hover:text-red-700 flex-shrink-0"
                                                                                        title="Remove component"
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </button>
                                                                                </div>
                                                                                <div className="text-xs text-gray-500 truncate" title={component!.type || ''}>{component!.type}</div>
                                                                                <div className="text-xs text-gray-700 font-medium whitespace-nowrap mt-1 flex items-center gap-2">
                                                                                    {minElv.toFixed(1)}m - {maxElv.toFixed(1)}m

                                                                                    {/* Split Toggle */}
                                                                                    {component!.elv_1 != null && component!.elv_2 != null && (
                                                                                        <div className="flex items-center gap-1.5 ml-auto">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                id={`split-${component!.id}`}
                                                                                                checked={!!componentSplitByElevation[component!.id]}
                                                                                                onChange={(e) => {
                                                                                                    setComponentSplitByElevation(prev => ({
                                                                                                        ...prev,
                                                                                                        [component!.id]: e.target.checked
                                                                                                    }));
                                                                                                }}
                                                                                                className="h-3 w-3 cursor-pointer accent-blue-600 rounded"
                                                                                            />
                                                                                            <label htmlFor={`split-${component!.id}`} className="text-[10px] font-medium text-slate-500 cursor-pointer select-none">
                                                                                                Split
                                                                                            </label>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Configuration Controls (Only if split is enabled) */}
                                                                                {isSplit && (
                                                                                    <div className="mt-1.5 pl-2 border-l-2 border-blue-100 flex flex-col gap-1.5 animate-in slide-in-from-left-2 duration-200">
                                                                                        {/* Inputs Row */}
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <div className="flex items-center relative flex-1 min-w-[70px]">
                                                                                                <input
                                                                                                    type="number"
                                                                                                    step="0.1"
                                                                                                    placeholder="Split..."
                                                                                                    className="w-full h-6 text-[10px] pl-1.5 pr-4 border border-slate-200 rounded text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-0 transition-colors placeholder:text-slate-400"
                                                                                                    value={newElevationInput[component!.id] || ''}
                                                                                                    onChange={(e) => setNewElevationInput(prev => ({
                                                                                                        ...prev,
                                                                                                        [component!.id]: e.target.value
                                                                                                    }))}
                                                                                                    onKeyPress={(e) => {
                                                                                                        if (e.key === 'Enter') {
                                                                                                            handleAddComponentBreakpoint(component!.id, parseFloat(newElevationInput[component!.id]));
                                                                                                            setNewElevationInput(prev => ({ ...prev, [component!.id]: '' }));
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                                <Plus
                                                                                                    className="h-3 w-3 text-blue-400 absolute right-1 cursor-pointer hover:text-blue-600"
                                                                                                    onClick={() => {
                                                                                                        handleAddComponentBreakpoint(component!.id, parseFloat(newElevationInput[component!.id]));
                                                                                                        setNewElevationInput(prev => ({ ...prev, [component!.id]: '' }));
                                                                                                    }}
                                                                                                />
                                                                                            </div>

                                                                                            <div className="flex items-center relative flex-1 min-w-[70px]">
                                                                                                <input
                                                                                                    type="number"
                                                                                                    step="0.1"
                                                                                                    placeholder="Interval..."
                                                                                                    className="w-full h-6 text-[10px] pl-1.5 pr-5 border border-slate-200 rounded text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-0 transition-colors placeholder:text-slate-400"
                                                                                                    value={autoSplitIntervals[component!.id] || ''}
                                                                                                    onChange={(e) => setAutoSplitIntervals(prev => ({
                                                                                                        ...prev,
                                                                                                        [component!.id]: e.target.value
                                                                                                    }))}
                                                                                                    onKeyPress={(e) => {
                                                                                                        if (e.key === 'Enter') {
                                                                                                            const interval = parseFloat(autoSplitIntervals[component!.id]);
                                                                                                            if (!isNaN(interval) && interval > 0) {
                                                                                                                const newPoints: number[] = [];
                                                                                                                if (interval > 0.001 && maxElv > minElv) {
                                                                                                                    for (let val = minElv + interval; val < maxElv; val += interval) {
                                                                                                                        newPoints.push(Math.round(val * 10) / 10);
                                                                                                                    }
                                                                                                                }
                                                                                                                setComponentBreakpoints(prev => ({
                                                                                                                    ...prev,
                                                                                                                    [component!.id]: newPoints.sort((a, b) => a - b)
                                                                                                                }));
                                                                                                                setAutoSplitIntervals(prev => ({ ...prev, [component!.id]: '' }));
                                                                                                            }
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        const interval = parseFloat(autoSplitIntervals[component!.id]);
                                                                                                        if (!isNaN(interval) && interval > 0) {
                                                                                                            const newPoints: number[] = [];
                                                                                                            if (interval > 0.001 && maxElv > minElv) {
                                                                                                                for (let val = minElv + interval; val < maxElv; val += interval) {
                                                                                                                    newPoints.push(Math.round(val * 10) / 10);
                                                                                                                }
                                                                                                            }
                                                                                                            setComponentBreakpoints(prev => ({
                                                                                                                ...prev,
                                                                                                                [component!.id]: newPoints.sort((a, b) => a - b)
                                                                                                            }));
                                                                                                            setAutoSplitIntervals(prev => ({ ...prev, [component!.id]: '' }));
                                                                                                        }
                                                                                                    }}
                                                                                                    className="absolute right-1 top-0.5 p-1 hover:bg-slate-100 rounded"
                                                                                                >
                                                                                                    <Columns className="h-3 w-3 text-purple-400 hover:text-purple-600" />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Existing Breakpoints List - Compact */}
                                                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                                                            {breakpoints.map((bp) => (
                                                                                                <span key={bp} className="inline-flex items-center text-[10px] bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded px-1 border border-slate-200 cursor-pointer group/bp transition-colors"
                                                                                                    onClick={() => handleRemoveComponentBreakpoint(component!.id, bp)}
                                                                                                    title="Click to remove"
                                                                                                >
                                                                                                    {bp}m
                                                                                                    <X className="h-2 w-2 ml-0.5 opacity-0 group-hover/bp:opacity-100" />
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                </td>
                                                                {filteredInspectionTypes.map((inspection) => (
                                                                    <td key={inspection.id} className="p-2 border-r text-center align-top pt-4 bg-gray-50/30">
                                                                        <div className="flex justify-center items-center gap-2" title="Select for WHOLE component">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="h-4 w-4 rounded border-gray-400 text-blue-800 focus:ring-blue-500"
                                                                                checked={isSelected(component!.id, inspection.id, 0, 0)}
                                                                                onChange={() => toggleSelection(component!.id, inspection.id, 0, 0)}
                                                                            />
                                                                            {isSelected(component!.id, inspection.id, 0, 0) && (
                                                                                <div title={getItemStatus(component!.id, inspection.id, 0, 0)}>
                                                                                    {getStatusIcon(getItemStatus(component!.id, inspection.id, 0, 0))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                ))}
                                                            </tr>

                                                                {/* SPLIT ROWS: Only if split is enabled */ }
                                                        {
                                                            isSplit && componentRanges.map((range, idx) => (
                                                                <tr key={`${component!.id}-split-${idx}`} className="border-b hover:bg-slate-50/50">
                                                                    <td className="p-2 border-r border-slate-100 bg-white sticky left-0 z-10 w-[300px] pl-8 text-xs text-slate-500 font-mono border-l-4 border-l-blue-100">
                                                                        {range.start.toFixed(1)}m - {range.end.toFixed(1)}m
                                                                    </td>
                                                                    {filteredInspectionTypes.map((inspection) => {
                                                                        const isWholeSelected = isSelected(component!.id, inspection.id, 0, 0);
                                                                        return (
                                                                            <td key={inspection.id} className="p-2 border-r border-slate-100 text-center bg-white">
                                                                                <div className="flex justify-center items-center gap-2">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        className="h-3 w-3 rounded border-gray-300 text-blue-500 focus:ring-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                        checked={isSelected(component!.id, inspection.id, range.start, range.end)}
                                                                                        onChange={() => toggleSelection(component!.id, inspection.id, range.start, range.end)}
                                                                                        disabled={isWholeSelected}
                                                                                    />
                                                                                    {isSelected(component!.id, inspection.id, range.start, range.end) && (
                                                                                        <div title={getItemStatus(component!.id, inspection.id, range.start, range.end)}>
                                                                                            {getStatusIcon(getItemStatus(component!.id, inspection.id, range.start, range.end))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        )
                                                                    })}
                                                                </tr>
                                                            ))
                                                        }


                </React.Fragment >
                                                );
        })}
                                            </tbody >
                                        </table >
</div >
)}
                            </div >
                        </div >

    {/* Actions */}
                    < div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2" >
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || filteredInspectionTypes.length === 0 || reportNumbers.length === 0}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-200 disabled:opacity-50 disabled:shadow-none min-w-[120px]"
                        >
                            {saving ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Save Configuration
                                </>
                            )}
                        </Button>
                    </div >
                </div >
)}
            </DialogContent >
        </Dialog >

            <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Initialize Scope for {pendingReportToAdd?.number}</DialogTitle>
                        <DialogDescription>
                            How would you like to initialize the scope for this new report?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-4">
                        <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => handleConfirmCopyScope('empty')}
                        >
                            Start with Empty Scope
                        </Button>

                        {reportNumbers.length > 0 && (
                            <>
                                <div className="text-sm font-medium pt-2">Copy from existing reports:</div>
                                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                                    {reportNumbers.map(s => (
                                        <div key={s.number} className="flex gap-2 items-center border p-2 rounded hover:bg-gray-50">
                                            <span className="text-sm font-medium w-24 truncate" title={s.number}>{s.number}</span>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => handleConfirmCopyScope('copy', s.number)}
                                            >
                                                Copy All
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => handleConfirmCopyScope('copy_pending', s.number)}
                                            >
                                                Copy Pending
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
</>
);
}
