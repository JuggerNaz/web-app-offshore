"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Video, Play, Pause, Square, Plus } from "lucide-react";

interface TapeManagementCardProps {
    vidState: "IDLE" | "RECORDING" | "PAUSED";
    vidTimer: number;
    tapeId: number | null;
    tapeNo: string;
    activeChapter: number;
    jobTapes: any[];
    handleLogEvent: (action: string) => void;
    setTapeId: (id: number) => void;
    setTapeNo: (no: string) => void;
    setActiveChapter: (ch: number) => void;
    setIsNewTapeOpen: (open: boolean) => void;
    formatTime: (seconds: number) => string;
    children?: React.ReactNode;
}

export const TapeManagementCard: React.FC<TapeManagementCardProps> = ({
    vidState,
    vidTimer,
    tapeId,
    tapeNo,
    activeChapter,
    jobTapes,
    handleLogEvent,
    setTapeId,
    setTapeNo,
    setActiveChapter,
    setIsNewTapeOpen,
    formatTime,
    children
}) => {
    return (
        <Card className="border-slate-200 shadow-md rounded-lg bg-white overflow-hidden flex flex-col min-w-0">
            <div className="bg-slate-900 px-2.5 py-2 flex items-center justify-between min-w-0">
                <h3 className="text-[11px] font-black uppercase text-white tracking-widest flex items-center gap-2 min-w-0 truncate">
                    <Video className="w-4 h-4 text-blue-400 shrink-0" /> VIDEO LOG
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${vidState === 'RECORDING' ? 'bg-red-500 animate-pulse' : (vidState === 'PAUSED' ? 'bg-amber-500' : 'bg-slate-500')}`} />
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-wider">{vidState}</span>
                </div>
            </div>

            <div className="p-2.5 space-y-2.5 min-w-0">
                <div className="flex items-end gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Active Tape</label>
                        <div className="flex items-center gap-1.5">
                            <Select value={String(tapeId || '')} onValueChange={(v) => {
                                const t = jobTapes.find(x => String(x.tape_id) === v);
                                if (t) {
                                    setTapeId(t.tape_id);
                                    setTapeNo(t.tape_no);
                                    setActiveChapter(t.chapter_no || 1);
                                }
                            }}>
                                <SelectTrigger className="h-9 text-[11px] font-bold bg-slate-50 border-slate-200 focus:ring-blue-500/20 min-w-0 flex-1">
                                    <SelectValue placeholder="Select Tape" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 shadow-xl">
                                    {jobTapes.map((t: any) => (
                                        <SelectItem key={t.tape_id} value={String(t.tape_id)} className="text-[12px] font-medium py-2 focus:bg-blue-50 focus:text-blue-700">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{t.tape_no}</span>
                                                <span className="text-[10px] text-slate-400">Chapters: {t.chapter_no || 1} • Status: {t.status}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    {jobTapes.length === 0 && (
                                        <div className="px-2 py-3 text-center text-[11px] text-slate-400 italic">
                                            No tapes yet
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9 shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                            onClick={() => setIsNewTapeOpen(true)}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-xs font-bold">Create New Tape</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                    <div className="w-16 shrink-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Chapter</label>
                        <div className="h-9 flex items-center justify-center font-mono font-black text-blue-700 bg-blue-50 border border-blue-100 rounded-md text-[14px] shadow-sm">{activeChapter}</div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-3 flex flex-col gap-3 shadow-inner border border-slate-800 min-w-0">
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Recording Duration</span>
                        <span className="text-[clamp(1.25rem,5vw,2rem)] font-mono font-black text-green-400 tabular-nums tracking-[0.08em] leading-none drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]">{formatTime(vidTimer)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1.5 min-w-0">
                        {vidState === "IDLE" ? (
                            <Button 
                                onClick={() => handleLogEvent("Start Tape")} 
                                className="col-span-2 h-10 bg-red-600 hover:bg-red-700 text-white font-black text-[11px] gap-1.5 shadow-lg shadow-red-600/30 uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-red-800"
                            >
                                <Play className="w-3.5 h-3.5 fill-current shrink-0" /> START RECORDING
                            </Button>
                        ) : vidState === "RECORDING" ? (
                            <>
                                <Button 
                                    onClick={() => handleLogEvent("Pause")} 
                                    className="h-10 bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] gap-1.5 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-amber-700 uppercase tracking-wider min-w-0"
                                >
                                    <Pause className="w-3.5 h-3.5 fill-current shrink-0" /> PAUSE
                                </Button>
                                <Button 
                                    onClick={() => handleLogEvent("Stop Tape")} 
                                    className="h-10 bg-slate-700 hover:bg-black text-white font-black text-[11px] gap-1.5 shadow-lg shadow-slate-900/40 transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-slate-900 uppercase tracking-wider min-w-0"
                                >
                                    <Square className="w-3.5 h-3.5 fill-current shrink-0" /> STOP TAPE
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button 
                                    onClick={() => handleLogEvent("Resume")} 
                                    className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] gap-1.5 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-blue-800 uppercase tracking-wider min-w-0"
                                >
                                    <Play className="w-3.5 h-3.5 fill-current shrink-0" /> RESUME
                                </Button>
                                <Button 
                                    onClick={() => handleLogEvent("Stop Tape")} 
                                    className="h-10 bg-slate-700 hover:bg-black text-white font-black text-[11px] gap-1.5 shadow-lg shadow-slate-900/40 transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-slate-900 uppercase tracking-wider min-w-0"
                                >
                                    <Square className="w-3.5 h-3.5 fill-current shrink-0" /> STOP TAPE
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                {children}
            </div>
        </Card>
    );
};
