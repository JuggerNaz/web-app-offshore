"use client";

import { useInspection } from "@/components/inspection/inspection-context";
import { cn } from "@/lib/utils";
import { Check, AlertCircle, Circle, Clock } from "lucide-react";

export function InspectionChecklist() {
    const { state, validation } = useInspection();

    const items = [
        { id: 'context', label: 'Inspection Context', status: validation.context },
        { id: 'component', label: 'Component Selected', status: validation.component },
        { id: 'position', label: 'Position Confirmed', status: validation.position },
        { id: 'observation', label: 'Observation Entered', status: validation.observation },
        { id: 'evidence', label: 'Video Linked', status: validation.evidence },
        { id: 'saved', label: 'Event Saved', status: validation.saved },
    ];

    return (
        <div className="space-y-6">
            {/* Sticky Summary Card */}
            <div className="rounded-lg bg-slate-800 p-4 border border-slate-700 shadow-xl sticky top-0 bg-slate-800/95 backdrop-blur z-10 transition-all">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Event</h3>
                    {state.isDraft && <span className="text-[10px] font-bold text-amber-500 animate-pulse">DRAFT</span>}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
                        <span className="text-slate-500 text-xs uppercase font-semibold">Component</span>
                        <span className={cn("font-mono font-medium", state.componentId ? "text-blue-400" : "text-slate-600")}>
                            {state.componentId || "--"}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
                        <span className="text-slate-500 text-xs uppercase font-semibold">Depth</span>
                        <span className="font-mono text-slate-300">{state.elevation || "--"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-1">
                        <span className="text-slate-500 text-xs uppercase font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Time</span>
                        <span className="font-mono text-xs text-slate-400">{state.evidence.timecode ? state.evidence.timecode.split(',')[1] : "--:--:--"}</span>
                    </div>
                </div>
            </div>

            {/* Checklist */}
            <div className="space-y-3 px-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Validation Checklist</h3>
                <div className="space-y-2">
                    {items.map((item) => {
                        const isComplete = item.status;
                        // Logic: Red if strictly required and missing (based on validation logic), Green if complete

                        let colorClass = "bg-slate-900/50 border-slate-800 text-slate-500";
                        let icon = <Circle className="h-2 w-2" />;
                        let borderColor = "border-slate-800";

                        if (isComplete) {
                            colorClass = "bg-green-950/20 text-green-400";
                            borderColor = "border-green-900/50";
                            icon = <Check className="h-3 w-3" />;
                        } else {
                            // Highlight immediate next steps or missing errors
                            if (['context', 'component', 'observation'].includes(item.id)) {
                                colorClass = "bg-red-950/10 text-red-500/80";
                                borderColor = "border-red-900/30";
                                icon = <AlertCircle className="h-3 w-3" />;
                            } else if (item.id === 'saved') {
                                colorClass = "bg-slate-900/50 text-slate-600"; // Neutral until ready
                            } else {
                                colorClass = "bg-yellow-950/10 text-yellow-600";
                                borderColor = "border-yellow-900/30";
                            }
                        }

                        return (
                            <div key={item.id} className={cn("flex items-center gap-3 rounded-md border p-2.5 text-sm transition-all duration-300", colorClass, borderColor)}>
                                <div className={cn("flex h-5 w-5 items-center justify-center rounded-full border border-current opacity-80 shrink-0")}>
                                    {icon}
                                </div>
                                <span className="font-medium truncate">{item.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Status Message */}
            <div className="mt-6 rounded-md bg-slate-900 p-3 text-xs text-slate-500 text-center">
                {validation.isValid ? (
                    <span className="text-green-500 font-medium">All systems go. Ready to save.</span>
                ) : (
                    <span>Complete all red items to proceed.</span>
                )}
            </div>
        </div>
    );
}
