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
    expanded: boolean;
    setExpanded: (v: boolean) => void;
    isFloating?: boolean;
}

export const TapeLogEvents: React.FC<TapeLogEventsProps> = ({
    videoEvents,
    handleDeleteEvent,
    onEditEvent,
    expanded,
    setExpanded,
    isFloating = false,
}) => {
    const sortedEvents = [...videoEvents].sort((a, b) => {
        const timeA = a.eventTime ? new Date(a.eventTime).getTime() : 0;
        const timeB = b.eventTime ? new Date(b.eventTime).getTime() : 0;
        
        // Final descending sort by event time
        if (timeA === timeB) {
            return (b.realId || b.id || 0) - (a.realId || a.id || 0);
        }
        return timeB - timeA;
    });

    const latestEvent = sortedEvents.length > 0 ? sortedEvents[0] : null;

    return (
        <div className="border border-slate-200 rounded-lg bg-white flex flex-col transition-all duration-300">
            {/* Header (Acts as Trigger) */}
            <div 
                className="bg-slate-50 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200"
                onClick={() => setExpanded(true)}
            >
                <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Video Log Events</span>
                    {sortedEvents.length > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{sortedEvents.length}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {latestEvent ? (
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-[9px] font-bold text-blue-700 uppercase tracking-tight animate-in fade-in slide-in-from-right-2">
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
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700">
                            <History className="w-4 h-4 text-blue-600" /> Video Log Event History
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 p-3">
                        <div className="space-y-2">
                            {sortedEvents.length === 0 ? (
                                <div className="py-12 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <History className="w-10 h-10 opacity-20" />
                                    <span className="text-xs uppercase font-bold tracking-widest italic">No events logged for this session</span>
                                </div>
                            ) : (
                                sortedEvents.map((ev, i) => (
                                    <div 
                                        key={ev.id || i} 
                                        className="group flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all animate-in fade-in slide-in-from-top-1"
                                    >
                                        <div className="flex flex-col items-center justify-center w-16 bg-slate-50 rounded-md py-1.5 shrink-0 border border-slate-100">
                                            <span className="text-xs font-black text-blue-600 font-mono leading-none">{ev.time}</span>
                                        </div>
                                        
                                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex flex-col">
                                                <span className={`text-[13px] font-black uppercase tracking-wide truncate ${
                                                    ev.action.includes('Start') ? 'text-green-600' : 
                                                    ev.action.includes('Stop') || ev.action.includes('End') ? 'text-red-600' : 
                                                    ev.action.includes('Pause') ? 'text-amber-600' : 'text-slate-800'
                                                }`}>
                                                    {ev.action}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Event Captured At: {ev.eventTime ? format(new Date(ev.eventTime), 'MMM dd, yyyy HH:mm:ss') : '-'}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-auto">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border-slate-200"
                                                    onClick={() => { setExpanded(false); onEditEvent(ev); }}
                                                >
                                                    <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-2 text-slate-500 hover:text-red-600 hover:bg-red-50 border-slate-200"
                                                    onClick={() => handleDeleteEvent(ev.id, ev.logType, ev.realId)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
