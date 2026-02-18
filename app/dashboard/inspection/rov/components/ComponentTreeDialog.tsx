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
import { Database, ChevronRight, ChevronDown, Check } from "lucide-react";
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
}

export default function ComponentTreeDialog({
    open,
    onOpenChange,
    structureId,
    jobpackId,
    sowId,
    onComponentSelect,
    selectedComponent,
}: ComponentTreeDialogProps) {
    const supabase = createClient();
    const [components, setComponents] = useState<any[]>([]);
    const [internalSelection, setInternalSelection] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

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

    const filteredComponents = components.filter((c: any) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.trim().toLowerCase();
        const id = c.q_id || "";
        return String(id).toLowerCase().includes(searchLower);
    });

    // Calculate stats
    const sowCount = components.filter(c => c.sowItems?.length > 0).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
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
                </DialogHeader>

                <div className="space-y-4">
                    {/* Info Banner */}
                    {sowCount > 0 && (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                            <p className="text-xs text-blue-900 dark:text-blue-100">
                                📋 {sowCount} components linked to SOW Report
                            </p>
                        </div>
                    )}

                    {/* Search */}
                    <Input
                        placeholder="Search components..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    {/* Component List */}
                    <div className="max-h-[500px] overflow-y-auto border rounded-lg">
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
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-sm">
                                                        {componentId || "Unnamed Component"}
                                                    </p>
                                                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
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
                                                {isSelected && (
                                                    <Check className="h-5 w-5 text-green-600" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected Component Info */}
                    {internalSelection && (
                        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
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

                <DialogFooter className="mt-4">
                    <Button
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold h-12 text-base shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
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
