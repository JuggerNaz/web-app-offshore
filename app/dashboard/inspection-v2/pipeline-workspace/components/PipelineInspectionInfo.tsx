"use client";

import React from "react";
import { Info } from "lucide-react";

interface InfoProps {
  currentKp: number;
  totalLength: number;
  flowDirection: string;
  nextFieldJointAhead: number;
  nextAnodeAhead: number;
  nextCrossingAhead: number;
}

export function PipelineInspectionInfo({
  currentKp = 12.486,
  totalLength = 130.0,
  flowDirection = "Increase KP",
  nextFieldJointAhead = 14,
  nextAnodeAhead = 134,
  nextCrossingAhead = 614
}: InfoProps) {
  const completionPercentage = ((currentKp / totalLength) * 100).toFixed(1);

  return (
    <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-3 space-y-3">
      {/* Subheader */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Inspection Info</span>
        <Info className="w-3.5 h-3.5 text-slate-500" />
      </div>

      <div className="space-y-2.5 text-xs">
        {/* KP Progress */}
        <div className="flex flex-col">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Current KP</span>
            <span className="text-slate-200 font-mono font-bold">
              {currentKp.toFixed(3)} / {totalLength.toFixed(3)} = <span className="text-cyan-400 font-black">{completionPercentage}%</span>
            </span>
          </div>
          <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500 shadow-sm shadow-cyan-500/50"
              style={{ width: `${Math.min(100, parseFloat(completionPercentage))}%` }}
            />
          </div>
        </div>

        {/* Info Grid details */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900">
          <div className="flex flex-col col-span-2">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Inspection Flow</span>
            <span className="text-xs font-black text-slate-200 uppercase tracking-wide">{flowDirection}</span>
          </div>
          <div className="flex flex-col mt-1">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Next Field Joint</span>
            <span className="text-xs font-black text-slate-200">
              KP {(currentKp + nextFieldJointAhead / 1000).toFixed(3)} <span className="text-[10px] text-cyan-400 font-mono font-normal">({nextFieldJointAhead}m ahead)</span>
            </span>
          </div>
          <div className="flex flex-col mt-1">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Next Anode</span>
            <span className="text-xs font-black text-slate-200">
              KP {(currentKp + nextAnodeAhead / 1000).toFixed(3)} <span className="text-[10px] text-cyan-400 font-mono font-normal">({nextAnodeAhead}m ahead)</span>
            </span>
          </div>
          <div className="flex flex-col mt-1 col-span-2">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Next Crossing</span>
            <span className="text-xs font-black text-slate-200">
              KP {(currentKp + nextCrossingAhead / 1000).toFixed(3)} <span className="text-[10px] text-cyan-400 font-mono font-normal font-bold">({nextCrossingAhead}m ahead)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
