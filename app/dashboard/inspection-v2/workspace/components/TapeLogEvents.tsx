"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
    History, 
    Trash2, 
    Edit, 
    Clock, 
    Video 
} from "lucide-react";
import { format } from "date-fns";

interface TapeLogEventsProps {
    videoEvents: any[];
    handleDeleteEvent: (id: string, logType: string, realId: number) => void;
    onEditEvent: (ev: any) => void;
    expanded?: boolean;
    setExpanded?: (v: boolean) => void;
    isFloating?: boolean;
    inline?: boolean;
}

export const TapeLogEvents: React.FC<TapeLogEventsProps> = ({
    videoEvents,
    handleDeleteEvent,
    onEditEvent,
    expanded,
    setExpanded,
    isFloating = false,
    inline = false,
}) => {
    const sortedEvents = [...videoEvents].sort((a, b) => {
        const timeA = a.eventTime ? new Date(a.eventTime).getTime() : 0;
        const timeB = b.eventTime ? new Date(b.eventTime).getTime() : 0;
        
        // Final descending sort by event time (latest first)
        if (timeA === timeB) {
            return (b.realId || b.id || 0) - (a.realId || a.id || 0);
        }
        return timeB - timeA;
    });

    const latestEvent = sortedEvents.length > 0 ? sortedEvents[0] : null;

    const firstEvent = videoEvents.find(ev => ev.tapeNo && ev.tapeNo !== "N/A") || videoEvents[0];
    const commonTapeNo = firstEvent?.tapeNo || "N/A";
    const commonDiveNo = firstEvent?.diveNo || "N/A";
    const commonStructure = firstEvent?.structure || "N/A";

    // Group events by chapter number (sorted descending)
    const groupedEvents = React.useMemo(() => {
        const groups: Record<string, typeof sortedEvents> = {};
        
        sortedEvents.forEach(ev => {
            const ch = ev.chapterNo || "N/A";
            if (!groups[ch]) {
                groups[ch] = [];
            }
            groups[ch].push(ev);
        });

        // Sort the group keys descending: e.g. "32", "31", "N/A"
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === "N/A") return 1;
            if (b === "N/A") return -1;
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numB - numA;
            }
            return b.localeCompare(a);
        });

        return {
            groups,
            sortedKeys
        };
    }, [sortedEvents]);

    const renderEventList = () => (
        <div className="space-y-6">
            {sortedEvents.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-3">
                    <History className="w-10 h-10 opacity-20" />
                    <span className="text-[10px] uppercase font-bold tracking-widest italic">No events logged for this session</span>
                </div>
            ) : (
                groupedEvents.sortedKeys.map(chapterKey => (
                    <div key={chapterKey} className="space-y-2">
                        {/* Chapter Group Header */}
                        <div className="flex items-center gap-2 px-1 py-1 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                                Chapter: {chapterKey}
                            </span>
                            <span className="bg-blue-100/65 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                {groupedEvents.groups[chapterKey].length} {groupedEvents.groups[chapterKey].length === 1 ? 'event' : 'events'}
                            </span>
                        </div>

                        {/* Group Items */}
                        <div className="space-y-2 pl-1.5">
                            {groupedEvents.groups[chapterKey].map((ev, i) => (
                                <div 
                                    key={ev.id || i} 
                                    className="group flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md transition-all animate-in fade-in slide-in-from-top-1"
                                >
                                    <div className="flex flex-col items-center justify-center w-16 bg-slate-100 dark:bg-slate-800 rounded-md py-1.5 shrink-0 border border-slate-200 dark:border-slate-800">
                                        <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono leading-none">{ev.time}</span>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex flex-col">
                                            <span className={`text-[12px] font-black uppercase tracking-wide truncate ${
                                                ev.action.includes('Start') ? 'text-green-600 dark:text-green-400' : 
                                                ev.action.includes('Stop') || ev.action.includes('End') ? 'text-red-600 dark:text-red-400' : 
                                                ev.action.includes('Pause') ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'
                                            }`}>
                                                {ev.action}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight mt-0.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {ev.eventTime ? format(new Date(ev.eventTime), 'MMM dd, HH:mm:ss') : '-'}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-auto">
                                             <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-7 px-2 text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-slate-300 dark:border-slate-700"
                                                onClick={() => { setExpanded?.(false); onEditEvent(ev); }}
                                            >
                                                <Edit className="w-3 h-3 mr-1" /> Edit
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-7 px-2 text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border-slate-300 dark:border-slate-700"
                                                onClick={() => handleDeleteEvent(ev.id, ev.logType, ev.realId)}
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" /> Del
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )
        }
        </div>
    );

    if (inline) {
        return (
            <div className="h-full flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {renderEventList()}
                </div>

                {/* Always include Dialog so it can be opened via prop */}
                <Dialog open={!!expanded} onOpenChange={setExpanded}>
                    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800">
                        <DialogHeader className="p-4 border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shrink-0 flex flex-col gap-2">
                            <DialogTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                                <History className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Video Log Event History
                            </DialogTitle>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-750 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">Tape: {commonTapeNo}</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-750 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">Dive: {commonDiveNo}</span>
                                <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-750 dark:text-purple-400 border border-purple-200 dark:border-purple-900/30">Struct: {commonStructure}</span>
                            </div>
                        </DialogHeader>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 p-3">
                            {renderEventList()}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    return (
        <div className="border border-slate-300 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 flex flex-col transition-all duration-300">
            {/* Header (Acts as Trigger) */}
            <div 
                className="bg-slate-100 dark:bg-slate-900 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-slate-300 dark:border-slate-800"
                onClick={() => setExpanded?.(true)}
            >
                <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-widest">Video Log Events</span>
                    {sortedEvents.length > 0 && (
                        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{sortedEvents.length}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {latestEvent ? (
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-tight animate-in fade-in slide-in-from-right-2">
                             <span className="opacity-60">{latestEvent.time}</span>
                             <span>{latestEvent.action}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-slate-400 italic font-medium px-2">Ready to record...</span>
                    )}
                </div>
            </div>

            {/* Popup Dialog for all events */}
            <Dialog open={expanded} onOpenChange={setExpanded}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800">
                    <DialogHeader className="p-4 border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shrink-0 flex flex-col gap-2">
                        <DialogTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                            <History className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Video Log Event History
                        </DialogTitle>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-750 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">Tape: {commonTapeNo}</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-750 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">Dive: {commonDiveNo}</span>
                            <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-750 dark:text-purple-400 border border-purple-200 dark:border-purple-900/30">Struct: {commonStructure}</span>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 p-3">
                        {renderEventList()}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
