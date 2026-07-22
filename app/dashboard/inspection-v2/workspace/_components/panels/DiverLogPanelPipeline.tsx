"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Edit, Settings, ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";

interface DiverLogPanelProps {
  inspMethod: "DIVING" | "ROV";
  activeDep: any;
  timeInWater: string;
  currentMovement: string;
  diveStartTime: string | null;
  diveEndTime: string | null;
  setIsDiveSetupForNew: (val: boolean) => void;
  setIsDiveSetupOpen: (val: boolean) => void;
  setIsMovementLogOpen: (val: boolean) => void;

  // Movement Handlers
  handleMovementPrev: () => void;
  handleMovementNext: () => void;
  handleMovementLog: (action: string) => void;
  handlePrevDep: () => void;
  handleNextDep: () => void;
  diveActionsList: any[];
  ROV_MOVEMENT_BRANCHES: Record<string, string[]>;
}

export function DiverLogPanelPipeline({
  inspMethod,
  activeDep,
  timeInWater,
  currentMovement,
  diveStartTime,
  diveEndTime,
  setIsDiveSetupForNew,
  setIsDiveSetupOpen,
  setIsMovementLogOpen,
  handleMovementPrev,
  handleMovementNext,
  handleMovementLog,
  handlePrevDep,
  handleNextDep,
  diveActionsList,
  ROV_MOVEMENT_BRANCHES,
}: DiverLogPanelProps) {
  const options = ROV_MOVEMENT_BRANCHES[currentMovement || "Awaiting Deployment"] || [];
  const isCompleted = options.length === 0;

  // Map actions to match exact keys defined in ROV_MOVEMENT_BRANCHES configuration
  const rovActions = [
    {
      id: "Rov Launched",
      label: "Rov Launched",
      color: "border-blue-200 dark:border-blue-500/40 text-slate-800 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-400 bg-slate-50/50 dark:bg-[#0c1322] active:bg-blue-100",
      svg: (
        <svg viewBox="0 0 100 50" className="w-full max-w-[120px] h-auto text-slate-700 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 mx-auto" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 38 L95 38" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <path d="M15 38 L30 18 L50 18" stroke="currentColor" />
          <rect x="52" y="14" width="22" height="12" rx="2" fill="currentColor" fillOpacity="0.2" />
          <path d="M52 20 L74 20" />
          <circle cx="58" cy="23" r="2" fill="currentColor" />
          <circle cx="68" cy="23" r="2" fill="currentColor" />
          <path d="M50 18 Q55 18, 63 14" stroke="currentColor" strokeWidth="1" />
        </svg>
      )
    },
    {
      id: "Rov Back to TMS",
      label: "Back to TMS",
      color: "border-green-200 dark:border-green-500/40 text-slate-800 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 hover:border-green-400 bg-slate-50/50 dark:bg-[#0c1322] active:bg-green-100",
      svg: (
        <svg viewBox="0 0 100 50" className="w-full max-w-[120px] h-auto text-slate-700 dark:text-green-400 group-hover:text-green-600 dark:group-hover:text-green-300 mx-auto" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="25" y="8" width="50" height="34" rx="4" fill="currentColor" fillOpacity="0.1" />
          <path d="M35 8 L35 4 L65 4 L65 8" />
          <rect x="35" y="16" width="30" height="18" rx="2" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
          <text x="50" y="28" textAnchor="middle" fontSize="8" fontWeight="black" fill="currentColor" stroke="none">TMS</text>
        </svg>
      )
    },
    {
      id: "Rov at the Worksite",
      label: "At Worksite",
      color: "border-lime-200 dark:border-lime-500/40 text-slate-800 dark:text-lime-400 hover:bg-lime-50 dark:hover:bg-lime-950/40 hover:border-lime-400 bg-slate-50/50 dark:bg-[#0c1322] active:bg-lime-100",
      svg: (
        <svg viewBox="0 0 100 50" className="w-full max-w-[120px] h-auto text-slate-700 dark:text-lime-400 group-hover:text-lime-600 dark:group-hover:text-lime-300 mx-auto" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 42 Q25 38, 50 42 T95 40" stroke="currentColor" strokeWidth="1.5" />
          <rect x="65" y="32" width="20" height="8" rx="1" fill="currentColor" fillOpacity="0.1" />
          <circle cx="75" cy="36" r="3" />
          <rect x="15" y="14" width="24" height="14" rx="2" fill="currentColor" fillOpacity="0.3" />
          <circle cx="22" cy="24" r="2.5" fill="currentColor" />
          <path d="M39 21 L47 21" stroke="currentColor" strokeWidth="1" />
          <path d="M47 16 L57 26 M55 12 L69 26" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      )
    },
    {
      id: "Rov Leaving the Worksite",
      label: "Leaving Worksite",
      color: "border-amber-200 dark:border-amber-500/40 text-slate-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-400 bg-slate-50/50 dark:bg-[#0c1322] active:bg-amber-100",
      svg: (
        <svg viewBox="0 0 100 50" className="w-full max-w-[120px] h-auto text-slate-700 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300 mx-auto" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 44 L95 44" stroke="currentColor" strokeWidth="1" />
          <rect x="40" y="10" width="24" height="14" rx="2" fill="currentColor" fillOpacity="0.2" />
          <path d="M52 24 L52 34 M46 24 L42 30 M58 24 L62 30" stroke="currentColor" strokeWidth="1.5" />
          <path d="M35 17 L25 17" stroke="currentColor" strokeWidth="1.5" />
          <path d="M30 13 L24 17 L30 21" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    },
    {
      id: "Rov Recovered",
      label: "Rov Recovered",
      color: "border-purple-200 dark:border-purple-500/40 text-slate-800 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-400 bg-slate-50/50 dark:bg-[#0c1322] active:bg-purple-100",
      svg: (
        <svg viewBox="0 0 100 50" className="w-full max-w-[120px] h-auto text-slate-700 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300 mx-auto" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="25" y="8" width="50" height="34" rx="4" fill="currentColor" fillOpacity="0.1" />
          <path d="M35 8 L35 4 L65 4 L65 8" />
          <rect x="35" y="16" width="30" height="18" rx="2" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
          <text x="50" y="28" textAnchor="middle" fontSize="8" fontWeight="black" fill="currentColor" stroke="none">TMS</text>
        </svg>
      )
    },
    {
      id: "Rov On Hire",
      label: "Rov On Hire",
      color: "border-orange-200 dark:border-orange-500/40 text-slate-800 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:border-orange-400 bg-slate-50/50 dark:bg-[#0c1322] active:bg-orange-100",
      svg: (
        <svg viewBox="0 0 100 50" className="w-full max-w-[120px] h-auto text-slate-700 dark:text-orange-400 group-hover:text-orange-600 dark:group-hover:text-orange-300 mx-auto" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="36" width="90" height="10" rx="1" fill="currentColor" fillOpacity="0.2" />
          <path d="M25 36 L30 28 L70 28 L75 36" stroke="currentColor" />
          <rect x="32" y="16" width="36" height="14" rx="2" fill="currentColor" fillOpacity="0.4" />
          <circle cx="42" cy="23" r="2" fill="currentColor" />
          <circle cx="58" cy="23" r="2" fill="currentColor" />
        </svg>
      )
    }
  ];

  if (inspMethod === "ROV") {
    return (
      <Card className="flex flex-col border-none shadow-none rounded-none h-full bg-white dark:bg-[#090d16] text-slate-800 dark:text-slate-100 overflow-y-auto custom-scrollbar select-none">
        {/* Header Section */}
        <div className="bg-slate-100 dark:bg-[#030712] border-b border-slate-200 dark:border-cyan-500/10 text-slate-800 dark:text-cyan-400 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] flex justify-between items-center shrink-0">
          <span>ROV STATUS {activeDep?.jobNo ? `(${activeDep.jobNo})` : ""}</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                setIsDiveSetupForNew(true);
                setIsDiveSetupOpen(true);
              }}
              className="p-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-all"
              title="New ROV Log"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsDiveSetupForNew(false);
                setIsDiveSetupOpen(true);
              }}
              className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-all"
              title="Telemetry Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="p-2 bg-slate-50/50 dark:bg-[#05080e] border-b border-slate-100 dark:border-slate-900 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-900/50 pb-1">
            <span>Dive No.</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">: {activeDep?.jobNo || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-900/50 pb-1">
            <span>Date</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">: {
              (() => {
                const candidates = [
                  activeDep?.created_at,
                  activeDep?.date,
                  activeDep?.raw?.created_at,
                  activeDep?.raw?.date,
                  activeDep?.raw?.dive_date,
                  activeDep?.raw?.start_date,
                  activeDep?.raw?.start_time,
                  activeDep?.raw?.created_date,
                  activeDep?.raw?.movement_time,
                  diveStartTime,
                ];

                for (const cand of candidates) {
                  if (!cand) continue;
                  if (cand instanceof Date && !isNaN(cand.getTime())) {
                    return format(cand, "dd MMM yyyy");
                  }
                  if (typeof cand === "string") {
                    const cleaned = cand.replace(" ", "T");
                    let parsed = new Date(cleaned);
                    if (!isNaN(parsed.getTime())) {
                      return format(parsed, "dd MMM yyyy");
                    }
                    const ymdMatch = cand.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
                    if (ymdMatch) {
                      parsed = new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]));
                      if (!isNaN(parsed.getTime())) {
                        return format(parsed, "dd MMM yyyy");
                      }
                    }
                  }
                }

                // If active deployment or dive session is registered, display current date when event was captured
                return format(new Date(), "dd MMM yyyy");
              })()
            }</span>
          </div>
          <div className="flex justify-between">
            <span>Time</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">: {timeInWater}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className="font-black text-green-600 dark:text-green-400 uppercase">: {currentMovement}</span>
          </div>
        </div>

        {/* Grid Interactive State Selector */}
        <div className="p-2 flex-1 flex flex-row flex-wrap justify-center items-center gap-2 bg-white dark:bg-[#090d16] min-h-0 overflow-y-auto">
          {rovActions.map((act) => {
            const isSelectable = options.includes(act.id);
            const isActive = currentMovement === act.id;

            if (!isSelectable && !isActive) return null;

            return (
              <button
                key={act.id}
                onClick={() => isSelectable && handleMovementLog && handleMovementLog(act.id)}
                disabled={!isSelectable && !isActive}
                className={`flex flex-col justify-center items-center p-2 rounded-md border-2 text-center transition-all min-h-[72px] flex-1 min-w-[80px] ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                    : isSelectable
                      ? act.color + " cursor-pointer shadow-sm active:scale-95"
                      : "border-slate-100 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/20 text-slate-300 dark:text-slate-800 opacity-20 cursor-not-allowed"
                }`}
              >
                <div className="mb-1 shrink-0 scale-100 w-full">
                  {act.svg}
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider leading-tight">
                  {act.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer Area with Navigation and Event View Controls in Flex Row */}
        <div className="p-2 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-[#05080e] flex gap-2 shrink-0">
          <Button
            onClick={handleMovementPrev}
            disabled={currentMovement === "Awaiting Deployment"}
            variant="outline"
            className="flex-1 h-8 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-900 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 bg-transparent flex items-center justify-center gap-1.5"
            title="Rollback to previous action"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> UNDO
          </Button>

          <Button
            onClick={() => setIsMovementLogOpen(true)}
            variant="outline"
            className="flex-[1.2] h-8 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-900 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 bg-transparent flex items-center justify-center gap-1"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" strokeLinecap="round" />
              <line x1="3" y1="12" x2="3.01" y2="12" strokeLinecap="round" />
              <line x1="3" y1="18" x2="3.01" y2="18" strokeLinecap="round" />
            </svg>
            ALL EVENTS
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col border-none shadow-none rounded-none h-full bg-white dark:bg-slate-900/60 backdrop-blur-md overflow-y-auto custom-scrollbar">
      <div className="bg-[#1f2937] text-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] flex justify-between items-center shrink-0">
        <span>{inspMethod === "DIVING" ? "DIVER LOG" : "ROV LOG"}</span>
        <div className="flex items-center gap-2 text-slate-300">
          <button
            onClick={() => {
              setIsDiveSetupForNew(true);
              setIsDiveSetupOpen(true);
            }}
            className="flex items-center gap-1 p-1 hover:text-white transition"
            title="New Dive"
          >
            <Plus className="w-3.5 h-3.5" /> <span className="text-[9px] hidden lg:inline">New Dive</span>
          </button>
          <button onClick={() => setIsMovementLogOpen(true)} className="p-1 hover:text-white transition" title="Edit Events">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setIsDiveSetupForNew(false);
              setIsDiveSetupOpen(true);
            }}
            className="p-1 hover:text-white transition"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-2.5 bg-white dark:bg-slate-900 space-y-2 flex-1">
        <div className="flex flex-col sm:flex-row justify-between gap-1.5 px-1">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap justify-between items-center gap-x-2">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Selection
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                {activeDep?.jobNo || "None"}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap justify-between items-center gap-x-2 sm:justify-end">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                In Water
              </span>
              <span className="font-black text-[#2563eb] dark:text-blue-400 text-xs">
                {timeInWater}
              </span>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-2.5 border shadow-sm relative overflow-hidden group/m transition-colors duration-500 ${
          currentMovement.toLowerCase().includes('worksite') || currentMovement.toLowerCase().includes('bottom') 
            ? 'bg-green-50/80 dark:bg-green-900/20 border-green-100 dark:border-green-800'
            : currentMovement.toLowerCase().includes('surface') || currentMovement.toLowerCase().includes('back')
              ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
              : 'bg-slate-50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-800'
        }`}>
          <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-500 ${
             currentMovement.toLowerCase().includes('worksite') || currentMovement.toLowerCase().includes('bottom') ? 'bg-green-500' :
             currentMovement.toLowerCase().includes('surface') || currentMovement.toLowerCase().includes('back') ? 'bg-blue-500' :
             'bg-slate-400'
          }`} />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Current Action</span>
            {activeDep && (
              <Badge variant="outline" className={`text-[8px] h-4 px-1.5 font-bold uppercase tracking-tighter ${
                currentMovement.toLowerCase().includes('worksite') || currentMovement.toLowerCase().includes('bottom') 
                  ? 'bg-green-100 text-green-700 border-green-200' 
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                Live Session
              </Badge>
            )}
          </div>
          <div className={`font-black text-base leading-tight tracking-tight uppercase line-clamp-2 ${
            currentMovement.toLowerCase().includes('worksite') || currentMovement.toLowerCase().includes('bottom') 
              ? 'text-green-700 dark:text-green-400' 
              : currentMovement.toLowerCase().includes('surface') || currentMovement.toLowerCase().includes('back')
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-slate-900 dark:text-slate-100'
          }`}>
            {currentMovement}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          {inspMethod === "DIVING" ? (
            <>
              <div className="bg-slate-50 dark:bg-slate-800/40 py-1 px-2 rounded-md border border-slate-100 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-x-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase min-w-[40px]">In Water</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-none">
                  {diveStartTime ? format(new Date(diveStartTime), "HH:mm:ss") : "--:--:--"}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 py-1 px-2 rounded-md border border-slate-100 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-x-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase min-w-[40px]">On Deck</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-none">
                  {diveEndTime ? format(new Date(diveEndTime), "HH:mm:ss") : "--:--:--"}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-50 dark:bg-slate-800/40 py-1 px-2 rounded-md border border-slate-100 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-x-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase min-w-[40px]">Launch</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-none">
                  {diveStartTime ? format(new Date(diveStartTime), "HH:mm:ss") : "--:--:--"}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 py-1 px-2 rounded-md border border-slate-100 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-x-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase min-w-[40px]">Recovery</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-none">
                  {diveEndTime ? format(new Date(diveEndTime), "HH:mm:ss") : "--:--:--"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Movement Controls (Navigation Buttons) */}
        <div className="flex gap-1.5 mt-1">
            <Button
              onClick={handleMovementPrev}
              disabled={
                currentMovement === "Awaiting Deployment" ||
                (inspMethod === "DIVING" && currentMovement === diveActionsList[0]?.label)
              }
              variant="outline"
              className="flex-1 h-8 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-900 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Rollback
            </Button>

            {inspMethod === "DIVING" ? (
              <Button
                onClick={handleMovementNext}
                disabled={currentMovement === diveActionsList[diveActionsList.length - 1]?.label}
                className="flex-[1.5] h-8 text-[11px] font-black uppercase tracking-wider bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm"
              >
                {currentMovement === "Awaiting Deployment"
                  ? "Next"
                  : diveActionsList.findIndex((a) => a.label === currentMovement) <
                      diveActionsList.length - 1
                    ? "Next Action"
                    : "Completed"}{" "}
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              (() => {
                const options = ROV_MOVEMENT_BRANCHES[currentMovement || "Awaiting Deployment"] || [];
                const isCompleted = options.length === 0;

                if (currentMovement === "Rov Recovered" || currentMovement === "ROV_RECOVERED") {
                  return (
                    <Button
                      onClick={() => {
                        setIsDiveSetupForNew(true);
                        setIsDiveSetupOpen(true);
                      }}
                      className="flex-[1.5] h-8 text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> New ROV Dive
                    </Button>
                  );
                }

                if (isCompleted) {
                  return (
                    <Button
                      disabled
                      className="flex-[1.5] h-8 text-[11px] font-black uppercase tracking-wider bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm"
                    >
                      Completed <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  );
                }

                if (options.length === 1) {
                  const labelText = `Next: ${options[0]}`;
                  const isLong = labelText.length > 18;
                  return (
                    <Button
                      onClick={() => handleMovementLog && handleMovementLog(options[0])}
                      className={`flex-[1.5] h-8 font-black uppercase bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm flex items-center justify-center min-w-0 ${
                        isLong 
                          ? "text-[9px] tracking-tighter px-1.5 leading-tight whitespace-normal text-center" 
                          : "text-[11px] tracking-wider whitespace-nowrap"
                      }`}
                    >
                      <span className="line-clamp-2">{labelText}</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1 shrink-0" />
                    </Button>
                  );
                }

                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="flex-[1.5] h-8 text-[11px] font-black uppercase tracking-wider bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm">
                        Next Action... <ChevronDown className="w-3.5 h-3.5 ml-1 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 shadow-xl min-w-[180px]">
                      {options.map((opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() => handleMovementLog && handleMovementLog(opt)}
                          className="text-[11px] font-bold uppercase tracking-wider cursor-pointer py-2"
                        >
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
  );
}
