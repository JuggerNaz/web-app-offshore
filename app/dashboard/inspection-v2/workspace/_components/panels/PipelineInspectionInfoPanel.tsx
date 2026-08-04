"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Info, Gauge } from "lucide-react";

export interface PipelineInspectionInfoPanelProps {
  currentKp?: number | string;
  rovKp?: number | string;
  inspectionDirection?: string;
  inspectionLocation?: string;
  totalPipelineLength?: number | string;
  unitSystem?: "METRIC" | "IMPERIAL";
  historicalEvents?: Array<{ eventType: string; kp: number }>;
}

export function PipelineInspectionInfoPanel({
  currentKp = 0.000,
  rovKp,
  inspectionDirection = "Increase KP",
  inspectionLocation = "Pipeline",
  totalPipelineLength = 10.000,
  unitSystem = "METRIC",
  historicalEvents = [],
}: PipelineInspectionInfoPanelProps) {
  const [liveKp, setLiveKp] = useState<number>(() => {
    const p = parseFloat(String(rovKp ?? currentKp));
    return !isNaN(p) && p >= 0 ? p : 0;
  });

  useEffect(() => {
    const p = parseFloat(String(rovKp ?? currentKp));
    if (!isNaN(p) && p >= 0) {
      setLiveKp(p);
    }
  }, [rovKp, currentKp]);

  const inspectionInfoSummary = useMemo(() => {
    const isImperial = unitSystem === "IMPERIAL";
    const posPrefix = isImperial ? "FP" : "KP";
    const distUnit = isImperial ? "ft" : "m";

    const toPosVal = (kpInKm: number): number => {
      return isImperial ? kpInKm * 3280.84 : kpInKm;
    };

    const curPosVal = toPosVal(liveKp);
    const curPosFormatted = isImperial ? curPosVal.toFixed(1) : curPosVal.toFixed(3);

    const isIncreaseFlow = !inspectionDirection.toUpperCase().includes("DECREASE");
    const flowLabel = isIncreaseFlow ? `Increase ${posPrefix}` : `Decrease ${posPrefix}`;
    const isMainPipelineLocation = inspectionLocation.toUpperCase() === "PIPELINE";

    let completionText = `${curPosFormatted}`;
    const totalLenKm = typeof totalPipelineLength === "number" ? totalPipelineLength : parseFloat(String(totalPipelineLength || ""));
    if (isMainPipelineLocation && !isNaN(totalLenKm) && totalLenKm > 0) {
      const totalPosVal = toPosVal(totalLenKm);
      const totalPosFormatted = isImperial ? totalPosVal.toFixed(1) : totalPosVal.toFixed(3);
      const pct = Math.min(100, Math.max(0, (liveKp / totalLenKm) * 100));
      completionText = `${curPosFormatted} / ${totalPosFormatted} = ${pct.toFixed(1)}%`;
    }

    const findNextUpcoming = (type: "FIELD_JOINT" | "ANODE" | "CROSSING", fallbackIntervalMeters?: number) => {
      const matches = historicalEvents.filter((e) => e.eventType === type);
      let upcomingKp: number | null = null;

      if (matches.length > 0) {
        if (isIncreaseFlow) {
          const ahead = matches.filter((e) => e.kp > liveKp).sort((a, b) => a.kp - b.kp);
          if (ahead.length > 0) upcomingKp = ahead[0].kp;
        } else {
          const ahead = matches.filter((e) => e.kp < liveKp).sort((a, b) => b.kp - a.kp);
          if (ahead.length > 0) upcomingKp = ahead[0].kp;
        }
      }

      if (upcomingKp === null && fallbackIntervalMeters) {
        const intervalKp = fallbackIntervalMeters / 1000;
        if (isIncreaseFlow) {
          upcomingKp = Math.ceil(liveKp / intervalKp) * intervalKp;
          if (upcomingKp <= liveKp) upcomingKp += intervalKp;
        } else {
          upcomingKp = Math.floor(liveKp / intervalKp) * intervalKp;
          if (upcomingKp >= liveKp) upcomingKp -= intervalKp;
        }
      }

      if (upcomingKp !== null) {
        const distMeters = Math.abs(upcomingKp - liveKp) * 1000;
        const displayUpcomingPos = toPosVal(upcomingKp);
        const displayUpcomingStr = isImperial ? displayUpcomingPos.toFixed(1) : displayUpcomingPos.toFixed(3);
        const displayDist = Math.round(isImperial ? distMeters * 3.28084 : distMeters);

        return {
          kpStr: `${posPrefix} ${displayUpcomingStr}`,
          distStr: `(${displayDist}${distUnit} ahead)`,
        };
      }

      return { kpStr: "N/A", distStr: "" };
    };

    const nextFj = findNextUpcoming("FIELD_JOINT", 12);
    const nextAnode = findNextUpcoming("ANODE");
    const nextCrossing = findNextUpcoming("CROSSING");

    return {
      posPrefix,
      curPosFormatted,
      completionText,
      flowLabel,
      nextFj,
      nextAnode,
      nextCrossing,
    };
  }, [liveKp, inspectionDirection, inspectionLocation, totalPipelineLength, historicalEvents, unitSystem]);

  return (
    <Card className="flex flex-col h-full w-full min-h-0 border-none shadow-none rounded-none bg-[#080d16] text-slate-100 overflow-hidden font-mono">
      {/* Panel Header */}
      <div className="bg-[#0b1626] border-b border-sky-500/20 px-3.5 py-2 shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-sky-400" />
          <span className="text-[11px] font-black uppercase tracking-wider text-sky-400 font-sans">
            INSPECTION INFO
          </span>
        </div>
        <span className="w-4 h-4 rounded-full border border-sky-400/60 text-sky-400 flex items-center justify-center text-[10px] font-serif font-bold shadow-sm" title="Pipeline Live Inspection Info">
          i
        </span>
      </div>

      {/* Main Content Body */}
      <div className="p-3.5 space-y-2 text-[11px] overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-[115px_10px_1fr] items-center gap-y-2">
          <span className="text-slate-300 font-sans font-medium">Current {inspectionInfoSummary.posPrefix}</span>
          <span className="text-slate-400">:</span>
          <span className="text-lime-400 font-black tracking-wide text-xs">
            {inspectionInfoSummary.completionText}
          </span>

          <span className="text-slate-300 font-sans font-medium">Inspection Flow</span>
          <span className="text-slate-400">:</span>
          <span className="text-lime-400 font-bold">
            {inspectionInfoSummary.flowLabel}
          </span>

          <span className="text-slate-300 font-sans font-medium">Next Field Joint</span>
          <span className="text-slate-400">:</span>
          <span className="text-lime-400 font-bold">
            {inspectionInfoSummary.nextFj.kpStr}{" "}
            {inspectionInfoSummary.nextFj.distStr && (
              <span className="text-lime-300/80 text-[10px] font-normal">
                {inspectionInfoSummary.nextFj.distStr}
              </span>
            )}
          </span>

          <span className="text-slate-300 font-sans font-medium">Next Anode</span>
          <span className="text-slate-400">:</span>
          <span className="text-lime-400 font-bold">
            {inspectionInfoSummary.nextAnode.kpStr}{" "}
            {inspectionInfoSummary.nextAnode.distStr && (
              <span className="text-lime-300/80 text-[10px] font-normal">
                {inspectionInfoSummary.nextAnode.distStr}
              </span>
            )}
          </span>

          <span className="text-slate-300 font-sans font-medium">Next Crossing</span>
          <span className="text-slate-400">:</span>
          <span className="text-lime-400 font-bold">
            {inspectionInfoSummary.nextCrossing.kpStr}{" "}
            {inspectionInfoSummary.nextCrossing.distStr && (
              <span className="text-lime-300/80 text-[10px] font-normal">
                {inspectionInfoSummary.nextCrossing.distStr}
              </span>
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
