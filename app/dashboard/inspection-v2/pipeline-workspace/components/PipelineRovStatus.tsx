"use client";

import React from "react";
import { Ship, Anchor, HelpCircle } from "lucide-react";

interface StatusProps {
  diveNo: string;
  dateStr: string;
  timeStr: string;
  status: string;
  onActionTrigger?: (action: string) => void;
}

export function PipelineRovStatus({
  diveNo = "R007",
  dateStr = "24 Dec 2025",
  timeStr = "03:34:20",
  status = "AT WORKSITE",
  onActionTrigger
}: StatusProps) {
  // Mock button configuration based on Petronas/AMS layout
  const statuses = [
    { label: "OFF DECK", value: "OFF DECK", color: "blue" },
    { label: "IN TMS", value: "IN TMS (LAUNCH)", color: "purple" },
    { label: "AT WORKSITE", value: "AT WORKSITE", color: "green" },
    { label: "LEAVING WORKSITE", value: "LEAVING WORKSITE", color: "yellow" },
    { label: "IN TMS", value: "IN TMS (RECOVERY)", color: "purple2" },
    { label: "ON DECK", value: "ON DECK", color: "red" }
  ];

  return (
    <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-3 space-y-3">
      {/* Subheader */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">ROV Status ({diveNo})</span>
        <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-help" />
      </div>

      {/* Grid status details */}
      <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-900 pb-3">
        <div className="flex flex-col">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Dive No.</span>
          <span className="text-xs font-black text-slate-200">{diveNo}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Date</span>
          <span className="text-xs font-black text-slate-200">{dateStr}</span>
        </div>
        <div className="flex flex-col mt-1">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Time</span>
          <span className="text-xs font-mono font-black text-slate-200">{timeStr}</span>
        </div>
        <div className="flex flex-col mt-1">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Status</span>
          <span className="text-xs font-black text-green-400">{status}</span>
        </div>
      </div>

      {/* Interactive Command buttons */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {statuses.map((btn, i) => {
          let btnClass = "border-slate-850 hover:bg-slate-900/60";
          let labelColor = "text-slate-400";
          const isActive = status.toUpperCase().includes(btn.label.toUpperCase()) || (btn.value === "IN TMS (LAUNCH)" && status === "LAUNCHING");

          if (isActive) {
            if (btn.color === "blue") {
              btnClass = "bg-blue-950/40 border-blue-500 text-blue-400 shadow-md shadow-blue-950/50";
              labelColor = "text-blue-300";
            } else if (btn.color.startsWith("purple")) {
              btnClass = "bg-purple-950/40 border-purple-500 text-purple-400 shadow-md shadow-purple-950/50";
              labelColor = "text-purple-300";
            } else if (btn.color === "green") {
              btnClass = "bg-green-950/40 border-green-500 text-green-400 shadow-md shadow-green-950/50";
              labelColor = "text-green-300 animate-pulse";
            } else if (btn.color === "yellow") {
              btnClass = "bg-amber-950/40 border-amber-500 text-amber-400 shadow-md shadow-amber-950/50";
              labelColor = "text-amber-300";
            } else if (btn.color === "red") {
              btnClass = "bg-red-950/40 border-red-500 text-red-400 shadow-md shadow-red-950/50";
              labelColor = "text-red-300";
            }
          }

          return (
            <button
              key={i}
              onClick={() => onActionTrigger && onActionTrigger(btn.value)}
              className={`border p-2.5 rounded-lg flex flex-col items-center justify-center text-center transition-all min-h-[60px] ${btnClass}`}
            >
              {btn.color === "blue" && <Ship className={`w-4 h-4 mb-1 ${isActive ? "text-blue-400 animate-bounce" : "text-slate-500"}`} />}
              {btn.color.startsWith("purple") && <Anchor className={`w-4 h-4 mb-1 ${isActive ? "text-purple-400 animate-pulse" : "text-slate-500"}`} />}
              {btn.color === "green" && <Anchor className={`w-4 h-4 mb-1 ${isActive ? "text-green-400" : "text-slate-500"}`} />}
              {btn.color === "yellow" && <Ship className={`w-4 h-4 mb-1 ${isActive ? "text-amber-400" : "text-slate-500"}`} />}
              {btn.color === "red" && <Anchor className={`w-4 h-4 mb-1 ${isActive ? "text-red-400" : "text-slate-500"}`} />}
              <span className={`text-[8px] font-black uppercase tracking-wider mt-0.5 leading-none ${labelColor}`}>
                {btn.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
