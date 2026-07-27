"use client";

import React from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EventItem {
  id: string | number;
  date: string;
  time: string;
  dive: string;
  kp: string;
  event: string;
  anomaly: string;
  data: string;
}

interface EventLogProps {
  events: EventItem[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export function PipelineEventLog({
  events,
  searchTerm,
  setSearchTerm
}: EventLogProps) {
  const filteredEvents = events.filter((ev) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      ev.event.toLowerCase().includes(term) ||
      ev.data.toLowerCase().includes(term) ||
      ev.kp.toLowerCase().includes(term) ||
      ev.anomaly.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header and Search */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Event Log</span>
          <Badge className="bg-cyan-950 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-950 px-2 py-0.5 text-[9px] font-bold">
            {events.length} TOTAL
          </Badge>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 max-w-xs flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search Events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-12 bg-slate-900/60 border-b border-slate-800 px-4 py-2 text-[8px] font-black uppercase tracking-wider text-slate-500 shrink-0">
        <div className="col-span-2">Date / Time</div>
        <div className="col-span-1">Dive</div>
        <div className="col-span-2">KP</div>
        <div className="col-span-3">Event</div>
        <div className="col-span-2">Anomaly</div>
        <div className="col-span-2 text-right">Data</div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((ev, i) => (
            <div
              key={ev.id || i}
              className="grid grid-cols-12 border-b border-slate-900 hover:bg-slate-900/20 px-4 py-2.5 text-xs text-slate-350 transition-colors items-center"
            >
              <div className="col-span-2 flex flex-col font-mono text-[10px]">
                <span className="text-slate-300 font-bold">{ev.date}</span>
                <span className="text-slate-500 mt-0.5">{ev.time}</span>
              </div>
              <div className="col-span-1 font-mono text-[10px] text-slate-400">{ev.dive}</div>
              <div className="col-span-2 font-mono text-[10px] text-cyan-400 font-bold">{ev.kp}</div>
              <div className="col-span-3 font-bold text-slate-200">{ev.event}</div>
              <div className="col-span-2">
                {ev.anomaly && ev.anomaly !== "-" ? (
                  <Badge variant="outline" className="bg-red-950/20 text-red-400 border-red-500/20 hover:bg-red-950/20 text-[9px] font-bold tracking-wide uppercase px-2">
                    {ev.anomaly}
                  </Badge>
                ) : (
                  <span className="text-slate-650">—</span>
                )}
              </div>
              <div className="col-span-2 text-right text-[10px] font-semibold text-slate-400 truncate" title={ev.data}>
                {ev.data}
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-[10px] font-bold uppercase tracking-wider py-8">
            No events found
          </div>
        )}
      </div>
    </div>
  );
}
