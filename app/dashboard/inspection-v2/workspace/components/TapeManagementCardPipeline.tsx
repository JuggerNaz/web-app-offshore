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
import { Video, Play, Pause, Square, Plus, Edit, Trash2, History } from "lucide-react";
import { format } from "date-fns";

interface TapeManagementCardProps {
    vidState: "IDLE" | "RECORDING" | "PAUSED";
    vidTimer: number;
    tapeId: number | null;
    tapeNo: string;
    activeChapter: number;
    jobTapes: any[];
    handleLogEvent: (action: string) => void;
    setTapeId: (id: number | null) => void;
    setTapeNo: (no: string) => void;
    setActiveChapter: (ch: number) => void;
    setIsNewTapeOpen: (open: boolean) => void;
    handleOpenEditTape: () => void;
    formatTime: (seconds: number) => string;
    handleDeleteTape?: (id: number) => void;
    canDelete?: boolean;
    onChapterChange?: (ch: number) => void;
    onOpenHistory?: () => void;
    children?: React.ReactNode;
}

export const TapeManagementCardPipeline: React.FC<TapeManagementCardProps> = ({
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
    handleOpenEditTape,
    formatTime,
    handleDeleteTape,
    canDelete,
    onChapterChange,
    onOpenHistory,
    children
}) => {
    const now = new Date();
    const dateStr = format(now, "dd MMM yyyy");
    const timeStr = format(now, "HH:mm:ss");

    return (
        <Card className="border-none shadow-none rounded-none bg-white dark:bg-[#090d16] overflow-y-auto custom-scrollbar flex flex-col h-full w-full min-w-0 flex-1">
            {/* Header */}
            <div className="bg-slate-100 dark:bg-[#030712] border-b border-slate-200 dark:border-cyan-500/10 px-3 py-2 flex items-center justify-between min-w-0">
                <h3 className="text-[10px] font-black uppercase text-slate-800 dark:text-cyan-400 tracking-[0.2em] flex items-center gap-2 min-w-0 truncate">
                    VIDEO LOG
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                    {/* Tape Management Icons */}
                    <TooltipProvider>
                        <div className="flex items-center gap-0.5">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setIsNewTapeOpen(true)}
                                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-all"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-[10px] font-bold">New Tape</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={handleOpenEditTape}
                                        disabled={!tapeId}
                                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-all disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                        <Edit className="w-3 h-3" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-[10px] font-bold">Edit Tape</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => handleDeleteTape && tapeId && handleDeleteTape(tapeId)}
                                        disabled={!tapeId || !canDelete}
                                        className={`p-1 text-slate-500 dark:text-slate-400 rounded transition-all ${!tapeId || !canDelete ? 'opacity-30 pointer-events-none' : 'hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-[10px] font-bold">Delete Tape</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                </div>
            </div>

            <div className="flex flex-col flex-1 min-w-0 overflow-y-auto custom-scrollbar">
                {/* Info Grid - Date, Time, Tape, Counter */}
                <div className="p-3 bg-slate-50/50 dark:bg-[#05080e] border-b border-slate-100 dark:border-slate-900 space-y-2 text-[10px] font-medium">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Date</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">: {dateStr}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Time</span>
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200">: {timeStr}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Tape Number</span>
                        <span className="font-bold font-mono text-blue-600 dark:text-cyan-400">: {tapeNo || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Chapter No.</span>
                        <span className="font-bold font-mono text-purple-600 dark:text-purple-400">: Chapter {activeChapter || 1}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Tape Counter</span>
                        <span className={`font-bold font-mono text-base ${vidState === "RECORDING" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                            : {formatTime(vidTimer)}
                        </span>
                    </div>
                </div>

                {/* Active Tape Selector (collapsed) */}
                <div className="px-3 py-2 bg-white dark:bg-[#090d16] border-b border-slate-100 dark:border-slate-900">
                    <Select value={String(tapeId || '')} onValueChange={(v) => {
                        const t = jobTapes.find(x => String(x.tape_id) === v);
                        if (t) {
                            setTapeId(t.tape_id);
                            setTapeNo(t.tape_no);
                            setActiveChapter(t.chapter_no || 1);
                        }
                    }}>
                        <SelectTrigger className="h-8 text-[10px] font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 w-full min-w-0 text-slate-800 dark:text-slate-200">
                            <SelectValue placeholder={tapeNo ? `${tapeNo} (Ch: ${activeChapter || 1})` : "Select Tape"}>
                                {jobTapes.find(t => String(t.tape_id) === String(tapeId)) ? `${jobTapes.find(t => String(t.tape_id) === String(tapeId))?.tape_no} (Ch: ${activeChapter || 1})` : (tapeNo ? `${tapeNo} (Ch: ${activeChapter || 1})` : "Select Tape")}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 shadow-xl">
                            {jobTapes.map((t: any) => (
                                <SelectItem key={t.tape_id} value={String(t.tape_id)} className="text-[12px] font-medium py-2 focus:bg-blue-100 dark:focus:bg-blue-900/30 focus:text-blue-700 dark:focus:text-blue-400 dark:text-slate-200">
                                    <div className="flex flex-col">
                                        <span className="font-bold">{t.tape_no}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Ch: {t.chapter_no || 1} • {t.status}</span>
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
                </div>

                {/* START / STOP / PAUSE Buttons */}
                <div className="p-2 bg-white dark:bg-[#090d16] flex gap-1.5 min-w-0">
                    <Button
                        onClick={() => vidState === "PAUSED" ? handleLogEvent("Resume") : handleLogEvent("Start Tape")}
                        disabled={vidState === "RECORDING"}
                        variant="outline"
                        className={`flex-1 h-9 px-1 text-[9px] font-black uppercase tracking-wider gap-1 rounded-md border-2 transition-all active:scale-95 min-w-0 ${
                            vidState === "RECORDING"
                                ? "border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed"
                                : "border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-400 bg-emerald-50/40 dark:bg-[#0c1322] active:bg-emerald-100 shadow-sm"
                        }`}
                    >
                        <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                        <span className="whitespace-nowrap">{vidState === "PAUSED" ? "Resume" : "Start"}</span>
                    </Button>

                    <Button
                        onClick={() => handleLogEvent("Stop Tape")}
                        disabled={vidState === "IDLE"}
                        variant="outline"
                        className={`flex-1 h-9 px-1 text-[9px] font-black uppercase tracking-wider gap-1 rounded-md border-2 transition-all active:scale-95 min-w-0 ${
                            vidState === "IDLE"
                                ? "border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed"
                                : "border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-400 bg-red-50/40 dark:bg-[#0c1322] active:bg-red-100 shadow-sm"
                        }`}
                    >
                        <Square className="w-3.5 h-3.5 fill-current shrink-0" />
                        <span className="whitespace-nowrap">Stop</span>
                    </Button>

                    <Button
                        onClick={() => handleLogEvent("Pause")}
                        disabled={vidState === "IDLE" || vidState === "PAUSED"}
                        variant="outline"
                        className={`flex-1 h-9 px-1 text-[9px] font-black uppercase tracking-wider gap-1 rounded-md border-2 transition-all active:scale-95 min-w-0 ${
                            vidState === "IDLE" || vidState === "PAUSED"
                                ? "border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed"
                                : "border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-400 bg-blue-50/40 dark:bg-[#0c1322] active:bg-blue-100 shadow-sm"
                        }`}
                    >
                        <Pause className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">Pause</span>
                    </Button>
                </div>
            </div>

            {/* Footer: View All Video Logs */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-[#05080e] shrink-0 mt-auto">
                <Button
                    onClick={onOpenHistory}
                    variant="outline"
                    className="w-full h-8 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-900 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 bg-transparent flex items-center justify-center gap-1.5"
                >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" strokeLinecap="round" />
                        <line x1="3" y1="12" x2="3.01" y2="12" strokeLinecap="round" />
                        <line x1="3" y1="18" x2="3.01" y2="18" strokeLinecap="round" />
                    </svg>
                    VIEW ALL VIDEO LOGS
                </Button>
            </div>

            {children}
        </Card>
    );
};
