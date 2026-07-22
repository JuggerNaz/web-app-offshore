"use client";

import React from "react";
import { ListTodo, Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SummaryPanelProps {
  stats: {
    fieldJointsDone: number;
    fieldJointsTotal: number;
    anodesDone: number;
    anodesTotal: number;
    mgDone: number;
    mgTotal: number;
    crossingsDone: number;
    crossingsTotal: number;
    exposedDone: number;
    exposedTotal: number;
    spansDone: number;
    spansTotal: number;
    burialDone: number;
    burialTotal: number;
    supportsDone: number;
    supportsTotal: number;
    cpStabsDone: number;
    cpStabsTotal: number;
    anomaliesCount: number;
    anomaliesTotal: number;
  };
  dataCapture: {
    anodeType: string;
    anodeCondition: string;
    depletionRate: string;
    cpValue: string;
    observation: string;
  };
  setDataCapture: React.Dispatch<React.SetStateAction<any>>;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function PipelineSummaryPanel({
  stats,
  dataCapture,
  setDataCapture,
  onSave,
  onCancel,
  isSaving = false
}: SummaryPanelProps) {
  const categories = [
    { label: "Field Joint", done: stats.fieldJointsDone, total: stats.fieldJointsTotal },
    { label: "Anode", done: stats.anodesDone, total: stats.anodesTotal },
    { label: "Marine Growth", done: stats.mgDone, total: stats.mgTotal },
    { label: "Crossing", done: stats.crossingsDone, total: stats.crossingsTotal },
    { label: "Exposed Pipeline", done: stats.exposedDone, total: stats.exposedTotal },
    { label: "Span", done: stats.spansDone, total: stats.spansTotal },
    { label: "Burial", done: stats.burialDone, total: stats.burialTotal },
    { label: "Support", done: stats.supportsDone, total: stats.supportsTotal },
    { label: "CP Stab", done: stats.cpStabsDone, total: stats.cpStabsTotal },
    { label: "Anomaly", done: stats.anomaliesCount, total: stats.anomaliesTotal, highlight: true }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Scope Summary Section */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <ListTodo className="w-4 h-4 text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Inspection Summary</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
        {/* Progress Grid */}
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat, i) => (
            <div
              key={i}
              className={`p-2 rounded-lg border flex flex-col justify-between min-h-[50px] transition-all ${
                cat.highlight
                  ? "bg-red-950/20 border-red-500/30 shadow-sm shadow-red-950/20"
                  : "bg-slate-900/40 border-slate-800/80 hover:border-slate-800"
              }`}
            >
              <span className={`text-[9px] font-black uppercase tracking-wider ${cat.highlight ? "text-red-400" : "text-slate-400"}`}>
                {cat.label}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-black text-white">{cat.done}</span>
                <span className="text-[9px] font-bold text-slate-500">/ {cat.total}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Data Capture Form Section */}
        <div className="border-t border-slate-900 pt-3">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Data Capture</span>
          </div>

          <div className="space-y-2.5">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mb-1">Anode Type</span>
              <select
                value={dataCapture.anodeType}
                onChange={(e) => setDataCapture((prev: any) => ({ ...prev, anodeType: e.target.value }))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="Bracelet">Bracelet</option>
                <option value="Collar">Collar</option>
                <option value="Bar">Bar</option>
                <option value="Sled">Sled</option>
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mb-1">Anode Condition</span>
              <select
                value={dataCapture.anodeCondition}
                onChange={(e) => setDataCapture((prev: any) => ({ ...prev, anodeCondition: e.target.value }))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="Good">Good</option>
                <option value="Satisfactory">Satisfactory</option>
                <option value="Depleted">Depleted</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mb-1">Depletion Rate</span>
              <select
                value={dataCapture.depletionRate}
                onChange={(e) => setDataCapture((prev: any) => ({ ...prev, depletionRate: e.target.value }))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="0 - 25%">0 - 25%</option>
                <option value="25 - 50%">25 - 50%</option>
                <option value="50 - 75%">50 - 75%</option>
                <option value="75 - 100%">75 - 100%</option>
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mb-1">CP Value</span>
              <input
                type="text"
                placeholder="-987 mV"
                value={dataCapture.cpValue}
                onChange={(e) => setDataCapture((prev: any) => ({ ...prev, cpValue: e.target.value }))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
            </div>

            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mb-1">Observation</span>
              <textarea
                placeholder="No damage observed..."
                rows={2}
                value={dataCapture.observation}
                onChange={(e) => setDataCapture((prev: any) => ({ ...prev, observation: e.target.value }))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex gap-2 shrink-0">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1 h-8 text-[10px] font-black uppercase tracking-wider border-slate-800 text-slate-400 hover:text-white"
        >
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 h-8 text-[10px] font-black uppercase tracking-wider bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
