"use client";

import { useInspection } from "@/components/inspection/inspection-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Camera, Clock, AlertTriangle, Save, FileText, Square, Trash2 } from "lucide-react";

export function InspectionForm() {
    const { state, updateState, saveEvent, validation } = useInspection();

    return (
        <div className="space-y-8 pb-32">
            {/* Step 1: Context */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    Inspection Context
                </h2>
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500 uppercase tracking-wider">Inspection Mode</Label>
                        <div className="text-sm font-medium text-slate-200">{state.inspectionMode}</div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500 uppercase tracking-wider">Supervisor</Label>
                        <div className="text-sm font-medium text-slate-200">{state.supervisor}</div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500 uppercase tracking-wider">Date & Time</Label>
                        <div className="text-sm font-mono text-blue-400">{state.dateTime || "Connecting..."}</div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500 uppercase tracking-wider">ROV Position</Label>
                        <div className="text-sm font-mono text-slate-400">{state.rovPosition}</div>
                    </div>
                </div>
            </section>

            {/* Step 2: Component */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    Component & Location
                </h2>
                <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Select Component <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Input
                                placeholder="Search component ID (e.g. KP-101)..."
                                className="bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600"
                                value={state.componentId}
                                onChange={(e) => updateState({ componentId: e.target.value, componentName: `Component ${e.target.value}` })}
                            />
                            {state.componentId && (
                                <div className="absolute right-3 top-2.5 text-xs text-green-500 font-medium animate-in fade-in">
                                    ✓ Found
                                </div>
                            )}
                        </div>
                        {state.componentId && (
                            <div className="mt-2 p-2 bg-slate-900/50 rounded border border-slate-800 flex gap-4 text-xs">
                                <div>
                                    <span className="text-slate-500 block">Depth</span>
                                    <span className="font-mono text-slate-300">-45.2m</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Zone</span>
                                    <span className="text-slate-300">Splash Zone</span>
                                </div>
                                <div className="ml-auto flex items-center">
                                    <span className="px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded text-[10px] uppercase font-bold border border-blue-900/50">Auto-Filled</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Step 3: Observation */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    Observation
                </h2>
                <div className="rounded-lg border border-slate-800 p-5 space-y-5 bg-slate-900/20 shadow-inner">
                    <div className="space-y-2">
                        <Label>Observation Type <span className="text-red-500">*</span></Label>
                        <Select onValueChange={(val) => updateState({ observationType: val })} value={state.observationType}>
                            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-200">
                                <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                <SelectItem value="general">General Condition</SelectItem>
                                <SelectItem value="corrosion">Corrosion</SelectItem>
                                <SelectItem value="damage">Physical Damage</SelectItem>
                                <SelectItem value="marine_growth">Marine Growth</SelectItem>
                                <SelectItem value="debris">Debris</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Description <span className="text-red-500">*</span></Label>
                        <Textarea
                            placeholder="Enter detailed observation..."
                            className="min-h-[120px] bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600 resize-none focus-visible:ring-blue-600"
                            value={state.description}
                            onChange={(e) => updateState({ description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-4">
                            <div className="space-y-4">
                                {state.cpValues.map((val, idx) => (
                                    <div key={idx} className="space-y-2 animate-in slide-in-from-left-2 fade-in">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-200">
                                                CP Value {state.cpValues.length > 1 ? `#${idx + 1}` : ""}
                                            </Label>
                                            {idx > 0 && (
                                                <button
                                                    onClick={() => {
                                                        const newCpValues = state.cpValues.filter((_, i) => i !== idx);
                                                        updateState({ cpValues: newCpValues });
                                                    }}
                                                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                placeholder="e.g. -950"
                                                className="bg-slate-950 border-slate-700 text-slate-100 font-mono h-[46px] focus:ring-blue-500/20 transition-all"
                                                value={val}
                                                onChange={(e) => {
                                                    const newCpValues = [...state.cpValues];
                                                    newCpValues[idx] = e.target.value;
                                                    updateState({ cpValues: newCpValues });
                                                }}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">mV</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-dashed border-slate-800 hover:border-slate-600 hover:bg-slate-800/50 text-slate-400 transition-all text-[11px] font-medium h-9"
                                onClick={() => updateState({ cpValues: [...state.cpValues, ""] })}
                            >
                                + ADDITIONAL CP
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label>Marine Growth</Label>
                            <Select onValueChange={(val) => updateState({ marineGrowthType: val })} value={state.marineGrowthType}>
                                <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-200 h-[46px]">
                                    <SelectValue placeholder="Select choice..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                    <SelectItem value="hard_and_soft">Hard and Soft</SelectItem>
                                    <SelectItem value="soft">Soft</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 p-3">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-full", state.isAnomaly ? "bg-red-500/20 text-red-500" : "bg-slate-800 text-slate-500")}>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <Label className="text-base cursor-pointer" htmlFor="anomaly-mode">Flag as Anomaly</Label>
                                <p className="text-xs text-slate-500">Requires immediate attention or further review</p>
                            </div>
                        </div>
                        <Switch
                            id="anomaly-mode"
                            checked={state.isAnomaly}
                            onCheckedChange={(checked) => updateState({ isAnomaly: checked })}
                        />
                    </div>

                    {state.isAnomaly && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 fade-in">
                            <Label className="text-red-400">Anomaly Reference ID <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="e.g. ANOM-2024-X"
                                className="bg-red-950/10 border-red-900/50 text-red-100 placeholder:text-red-900/50 focus-visible:ring-red-500"
                                value={state.anomalyReference}
                                onChange={(e) => updateState({ anomalyReference: e.target.value })}
                            />
                        </div>
                    )}
                </div>
            </section>

            {/* Recent Log Section (Moved from Right) */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    Recent Log
                </h2>
                <div className="grid grid-cols-1 gap-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="group relative p-4 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-mono text-blue-400 font-bold tracking-tight">EVT-2024-00{i}</span>
                                <span className="text-[10px] text-slate-500 font-medium">10:4{i}:00 AM</span>
                            </div>
                            <div className="text-sm text-slate-200 font-medium line-clamp-1">Minor corrosion on Leg B2 - Structural integrity verified</div>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded uppercase font-black tracking-widest">General</span>
                                <span className="text-[9px] px-1.5 py-0.5 bg-blue-900/20 text-blue-400 rounded uppercase font-black tracking-widest border border-blue-900/30">Verified</span>
                            </div>

                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-1 group-hover:translate-x-0">
                                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                                    →
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Sticky Save Bar */}
            <div className="fixed bottom-6 w-[calc(100%-620px)] max-w-3xl left-[310px] right-[350px] mx-auto rounded-lg border border-slate-700 bg-slate-900/95 p-4 backdrop-blur-md shadow-2xl flex items-center justify-between z-20">
                <div className="flex flex-col">
                    {!validation.isValid ? (
                        <>
                            <div className="text-xs font-bold text-amber-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Missing Required Data
                            </div>
                            <div className="text-xs text-slate-400">
                                {validation.missingFields.join(", ")}
                            </div>
                        </>
                    ) : (
                        <div className="text-sm font-medium text-green-500 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" /> Ready to Save
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="ghost"
                        className="text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={() => saveEvent(true)}
                    >
                        Save Draft
                    </Button>
                    <Button
                        disabled={!validation.isValid}
                        onClick={() => saveEvent(false)}
                        className={cn(
                            "gap-2 font-bold transition-all",
                            validation.isValid
                                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                                : "bg-slate-800 text-slate-500"
                        )}
                    >
                        <Save className="h-4 w-4" />
                        Save Event
                    </Button>
                </div>
            </div>
        </div>
    );
}

function CheckCircle({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="m9 11 3 3L22 4" />
        </svg>
    )
}
