"use client";

import React from "react";
import { Play, Square, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoLogProps {
  tapeNo: string;
  tapeCounter: string;
  dateStr: string;
  timeStr: string;
  vidState: "IDLE" | "RECORDING" | "PAUSED";
  onStart?: () => void;
  onStop?: () => void;
  onPause?: () => void;
}

export function PipelineVideoLog({
  tapeNo = "21007/NQ/KK01/V001R",
  tapeCounter = "00:13:33",
  dateStr = "24 Dec 2025",
  timeStr = "03:34:20",
  vidState = "IDLE",
  onStart,
  onStop,
  onPause
}: VideoLogProps) {
  return (
    <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-3 space-y-3">
      {/* Subheader */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Video Log</span>
      </div>

      {/* Grid Video Details */}
      <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-900 pb-3">
        <div className="flex flex-col">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Date</span>
          <span className="text-xs font-black text-slate-200">{dateStr}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Time</span>
          <span className="text-xs font-black text-slate-200">{timeStr}</span>
        </div>
        <div className="flex flex-col mt-1 col-span-2">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Tape Number</span>
          <span className="text-xs font-black text-slate-200 font-mono text-cyan-400">{tapeNo}</span>
        </div>
        <div className="flex flex-col mt-1 col-span-2">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Tape Counter</span>
          <span className={`text-base font-mono font-black ${vidState === "RECORDING" ? "text-red-500" : "text-green-400"}`}>
            {tapeCounter}
          </span>
        </div>
      </div>

      {/* Playback Trigger controls */}
      <div className="flex gap-2">
        <Button
          onClick={onStart}
          disabled={vidState === "RECORDING"}
          className={`flex-1 h-9 text-[10px] font-black uppercase tracking-wider gap-1.5 border border-slate-800 ${
            vidState === "RECORDING"
              ? "bg-slate-900 text-slate-600"
              : "bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/50 border-emerald-500/20"
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start</span>
        </Button>

        <Button
          onClick={onStop}
          disabled={vidState === "IDLE"}
          className={`flex-1 h-9 text-[10px] font-black uppercase tracking-wider gap-1.5 border border-slate-800 ${
            vidState === "IDLE"
              ? "bg-slate-900 text-slate-600"
              : "bg-red-950/20 text-red-400 hover:bg-red-950/50 border-red-500/20"
          }`}
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </Button>

        <Button
          onClick={onPause}
          disabled={vidState === "IDLE" || vidState === "PAUSED"}
          className={`flex-1 h-9 text-[10px] font-black uppercase tracking-wider gap-1.5 border border-slate-800 ${
            vidState === "IDLE" || vidState === "PAUSED"
              ? "bg-slate-900 text-slate-600"
              : "bg-blue-950/20 text-blue-400 hover:bg-blue-950/50 border-blue-500/20"
          }`}
        >
          <Pause className="w-3.5 h-3.5" />
          <span>Pause</span>
        </Button>
      </div>
    </div>
  );
}
