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
    Anchor, Target, Eye, Navigation, Box, ClipboardCheck, BarChart
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOW, SOWItem, ReportNumber, InspectionStatus } from "@/types/sow";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

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
    
    // Logic state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [componentSplitByElevation, setComponentSplitByElevation] = useState<Record<number, boolean>>({});
    const [componentBreakpoints, setComponentBreakpoints] = useState<Record<number, number[]>>({});
    const [newElevationInput, setNewElevationInput] = useState<Record<number, string>>({});
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [pendingReportToAdd, setPendingReportToAdd] = useState<ReportNumber | null>(null);

    const activeReport = activeReportNumber || 'null';

    // ── DATA LOADING ──
    useEffect(() => {
        if (open && structure) loadSOW();
    }, [open, structure]);

    const loadSOW = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sow?jobpack_id=${jobpackId}&structure_id=${structure.id}`);
            const { data } = await res.json();
            if (data) {
                setSOW(data);
                setSOWItems(data.items || []);
                setReportNumbers(data.report_numbers || []);
                if (data.report_numbers?.length > 0 && !activeReportNumber) setActiveReportNumber(data.report_numbers[0].number);
                
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
        return inspectionTypes.filter(t => !['EXSUM', 'LOG', 'CALIB', 'SETUP'].some(k => t.code.toUpperCase().includes(k)))
            .map(it => ({ ...it, mode: getTaskMode(it) }));
    }, [inspectionTypes]);

    const getItemStatus = (compId: number, typeId: number, s: number, e: number): InspectionStatus => {
        const itm = sowItems.find(i => i.component_id === compId && i.inspection_type_id === typeId && (i.report_number || 'null') === activeReport);
        if (!itm) return "pending";
        if (itm.elevation_required && itm.elevation_data) return itm.elevation_data.find((d: any) => d.start === s && d.end === e)?.status || "pending";
        return itm.status || "pending";
    };

    const isSelected = (compId: number, typeId: number, s: number, e: number) => {
        return selectedItems.has(`${activeReport}:${compId}:${typeId}:${s}:${e}`);
    };

    const activeComponents = useMemo(() => components.filter(c => {
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

        if (scopeStatusFilter === 'all') return true;

        if (scopeStatusFilter === 'selected') {
            return validInspections.some(it => isSelected(c.id, it.id, 0, 0));
        }

        if (scopeStatusFilter === 'pending') {
            return validInspections.some(it => isSelected(c.id, it.id, 0, 0) && getItemStatus(c.id, it.id, 0, 0) === 'pending');
        }

        if (scopeStatusFilter === 'completed') {
            return validInspections.some(it => isSelected(c.id, it.id, 0, 0) && getItemStatus(c.id, it.id, 0, 0) === 'completed');
        }

        if (scopeStatusFilter === 'incomplete') {
            return validInspections.some(it => isSelected(c.id, it.id, 0, 0) && getItemStatus(c.id, it.id, 0, 0) === 'incomplete');
        }

        return true;
    }), [components, componentSearch, scopeStatusFilter, validInspections, selectedItems, sowItems, activeReport]);

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

    const handleRemoveReportNumber = (i: number) => {
        const removed = reportNumbers[i].number;
        setReportNumbers(reportNumbers.filter((_, idx) => idx !== i));
        if (activeReportNumber === removed) setActiveReportNumber(null);
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

    const handleSave = async () => {
        setSaving(true);
        try {
            const hReq = await fetch("/api/sow", {
                method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ id: sow?.id, jobpack_id: jobpackId, structure_id: structure.id, report_numbers: reportNumbers, structure_type: structure.type, structure_title: structure.title })
            });
            const { data: savedSOW } = await hReq.json();
            const sId = savedSOW.id;
            const grouped: Record<string, any[]> = {};
            selectedItems.forEach(key => {
                const [rpt, compId, typeId, s, e] = key.split(":");
                const gKey = `${rpt}:${compId}:${typeId}`;
                if (!grouped[gKey]) grouped[gKey] = [];
                grouped[gKey].push({ start: parseFloat(s), end: parseFloat(e) });
            });
            for (const [gKey, ranges] of Object.entries(grouped)) {
                const [rpt, compId, typeId] = gKey.split(":");
                const comp = components.find(c => c.id === Number(compId));
                const it = inspectionTypes.find(i => i.id === Number(typeId));
                if (!comp || !it) continue;
                const isSplit = ranges.length > 1 || (ranges[0].start !== 0 || ranges[0].end !== 0);
                await fetch("/api/sow/items", {
                    method: "POST", headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        sow_id: sId, component_id: Number(compId), inspection_type_id: Number(typeId),
                        report_number: rpt === 'null' ? null : rpt, component_qid: comp.qid, component_type: comp.type,
                        inspection_code: it.code, inspection_name: it.name, elevation_required: isSplit,
                        elevation_data: isSplit ? ranges.map(r => ({ ...r, status: "pending", elevation: `${r.start}m - ${r.end}m` })) : [],
                        status: "pending"
                    })
                });
            }
            for (const itm of sowItems) {
                const rpt = itm.report_number || 'null';
                if (rpt !== activeReport) continue;
                const gKey = `${rpt}:${itm.component_id}:${itm.inspection_type_id}`;
                if (!grouped[gKey]) { await fetch(`/api/sow/items?id=${itm.id}`, { method: "DELETE" }); }
            }
            alert("SOW Portfolio Updated!"); loadSOW(); onSave?.();
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };

    // ── RENDER ──
    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "flex flex-col p-0 bg-[#fbfcff] overflow-hidden border-none",
                isFullScreen ? "max-w-[100vw] max-h-[100vh] h-screen w-screen rounded-none" : "max-w-[98vw] max-h-[96vh] h-[96vh] w-[98vw] rounded-[32px]"
            )}>
                <DialogHeader className="px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-4 shrink-0 z-50 shadow-sm flex-row space-y-0 text-slate-900">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg"><ShieldCheck className="h-5 w-5 text-white" /></div>
                        <div className="flex flex-col">
                            <DialogTitle className="text-sm font-black leading-tight text-slate-900">
                                {availableStructures && availableStructures.length > 1 ? (
                                    <Select value={`${structure.type}-${structure.id}`} onValueChange={(v) => {
                                        const [type, id] = v.split("-");
                                        const s = availableStructures.find(st => st.id === Number(id) && st.type === type);
                                        if (s && onSwitchStructure) onSwitchStructure(s);
                                    }}>
                                        <SelectTrigger className="w-fit h-6 px-0 border-none bg-transparent text-sm font-black text-slate-900 rounded shadow-none gap-1"><SelectValue /> <ChevronDown className="h-3 w-3 opacity-50"/></SelectTrigger>
                                        <SelectContent align="start" className="font-bold">{availableStructures.map(s => <SelectItem key={`${s.type}-${s.id}`} value={`${s.type}-${s.id}`}>{s.title}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : structure.title}
                            </DialogTitle>
                            <DialogDescription className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{jobpackTitle || "OFFSHORE SCOPE"}</DialogDescription>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center gap-3 px-4 border-l border-slate-100 ml-2 overflow-hidden">
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
                            {reportNumbers.map((r, i) => (
                                <div key={r.number} onClick={() => setActiveReportNumber(r.number)}
                                    className={cn("flex flex-col items-start px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-sm relative group space-y-0.5 min-w-[100px]",
                                        activeReportNumber === r.number ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-100 hover:border-blue-200"
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
                                                isActive ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                            )}>
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex items-center gap-2 shrink-0 bg-slate-50 p-1 rounded-xl border border-dashed border-slate-200 min-w-[200px] ml-auto">
                            <input placeholder="New Report ID..." value={reportInput} onChange={e => setReportInput(e.target.value)} className="flex-1 h-8 text-[11px] px-2 bg-transparent border-none font-bold outline-none" />
                            <Button onClick={handleAddReportNumber} size="sm" className="h-8 rounded-lg bg-blue-600 font-bold px-3 transition-transform active:scale-95" disabled={readOnly}><Plus className="h-3.5 w-3.5 mr-1"/> ADD</Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 px-4 border-l border-slate-100">
                        <div className="flex gap-1">
                            {modeAnalytics.map(m => {
                                const styles = getModeStyles(m.mode);
                                return (
                                    <div key={m.mode} className={cn("px-2.5 py-1.5 rounded-lg border flex items-center gap-2 shadow-sm", styles.border, styles.light)}>
                                        <span className={cn("text-[8px] font-black uppercase text-slate-900")}>{m.mode}</span>
                                        <span className={cn("text-xs font-black", styles.text)}>{m.all}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <Button variant="outline" size="icon" onClick={() => setShowAnalytics(!showAnalytics)} className={cn("h-10 w-10 rounded-xl", showAnalytics ? "bg-blue-600 text-white" : "bg-white text-slate-400")}><PieChart className="h-5 w-5"/></Button>
                    </div>

                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 rounded-full" onClick={() => onOpenChange(false)}><X className="h-5 w-5" /></Button>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden relative">
                    {/* LEFT FILTERS */}
                    <div className={cn("flex flex-col bg-white border-r border-slate-100 transition-all shrink-0", isSidebarCollapsed ? "w-0 opacity-0" : "w-[300px]")}>
                        <div className="p-6">
                            <div className="flex items-center gap-2 mb-4"><Search className="h-4 w-4 text-blue-600" /><h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Inventory Filters</h3></div>
                            <div className="relative mb-6"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-200" /><Input placeholder="Search asset attributes..." value={componentSearch} onChange={e => setComponentSearch(e.target.value)} className="pl-9 h-11 rounded-2xl bg-slate-50 border-none text-xs font-black shadow-inner" /></div>
                            
                            <div className="mb-6 space-y-2">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Filter By Status</h4>
                                
                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'all' ? "bg-slate-400" : "bg-transparent group-hover:bg-slate-200")} />
                                    <input type="radio" checked={scopeStatusFilter === 'all'} onChange={() => setScopeStatusFilter('all')} className="accent-slate-600 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-2"><Layers className="h-4 w-4 text-slate-400" /> All Components</span>
                                </label>
                                
                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'selected' ? "bg-blue-500" : "bg-transparent group-hover:bg-slate-200")} />
                                    <input type="radio" checked={scopeStatusFilter === 'selected'} onChange={() => setScopeStatusFilter('selected')} className="accent-blue-600 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-500" /> Selected</span>
                                </label>

                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'pending' ? "bg-slate-500" : "bg-transparent group-hover:bg-slate-200")} />
                                    <input type="radio" checked={scopeStatusFilter === 'pending'} onChange={() => setScopeStatusFilter('pending')} className="accent-slate-500 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> Pending</span>
                                </label>

                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'completed' ? "bg-emerald-500" : "bg-transparent group-hover:bg-slate-200")} />
                                    <input type="radio" checked={scopeStatusFilter === 'completed'} onChange={() => setScopeStatusFilter('completed')} className="accent-emerald-600 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Inspected</span>
                                </label>

                                <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden relative group">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 transition-colors", scopeStatusFilter === 'incomplete' ? "bg-rose-500" : "bg-transparent group-hover:bg-slate-200")} />
                                    <input type="radio" checked={scopeStatusFilter === 'incomplete'} onChange={() => setScopeStatusFilter('incomplete')} className="accent-rose-600 h-4 w-4 ml-1" />
                                    <span className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-2"><AlertCircle className="h-4 w-4 text-rose-500" /> Incomplete / Anomalies</span>
                                </label>
                            </div>

                            <div className="p-8 flex flex-col items-center justify-center bg-slate-50/50 mt-auto rounded-[2rem] mx-4 mb-6 border border-slate-100 shadow-inner">
                                <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                                    <Navigation className="h-5 w-5 text-blue-500"/>
                                </div>
                                <div className="text-4xl font-black text-slate-800 tracking-tighter">{activeComponents.length}</div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-1 leading-tight">Active Component<br/>Library</div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN WORKSPACE */}
                    <div className="flex-1 flex flex-col bg-white overflow-hidden">
                        <div className="px-6 py-2 border-b border-slate-50 flex justify-between items-center bg-white/50 backdrop-blur-sm z-30">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>{isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5 text-blue-600" /> : <PanelLeftClose className="h-5 w-5" />}</Button>
                            <Badge className="bg-blue-50 text-blue-600 border border-blue-100 font-black text-[9px] tracking-widest px-3 py-1.5 rounded-full uppercase">Project Strategy Grid</Badge>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-[#fbfcff] sticky top-0 z-40">
                                    <tr>
                                        <th className="p-4 text-left border-r border-b border-slate-50 sticky left-0 bg-[#fbfcff] w-[260px] z-50"><div className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-2 group flex items-center gap-2">Component Identifier <ChevronDown className="h-3 w-3" /></div></th>
                                        {validInspections.map(it => {
                                            const styles = getModeStyles(it.mode as any);
                                            const allSelectedInType = activeComponents.every(c => isSelected(c.id, it.id, 0, 0));
                                            return (
                                                <th key={it.id} className="p-2 border-b border-slate-50 min-w-[75px] h-52 relative group hover:bg-slate-50 transition-colors">
                                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <input type="checkbox" checked={allSelectedInType && activeComponents.length > 0} 
                                                            onChange={e => handleBulkSelect(it.id, e.target.checked)}
                                                            className={cn("h-5 w-5 rounded-lg border-2 accent-current cursor-pointer transition-transform shadow-sm", styles.text)} />
                                                    </div>
                                                    <div className={cn("writing-mode-vertical text-[11px] font-black uppercase transform rotate-180 w-full flex items-center justify-center text-center tracking-tighter h-full py-8 transition-colors", styles.text)} 
                                                        style={{ writingMode: 'vertical-rl' }}>{it.name}</div>
                                                    <div className={cn("absolute inset-x-0 bottom-0 h-1", styles.bg, "opacity-20")} />
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {activeComponents.map(comp => (
                                        <tr key={comp.id} className="group hover:bg-slate-50 transition-colors">
                                            <td className="p-5 border-r border-slate-50 sticky left-0 bg-white z-10 w-[260px] group-hover:bg-slate-50 transition-colors">
                                                <div className="flex flex-col gap-2">
                                                    <div className="font-black text-slate-800 text-[14px] leading-tight flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500" /> {comp.qid}</div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[8px] font-black h-4 border-slate-200 text-slate-400 px-1.5 rounded-full uppercase">{comp.type}</Badge>
                                                        <span className="text-[10px] font-black text-slate-300 font-mono tracking-tighter">
                                                            {Number(comp.elv_1 || 0).toFixed(1)}m – {Number(comp.elv_2 || 0).toFixed(1)}m
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            {validInspections.map(it => {
                                                const styles = getModeStyles(it.mode as any);
                                                const s = getItemStatus(comp.id, it.id, 0, 0);
                                                const sel = isSelected(comp.id, it.id, 0, 0);
                                                return (
                                                    <td key={it.id} className="p-3 border-r border-slate-50 text-center bg-white group-hover:bg-slate-50 transition-colors">
                                                        <div className="flex flex-col items-center justify-center gap-2.5">
                                                            <input type="checkbox" checked={sel} disabled={readOnly || s==='completed' || s==='incomplete'}
                                                                onChange={() => !readOnly && toggleSelection(comp.id, it.id, 0, 0)}
                                                                className={cn("h-8 w-8 rounded-[10px] border-2 transition-all cursor-pointer shadow-sm",
                                                                    sel ? `${styles.bg} border-transparent shadow-lg scale-105` : "bg-white border-slate-200 hover:border-slate-300"
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
                                className="absolute right-0 top-0 bottom-0 w-[480px] bg-white border-l border-slate-200 shadow-[-15px_0_60px_rgba(0,0,0,0.12)] z-[60] flex flex-col text-slate-900">
                                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-blue-50 rounded-2xl flex items-center justify-center shadow-inner text-blue-600"><BarChart3 className="h-5 w-5"/></div>
                                        <div><h3 className="text-sm font-black text-slate-900 tracking-tight">Scope Analytics</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeReportNumber || 'ALL REPORTS'}</p></div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setShowAnalytics(false)} className="rounded-full hover:bg-slate-100"><X className="h-4 w-4"/></Button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8 bg-[#fbfcff]">
                                    {/* OVERALL DONUT */}
                                    <div className="flex flex-col items-center">
                                        <div className="relative h-36 w-36 flex items-center justify-center mb-4">
                                            <svg className="h-full w-full transform -rotate-90"><circle cx="72" cy="72" r="62" fill="transparent" stroke="#f1f5f9" strokeWidth="14" /><circle cx="72" cy="72" r="62" fill="transparent" stroke="#3b82f6" strokeWidth="14" strokeDasharray="389.6" strokeDashoffset={389.6 - (389.6 * (stats.completed / (stats.all || 1)))} strokeLinecap="round" /></svg>
                                            <div className="absolute flex flex-col items-center"><div className="text-2xl font-black text-slate-900 tracking-tighter">{Math.round((stats.completed / (stats.all || 1)) * 100)}%</div><div className="text-[7px] font-black text-slate-300 uppercase tracking-[0.15em] mt-0.5">Overall</div></div>
                                        </div>
                                        <div className="flex gap-4 text-center">
                                            <div><div className="text-lg font-black text-slate-800">{stats.all}</div><div className="text-[8px] font-black text-slate-300 uppercase">Total</div></div>
                                            <div><div className="text-lg font-black text-emerald-600">{stats.completed}</div><div className="text-[8px] font-black text-emerald-400 uppercase">Done</div></div>
                                            <div><div className="text-lg font-black text-slate-400">{stats.pending}</div><div className="text-[8px] font-black text-slate-300 uppercase">Pending</div></div>
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
                                                        className={cn("p-4 bg-white rounded-2xl border shadow-sm cursor-pointer transition-all hover:shadow-md", styles.light, styles.border, isExpanded && "ring-2 ring-blue-100")}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <ChevronRight className={cn("h-4 w-4 transition-transform text-slate-300", isExpanded && "rotate-90")} />
                                                                {styles.icon}
                                                                <span className={cn("text-[12px] font-black uppercase tracking-tight", styles.text)}>{item.mode} Mode</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={cn("text-[18px] font-black tabular-nums", styles.text)}>{pct}%</span>
                                                                <span className="text-[10px] font-bold text-slate-400">{item.completed}/{item.all}</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-slate-100 shadow-inner">
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
                                                                            <div key={taskName} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                                                <div className="flex justify-between items-center mb-1.5">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{taskName}</span>
                                                                                        <span className="text-[8px] font-bold text-slate-300 uppercase">{tv.code}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={cn("text-[13px] font-black tabular-nums", styles.text)}>{subPct}%</span>
                                                                                        <span className="text-[9px] font-bold text-slate-400">{tv.completed}/{tv.all}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
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
                                                        className={cn("p-4 bg-white rounded-2xl border border-slate-100 shadow-sm cursor-pointer transition-all hover:shadow-md", isExpanded && "ring-2 ring-amber-100")}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <ChevronRight className={cn("h-4 w-4 transition-transform text-slate-300", isExpanded && "rotate-90")} />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{item.name}</span>
                                                                    <span className="text-[8px] font-bold text-slate-300 uppercase">{item.code}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[18px] font-black text-amber-500 tabular-nums">{pct}%</span>
                                                                <span className="text-[10px] font-bold text-slate-400">{item.completed}/{item.all}</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
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
                                                                            <div key={compType} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                                                <div className="flex justify-between items-center mb-1.5">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Box className="h-3 w-3 text-amber-400" />
                                                                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{compType}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[13px] font-black text-amber-500 tabular-nums">{subPct}%</span>
                                                                                        <span className="text-[9px] font-bold text-slate-400">{cv.completed}/{cv.all}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
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
                                                        className={cn("p-4 bg-white rounded-2xl border border-slate-100 shadow-sm cursor-pointer transition-all hover:shadow-md", isExpanded && "ring-2 ring-emerald-100")}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <ChevronRight className={cn("h-4 w-4 transition-transform text-slate-300", isExpanded && "rotate-90")} />
                                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{item.type}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[18px] font-black text-emerald-500 tabular-nums">{pct}%</span>
                                                                <span className="text-[10px] font-bold text-slate-400">{item.completed}/{item.all}</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
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
                                                                            <div key={taskName} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                                                <div className="flex justify-between items-center mb-1.5">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <ClipboardCheck className="h-3 w-3 text-emerald-400" />
                                                                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{taskName}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[13px] font-black text-emerald-500 tabular-nums">{subPct}%</span>
                                                                                        <span className="text-[9px] font-bold text-slate-400">{tv.completed}/{tv.all}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
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

                <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 shadow-lg">
                    <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><BarChart className="h-4 w-4 text-blue-500"/> MISSION STRATEGY ENGINE ONLINE</div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" className="h-12 px-10 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400" onClick={() => onOpenChange(false)}>Cancel Session</Button>
                        <Button onClick={handleSave} disabled={saving || readOnly} className="h-14 px-16 rounded-[24px] bg-blue-600 border-none text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 transition-all hover:translate-y-[-3px] active:scale-95">{saving ? <Activity className="h-4 w-4 animate-spin mr-2"/> : "Finalize Scope Matrix"}</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Copy Scope Dialog */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
            <DialogContent className="max-w-[420px] bg-white p-6 rounded-3xl border-none shadow-2xl">
                <DialogHeader className="space-y-3">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-2"><Copy className="w-6 h-6" /></div>
                    <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Copy Scope Matrix?</DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 font-medium leading-relaxed">
                        Do you want to perfectly duplicate all inspection selections from your currently active report to this new report?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-8 flex items-center justify-end gap-3 sm:justify-end">
                    <Button variant="ghost" className="h-10 rounded-xl px-5 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-wider" onClick={() => handleConfirmAddReport(false)}>Empty Report</Button>
                    <Button className="h-10 rounded-xl px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 text-xs font-bold uppercase tracking-wider transition-transform active:scale-95" onClick={() => handleConfirmAddReport(true)}>Copy & Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
