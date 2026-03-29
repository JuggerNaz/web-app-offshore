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
    formatTime
}) => {
    return (
        <Card className="border-slate-200 shadow-md rounded-lg bg-white overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-3 py-2.5 flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase text-white tracking-widest flex items-center gap-2">
                    <Video className="w-4 h-4 text-blue-400" /> Tape Management
                </h3>
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${vidState === 'RECORDING' ? 'bg-red-500 animate-pulse' : (vidState === 'PAUSED' ? 'bg-amber-500' : 'bg-slate-500')}`} />
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">{vidState}</span>
                </div>
            </div>

            <div className="p-3 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Active Tape</label>
                        <Select value={String(tapeId || '')} onValueChange={(v) => {
                            const t = jobTapes.find(x => String(x.tape_id) === v);
                            if (t) {
                                setTapeId(t.tape_id);
                                setTapeNo(t.tape_no);
                                setActiveChapter(t.chapter_no || 1);
                            }
                        }}>
                            <SelectTrigger className="h-9 text-[12px] font-bold bg-slate-50 border-slate-200 focus:ring-blue-500/20">
                                <SelectValue placeholder="Select Tape" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200 shadow-xl">
                                <div className="p-1 border-b border-slate-100 mb-1">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="w-full justify-start h-8 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsNewTapeOpen(true);
                                        }}
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1" /> CREATE NEW TAPE
                                    </Button>
                                </div>
                                {jobTapes.map((t: any) => (
                                    <SelectItem key={t.tape_id} value={String(t.tape_id)} className="text-[12px] font-medium py-2 focus:bg-blue-50 focus:text-blue-700">
                                        <div className="flex flex-col">
                                            <span className="font-bold">{t.tape_no}</span>
                                            <span className="text-[10px] text-slate-400">Chapters: {t.chapter_no || 1} • Status: {t.status}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-20">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Chapter</label>
                        <div className="h-9 flex items-center justify-center font-mono font-black text-blue-700 bg-blue-50 border border-blue-100 rounded-md text-[14px] shadow-sm">{activeChapter}</div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-4 flex flex-col gap-4 shadow-inner border border-slate-800">
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Recording Duration</span>
                        <span className="text-[32px] font-mono font-black text-green-400 tabular-nums tracking-[0.1em] leading-none drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]">{formatTime(vidTimer)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        {vidState === "IDLE" ? (
                            <Button 
                                onClick={() => handleLogEvent("Start Tape")} 
                                className="col-span-2 h-12 bg-red-600 hover:bg-red-700 text-white font-black text-[12px] gap-2 shadow-lg shadow-red-600/30 uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-red-800"
                            >
                                <Play className="w-4 h-4 fill-current" /> START RECORDING
                            </Button>
                        ) : vidState === "RECORDING" ? (
                            <>
                                <Button 
                                    onClick={() => handleLogEvent("Pause")} 
                                    className="h-12 bg-amber-500 hover:bg-amber-600 text-white font-black text-[12px] gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-amber-700 uppercase tracking-widest"
                                >
                                    <Pause className="w-4 h-4 fill-current" /> PAUSE
                                </Button>
                                <Button 
                                    onClick={() => handleLogEvent("Stop Tape")} 
                                    className="h-12 bg-slate-700 hover:bg-black text-white font-black text-[12px] gap-2 shadow-lg shadow-slate-900/40 transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-slate-900 uppercase tracking-widest"
                                >
                                    <Square className="w-4 h-4 fill-current" /> STOP TAPE
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button 
                                    onClick={() => handleLogEvent("Resume")} 
                                    className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-[12px] gap-2 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-blue-800 uppercase tracking-widest"
                                >
                                    <Play className="w-4 h-4 fill-current" /> RESUME
                                </Button>
                                <Button 
                                    onClick={() => handleLogEvent("Stop Tape")} 
                                    className="h-12 bg-slate-700 hover:bg-black text-white font-black text-[12px] gap-2 shadow-lg shadow-slate-900/40 transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-slate-900 uppercase tracking-widest"
                                >
                                    <Square className="w-4 h-4 fill-current" /> STOP TAPE
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
};
