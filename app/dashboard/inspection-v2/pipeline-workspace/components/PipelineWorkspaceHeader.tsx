"use client";

import React from "react";
import { ArrowLeft, Settings, HelpCircle, LogOut, Globe } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  clientName: string;
  contractorName: string;
  pipelineName: string;
  taskName: string;
  dateStr: string;
  timeStr: string;
  vesselName?: string;
  jobpackName?: string;
  sowReportNo?: string;
  onOpenSettings?: () => void;
  onOpenGeodetic?: () => void;
}

export function PipelineWorkspaceHeader({
  clientName = "Petronas PCSB",
  contractorName = "AMSB",
  pipelineName = "NQ - PL01",
  taskName = "Pipeline Inspection",
  dateStr = "24/12/2025",
  timeStr = "03:34:20",
  vesselName = "MV JUGGERNAUT",
  jobpackName = "",
  sowReportNo = "Pipeline Scope",
  onOpenSettings,
  onOpenGeodetic
}: HeaderProps) {
  return (
    <header className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-md z-20 shrink-0 border-b border-slate-800">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inspection-v2">
          <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </Link>
        <div className="h-5 w-px bg-slate-700"></div>

        <div className="flex flex-col select-none">
          <span className="text-xs font-black tracking-[0.2em] text-white leading-none">NASQUEST</span>
          <span className="text-[8px] font-semibold tracking-[0.3em] text-cyan-400/80 mt-0.5 leading-none">RESOURCES</span>
        </div>
        <div className="h-5 w-px bg-slate-700"></div>

        <div className="flex bg-slate-800 rounded p-1 mr-2 select-none">
          <button className="px-4 py-1 text-xs font-bold rounded uppercase tracking-wider text-slate-400 cursor-not-allowed">
            DIVING
          </button>
          <button className="px-4 py-1 text-xs font-bold rounded uppercase tracking-wider bg-blue-600 text-white">
            ROV
          </button>
        </div>

        <div className="hidden md:flex items-center text-xs ml-3 space-x-3 select-none">
          {jobpackName && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Jobpack:</span>
              <span className="font-mono font-bold text-slate-200">{jobpackName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Pipeline:</span>
            <span className="font-mono font-bold text-cyan-400">{pipelineName}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">SOW Report:</span>
            <span className="font-mono font-black text-cyan-400">{sowReportNo}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-3">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Vessel:</span>
            <span className="font-mono font-bold text-blue-300">{vesselName || "N/A"}</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Client:</span>
            <span className="font-mono font-bold text-slate-300">{clientName}</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Contractor:</span>
            <span className="font-mono font-bold text-slate-300">{contractorName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono border-r border-slate-800 pr-4 mr-2 select-none">
          <div className="flex flex-col text-right">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Date</span>
            <span className="text-[10px] font-bold text-slate-300">{dateStr}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Time (UTC)</span>
            <span className="text-[10px] font-bold text-cyan-400">{timeStr}</span>
          </div>
        </div>

        {onOpenGeodetic && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenGeodetic}
            className="bg-blue-950/40 border-blue-800/60 text-blue-300 hover:bg-blue-900/60 hover:text-white h-8 text-[11px] font-bold gap-1.5"
            title="Geodetic Parameters"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Geodetic</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"
          title="Telemetry Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>

        <Link href="/dashboard/inspection-v2">
          <Button
            variant="outline"
            size="sm"
            className="bg-red-950/20 hover:bg-red-950/50 text-red-400 hover:text-red-300 border border-red-900/30 hover:border-red-500/30 h-8 font-bold text-[10px] uppercase tracking-wider px-3"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Exit
          </Button>
        </Link>
      </div>
    </header>
  );
}
