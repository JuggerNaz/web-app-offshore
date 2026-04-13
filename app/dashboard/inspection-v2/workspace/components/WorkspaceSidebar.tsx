"use client";

import React from "react";
import { createPortal } from "react-dom";
import { 
    Plus, 
    Edit, 
    Settings, 
    ArrowLeft, 
    ArrowRight, 
    ChevronDown, 
    Video, 
    X 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { TapeManagementCard } from "./TapeManagementCard";
import { TapeLogEvents } from "./TapeLogEvents";
import { VideoInterface } from "./VideoInterface";

interface WorkspaceSidebarProps {
    inspMethod: "DIVING" | "ROV";
    activeDep: any;
    timeInWater: string;
    currentMovement: string;
    diveActionsList: any[];
    ROV_MOVEMENT_BRANCHES: Record<string, string[]>;
    handleMovementPrev: () => void;
    handleMovementNext: () => void;
    handleMovementLog: (action: string) => void;
    setIsDiveSetupForNew: (val: boolean) => void;
    setIsDiveSetupOpen: (val: boolean) => void;
    setIsMovementLogOpen: (val: boolean) => void;
    
    // Tape Props
    vidState: "IDLE" | "RECORDING" | "PAUSED";
    vidTimer: number;
    tapeId: number | null;
    tapeNo: string;
    activeChapter: number;
    jobTapes: any[];
    videoEvents: any[];
    handleLogEvent: (action: string) => void;
    setTapeId: (id: number | null) => void;
    setTapeNo: (no: string) => void;
    setActiveChapter: (ch: number) => void;
    setIsNewTapeOpen: (val: boolean) => void;
    handleOpenEditTape: () => void;
    handleDeleteTape: (id: number) => void;
    handleDeleteEvent: (id: string, type: string, realId: number) => void;
    setEditingEvent: (ev: any) => void;
    tapeLogExpanded: boolean;
    setTapeLogExpanded: (val: boolean) => void;
    formatTime: (sec: number) => string;
    
    // Video Props
    pipWindow: Window | null;
    renderStreamUI: () => React.ReactNode;
}

export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
    const {
        inspMethod, activeDep, timeInWater, currentMovement, 
        diveActionsList, ROV_MOVEMENT_BRANCHES, 
        handleMovementPrev, handleMovementNext, handleMovementLog,
        setIsDiveSetupForNew, setIsDiveSetupOpen, setIsMovementLogOpen,
        vidState, vidTimer, tapeId, tapeNo, activeChapter, jobTapes, 
        videoEvents, handleLogEvent, setTapeId, setTapeNo, setActiveChapter,
        setIsNewTapeOpen, handleOpenEditTape, handleDeleteTape, 
        handleDeleteEvent, setEditingEvent, tapeLogExpanded, 
        setTapeLogExpanded, formatTime, pipWindow, renderStreamUI
    } = props;

    return (
        <div className="w-[320px] flex flex-col gap-3 shrink-0 overflow-hidden">
            {/* 1. Diver / ROV Log */}
            <Card className="flex flex-col border-slate-200 shadow-sm rounded-md shrink-0 mb-2">
                <div className="bg-[#1f2937] text-white px-3 py-2 text-sm font-bold uppercase tracking-widest flex justify-between items-center rounded-t-md">
                    <span>{inspMethod === "DIVING" ? "DIVER LOG" : "ROV DIVE LOG"}</span>
                    <div className="flex items-center gap-2 text-slate-300">
                        <button onClick={() => { setIsDiveSetupForNew(true); setIsDiveSetupOpen(true); }} className="flex items-center gap-1 p-1 hover:text-white transition" title="New Dive">
                            <Plus className="w-4 h-4" /> <span className="text-[10px] hidden lg:inline">New Dive</span>
                        </button>
                        <button onClick={() => setIsMovementLogOpen(true)} className="p-1 hover:text-white transition" title="Edit Events"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => { setIsDiveSetupForNew(false); setIsDiveSetupOpen(true); }} className="p-1 hover:text-white transition" title="Settings"><Settings className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="p-2.5 bg-white space-y-2 rounded-b-md">
                    <div className="flex justify-between text-xs px-1">
                        <div><span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-0.5">Active Selection</span><span className="font-bold text-slate-800 text-xs">{activeDep?.jobNo || "None"}</span></div>
                        <div className="text-right"><span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-0.5">Time In Water</span><span className="font-mono font-bold text-blue-600 text-xs">{timeInWater}</span></div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100/60 rounded px-2 py-1.5 text-center relative">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Current Movement</span>
                        <span className="font-black text-slate-900 text-[14px] leading-tight flex items-center justify-center">{currentMovement || "Awaiting Deployment"}</span>
                    </div>

                    <div className="flex gap-1.5">
                        <Button
                            onClick={handleMovementPrev}
                            disabled={currentMovement === 'Awaiting Deployment' || (inspMethod === 'DIVING' && currentMovement === diveActionsList[0]?.label)}
                            variant="outline"
                            className="flex-1 h-7 text-[11px] font-bold text-slate-500 border-slate-200 hover:text-slate-700 bg-white shadow-sm"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Rollback
                        </Button>

                        {inspMethod === "DIVING" ? (
                            <Button
                                onClick={handleMovementNext}
                                disabled={currentMovement === diveActionsList[diveActionsList.length - 1]?.label}
                                className="flex-[1.5] h-7 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm"
                            >
                                {currentMovement === 'Awaiting Deployment' ? "Next" :
                                    (diveActionsList.findIndex(a => a.label === currentMovement) < diveActionsList.length - 1
                                        ? "Next"
                                        : "Completed")} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                        ) : (
                            (() => {
                                const options = ROV_MOVEMENT_BRANCHES[currentMovement || 'Awaiting Deployment'] || [];
                                const isCompleted = options.length === 0;

                                if (isCompleted) {
                                    return (
                                        <Button disabled className="flex-[1.5] h-7 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm">
                                            Completed <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                        </Button>
                                    );
                                }

                                if (options.length === 1) {
                                    return (
                                        <Button onClick={() => handleMovementLog(options[0])} className="flex-[1.5] h-7 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm truncate">
                                            Next: {options[0]} <ArrowRight className="w-3.5 h-3.5 ml-1 shrink-0" />
                                        </Button>
                                    );
                                }

                                return (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button className="flex-[1.5] h-7 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm">
                                                Next Action... <ChevronDown className="w-3.5 h-3.5 ml-1 shrink-0" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            {options.map(opt => (
                                                <DropdownMenuItem key={opt} onClick={() => handleMovementLog(opt)} className="text-xs font-bold cursor-pointer">
                                                    Select: {opt}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                );
                            })()
                        )}
                    </div>
                </div>
            </Card>

            {/* 2. Video Tape Management (MODULAR) */}
            <TapeManagementCard
                vidState={vidState}
                vidTimer={vidTimer}
                tapeId={tapeId}
                tapeNo={tapeNo}
                activeChapter={activeChapter}
                jobTapes={jobTapes}
                handleLogEvent={handleLogEvent}
                setTapeId={setTapeId}
                setTapeNo={setTapeNo}
                setActiveChapter={setActiveChapter}
                setIsNewTapeOpen={setIsNewTapeOpen}
                handleOpenEditTape={handleOpenEditTape}
                formatTime={formatTime}
                handleDeleteTape={handleDeleteTape}
                canDelete={tapeId ? !videoEvents.some((ev: any) => ev.tapeId === tapeId) : false}
                onChapterChange={(ch: number) => {
                    const match = jobTapes.find(t => t.tape_no === tapeNo && t.chapter_no === ch);
                    if (match) {
                        setTapeId(match.tape_id);
                        setActiveChapter(match.chapter_no);
                    } else {
                        setActiveChapter(ch);
                    }
                }}
            >
                <TapeLogEvents 
                    videoEvents={videoEvents.filter((ev: any) => ev.tapeId === tapeId)}
                    handleDeleteEvent={handleDeleteEvent}
                    onEditEvent={setEditingEvent}
                    expanded={tapeLogExpanded}
                    setExpanded={setTapeLogExpanded}
                    isFloating={!!pipWindow}
                />
            </TapeManagementCard>

            {/* 6. Video Interface (Reduced Size) */}
            {!pipWindow && (
                <div className="flex-1 min-h-[180px] bg-black rounded-lg overflow-hidden border border-slate-800 shadow-xl relative">
                    {renderStreamUI()}
                </div>
            )}

            {/* PiP Portal */}
            {pipWindow && createPortal(
                <div className="h-full w-full bg-black flex flex-col overflow-hidden select-none">
                    <div className="bg-slate-900 p-2.5 flex justify-between items-center border-b border-white/10 z-50 shrink-0">
                        <span className="text-[11px] text-white font-black uppercase tracking-widest flex items-center gap-2">
                            <Video className="w-3.5 h-3.5 text-red-500 animate-pulse" /> LIVE STREAMING CONTROL
                        </span>
                        <button onClick={() => pipWindow.close()} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {renderStreamUI()}
                    </div>
                </div>,
                pipWindow.document.body
            )}
        </div>
    );
}
