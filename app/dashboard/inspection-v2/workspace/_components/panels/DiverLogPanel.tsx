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
import DiveMovementLog from "@/app/dashboard/inspection/dive/components/DiveMovementLog";
import ROVMovementLog from "@/app/dashboard/inspection/rov/components/ROVMovementLog";

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
}: DiverLogPanelProps) {
  return (
    <Card className="flex flex-col border-none shadow-none rounded-none h-full bg-white dark:bg-slate-900/60 backdrop-blur-md overflow-y-auto custom-scrollbar">
      <div className="bg-[#1f2937] text-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] flex justify-between items-center shrink-0">
        <span>{inspMethod === "DIVING" ? "DIVER LOG" : "ROV DIVE LOG"}</span>
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
                  return (
                    <Button
                      onClick={() => handleMovementLog && handleMovementLog(options[0])}
                      className="flex-[1.5] h-8 text-[11px] font-black uppercase tracking-wider bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm truncate"
                    >
                      Next: {options[0]} <ArrowRight className="w-3.5 h-3.5 ml-1 shrink-0" />
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

        <div className="flex flex-col gap-1.5 mt-2 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
          {inspMethod === "DIVING" ? (
            <DiveMovementLog diveJob={activeDep} />
          ) : (
            <ROVMovementLog diveJob={activeDep} />
          )}
        </div>
      </div>
    </Card>
  );
}
