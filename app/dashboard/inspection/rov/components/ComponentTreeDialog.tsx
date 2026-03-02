"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, ChevronRight, ChevronDown, Check, Plus, Trash2, ArchiveRestore } from "lucide-react";
import specAdditionalDetails from "@/utils/spec-additional-details.json";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ComponentTreeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    structureId: string | null;
    jobpackId: string | null;
    sowId: string | null;
    onComponentSelect: (component: any) => void;
    selectedComponent: any;
    onCreateNew?: (typeCode: string) => void;
}

export default function ComponentTreeDialog({
    open,
    onOpenChange,
    structureId,
    jobpackId,
    sowId,
    onComponentSelect,
    selectedComponent,
    onCreateNew
}: ComponentTreeDialogProps) {
    const supabase = createClient();
    const [components, setComponents] = useState<any[]>([]);
    const [internalSelection, setInternalSelection] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [filterMode, setFilterMode] = useState<"sow" | "all">("sow");
    const [createType, setCreateType] = useState("");

    // Extract unique types from spec details for creation
    const componentTypes = specAdditionalDetails.data
        .filter(d => d.code)
        .reduce((acc: any[], current) => {
            const x = acc.find(item => item.code === current.code);
            if (!x) return acc.concat([current]);
            return acc;
        }, []);

    useEffect(() => {
        if (open) {
            setInternalSelection(selectedComponent);
        }
    }, [open, selectedComponent]);

    useEffect(() => {
        if (open && structureId) {
            loadComponents();
        }
    }, [open, structureId, jobpackId, sowId]);

    async function loadComponents() {
        if (!structureId) return;

        setLoading(true);
        try {
            // 1. Load ALL structure components (Base List)
            const { data: structData, error: structError } = await supabase
                .from("structure_components")
                .select("*")
                .eq("structure_id", parseInt(structureId))
                .order("q_id");

            if (structError) {
                console.error("Error loading structure components:", structError);
                toast.error("Failed to load components");
                setComponents([]);
                return;
            }

            let finalComponents = structData || [];

            // 2. Load SOW items to annotate the list
            if (jobpackId && sowId) {
                const [actualSowId, itemId] = sowId.split('-');

                // Get report number filter if applicable
                let targetReportNumber = null;
                if (itemId) {
                    const { data: itemData } = await supabase
                        .from('u_sow_items')
                        .select('report_number')
                        .eq('id', itemId)
                        .maybeSingle();
                    if (itemData?.report_number) {
                        targetReportNumber = itemData.report_number;
                    }
                }

                let query = supabase
                    .from("u_sow_items")
                    .select('*, u_sow!inner(structure_id)')
                    .eq("sow_id", actualSowId)
                    .eq("u_sow.structure_id", parseInt(structureId));

                if (targetReportNumber) {
                    query = query.eq("report_number", targetReportNumber);
                }

                const { data: sowData } = await query;

                // 3. Merge SOW info into structure components
                if (sowData && sowData.length > 0) {
                    const sowMap = new Map<number, any[]>();
                    sowData.forEach(item => {
                        const compId = item.component_id;
                        if (compId) {
                            if (!sowMap.has(compId)) {
                                sowMap.set(compId, []);
                            }
                            sowMap.get(compId)?.push(item);
                        }
                    });

                    finalComponents = finalComponents.map(comp => ({
                        ...comp,
                        sowItems: sowMap.get(comp.id) || []
                    }));
                }
            }

            setComponents(finalComponents);

            // Auto-switch to 'all' if there are no SOW components
            if (finalComponents.filter(c => c.sowItems?.length > 0).length === 0) {
                setFilterMode("all");
            } else {
                setFilterMode("sow");
            }
            console.log(`Loaded ${finalComponents.length} components.`);

        } catch (error) {
            console.error("Error loading components:", error);
            setComponents([]);
        } finally {
            setLoading(false);
        }
    }

    function toggleNode(qid: string) {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(qid)) {
            newExpanded.delete(qid);
        } else {
            newExpanded.add(qid);
        }
        setExpandedNodes(newExpanded);
    }

    function handleSelect(component: any) {
        // Just update local selection, don't close dialog yet
        setInternalSelection(component);
    }

    function handleConfirm() {
        if (internalSelection) {
            onComponentSelect({
                ...internalSelection,
                isFromSOW: internalSelection.sowItems && internalSelection.sowItems.length > 0,
                component_qid: internalSelection.q_id
            });
        }
    }

    async function handleDelete(id: number, e: React.MouseEvent) {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to permanently delete this component? This cannot be undone.")) return;
        try {
            const { error } = await supabase.from("structure_components").delete().eq("id", id);
            if (error) throw error;
            toast.success("Component deleted");
            if (internalSelection?.id === id) setInternalSelection(null);
            loadComponents();
        } catch (err: any) {
            toast.error("Failed to delete component");
            console.error(err);
        }
    }

    async function handleArchive(id: number, e: React.MouseEvent) {
        e.stopPropagation();
        if (!window.confirm("Archive this component? It will be hidden from normal operations.")) return;
        try {
            // Wait, we need to check if is_archived column exists or use metadata flag
            // for safety we inject is_archived: true into metadata if no column exists, but usually there's a status or we just delete. Let's try to update status or metadata
            const comp = components.find(c => c.id === id);
            let meta: any = {};
            try { meta = typeof comp.metadata === "string" ? JSON.parse(comp.metadata) : (comp.metadata || {}); } catch (e) { }
            meta.is_archived = true;

            const { error } = await supabase.from("structure_components").update({ metadata: meta }).eq("id", id);
            if (error) throw error;
            toast.success("Component archived");
            loadComponents();
        } catch (err: any) {
            toast.error("Failed to archive component");
            console.error(err);
        }
    }

    const filteredComponents = components.filter((c: any) => {
        // Exclude archived components
        try {
            const meta = typeof c.metadata === "string" ? JSON.parse(c.metadata) : (c.metadata || {});
            if (meta.is_archived) return false;
        } catch (e) { }

        const hasSOW = c.sowItems && c.sowItems.length > 0;
        if (filterMode === "sow" && !hasSOW) return false;

        if (!searchTerm) return true;
        const searchLower = searchTerm.trim().toLowerCase();
        const id = c.q_id || "";
        return String(id).toLowerCase().includes(searchLower);
    });

    // Calculate stats
    const sowCount = components.filter(c => c.sowItems?.length > 0).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-4 md:p-6 rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 overflow-hidden">
                <DialogHeader className="shrink-0 mb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                                <Database className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">Component Tree</DialogTitle>
                                <DialogDescription>
                                    Select a component for inspection
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex flex-col space-y-4">
                    {/* Toolbars */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-950 p-2 md:p-3 rounded-xl border shadow-sm shrink-0">
                        {/* Filter Toggle */}
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                            <Button
                                variant={filterMode === "sow" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setFilterMode("sow")}
                                className="h-8 text-xs font-bold"
                            >
                                SOW Listed ({sowCount})
                            </Button>
                            <Button
                                variant={filterMode === "all" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setFilterMode("all")}
                                className="h-8 text-xs font-bold"
                            >
                                All Components
                            </Button>
                        </div>

                        {/* Search & Create */}
                        <div className="flex items-center gap-2 flex-1 min-w-[300px] justify-end">
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-[200px] h-9"
                            />
                            {onCreateNew && (
                                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                                    <Select value={createType} onValueChange={setCreateType}>
                                        <SelectTrigger className="w-[110px] h-9">
                                            <SelectValue placeholder="Type..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {componentTypes.map(t => (
                                                <SelectItem key={t.code} value={t.code}>{t.code?.toUpperCase()}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        className="h-9 gap-1 whitespace-nowrap"
                                        disabled={!createType}
                                        onClick={() => onCreateNew(createType)}
                                    >
                                        <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Component List */}
                    <div className="flex-1 overflow-y-auto border bg-white dark:bg-slate-950 rounded-xl shadow-inner relative">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">
                                Loading components...
                            </div>
                        ) : filteredComponents.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                No components found
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredComponents.map((component: any, index: number) => {
                                    const hasSOW = component.sowItems && component.sowItems.length > 0;
                                    const componentId = component.q_id;
                                    // Use distinct database ID for selection matching since Q_ID is not unique
                                    const isSelected = internalSelection?.id === component.id;
                                    const uniqueKey = component.id || `${componentId}-${index}`;

                                    return (
                                        <div
                                            key={uniqueKey}
                                            className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition-colors ${isSelected
                                                ? "bg-green-50 dark:bg-green-950/20"
                                                : ""
                                                }`}
                                            onClick={() => handleSelect(component)}
                                        >
                                            <div className="flex items-start justify-between group">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                                                            {componentId || "Unnamed Component"}
                                                        </p>
                                                        {component.code && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                                {component.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground space-y-0.5 mt-2">
                                                        {hasSOW && (
                                                            <div className="mb-3 pb-2 border-b border-dashed border-gray-200 dark:border-gray-800">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    {component.sowItems.map((item: any, i: number) => {
                                                                        const status = (item.status || 'pending').toLowerCase();
                                                                        let statusStyles = "bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900";
                                                                        let icon = "🎯";

                                                                        if (status === 'completed') {
                                                                            statusStyles = "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900";
                                                                            icon = "✅";
                                                                        } else if (status === 'incomplete') {
                                                                            statusStyles = "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900";
                                                                            icon = "⚠️";
                                                                        }

                                                                        return (
                                                                            <div key={i} className={`p-2 rounded-md border text-xs ${statusStyles}`}>
                                                                                <div className="font-medium truncate flex items-center gap-1.5" title={item.inspection_name}>
                                                                                    <span>{icon}</span>
                                                                                    <span>{item.inspection_name || "Inspection"}</span>
                                                                                </div>
                                                                                <div className="flex items-center justify-between mt-1 opacity-80 px-0.5">
                                                                                    <span className="font-mono">{item.inspection_code}</span>
                                                                                    <span className="uppercase text-[10px] font-bold tracking-wider">{status}</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Structure Details (Always render since we are using structure_components source) */}
                                                        {(() => {
                                                            let meta: any = {};
                                                            try {
                                                                if (typeof component.metadata === 'string') {
                                                                    meta = JSON.parse(component.metadata);
                                                                } else if (typeof component.metadata === 'object' && component.metadata) {
                                                                    meta = component.metadata;
                                                                }
                                                            } catch (e) { }

                                                            const sLeg = meta.s_leg || meta.start_leg || "-";
                                                            const fLeg = meta.f_leg || meta.end_leg || "-";
                                                            const sNode = component.s_node || meta.s_node || "-";
                                                            const fNode = component.f_node || meta.f_node || "-";

                                                            return (
                                                                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                                    <div><span className="font-medium text-slate-700 dark:text-slate-300">Start Leg:</span> {sLeg}</div>
                                                                    <div><span className="font-medium text-slate-700 dark:text-slate-300">End Leg:</span> {fLeg}</div>
                                                                    <div><span className="font-medium text-slate-700 dark:text-slate-300">Start Node:</span> {sNode}</div>
                                                                    <div><span className="font-medium text-slate-700 dark:text-slate-300">End Node:</span> {fNode}</div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-2 shrink-0">
                                                    {isSelected && (
                                                        <Check className="h-6 w-6 text-green-600 drop-shadow-sm" />
                                                    )}
                                                    {/* Actions (only for non-SOW) */}
                                                    {!hasSOW && (
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 mt-auto pb-1">
                                                            <Button
                                                                title="Archive Component"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                                                                onClick={(e) => handleArchive(component.id, e)}
                                                            >
                                                                <ArchiveRestore className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                title="Delete Component"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                                onClick={(e) => handleDelete(component.id, e)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected Component Info */}
                    {internalSelection && (
                        <div className="p-3 md:p-4 rounded-xl bg-green-50/80 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 shrink-0">
                            <p className="text-xs font-medium text-green-900 dark:text-green-100 mb-1">
                                Selected Component
                            </p>
                            <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                                {internalSelection.q_id}
                            </p>
                            {(() => {
                                let meta: any = {};
                                try {
                                    if (typeof internalSelection.metadata === 'string') {
                                        meta = JSON.parse(internalSelection.metadata);
                                    } else if (typeof internalSelection.metadata === 'object' && internalSelection.metadata) {
                                        meta = internalSelection.metadata;
                                    }
                                } catch (e) { }

                                const sLeg = meta.s_leg || meta.start_leg || "-";
                                const fLeg = meta.f_leg || meta.end_leg || "-";
                                const sNode = internalSelection.s_node || meta.s_node || "-";
                                const fNode = internalSelection.f_node || meta.f_node || "-";

                                return (
                                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        <div><span className="font-medium text-green-800 dark:text-green-200">Start Leg:</span> {sLeg}</div>
                                        <div><span className="font-medium text-green-800 dark:text-green-200">End Leg:</span> {fLeg}</div>
                                        <div><span className="font-medium text-green-800 dark:text-green-200">Start Node:</span> {sNode}</div>
                                        <div><span className="font-medium text-green-800 dark:text-green-200">End Node:</span> {fNode}</div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-2 shrink-0">
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-base shadow-sm hover:shadow-md transition-all active:scale-[0.98] rounded-xl"
                        onClick={handleConfirm}
                        disabled={!internalSelection}
                    >
                        Confirm Selection
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
