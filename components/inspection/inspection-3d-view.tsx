"use client";

import { useInspection } from "@/components/inspection/inspection-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Camera, Square } from "lucide-react";
import { toast } from "sonner";

export function Inspection3DView() {
    const { state, updateState } = useInspection();

    return (
        <div className="space-y-6">
            <div className="aspect-[4/5] w-full rounded-lg border border-slate-800 bg-slate-950 relative overflow-hidden group">
                <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
                    {/* Grid Background */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                </div>

                {/* Mock Platform Graphic */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-3/4 h-3/4 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]" viewBox="0 0 200 300">
                        {/* Legs */}
                        <line x1="60" y1="40" x2="40" y2="260" stroke="#475569" strokeWidth="4" />
                        <line x1="140" y1="40" x2="160" y2="260" stroke="#475569" strokeWidth="4" />

                        {/* Braces */}
                        <line x1="55" y1="100" x2="145" y2="100" stroke="#475569" strokeWidth="2" />
                        <line x1="50" y1="180" x2="150" y2="180" stroke="#475569" strokeWidth="2" />
                        <line x1="55" y1="100" x2="150" y2="180" stroke="#475569" strokeWidth="2" />
                        <line x1="145" y1="100" x2="50" y2="180" stroke="#475569" strokeWidth="2" />

                        {/* Selected Component Highlight */}
                        {state.componentId && (
                            <circle cx="100" cy="140" r="15" fill="rgba(59, 130, 246, 0.5)" stroke="#3b82f6" strokeWidth="2" className="animate-pulse" />
                        )}

                        {/* Text Label */}
                        {state.componentId && (
                            <g transform="translate(120, 135)">
                                <rect x="0" y="0" width="70" height="24" rx="4" fill="#0f172a" stroke="#1e293b" />
                                <text x="35" y="16" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontFamily="sans-serif">{state.componentId}</text>
                            </g>
                        )}
                    </svg>
                </div>

                <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-400 border border-slate-800">
                    Interactive View
                </div>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Video</h3>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "flex-1 gap-2 border-slate-700 hover:bg-slate-800 hover:text-white transition-all text-[10px] h-9",
                                state.evidence.isRecording && "bg-red-600/20 border-red-600/50 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                            )}
                            onClick={() => updateState({ evidence: { ...state.evidence, isRecording: true } })}
                            disabled={state.evidence.isRecording}
                        >
                            <div className={cn("h-1.5 w-1.5 rounded-full bg-red-500", state.evidence.isRecording && "animate-pulse")} />
                            START
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "flex-1 gap-2 border-slate-700 hover:bg-slate-800 hover:text-white transition-all text-[10px] h-9",
                                state.evidence.videoCaptured && !state.evidence.isRecording && "bg-blue-600/20 border-blue-600/50 text-blue-400"
                            )}
                            onClick={() => updateState({ evidence: { ...state.evidence, isRecording: false, videoCaptured: true } })}
                            disabled={!state.evidence.isRecording}
                        >
                            <Square className="h-3 w-3 fill-current" />
                            STOP
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            "w-full gap-2 border-slate-700 hover:bg-slate-800 hover:text-white transition-all text-[10px] h-9",
                            state.evidence.frameCount > 0 && "bg-blue-600/20 border-blue-600/50 text-blue-400"
                        )}
                        onClick={() => {
                            updateState({
                                evidence: {
                                    ...state.evidence,
                                    frameCount: (state.evidence.frameCount || 0) + 1
                                }
                            });
                            toast.success(`Frame #${(state.evidence.frameCount || 0) + 1} captured`, {
                                description: "Added to event evidence",
                                duration: 2000,
                            });
                        }}
                    >
                        <Camera className="h-3 w-3" />
                        GRAB FRAME
                        {state.evidence.frameCount > 0 && (
                            <span className="ml-auto bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                                {state.evidence.frameCount}
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
