"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Compass,
  Activity,
  X,
  Maximize2,
  Minimize2,
  Eye,
  GitCompare,
  Box,
} from "lucide-react";
import { Pipeline3DViewer, PipelineEvent3D } from "../Pipeline3DViewer";

interface Pipeline3DViewerPanelProps {
  records: any[];
  startPlatformName?: string;
  endPlatformName?: string;
  selectedEventId?: string | number;
  onSelectEvent?: (evt: any) => void;
  onClose?: () => void;
  surveyOptions?: Array<{ id: string; label: string; records: any[] }>;
}

export function Pipeline3DViewerPanel({
  records = [],
  startPlatformName = "Platform A",
  endPlatformName = "Platform B",
  selectedEventId,
  onSelectEvent,
  onClose,
  surveyOptions = [],
}: Pipeline3DViewerPanelProps) {
  const [showComparison, setShowComparison] = useState(false);
  const [selectedComparisonId, setSelectedComparisonId] = useState<string>("");
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Map input inspection records to PipelineEvent3D
  const formattedPrimaryRecords: PipelineEvent3D[] = records.map((r, idx) => {
    const rawVal = r.raw || r;
    return {
      id: r.id || r.insp_id || idx,
      kp: parseFloat(r.kp || rawVal.kp || idx * 0.1),
      easting: parseFloat(r.easting || rawVal.easting || 700000 + idx * 20),
      northing: parseFloat(r.northing || rawVal.northing || 9000000 + idx * 10),
      depth: Math.abs(parseFloat(r.depth || rawVal.depth || rawVal.verification_depth || 15)),
      eventType: r.eventType || r.event_type || r.inspection_type?.code || "EVENT",
      eventName: r.eventName || r.event_name || r.inspection_type?.name || "Pipeline Inspection Event",
      isAnomaly: r.findingType === "Anomaly" || r.finding_type === "Anomaly" || r.is_anomaly,
      defectType: r.defectType || r.defect_type,
      cpValue: r.cp_fg_rdg || r.cp_rdg || r.cp,
      findings: r.findings || r.findings_summary || r.record_notes,
      anodeDepletion: r.anode_depletion || r.depletion_rate,
      length: parseFloat(r.span_length || r.length || 4),
    };
  });

  // Comparison Survey Records
  const selectedCompSurvey = surveyOptions.find((s) => s.id === selectedComparisonId);
  const formattedCompRecords: PipelineEvent3D[] = (selectedCompSurvey?.records || []).map((r, idx) => {
    const rawVal = r.raw || r;
    return {
      id: `comp-${r.id || idx}`,
      kp: parseFloat(r.kp || rawVal.kp || idx * 0.1),
      easting: parseFloat(r.easting || rawVal.easting || 700000 + idx * 20),
      northing: parseFloat(r.northing || rawVal.northing || 9000000 + idx * 10),
      depth: Math.abs(parseFloat(r.depth || rawVal.depth || 15.2)),
      eventType: r.eventType || r.event_type || "EVENT",
      eventName: r.eventName || r.event_name || "Historical Inspection Event",
      isAnomaly: r.findingType === "Anomaly" || r.finding_type === "Anomaly",
      findings: r.findings || r.findings_summary,
    };
  });

  return (
    <Card className={`flex flex-col h-full bg-slate-950 border-none rounded-none shadow-none text-white overflow-hidden ${isFullScreen ? "fixed inset-0 z-50" : "relative"}`}>
      {/* TOP CONTROL TOOLBAR */}
      <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-blue-600/20 text-blue-400 border border-blue-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5" />
            <span>3D PIPELINE INSPECTION MAP</span>
          </Badge>

          {/* Survey Comparison Toggle Button */}
          {surveyOptions.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[10px]">
              <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold text-slate-300">Compare Survey:</span>
              <select
                value={selectedComparisonId}
                onChange={(e) => {
                  setSelectedComparisonId(e.target.value);
                  setShowComparison(Boolean(e.target.value));
                }}
                className="bg-slate-900 text-cyan-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700 focus:outline-none"
              >
                <option value="">-- Select Historical Survey --</option>
                {surveyOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="h-7 px-2 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800"
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 px-2 text-[10px] font-bold text-slate-300 hover:text-red-400 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 3D CANVAS BODY */}
      <div className="flex-1 min-h-0 relative">
        <Pipeline3DViewer
          records={formattedPrimaryRecords}
          comparisonRecords={formattedCompRecords}
          startPlatformName={startPlatformName}
          endPlatformName={endPlatformName}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          showComparison={showComparison}
          surveyLabel="Current Survey"
          comparisonLabel={selectedCompSurvey?.label || "Historical Survey"}
        />
      </div>
    </Card>
  );
}
