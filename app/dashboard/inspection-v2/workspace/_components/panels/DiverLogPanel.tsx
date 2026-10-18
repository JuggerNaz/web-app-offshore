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
import { Plus, Edit, Settings, ArrowLeft, ArrowRight, ChevronDown, Check, Wrench } from "lucide-react";
import { format } from "date-fns";
import { formatClientTime } from "@/utils/client-date";

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

  // Historical dives & calibration
  deployments?: any[];
  setActiveDep?: (dep: any) => void;
  onOpenCalibration?: () => void;
}

export function DiverLogPanel({
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
  deployments,
  setActiveDep,
  onOpenCalibration,
}: DiverLogPanelProps) {
  return (
    <Card className="flex flex-col border-none shadow-none rounded-none h-full bg-white dark:bg-slate-900/60 backdrop-blur-md overflow-y-auto custom-scrollbar">
      <div className="bg-[#1f2937] text-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] flex justify-between items-center shrink-0">
        <span>{inspMethod === "DIVING" ? "DIVER LOG" : "ROV LOG"}</span>
        <div className="flex items-center gap-1.5 text-slate-300">
          <button
            type="button"
            onClick={onOpenCalibration}
            disabled={!activeDep}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-blue-300 hover:text-white hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title={activeDep ? `Calibration for Dive ${activeDep.jobNo}` : "Calibration (No active dive)"}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold hidden sm:inline">Calib</span>
          </button>
          <div className="w-px h-3 bg-slate-600 my-auto" />
          <button
            onClick={() => {
              setIsDiveSetupForNew(true);
              setIsDiveSetupOpen(true);
            }}
            className="flex items-center gap-1 p-1 hover:text-white transition"
            title={inspMethod === "DIVING" ? "New Dive" : "New ROV"}
          >
            <Plus className="w-3.5 h-3.5" /> <span className="text-[9px] hidden lg:inline">{inspMethod === "DIVING" ? "New Dive" : "New ROV"}</span>
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
        {/* Selection & In Water Row */}
        <div className="flex items-center justify-between gap-2 px-0.5">
          {/* Historical Dive Dropdown Selector */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider">
                  Selection
                </span>
                {deployments && deployments.length > 1 && (
                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500">
                    {deployments.length} Dives
                  </span>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50/60 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 rounded-md transition-all text-left shadow-2xs group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          activeDep?.raw?.status === "COMPLETED"
                            ? "bg-slate-400"
                            : activeDep
                              ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse"
                              : "bg-amber-400"
                        }`}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs uppercase tracking-tight text-slate-900 dark:text-slate-100 truncate">
                            {activeDep?.jobNo || "None"}
                          </span>
                          {activeDep?.raw?.status === "COMPLETED" ? (
                            <span className="text-[8px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 py-0.2 rounded">
                              Done
                            </span>
                          ) : activeDep ? (
                            <span className="text-[8px] font-bold uppercase bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-1 py-0.2 rounded border border-green-200 dark:border-green-800">
                              Active
                            </span>
                          ) : null}
                        </div>
                        {activeDep?.name && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate leading-none mt-0.5">
                            {activeDep.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 p-1 max-h-72 overflow-y-auto z-50">
                  <div className="px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                    <span>All {inspMethod === "DIVING" ? "Dives" : "Deployments"}</span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[8px] font-black">
                      {deployments?.length || 0}
                    </span>
                  </div>
                  {deployments && deployments.length > 0 ? (
                    deployments.map((dep) => {
                      const isActive = activeDep?.id === dep.id;
                      const isCompleted = dep.raw?.status === "COMPLETED";
                      return (
                        <DropdownMenuItem
                          key={dep.id}
                          onClick={() => setActiveDep && setActiveDep(dep)}
                          className={`flex items-center justify-between cursor-pointer rounded-md px-2 py-2 text-xs ${
                            isActive
                              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isActive
                                  ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                                  : isCompleted
                                    ? "bg-slate-300 dark:bg-slate-600"
                                    : "bg-blue-400"
                              }`}
                            />
                            <div className="flex flex-col min-w-0">
                              <span
                                className={`font-black text-xs uppercase leading-tight ${
                                  isActive ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {dep.jobNo || dep.id}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate leading-tight">
                                {dep.name || "Unknown"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCompleted && (
                              <span className="text-[8px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">
                                Done
                              </span>
                            )}
                            {isActive && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                          </div>
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <div className="px-2 py-3 text-center text-[10px] text-slate-400 font-bold uppercase">
                      No {inspMethod === "DIVING" ? "dives" : "deployments"} recorded
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* In Water Time */}
            <div className="shrink-0 flex flex-col items-end">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mb-1">
                In Water
              </span>
              <div className="h-[34px] flex items-center px-2 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 rounded-md">
                <span className="font-black text-[#2563eb] dark:text-blue-400 text-xs tracking-tight">
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
                  {diveStartTime ? formatClientTime(diveStartTime, { hour12: false, includeSeconds: true }) : "--:--:--"}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 py-1 px-2 rounded-md border border-slate-100 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-x-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase min-w-[40px]">On Deck</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-none">
                  {diveEndTime ? formatClientTime(diveEndTime, { hour12: false, includeSeconds: true }) : "--:--:--"}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-50 dark:bg-slate-800/40 py-1 px-2 rounded-md border border-slate-100 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-x-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase min-w-[40px]">Launch</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-none">
                  {diveStartTime ? formatClientTime(diveStartTime, { hour12: false, includeSeconds: true }) : "--:--:--"}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/40 py-1 px-2 rounded-md border border-slate-100 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-x-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase min-w-[40px]">Recovery</span>
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-none">
                  {diveEndTime ? formatClientTime(diveEndTime, { hour12: false, includeSeconds: true }) : "--:--:--"}
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
              className="flex-1 h-8 text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-950/60 bg-rose-50 dark:bg-rose-950/30 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Rollback
            </Button>

            {inspMethod === "DIVING" ? (
              <Button
                onClick={handleMovementNext}
                disabled={currentMovement === diveActionsList[diveActionsList.length - 1]?.label}
                className="flex-[1.5] h-8 text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md shadow-blue-500/20"
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
                      className="flex-[1.5] h-8 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> New ROV Dive
                    </Button>
                  );
                }

                if (isCompleted) {
                  return (
                    <Button
                      disabled
                      className="flex-[1.5] h-8 text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white opacity-80"
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
                      className={`flex-[1.5] h-8 font-black uppercase bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md shadow-blue-500/20 flex items-center justify-center min-w-0 ${
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
                      <Button className="flex-[1.5] h-8 text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md shadow-blue-500/20">
                        Next Action... <ChevronDown className="w-3.5 h-3.5 ml-1 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 shadow-xl min-w-[180px]">
                      {options.map((opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() => handleMovementLog && handleMovementLog(opt)}
                          className="text-[11px] font-bold uppercase tracking-wider cursor-pointer py-2 text-blue-600 dark:text-blue-400 font-mono"
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
