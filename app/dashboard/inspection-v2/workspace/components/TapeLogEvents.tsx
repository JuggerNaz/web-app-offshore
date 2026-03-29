"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
    History, 
    Trash2, 
    Edit, 
    ChevronDown, 
    ChevronUp, 
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
}

export const TapeLogEvents: React.FC<TapeLogEventsProps> = ({
    videoEvents,
    handleDeleteEvent,
    onEditEvent,
    expanded,
    setExpanded,
}) => {
    const latestEvent = videoEvents.length > 0 ? videoEvents[0] : null;

    return (
        <Card className="border-slate-200 shadow-sm rounded-lg bg-white overflow-hidden flex flex-col transition-all duration-300">
            <div 
                className="bg-slate-50 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Tape Log Events</span>
                    {videoEvents.length > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{videoEvents.length}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!expanded && latestEvent && (
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-[9px] font-bold text-blue-700 uppercase tracking-tight animate-in fade-in slide-in-from-right-2">
                             <span className="opacity-60">{latestEvent.time}</span>
                             <span>{latestEvent.action}</span>
                        </div>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </div>

            {expanded ? (
                <ScrollArea className="flex-1 h-[250px] bg-slate-50/30">
                    <div className="p-2 space-y-1.5">
                        {videoEvents.length === 0 ? (
                            <div className="py-10 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
                                <History className="w-8 h-8 opacity-20" />
                                <span className="text-[10px] uppercase font-bold tracking-widest italic">No events logged for this session</span>
                            </div>
                        ) : (
                            videoEvents.map((ev, i) => (
                                <div 
                                    key={ev.id || i} 
                                    className="group flex items-center gap-3 p-2 bg-white rounded border border-slate-100 hover:border-blue-300 hover:shadow-sm transition-all animate-in fade-in slide-in-from-top-1"
                                >
                                    <div className="flex flex-col items-center justify-center w-12 bg-slate-50 rounded py-1 shrink-0 border border-slate-100">
                                        <span className="text-[10px] font-black text-blue-600 font-mono leading-none">{ev.time}</span>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[11px] font-black uppercase tracking-wide truncate ${
                                                ev.action.includes('Start') ? 'text-green-600' : 
                                                ev.action.includes('Stop') || ev.action.includes('End') ? 'text-red-600' : 
                                                ev.action.includes('Pause') ? 'text-amber-600' : 'text-slate-700'
                                            }`}>
                                                {ev.action}
                                            </span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-slate-400 hover:text-blue-600"
                                                    onClick={() => onEditEvent(ev)}
                                                >
                                                    <Edit className="w-3 h-3" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-slate-400 hover:text-red-600"
                                                    onClick={() => handleDeleteEvent(ev.id, ev.logType, ev.realId)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                                            <Clock className="w-3 h-3" />
                                            {ev.eventTime ? format(new Date(ev.eventTime), 'HH:mm:ss') : '-'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            ) : (
                <div className="px-3 py-2 bg-white flex items-center justify-between">
                    {latestEvent ? (
                        <div className="flex items-center gap-3 w-full animate-in fade-in slide-in-from-left-2">
                            <span className="text-[10px] font-mono font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{latestEvent.time}</span>
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{latestEvent.action}</span>
                            <span className="ml-auto text-[9px] text-slate-400 font-bold">{latestEvent.eventTime ? format(new Date(latestEvent.eventTime), 'HH:mm:ss') : ''}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-slate-400 italic font-medium">Ready to record...</span>
                    )}
                </div>
            )}
        </Card>
    );
};
