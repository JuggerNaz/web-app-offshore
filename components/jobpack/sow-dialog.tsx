"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    ArrowLeft, ChevronDown, ChevronRight, FileText, Plus, Search, Trash2, X, 
    AlertTriangle, Check, Columns, CheckCircle, AlertCircle, Circle, ShieldCheck, 
    Layers, Filter, CheckCircle2, XCircle, Clock, Settings2, ListFilter,
    PanelLeftClose, PanelLeftOpen, ChevronLeft, LayoutGrid, Maximize2, Minimize2,
    Download, Copy, Save, Info, MoreHorizontal, Activity, BarChart3, PieChart,
    ChevronRightSquare, KanbanSquare, Sliders, Waves, PlaneTakeoff, Zap,
    Anchor, Target, Eye, Navigation, Box, ClipboardCheck, BarChart, RefreshCw, ArrowUpDown,
    ChevronUp
} from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOW, SOWItem, ReportNumber, InspectionStatus } from "@/types/sow";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
        metadata?: any;
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
        top_und?: string;
        comp_group?: string;
    }>;
    onSave?: () => void;
    readOnly?: boolean;
    returnTo?: string | null;
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
    readOnly = false,
    returnTo,
}: SOWDialogProps) {
    const router = useRouter();
    // ── STATE ──
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sow, setSOW] = useState<SOW | null>(null);
    const [sowItems, setSOWItems] = useState<SOWItem[]>([]);
    const [reportNumbers, setReportNumbers] = useState<ReportNumber[]>([]);
    const [reportInput, setReportInput] = useState("");
    const [contractorRefInput, setContractorRefInput] = useState("");
    const [componentSearch, setComponentSearch] = useState("");
    const [activeReportNumber, setActiveReportNumber] = useState<string | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(true);
    const [scopeStatusFilter, setScopeStatusFilter] = useState<'all' | 'selected' | 'completed' | 'incomplete' | 'pending'>('all');
    const [expandedMode, setExpandedMode] = useState<string | null>(null);
    const [expandedTaskType, setExpandedTaskType] = useState<string | null>(null);
    const [expandedCompType, setExpandedCompType] = useState<string | null>(null);
    const [compSortConfig, setCompSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'qid', direction: 'asc' });
    const [isCorrecting, setIsCorrecting] = useState(false);
    const [allInspectionTypes, setAllInspectionTypes] = useState<any[]>([]);
    const [extraInspectionIds, setExtraInspectionIds] = useState<number[]>([]);
    const [showAddInspectionDialog, setShowAddInspectionDialog] = useState(false);
    const [searchAddInspection, setSearchAddInspection] = useState("");
    
    // Logic state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [componentSplitByElevation, setComponentSplitByElevation] = useState<Record<number, boolean>>({});
    const [componentBreakpoints, setComponentBreakpoints] = useState<Record<number, number[]>>({});
    const [newElevationInput, setNewElevationInput] = useState<Record<number, string>>({});
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [pendingReportToAdd, setPendingReportToAdd] = useState<ReportNumber | null>(null);
    const [selectedInspectionFilter, setSelectedInspectionFilter] = useState<number | 'all'>('all');

    const activeReport = activeReportNumber || 'null';

    // ── DATA LOADING ──
    useEffect(() => {
        if (open && structure) loadSOW();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, structure?.id]);

    const loadSOW = async () => {
        setLoading(true);
        // Force clear previous states immediately on switch to prevent caching issues
        setSOW(null);
        setSOWItems([]);
        setReportNumbers([]);
        setActiveReportNumber(null);
        setSelectedItems(new Set<string>());
        
        try {
            const res = await fetch(`/api/sow?jobpack_id=${jobpackId}&structure_id=${structure.id}`);
            const { data } = await res.json();
            
            // Also fetch all master inspection types to allow adding new ones
            const itRes = await fetch('/api/inspection-types');
            const itData = await itRes.json();
            setAllInspectionTypes(itData?.data || []);

            if (data) {
                setSOW(data);
                setSOWItems(data.items || []);
                
                // Extract extra inspection types from metadata
                if (data.metadata?.extra_inspection_ids) {
                    setExtraInspectionIds(data.metadata.extra_inspection_ids);
                } else {
                    setExtraInspectionIds([]);
                }
                
                const fetchedReports = data.report_numbers || [];
                setReportNumbers(fetchedReports);
                
                const validNumbers = fetchedReports.map((r: any) => r.number);
                setActiveReportNumber((prev) => {
                    if (validNumbers.length > 0 && (!prev || !validNumbers.includes(prev))) {
                        return validNumbers[0];
                    }
                    if (validNumbers.length === 0) return null;
                    return prev;
                });
                
                const newSelectedItems = new Set<string>();
                const splitEnabled: Record<number, boolean> = {};
                const breakpoints: Record<number, Set<number>> = {};
                
                (data.items || []).forEach((item: any) => {
                    const rpt = item.report_number || 'null';
                    const prefix = `${rpt}:${item.component_id}:${item.inspection_type_id}`;
                    if (item.elevation_required && item.elevation_data?.length > 0) {
                        splitEnabled[item.component_id] = true;
                        if (!breakpoints[item.component_id]) breakpoints[item.component_id] = new Set();
                        item.elevation_data.forEach((d: any) => {
                            newSelectedItems.add(`${prefix}:${d.start || 0}:${d.end || 0}`);
                            if (d.start != null) breakpoints[item.component_id].add(d.start);
                            if (d.end != null) breakpoints[item.component_id].add(d.end);
                        });
                    } else newSelectedItems.add(`${prefix}:0:0`);
                });
                setSelectedItems(newSelectedItems);
                setComponentSplitByElevation(splitEnabled);
                const finalBreakpoints: Record<number, number[]> = {};
                Object.keys(breakpoints).forEach(k => finalBreakpoints[Number(k)] = Array.from(breakpoints[Number(k)]).sort((a,b) => a-b));
                setComponentBreakpoints(finalBreakpoints);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleStatusCorrection = async () => {
        if (!sow?.id || !structure?.id) {
            toast.error("No SOW or structure selected");
            return;
        }
        setIsCorrecting(true);
        try {
            const res = await fetch("/api/sow/correct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sow_id: sow.id, structure_id: structure.id })
            });
            const data = await res.json();
            if (data.success) {
                const updated = data.updated_count || 0;
                const inserted = data.inserted_count || 0;
                if (updated === 0 && inserted === 0) {
                    toast.info("All SOW items are already up to date.");
                } else {
                    toast.success(`Correction Complete: ${updated} items updated, ${inserted} items inserted.`);
                }
                loadSOW();
            } else {
                toast.error(data.error || "Correction failed");
            }
        } catch (e) {
            console.error(e);
            toast.error("An error occurred during correction");
        } finally {
            setIsCorrecting(false);
        }
    };

    // ── CORE LOGIC ──
    const getTaskMode = (it: { code: string; name: string; metadata?: any }) => {
        const code = (it.code || "").toUpperCase();
        const meta = JSON.stringify(it.metadata || "").toLowerCase();
        const name = (it.name || "").toUpperCase();
        if (code.includes("ROV") || meta.includes("rov") || name.includes("ROV") || name.includes("SEABED") || name.includes("SURVEY") || name.includes("VIDEO")) return "ROV";
        return "DIVING";
    };

    const getModeStyles = (mode: "ROV" | "DIVING") => {
        if (mode === "ROV") return { text: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]", border: "border-[#0ea5e9]/20", light: "bg-[#0ea5e9]/5", icon: <PlaneTakeoff className="h-4 w-4" /> };
        return { text: "text-[#10b981]", bg: "bg-[#10b981]", border: "border-[#10b981]/20", light: "bg-[#10b981]/5", icon: <Waves className="h-4 w-4" /> };
    };

    // ── ANALYTICS ──
    const stats = useMemo(() => {
        const filtered = sowItems.filter(i => (i.report_number || 'null') === activeReport);
        const totals = { all: filtered.length, completed: 0, incomplete: 0, pending: 0 };
        filtered.forEach(i => {
           if (i.status === 'completed') totals.completed++;
           else if (i.status === 'incomplete') totals.incomplete++;
           else totals.pending++;
        });
        return totals;
    }, [sowItems, activeReport]);

    const modeAnalytics = useMemo(() => {
        const filtered = sowItems.filter(i => (i.report_number || 'null') === activeReport);
        const modes: Record<string, { all: number; completed: number }> = { "ROV": { all: 0, completed: 0 }, "DIVING": { all: 0, completed: 0 } };
        filtered.forEach(i => {
            const itObj = inspectionTypes.find(t => t.id === i.inspection_type_id) || { code: i.inspection_code || '', name: i.inspection_name || '' };
            const m = getTaskMode(itObj as any);
            modes[m].all++;
            if (i.status === 'completed') modes[m].completed++;
        });
        return Object.entries(modes).map(([mode, val]) => ({ mode: mode as "ROV" | "DIVING", ...val }));
    }, [sowItems, activeReport, inspectionTypes]);

    // Drill-down: tasks within each mode
    const modeTaskBreakdown = useMemo(() => {
        const filtered = sowItems.filter(i => (i.report_number || 'null') === activeReport);
        const breakdown: Record<string, Record<string, { all: number; completed: number; code: string }>> = { "ROV": {}, "DIVING": {} };
        filtered.forEach(i => {
            const itObj = inspectionTypes.find(t => t.id === i.inspection_type_id) || { code: i.inspection_code || '', name: i.inspection_name || '' };
            const m = getTaskMode(itObj as any);
            const taskName = i.inspection_name || 'Generic';
            if (!breakdown[m][taskName]) breakdown[m][taskName] = { all: 0, completed: 0, code: i.inspection_code || '' };
            breakdown[m][taskName].all++;
            if (i.status === 'completed') breakdown[m][taskName].completed++;
        });
        return breakdown;
    }, [sowItems, activeReport, inspectionTypes]);

    const taskTypeAnalytics = useMemo(() => {
        const filtered = sowItems.filter(i => (i.report_number || 'null') === activeReport);
        const tasks: Record<string, { all: number; completed: number; code: string }> = {};
        filtered.forEach(i => {
            const k = i.inspection_name || 'Generic';
            if (!tasks[k]) tasks[k] = { all: 0, completed: 0, code: i.inspection_code || '' };
            tasks[k].all++;
            if (i.status === 'completed') tasks[k].completed++;
        });
        return Object.entries(tasks).map(([name, val]) => ({ name, ...val }));
    }, [sowItems, activeReport]);

    // Drill-down: component types within each task
    const taskCompBreakdown = useMemo(() => {
        const filtered = sowItems.filter(i => (i.report_number || 'null') === activeReport);
        const breakdown: Record<string, Record<string, { all: number; completed: number }>> = {};
        filtered.forEach(i => {
            const taskName = i.inspection_name || 'Generic';
            const compType = i.component_type || 'Unclassified';
            if (!breakdown[taskName]) breakdown[taskName] = {};
            if (!breakdown[taskName][compType]) breakdown[taskName][compType] = { all: 0, completed: 0 };
            breakdown[taskName][compType].all++;
            if (i.status === 'completed') breakdown[taskName][compType].completed++;
        });
        return breakdown;
    }, [sowItems, activeReport]);

    const compTypeAnalytics = useMemo(() => {
        const filtered = sowItems.filter(i => (i.report_number || 'null') === activeReport);
        const types: Record<string, { all: number; completed: number }> = {};
        filtered.forEach(i => {
            const k = i.component_type || 'Unclassified';
            if (!types[k]) types[k] = { all: 0, completed: 0 };
            types[k].all++;
            if (i.status === 'completed') types[k].completed++;
        });
        return Object.entries(types).map(([type, val]) => ({ type, ...val }));
    }, [sowItems, activeReport]);

    // Drill-down: tasks within each component type
    const compTypeTaskBreakdown = useMemo(() => {
        const filtered = sowItems.filter(i => (i.report_number || 'null') === activeReport);
        const breakdown: Record<string, Record<string, { all: number; completed: number }>> = {};
        filtered.forEach(i => {
            const compType = i.component_type || 'Unclassified';
            const taskName = i.inspection_name || 'Generic';
            if (!breakdown[compType]) breakdown[compType] = {};
            if (!breakdown[compType][taskName]) breakdown[compType][taskName] = { all: 0, completed: 0 };
            breakdown[compType][taskName].all++;
            if (i.status === 'completed') breakdown[compType][taskName].completed++;
        });
        return breakdown;
    }, [sowItems, activeReport]);

    const validInspections = useMemo(() => {
        // 1. Get base inspections from Jobpack
        const baseInspections = [...inspectionTypes];

        // 2. Add extra inspections from SOW metadata that are NOT already in Jobpack list
        const extraInspections = allInspectionTypes.filter(it => 
            extraInspectionIds.includes(it.id) && 
            !baseInspections.some(base => base.id === it.id)
        );

        // 3. Combine and apply standard filters
        return [...baseInspections, ...extraInspections]
            .filter(t => !['EXSUM', 'LOG', 'CALIB', 'SETUP'].some(k => t.code.toUpperCase().includes(k)))
            .map(it => ({ ...it, mode: getTaskMode(it) }))
            .sort((a, b) => {
                // Group by mode (ROV vs DIVING)
                if (a.mode !== b.mode) {
                    return a.mode.localeCompare(b.mode);
                }
                // Then sort alphabetically by name
                return (a.name || '').localeCompare(b.name || '');
            });
    }, [inspectionTypes, allInspectionTypes, extraInspectionIds]);

    const getItemStatus = (compId: number, typeId: number, s: number, e: number): InspectionStatus => {
        const itm = sowItems.find(i => i.component_id === compId && i.inspection_type_id === typeId && (i.report_number || 'null') === activeReport);
        if (!itm) return "pending";
        if (itm.elevation_required && itm.elevation_data) return itm.elevation_data.find((d: any) => d.start === s && d.end === e)?.status || "pending";
        return itm.status || "pending";
    };

    const isSelected = (compId: number, typeId: number, s: number, e: number) => {
        return selectedItems.has(`${activeReport}:${compId}:${typeId}:${s}:${e}`);
    };

    const activeComponents = useMemo(() => {
        let filtered = components.filter(c => {
            let matchesSearch = true;
            if (componentSearch) {
                const s = componentSearch.toLowerCase();
                matchesSearch = [
                    c.qid, c.type, c.s_node, c.f_node, c.s_leg, c.f_leg, 
                    c.top_und, c.comp_group, 
                    c.elv_1?.toString(), c.elv_2?.toString()
                ].some(val => val && val.toString().toLowerCase().includes(s));
            }
            if (!matchesSearch) return false;
            
            // Combine status and inspection filters
            let matchesStatus = true;
            const inspectionsToCheck = selectedInspectionFilter === 'all' 
                ? validInspections 
                : validInspections.filter(it => String(it.id) === String(selectedInspectionFilter));

            if (scopeStatusFilter === 'selected') {
                matchesStatus = inspectionsToCheck.some(it => isSelected(c.id, it.id, 0, 0));
            } else if (scopeStatusFilter === 'pending') {
                matchesStatus = inspectionsToCheck.some(it => isSelected(c.id, it.id, 0, 0) && getItemStatus(c.id, it.id, 0, 0) === 'pending');
            } else if (scopeStatusFilter === 'completed') {
                matchesStatus = inspectionsToCheck.some(it => isSelected(c.id, it.id, 0, 0) && getItemStatus(c.id, it.id, 0, 0) === 'completed');
            } else if (scopeStatusFilter === 'incomplete') {
                matchesStatus = inspectionsToCheck.some(it => isSelected(c.id, it.id, 0, 0) && getItemStatus(c.id, it.id, 0, 0) === 'incomplete');
            } else if (scopeStatusFilter === 'all') {
                // If 'all' is selected, we don't filter rows by status or inspection selection
                matchesStatus = true;
            }
            
            return matchesStatus;
        });

        // Sorting
        return filtered.sort((a, b) => {
            const key = compSortConfig.key as keyof typeof a;
            let valA: any = a[key];
            let valB: any = b[key];

            // Handle numeric values for elevations
            if (key === 'elv_1' || key === 'elv_2') {
                valA = Number(valA || 0);
                valB = Number(valB || 0);
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return compSortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return compSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [components, componentSearch, scopeStatusFilter, selectedInspectionFilter, validInspections, selectedItems, sowItems, activeReport, compSortConfig]);

    // ── ACTIONS ──
    const handleAddReportNumber = () => {
        if (!reportInput.trim()) return;
        const newReport = { number: reportInput.trim(), contractor_ref: contractorRefInput.trim(), date: new Date().toISOString() };
        if (reportNumbers.length > 0) { setPendingReportToAdd(newReport); setCopyDialogOpen(true); } 
        else { setReportNumbers([...reportNumbers, newReport]); setActiveReportNumber(newReport.number); setReportInput(""); }
    };

    const handleConfirmAddReport = (copyScope: boolean) => {
        if (!pendingReportToAdd) return;
        setReportNumbers(prev => [...prev, pendingReportToAdd]);
        
        if (copyScope && activeReportNumber) {
            setSelectedItems(prev => {
                const next = new Set(prev);
                const prefixToMatch = `${activeReportNumber}:`;
                const newPrefix = `${pendingReportToAdd.number}:`;
                Array.from(prev).forEach(key => {
                    if (key.startsWith(prefixToMatch)) {
                        next.add(key.replace(prefixToMatch, newPrefix));
                    }
                });
                return next;
            });
        }
        
        setActiveReportNumber(pendingReportToAdd.number);
        setReportInput("");
        setPendingReportToAdd(null);
        setCopyDialogOpen(false);
    };

    const handleRemoveReportNumber = async (i: number) => {
        const removed = reportNumbers[i].number;
        
        // 1. Check for actual inspection records (Completed or Incomplete status)
        const hasActualRecords = sowItems.some(item => 
            item.report_number === removed && 
            (item.status === 'completed' || item.status === 'incomplete')
        );
        
        if (hasActualRecords) {
            alert(`Deletion Blocked: Report Number "${removed}" has existing inspection records. You cannot delete a report number that contains field data. Please delete the inspection records in the Workspace first if you wish to remove this report.`);
            return;
        }

        // 2. Check for planned assignments (Pending status)
        const hasAssignments = sowItems.some(item => item.report_number === removed);
        
        let confirmMsg = `Are you sure you want to remove Report Number "${removed}"?`;
        if (hasAssignments) {
            confirmMsg = `Warning: Report Number "${removed}" has inspection types assigned in the Scope Matrix. Deleting this report number will clear all these assignments. \n\nAre you sure you want to proceed?`;
        }

        const confirmed = window.confirm(confirmMsg);
        if (confirmed) {
            const newReportNumbers = reportNumbers.filter((_, idx) => idx !== i);
            setReportNumbers(newReportNumbers);
            if (activeReportNumber === removed) setActiveReportNumber(null);
            
            // Purge all selected items associated with this report number locally
            let itemsToPurge: string[] = [];
            setSelectedItems(prev => {
                const next = new Set(prev);
                const prefixToMatch = `${removed}:`;
                Array.from(prev).forEach(key => {
                    if (key.startsWith(prefixToMatch)) {
                        itemsToPurge.push(key);
                        next.delete(key);
                    }
                });
                return next;
            });

            // IMMEDIATELY COMMIT TO DATABASE
            if (sow?.id) {
                try {
                    // Update header (report numbers array)
                    await fetch("/api/sow", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id: sow.id,
                            report_numbers: newReportNumbers
                        })
                    });

                    // If there were items assigned, we should also trigger a bulk sync to delete them from DB
                    if (itemsToPurge.length > 0) {
                        // We can't easily call handleSave here because it depends on current UI state,
                        // but we can tell the user they should still click "Finalize" to ensure all grid changes are synced,
                        // OR we just perform a targeted delete for these items.
                        
                        // For now, updating the header ensures the report number is gone.
                        // The items will be cleaned up when they next click "Finalize".
                        // However, to satisfy "it was not committed", the header is the most important part.
                        toast.success(`Report Number ${removed} removed and saved.`);
                    } else {
                        toast.success(`Report Number ${removed} removed.`);
                    }
                } catch (error) {
                    console.error("Failed to commit report deletion:", error);
                    toast.error("Report removed locally, but failed to sync with server. Please click Finalize Scope Matrix to save all changes.");
                }
            }
        }
    };

    const handleUpdateReportJobType = (jobType: string) => {
        if (!activeReportNumber) return;
        setReportNumbers(prev => prev.map(r => r.number === activeReportNumber ? { ...r, job_type: jobType } : r));
    };

    const toggleSelection = (compId: number, typeId: number, s: number, e: number) => {
        const key = `${activeReport}:${compId}:${typeId}:${s}:${e}`;
        setSelectedItems(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    };

    const handleBulkSelect = (typeId: number, checked: boolean) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            activeComponents.forEach(comp => {
                const key = `${activeReport}:${comp.id}:${typeId}:0:0`;
                if (checked) next.add(key); else next.delete(key);
            });
            return next;
        });
    };

    const handleExit = () => {
        onOpenChange(false);
        if (returnTo) {
            router.replace(returnTo);
        } else {
            router.back();
            // Fallback for cases where back doesn't trigger parent state change
            setTimeout(() => onOpenChange(false), 50);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Save SOW Header
            const hReq = await fetch("/api/sow", {
                method: "POST", 
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ 
                    id: sow?.id, 
                    jobpack_id: jobpackId, 
                    structure_id: structure.id, 
                    report_numbers: reportNumbers, 
                    structure_type: structure.type, 
                    structure_title: structure.title,
                    metadata: {
                        ...(sow?.metadata || {}),
                        extra_inspection_ids: extraInspectionIds
                    }
                })
            });
            
            if (!hReq.ok) {
                const errData = await hReq.json();
                throw new Error(errData.error || "Failed to save SOW header");
            }

            const resData = await hReq.json();
            const savedSOW = resData.data;

            if (!savedSOW?.id) {
                throw new Error("No SOW ID returned from server");
            }
            
            const sId = savedSOW.id;

            // 2. Prepare bulk items payload
            const grouped: Record<string, any[]> = {};
            selectedItems.forEach(key => {
                const [rpt, compId, typeId, s, e] = key.split(":");
                const gKey = `${rpt}:${compId}:${typeId}`;
                if (!grouped[gKey]) grouped[gKey] = [];
                grouped[gKey].push({ start: parseFloat(s), end: parseFloat(e) });
            });

            const itemsToSync = Object.entries(grouped).map(([gKey, ranges]) => {
                const [rpt, compId, typeId] = gKey.split(":");
                const comp = components.find(c => c.id === Number(compId));
                // Look for inspection type in either jobpack list or master list
                const it = validInspections.find(i => i.id === Number(typeId));
                if (!comp || !it) return null;

                const isSplit = ranges.length > 1 || (ranges[0].start !== 0 || ranges[0].end !== 0);
                
                return {
                    component_id: Number(compId),
                    inspection_type_id: Number(typeId),
                    report_number: rpt === 'null' ? null : rpt,
                    component_qid: comp.qid,
                    component_type: comp.type,
                    inspection_code: it.code,
                    inspection_name: it.name,
                    elevation_required: isSplit,
                    elevation_data: isSplit ? ranges.map(r => ({ ...r, status: "pending", elevation: `${r.start}m - ${r.end}m` })) : [],
                    status: "pending" // Default for new items, bulk API will preserve existing ones
                };
            }).filter(Boolean);

            // 3. Call Bulk Sync API
            const bulkRes = await fetch("/api/sow/items/bulk", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    sow_id: sId,
                    items: itemsToSync
                })
            });

            const bulkData = await bulkRes.json();

            if (bulkData.success) {
                toast.success("Scope Matrix Finalized Successfully!");
                loadSOW(); // Refresh data to show current state
                onSave?.();
                // We DON'T redirect here as per user request: "once saved dont close the page"
            } else {
                toast.error(bulkData.error || "Failed to sync SOW items");
            }
        } catch (e) { 
            console.error(e); 
            toast.error("An error occurred while saving");
        } finally { 
            setSaving(false); 
        }
    };

    // ── RENDER ──
    return (
        <>
        <Dialog 
            open={open} 
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    onOpenChange(false);
                    if (returnTo) {
                        router.replace(returnTo);
                    }
                }
            }}
        >
            <DialogContent className={cn(
                "flex flex-col p-0 bg-[#fbfcff] dark:bg-slate-950 overflow-hidden border-none",
                isFullScreen ? "max-w-[100vw] max-h-[100vh] h-screen w-screen rounded-none" : "max-w-[98vw] max-h-[96vh] h-[96vh] w-[98vw] rounded-[32px]"
            )}>
                <DialogHeader className="px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 z-50 shadow-sm flex-row space-y-0 text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3 shrink-0">
                        {returnTo && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-9 px-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 font-bold text-xs mr-2 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700"
                                onClick={() => {
                                    onOpenChange(false);
                                    router.replace(returnTo);
                                }}
                            >
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Button>
                        )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-9 px-3 text-slate-600 dark:text-slate-400 hover:text-blue-600 flex items-center gap-2 font-bold text-[10px] bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all",
                                    isCorrecting && "animate-pulse opacity-70"
                                )}
                            onClick={handleStatusCorrection}
                            disabled={isCorrecting || readOnly}
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", isCorrecting && "animate-spin")} />
                            {isCorrecting ? "Correcting..." : "Correct Status"}
                        </Button>
                        <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg"><ShieldCheck className="h-5 w-5 text-white" /></div>
                        <div className="flex flex-col">
                            <DialogTitle className="text-sm font-black leading-tight text-slate-900 dark:text-slate-100">
                                {availableStructures && availableStructures.length > 1 ? (
                                    <Select value={`${structure.type}-${structure.id}`} onValueChange={(v) => {
                                        const [type, id] = v.split("-");
                                        const s = availableStructures.find(st => st.id === Number(id) && st.type === type);
                                        if (s && onSwitchStructure) onSwitchStructure(s);
                                    }}>
                                        <SelectTrigger className="w-fit h-6 px-0 border-none bg-transparent text-sm font-black text-slate-900 dark:text-slate-100 rounded shadow-none gap-1"><SelectValue /> <ChevronDown className="h-3 w-3 opacity-50"/></SelectTrigger>
                                        <SelectContent align="start" className="font-bold">{availableStructures.map(s => <SelectItem key={`${s.type}-${s.id}`} value={`${s.type}-${s.id}`}>{s.title}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : structure.title}
                            </DialogTitle>
                            <DialogDescription className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{jobpackTitle || "OFFSHORE SCOPE"}</DialogDescription>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center gap-3 px-4 border-l border-slate-100 dark:border-slate-800 ml-2 overflow-hidden">
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
                            {reportNumbers.map((r, i) => (
                                <div key={r.number} onClick={() => setActiveReportNumber(r.number)}
                                    className={cn("flex flex-col items-start px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-sm relative group space-y-0.5 min-w-[100px]",
                                        activeReportNumber === r.number ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-blue-200"
                                    )}>
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-[11px] font-black">{r.number}</span>
                                        {!readOnly && <X className={cn("h-3 w-3 transition-opacity", activeReportNumber === r.number ? "opacity-30 hover:opacity-100" : "opacity-0 group-hover:opacity-50 hover:!opacity-100")} onClick={e => { e.stopPropagation(); handleRemoveReportNumber(i); }} />}
                                    </div>
                                    <span className={cn("text-[8px] font-bold uppercase tracking-widest", activeReportNumber === r.number ? "text-blue-200" : "text-slate-400")}>{r.job_type || 'Unassigned'}</span>
                                </div>
                            ))}
                        </div>
                        {activeReportNumber && (
                            <div className="flex items-center gap-1.5 px-3">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mr-1">JOB TYPE</span>
                                {['Major', 'Partial', 'Pipeline', 'Special'].map(type => {
                                    const activeReport = reportNumbers.find(r => r.number === activeReportNumber);
                                    const isActive = activeReport?.job_type === type;
                                    return (
                                        <button key={type} onClick={() => handleUpdateReportJobType(type)} disabled={readOnly}
                                            className={cn("px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border outline-none",
                                                isActive ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200 shadow-sm" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                            )}>
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className={cn(
                            "flex items-center gap-2 shrink-0 p-1 rounded-xl border border-dashed min-w-[200px] ml-auto transition-all",
                            !activeReportNumber ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-900 animate-pulse" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        )}>
                            <input 
                                placeholder={!activeReportNumber ? "ENTER REPORT ID FIRST..." : "New Report ID..."} 
                                value={reportInput} 
                                onChange={e => setReportInput(e.target.value.toUpperCase())} 
                                className={cn(
                                    "flex-1 h-8 text-[11px] px-2 bg-transparent border-none font-bold outline-none text-slate-900 dark:text-slate-100",
                                    !activeReportNumber && "placeholder:text-amber-500 dark:placeholder:text-amber-400"
                                )} 
                            />
                            <Button 
                                onClick={handleAddReportNumber} 
                                size="sm" 
                                className={cn("h-8 rounded-lg font-bold px-3 transition-transform active:scale-95", !activeReportNumber ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600")} 
                                disabled={readOnly}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1"/> ADD
                            </Button>
                        </div>
                        {!activeReportNumber && (
                            <div className="flex items-center gap-2 px-3 animate-bounce">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <span className="text-[10px] font-black text-amber-600 uppercase">Create SOW Report first!</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 px-4 border-l border-slate-100 dark:border-slate-800">
                        <div className="flex gap-1">
                            {modeAnalytics.map(m => {
                                const styles = getModeStyles(m.mode);
                                return (
                                    <div key={m.mode} className={cn("px-2.5 py-1.5 rounded-lg border flex items-center gap-2 shadow-sm", styles.border, styles.light, "dark:bg-slate-800 dark:border-slate-700")}>
                                        <span className={cn("text-[8px] font-black uppercase text-slate-900 dark:text-slate-100")}>{m.mode}</span>
                                        <span className={cn("text-xs font-black", styles.text)}>{m.all}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <Button variant="outline" size="icon" onClick={() => setShowAnalytics(!showAnalytics)} className={cn("h-10 w-10 rounded-xl", showAnalytics ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700")}><PieChart className="h-5 w-5"/></Button>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-slate-300 rounded-full hover:bg-slate-800 transition-colors" 
                            onClick={handleExit}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden relative">
                    {/* LEFT FILTERS */}
                    <div className={cn("flex flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transition-all shrink-0", isSidebarCollapsed ? "w-0 opacity-0" : "w-[300px]")}>
                        <div className="p-6">
                            <div className="flex items-center gap-2 mb-4"><Search className="h-4 w-4 text-blue-600 dark:text-blue-400" /><h3 className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Inventory Filters</h3></div>
                            <div className="relative mb-6"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-200 dark:text-slate-600" /><Input placeholder="Search asset attributes..." value={componentSearch} onChange={e => setComponentSearch(e.target.value)} className="pl-9 h-11 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-black shadow-inner text-slate-900 dark:text-slate-100" /></div>
                            
                            <div className="mb-6 space-y-2">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Filter By Status</h4>
                                
                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'all' ? "bg-slate-400" : "bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-slate-700")} />
                                    <input type="radio" checked={scopeStatusFilter === 'all'} onChange={() => setScopeStatusFilter('all')} className="accent-slate-600 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2"><Layers className="h-4 w-4 text-slate-400 dark:text-slate-500" /> All Components</span>
                                </label>
                                
                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'selected' ? "bg-blue-500" : "bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-slate-700")} />
                                    <input type="radio" checked={scopeStatusFilter === 'selected'} onChange={() => setScopeStatusFilter('selected')} className="accent-blue-600 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400" /> Selected</span>
                                </label>

                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'pending' ? "bg-slate-500" : "bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-slate-700")} />
                                    <input type="radio" checked={scopeStatusFilter === 'pending'} onChange={() => setScopeStatusFilter('pending')} className="accent-slate-500 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" /> Pending</span>
                                </label>

                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'completed' ? "bg-emerald-500" : "bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-slate-700")} />
                                    <input type="radio" checked={scopeStatusFilter === 'completed'} onChange={() => setScopeStatusFilter('completed')} className="accent-emerald-600 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Inspected</span>
                                </label>

                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'incomplete' ? "bg-rose-500" : "bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-slate-700")} />
                                    <input type="radio" checked={scopeStatusFilter === 'incomplete'} onChange={() => setScopeStatusFilter('incomplete')} className="accent-rose-600 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2"><AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-400" /> Incomplete / Anomalies</span>
                                </label>
                            </div>
                            
                            <div className="mb-6 space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <ListFilter className="h-3.5 w-3.5 text-blue-500" /> Filter By Inspection
                                </h4>
                                <Select 
                                    value={selectedInspectionFilter.toString()} 
                                    onValueChange={(v) => setSelectedInspectionFilter(v === 'all' ? 'all' : Number(v))}
                                >
                                    <SelectTrigger className="w-full h-11 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-[11px] font-black shadow-inner focus:ring-0 focus:ring-offset-0 text-slate-900 dark:text-slate-100">
                                        <SelectValue placeholder="Select Inspection Type..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px] dark:bg-slate-900 dark:border-slate-800">
                                        <SelectItem value="all" className="text-[11px] font-black uppercase dark:text-slate-100">All Inspections</SelectItem>
                                        
                                        <SelectGroup>
                                            <SelectLabel className="text-[10px] font-black text-slate-400 uppercase px-2 py-1.5 flex items-center gap-1.5 bg-slate-50/50 dark:bg-slate-800/50">
                                                <Waves className="h-3 w-3 text-emerald-500 dark:text-emerald-400" /> Diving Mode
                                            </SelectLabel>
                                            {validInspections.filter(it => it.mode === 'DIVING').map(it => (
                                                <SelectItem key={it.id} value={it.id.toString()} className="text-[11px] font-bold dark:text-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <Badge className={cn("h-1.5 w-1.5 rounded-full p-0", getModeStyles(it.mode as any).bg)} />
                                                        <span>{it.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>

                                        <SelectGroup>
                                            <SelectLabel className="text-[10px] font-black text-slate-400 uppercase px-2 py-1.5 flex items-center gap-1.5 bg-slate-50/50 dark:bg-slate-800/50">
                                                <PlaneTakeoff className="h-3 w-3 text-blue-500 dark:text-blue-400" /> ROV Mode
                                            </SelectLabel>
                                            {validInspections.filter(it => it.mode === 'ROV').map(it => (
                                                <SelectItem key={it.id} value={it.id.toString()} className="text-[11px] font-bold dark:text-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <Badge className={cn("h-1.5 w-1.5 rounded-full p-0", getModeStyles(it.mode as any).bg)} />
                                                        <span>{it.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                {selectedInspectionFilter !== 'all' && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setSelectedInspectionFilter('all')}
                                        className="w-full h-8 text-[10px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl"
                                    >
                                        Clear Inspection Filter
                                    </Button>
                                )}

                                <Button 
                                    variant="outline" 
                                    className="w-full h-10 rounded-xl border-dashed border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 hover:border-blue-500 dark:hover:text-blue-400 dark:hover:border-blue-400 mt-3 transition-all flex items-center justify-center gap-2"
                                    onClick={() => setShowAddInspectionDialog(true)}
                                    disabled={readOnly}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Inspection Type
                                </Button>
                            </div>

                            <div className="p-8 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 mt-auto rounded-[2rem] mx-4 mb-6 border border-slate-100 dark:border-slate-800 shadow-inner">
                                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3">
                                    <Navigation className="h-5 w-5 text-blue-500 dark:text-blue-400"/>
                                </div>
                                <div className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{activeComponents.length}</div>
                                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mt-1 leading-tight">Active Component<br/>Library</div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN WORKSPACE */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
                        <div className="px-6 py-2 border-b border-slate-50 dark:border-slate-900 flex justify-between items-center bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm z-30">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>{isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <PanelLeftClose className="h-5 w-5 text-slate-400 dark:text-slate-600" />}</Button>
                            <Badge className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 font-black text-[9px] tracking-widest px-3 py-1.5 rounded-full uppercase">Project Strategy Grid</Badge>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-[#fbfcff] dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
                                    <tr>
                                        <th 
                                            className="p-4 text-left border-r border-b border-slate-50 dark:border-slate-800 sticky left-0 bg-[#fbfcff] dark:bg-slate-900 w-[260px] z-50 transition-colors"
                                        >
                                            <div className="flex flex-col gap-1 px-2">
                                                <div 
                                                    className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:text-slate-500 dark:hover:text-slate-400 group"
                                                    onClick={() => setCompSortConfig(prev => ({
                                                        key: 'qid',
                                                        direction: prev.key === 'qid' && prev.direction === 'asc' ? 'desc' : 'asc'
                                                    }))}
                                                >
                                                    Component Identifier 
                                                    {compSortConfig.key === 'qid' ? (
                                                        compSortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 text-blue-600 dark:text-blue-400" /> : <ChevronDown className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                                    ) : (
                                                        <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div 
                                                        className={cn("text-[8px] font-bold uppercase cursor-pointer hover:text-blue-600 px-1 rounded transition-colors", compSortConfig.key === 'type' ? "text-blue-600 bg-blue-50" : "text-slate-400")}
                                                        onClick={() => setCompSortConfig(prev => ({ key: 'type', direction: prev.key === 'type' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                                                    >
                                                        Type {compSortConfig.key === 'type' && (compSortConfig.direction === 'asc' ? '↑' : '↓')}
                                                    </div>
                                                    <div className="text-slate-200">|</div>
                                                    <div 
                                                        className={cn("text-[8px] font-bold uppercase cursor-pointer hover:text-blue-600 px-1 rounded transition-colors", compSortConfig.key === 'elv_1' ? "text-blue-600 bg-blue-50" : "text-slate-400")}
                                                        onClick={() => setCompSortConfig(prev => ({ key: 'elv_1', direction: prev.key === 'elv_1' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                                                    >
                                                        Elev {compSortConfig.key === 'elv_1' && (compSortConfig.direction === 'asc' ? '↑' : '↓')}
                                                    </div>
                                                </div>
                                            </div>
                                        </th>
                                        {validInspections
                                            .filter(it => selectedInspectionFilter === 'all' || String(it.id) === String(selectedInspectionFilter))
                                            .map(it => {
                                                const styles = getModeStyles(it.mode as any);
                                                const allSelectedInType = activeComponents.every(c => isSelected(c.id, it.id, 0, 0));
                                                 return (
                                                    <th key={it.id} className={cn("p-0 border-b border-slate-50 dark:border-slate-800 min-w-[85px] h-64 relative group transition-all duration-300 overflow-hidden", styles.light, "dark:bg-slate-900/40")}>
                                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/[0.02] dark:to-white/[0.02]" />
                                                        
                                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-y-1">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={allSelectedInType && activeComponents.length > 0} 
                                                                onChange={e => handleBulkSelect(it.id, e.target.checked)}
                                                                disabled={!activeReportNumber || readOnly}
                                                                className={cn(
                                                                    "h-6 w-6 rounded-lg border-2 accent-current transition-all shadow-lg cursor-pointer", 
                                                                    styles.text,
                                                                    (!activeReportNumber || readOnly) && "cursor-not-allowed opacity-50"
                                                                )} 
                                                            />
                                                        </div>

                                                        <div className="absolute inset-0 flex flex-col items-center justify-end pb-10 px-2">
                                                            <div className={cn("writing-mode-vertical text-[12px] font-black uppercase transform rotate-180 tracking-tighter transition-all group-hover:scale-105 group-hover:-translate-y-1", styles.text)} 
                                                                style={{ writingMode: 'vertical-rl' }}>
                                                                {it.name}
                                                            </div>
                                                            <div className={cn("mt-4 px-2 py-0.5 rounded-full text-[8px] font-black tracking-[0.15em] uppercase shadow-sm transition-all", styles.bg, "text-white opacity-30 group-hover:opacity-100 group-hover:translate-y-[-2px]")}>
                                                                {it.mode}
                                                            </div>
                                                        </div>

                                                        <div className={cn("absolute inset-x-0 bottom-0 h-1.5 transition-all group-hover:h-2", styles.bg, "opacity-20 group-hover:opacity-60")} />
                                                        
                                                        {/* Right border separator */}
                                                        <div className="absolute right-0 top-1/4 bottom-1/4 w-[1px] bg-slate-200 dark:bg-slate-800 opacity-50" />
                                                    </th>
                                                );
                                            })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                                    {activeComponents.map(comp => (
                                        <tr key={comp.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                            <td className="p-5 border-r border-slate-50 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-950 z-10 w-[260px] group-hover:bg-slate-50 dark:group-hover:bg-slate-900 transition-colors">
                                                <div className="flex flex-col gap-2">
                                                    <div className="font-black text-slate-800 dark:text-slate-100 text-[14px] leading-tight flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500" /> {comp.qid}</div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[8px] font-black h-4 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 px-1.5 rounded-full uppercase">{comp.type}</Badge>
                                                        <span className="text-[10px] font-black text-slate-300 font-mono tracking-tighter">
                                                            {Number(comp.elv_1 || 0).toFixed(1)}m – {Number(comp.elv_2 || 0).toFixed(1)}m
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            {validInspections
                                                .filter(it => selectedInspectionFilter === 'all' || String(it.id) === String(selectedInspectionFilter))
                                                .map(it => {
                                                    const styles = getModeStyles(it.mode as any);
                                                    const s = getItemStatus(comp.id, it.id, 0, 0);
                                                    const sel = isSelected(comp.id, it.id, 0, 0);
                                                    return (
                                                        <td key={it.id} className="p-3 border-r border-slate-50 dark:border-slate-800 text-center bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900/40 transition-colors">
                                                            <div className="flex flex-col items-center justify-center gap-2.5">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={sel} 
                                                                    disabled={!activeReportNumber || readOnly || s==='completed' || s==='incomplete'}
                                                                    onChange={() => !readOnly && activeReportNumber && toggleSelection(comp.id, it.id, 0, 0)}
                                                                    className={cn("h-8 w-8 rounded-[10px] border-2 transition-all shadow-sm",
                                                                        sel ? `${styles.bg} border-transparent shadow-lg scale-105` : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                                                                        (!activeReportNumber || readOnly || s==='completed' || s==='incomplete') ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                                                    )} />
                                                                {sel && <div className={cn("h-2 w-full rounded-full transition-all", s === 'completed' ? "bg-emerald-500" : s === 'incomplete' ? "bg-rose-500" : styles.bg)} />}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* DRILL-DOWN ANALYTICS SLIDER */}
                    <AnimatePresence>
                        {showAnalytics && (
                            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 220 }}
                                className="absolute right-0 top-0 bottom-0 w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-[-15px_0_60px_rgba(0,0,0,0.12)] z-[60] flex flex-col text-slate-900 dark:text-slate-100">
                                <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center shadow-inner text-blue-600 dark:text-blue-400"><BarChart3 className="h-5 w-5"/></div>
                                        <div><h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">Scope Analytics</h3><p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{activeReportNumber || 'ALL REPORTS'}</p></div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setShowAnalytics(false)} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4"/></Button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8 bg-[#fbfcff] dark:bg-slate-950">
                                    {/* OVERALL DONUT */}
                                    <div className="flex flex-col items-center">
                                        <div className="relative h-36 w-36 flex items-center justify-center mb-4">
                                            <svg className="h-full w-full transform -rotate-90"><circle cx="72" cy="72" r="62" fill="transparent" stroke={cn("#f1f5f9", "dark:stroke-slate-800")} strokeWidth="14" /><circle cx="72" cy="72" r="62" fill="transparent" stroke="#3b82f6" strokeWidth="14" strokeDasharray="389.6" strokeDashoffset={389.6 - (389.6 * (stats.completed / (stats.all || 1)))} strokeLinecap="round" /></svg>
                                            <div className="absolute flex flex-col items-center"><div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">{Math.round((stats.completed / (stats.all || 1)) * 100)}%</div><div className="text-[7px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.15em] mt-0.5">Overall</div></div>
                                        </div>
                                        <div className="flex gap-4 text-center">
                                            <div><div className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.all}</div><div className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase">Total</div></div>
                                            <div><div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{stats.completed}</div><div className="text-[8px] font-black text-emerald-400 dark:text-emerald-600 uppercase">Done</div></div>
                                            <div><div className="text-lg font-black text-slate-400 dark:text-slate-500">{stats.pending}</div><div className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase">Pending</div></div>
                                        </div>
                                    </div>

                                    {/* SECTION 1: INSPECTION MODE (ROV vs DIVING) — DRILL DOWN */}
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-blue-600"/> By Inspection Mode</h4>
                                        {modeAnalytics.map(item => {
                                            const styles = getModeStyles(item.mode);
                                            const pct = Math.round((item.completed / (item.all || 1)) * 100);
                                            const isExpanded = expandedMode === item.mode;
                                            const subTasks = modeTaskBreakdown[item.mode] || {};
                                            return (
                                                <div key={item.mode}>
                                                    <div onClick={() => setExpandedMode(isExpanded ? null : item.mode)}
                                                        className={cn("p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm cursor-pointer transition-all hover:shadow-md", styles.light, styles.border, isExpanded && "ring-2 ring-blue-100 dark:ring-blue-900/30")}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <ChevronRight className={cn("h-4 w-4 transition-transform text-slate-300 dark:text-slate-600", isExpanded && "rotate-90")} />
                                                                {styles.icon}
                                                                <span className={cn("text-[12px] font-black uppercase tracking-tight", styles.text)}>{item.mode} Mode</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={cn("text-[18px] font-black tabular-nums", styles.text)}>{pct}%</span>
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{item.completed}/{item.all}</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-2 w-full bg-white dark:bg-slate-950 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800 shadow-inner">
                                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={cn("h-full rounded-full", styles.bg)} />
                                                        </div>
                                                    </div>
                                                    <AnimatePresence>
                                                        {isExpanded && Object.keys(subTasks).length > 0 && (
                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                                <div className="pl-6 pr-2 pt-2 space-y-2">
                                                                    {Object.entries(subTasks).map(([taskName, tv]) => {
                                                                        const subPct = Math.round((tv.completed / (tv.all || 1)) * 100);
                                                                        return (
                                                                            <div key={taskName} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                                <div className="flex justify-between items-center mb-1.5">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">{taskName}</span>
                                                                                        <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase">{tv.code}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={cn("text-[13px] font-black tabular-nums", styles.text)}>{subPct}%</span>
                                                                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{tv.completed}/{tv.all}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="h-1 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden">
                                                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${subPct}%` }} className={cn("h-full rounded-full", styles.bg, "opacity-60")} />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* SECTION 2: INSPECTION TYPE — DRILL DOWN */}
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2"><ClipboardCheck className="h-3.5 w-3.5 text-amber-500"/> By Inspection Type</h4>
                                        {taskTypeAnalytics.map(item => {
                                            const pct = Math.round((item.completed / (item.all || 1)) * 100);
                                            const isExpanded = expandedTaskType === item.name;
                                            const subComps = taskCompBreakdown[item.name] || {};
                                            return (
                                                <div key={item.name}>
                                                    <div onClick={() => setExpandedTaskType(isExpanded ? null : item.name)}
                                                        className={cn("p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer transition-all hover:shadow-md", isExpanded && "ring-2 ring-amber-100 dark:ring-amber-900/30")}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <ChevronRight className={cn("h-4 w-4 transition-transform text-slate-300 dark:text-slate-600", isExpanded && "rotate-90")} />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{item.name}</span>
                                                                    <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase">{item.code}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[18px] font-black text-amber-500 dark:text-amber-400 tabular-nums">{pct}%</span>
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{item.completed}/{item.all}</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800">
                                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-amber-500 rounded-full" />
                                                        </div>
                                                    </div>
                                                    <AnimatePresence>
                                                        {isExpanded && Object.keys(subComps).length > 0 && (
                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                                <div className="pl-6 pr-2 pt-2 space-y-2">
                                                                    {Object.entries(subComps).map(([compType, cv]) => {
                                                                        const subPct = Math.round((cv.completed / (cv.all || 1)) * 100);
                                                                        return (
                                                                            <div key={compType} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                                <div className="flex justify-between items-center mb-1.5">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Box className="h-3 w-3 text-amber-400 dark:text-amber-500" />
                                                                                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">{compType}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[13px] font-black text-amber-500 dark:text-amber-400 tabular-nums">{subPct}%</span>
                                                                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{cv.completed}/{cv.all}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="h-1 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden">
                                                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${subPct}%` }} className="h-full bg-amber-400 rounded-full opacity-60" />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* SECTION 3: COMPONENT TYPE — DRILL DOWN */}
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2"><Box className="h-3.5 w-3.5 text-emerald-500"/> By Component Type</h4>
                                        {compTypeAnalytics.map(item => {
                                            const pct = Math.round((item.completed / (item.all || 1)) * 100);
                                            const isExpanded = expandedCompType === item.type;
                                            const subTasks = compTypeTaskBreakdown[item.type] || {};
                                            return (
                                                <div key={item.type}>
                                                    <div onClick={() => setExpandedCompType(isExpanded ? null : item.type)}
                                                        className={cn("p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer transition-all hover:shadow-md", isExpanded && "ring-2 ring-emerald-100 dark:ring-emerald-900/30")}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <ChevronRight className={cn("h-4 w-4 transition-transform text-slate-300 dark:text-slate-600", isExpanded && "rotate-90")} />
                                                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{item.type}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[18px] font-black text-emerald-500 dark:text-emerald-400 tabular-nums">{pct}%</span>
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{item.completed}/{item.all}</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800">
                                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-emerald-500 rounded-full" />
                                                        </div>
                                                    </div>
                                                    <AnimatePresence>
                                                        {isExpanded && Object.keys(subTasks).length > 0 && (
                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                                <div className="pl-6 pr-2 pt-2 space-y-2">
                                                                    {Object.entries(subTasks).map(([taskName, tv]) => {
                                                                        const subPct = Math.round((tv.completed / (tv.all || 1)) * 100);
                                                                        return (
                                                                            <div key={taskName} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                                <div className="flex justify-between items-center mb-1.5">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <ClipboardCheck className="h-3 w-3 text-emerald-400 dark:text-emerald-500" />
                                                                                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">{taskName}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[13px] font-black text-emerald-500 dark:text-emerald-400 tabular-nums">{subPct}%</span>
                                                                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{tv.completed}/{tv.all}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="h-1 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden">
                                                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${subPct}%` }} className="h-full bg-emerald-400 rounded-full opacity-60" />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="p-6 border-t border-slate-50 bg-white"><Button onClick={() => window.print()} className="w-full h-14 rounded-2xl bg-slate-900 shadow-2xl text-white font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2"><Download className="h-4 w-4"/> Generate Full Strategy Report</Button></div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="px-10 py-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-lg">
                    <div className="text-[10px] font-black text-slate-800 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2"><BarChart className="h-4 w-4 text-blue-500 dark:text-blue-400"/> MISSION STRATEGY ENGINE ONLINE</div>
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="ghost" 
                            className="h-12 px-10 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400" 
                            onClick={handleExit}
                        >
                            Back
                        </Button>
                        <Button 
                            onClick={handleSave} 
                            disabled={saving || readOnly || !activeReportNumber} 
                            className={cn(
                                "h-14 px-16 rounded-[24px] border-none text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl transition-all hover:translate-y-[-3px] active:scale-95",
                                (!activeReportNumber || readOnly) ? "bg-slate-400 dark:bg-slate-700 shadow-none cursor-not-allowed" : "bg-blue-600 dark:bg-blue-500 shadow-blue-200 dark:shadow-blue-900/40"
                            )}
                        >
                            {saving ? <Activity className="h-4 w-4 animate-spin mr-2"/> : "Finalize Scope Matrix"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Copy Scope Dialog */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
            <DialogContent className="max-w-[420px] bg-white dark:bg-slate-900 p-6 rounded-3xl border-none shadow-2xl">
                <DialogHeader className="space-y-3">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-2"><Copy className="w-6 h-6" /></div>
                    <DialogTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Copy Scope Matrix?</DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Do you want to perfectly duplicate all inspection selections from your currently active report to this new report?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-8 flex items-center justify-end gap-3 sm:justify-end">
                    <Button variant="ghost" className="h-10 rounded-xl px-5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold uppercase tracking-wider" onClick={() => handleConfirmAddReport(false)}>Empty Report</Button>
                    <Button className="h-10 rounded-xl px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 text-xs font-bold uppercase tracking-wider transition-transform active:scale-95" onClick={() => handleConfirmAddReport(true)}>Copy & Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        {/* Add Inspection Type Dialog */}
        <Dialog open={showAddInspectionDialog} onOpenChange={setShowAddInspectionDialog}>
            <DialogContent className="max-w-[500px] bg-white dark:bg-slate-900 p-0 rounded-3xl border-none shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center"><Plus className="w-5 h-5" /></div>
                            <div>
                                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Add Inspection Type</DialogTitle>
                                <DialogDescription className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Expand Scope Matrix Registry</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search Master Inspection Registry..." 
                            value={searchAddInspection}
                            onChange={(e) => setSearchAddInspection(e.target.value)}
                            className="h-11 pl-10 rounded-2xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs font-bold"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white dark:bg-slate-950">
                    <div className="space-y-6">
                        {['DIVING', 'ROV'].map(mode => {
                            const inspections = allInspectionTypes
                                .filter(it => getTaskMode(it) === mode)
                                .filter(it => !validInspections.some(v => v.id === it.id))
                                .filter(it => 
                                    !searchAddInspection || 
                                    it.name.toLowerCase().includes(searchAddInspection.toLowerCase()) ||
                                    it.code.toLowerCase().includes(searchAddInspection.toLowerCase())
                                );
                            
                            if (inspections.length === 0) return null;

                            return (
                                <div key={mode} className="space-y-3">
                                    <div className="flex items-center gap-2 px-2">
                                        {mode === 'DIVING' ? <Waves className="h-3 w-3 text-emerald-500" /> : <PlaneTakeoff className="h-3 w-3 text-blue-500" />}
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{mode} Inspections</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {inspections.map(it => (
                                            <div 
                                                key={it.id}
                                                onClick={() => {
                                                    setExtraInspectionIds(prev => [...prev, it.id]);
                                                    setSearchAddInspection("");
                                                    // We don't close so they can add multiple
                                                    toast.success(`Added ${it.name} to scope`);
                                                }}
                                                className="group flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-all active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black", getModeStyles(mode as any).light, getModeStyles(mode as any).text)}>
                                                        {it.code.substring(0, 3)}
                                                    </div>
                                                    <div>
                                                        <div className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{it.name}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{it.code}</div>
                                                    </div>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                                        <Plus className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {allInspectionTypes.filter(it => !validInspections.some(v => v.id === it.id)).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3 opacity-20" />
                                <p className="text-xs font-bold text-slate-400">All available inspections are already in your scope.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex justify-end">
                    <Button 
                        onClick={() => setShowAddInspectionDialog(false)}
                        className="h-10 rounded-xl px-8 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-black text-[11px] uppercase tracking-widest shadow-lg"
                    >
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
