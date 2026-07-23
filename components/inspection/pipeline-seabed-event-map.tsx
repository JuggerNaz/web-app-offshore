"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MapPin,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter,
  Printer,
  Compass,
  Layers,
  Ruler,
  AlertTriangle,
  FileText,
  Eye,
  ArrowRight,
  Maximize2,
  Minimize2,
  X,
  Search,
  CheckCircle2,
  Activity,
  History,
  TrendingUp,
  Download,
  Info,
} from "lucide-react";
import { toast } from "sonner";

export interface PipelineEventItem {
  id: string | number;
  event_name: string;
  event_type?: string;
  event_position?: string;
  event_description?: string;
  kp: number;
  end_kp?: number; // For span / burial ranges
  northing?: string | number;
  easting?: string | number;
  depth?: string | number;
  cp_fg_rdg?: string | number;
  rov_heading?: string | number;
  inspection_date?: string;
  inspection_time?: string;
  tape_count_no?: string;
  finding_type?: "Complete" | "Finding" | "Anomaly" | "Incomplete" | string;
  findings?: string;
  anomaly_code?: string;
  span_height?: number; // in meters
  burial_depth?: number; // in meters
  survey_run?: "current" | "previous";
}

interface PipelineSeabedEventMapProps {
  isOpen: boolean;
  onClose: () => void;
  structureName?: string;
  pipelineLengthKm?: number; // e.g. 10.500 km
  events?: PipelineEventItem[];
  previousEvents?: PipelineEventItem[]; // For historical comparison
  onSelectEvent?: (event: PipelineEventItem) => void;
}

export function PipelineSeabedEventMap({
  isOpen,
  onClose,
  structureName = "Pipeline Main Line",
  pipelineLengthKm = 10.0,
  events = [],
  previousEvents = [],
  onSelectEvent,
}: PipelineSeabedEventMapProps) {
  // Navigation & Zoom State
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x to 50x
  const [viewStartKp, setViewStartKp] = useState<number>(0);
  const [viewEndKp, setViewEndKp] = useState<number>(pipelineLengthKm || 10);
  const [isMarkAreaMode, setIsMarkAreaMode] = useState<boolean>(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; endX: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);

  // Filter State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState<boolean>(false);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [showProfileGraph, setShowProfileGraph] = useState<boolean>(true);

  // Measure Tool State
  const [isMeasureMode, setIsMeasureMode] = useState<boolean>(false);
  const [measurePoint1, setMeasurePoint1] = useState<PipelineEventItem | null>(null);
  const [measurePoint2, setMeasurePoint2] = useState<PipelineEventItem | null>(null);

  // Selected Event Popover
  const [activeEvent, setActiveEvent] = useState<PipelineEventItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate actual total max KP from events if greater than default pipeline length
  const maxCalculatedKp = useMemo(() => {
    let maxKp = pipelineLengthKm || 1.0;
    events.forEach((e) => {
      if (e.kp && e.kp > maxKp) maxKp = e.kp;
      if (e.end_kp && e.end_kp > maxKp) maxKp = e.end_kp;
    });
    return Math.max(maxKp, 0.5);
  }, [events, pipelineLengthKm]);

  // Sync initial viewEndKp with maxCalculatedKp when opened
  useEffect(() => {
    if (isOpen) {
      setViewStartKp(0);
      setViewEndKp(maxCalculatedKp);
      setZoomLevel(1);
    }
  }, [isOpen, maxCalculatedKp]);

  // Event Categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      const cat = e.event_name || e.event_type || "General";
      if (cat) set.add(cat);
    });
    return Array.from(set);
  }, [events]);

  // Filtered Events List
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Category filter
      if (selectedCategories.length > 0) {
        const cat = evt.event_name || evt.event_type || "General";
        if (!selectedCategories.includes(cat)) return false;
      }
      // Anomalies only filter
      if (showAnomaliesOnly && evt.finding_type !== "Anomaly" && evt.finding_type !== "Finding") {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = evt.event_name?.toLowerCase().includes(q);
        const matchType = evt.event_type?.toLowerCase().includes(q);
        const matchDesc = evt.event_description?.toLowerCase().includes(q);
        const matchKp = evt.kp?.toString().includes(q);
        const matchAnomaly = evt.anomaly_code?.toLowerCase().includes(q);
        if (!matchName && !matchType && !matchDesc && !matchKp && !matchAnomaly) {
          return false;
        }
      }
      return true;
    });
  }, [events, selectedCategories, showAnomaliesOnly, searchQuery]);

  // Handle Box Selection Zooming
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMarkAreaMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setSelectionBox({ startX: x, endX: x });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionBox || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSelectionBox((prev) => (prev ? { ...prev, endX: x } : null));
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selectionBox || !containerRef.current) return;
    setIsSelecting(false);
    const width = containerRef.current.clientWidth;
    const startX = Math.min(selectionBox.startX, selectionBox.endX);
    const endX = Math.max(selectionBox.startX, selectionBox.endX);
    const dragDistance = endX - startX;

    if (dragDistance > 15 && width > 0) {
      const currentSpan = viewEndKp - viewStartKp;
      const newStartKp = viewStartKp + (startX / width) * currentSpan;
      const newEndKp = viewStartKp + (endX / width) * currentSpan;

      setViewStartKp(Math.max(0, newStartKp));
      setViewEndKp(Math.min(maxCalculatedKp, newEndKp));
      setZoomLevel(maxCalculatedKp / (newEndKp - newStartKp));
      toast.info(`Zoomed to KP ${newStartKp.toFixed(3)} - ${newEndKp.toFixed(3)}`);
    }
    setSelectionBox(null);
    setIsMarkAreaMode(false);
  };

  // Zoom Controls
  const handleZoomIn = () => {
    const currentSpan = viewEndKp - viewStartKp;
    const newSpan = currentSpan * 0.6;
    const mid = (viewStartKp + viewEndKp) / 2;
    let nStart = Math.max(0, mid - newSpan / 2);
    let nEnd = Math.min(maxCalculatedKp, mid + newSpan / 2);
    setViewStartKp(nStart);
    setViewEndKp(nEnd);
    setZoomLevel(maxCalculatedKp / (nEnd - nStart));
  };

  const handleZoomOut = () => {
    const currentSpan = viewEndKp - viewStartKp;
    const newSpan = currentSpan * 1.5;
    const mid = (viewStartKp + viewEndKp) / 2;
    let nStart = Math.max(0, mid - newSpan / 2);
    let nEnd = Math.min(maxCalculatedKp, mid + newSpan / 2);
    setViewStartKp(nStart);
    setViewEndKp(nEnd);
    setZoomLevel(maxCalculatedKp / (nEnd - nStart));
  };

  const handleResetZoom = () => {
    setViewStartKp(0);
    setViewEndKp(maxCalculatedKp);
    setZoomLevel(1);
  };

  // Helper to map KP to percentage position in visible viewport (0% to 100%)
  const kpToPercent = (kp: number) => {
    const span = viewEndKp - viewStartKp;
    if (span <= 0) return 0;
    return ((kp - viewStartKp) / span) * 100;
  };

  // Rulers & Ticks Calculation
  const rulerTicks = useMemo(() => {
    const visibleSpan = viewEndKp - viewStartKp;
    let step = 1.0; // Default 1 km
    if (visibleSpan <= 0.2) step = 0.01; // 10m
    else if (visibleSpan <= 0.5) step = 0.05; // 50m
    else if (visibleSpan <= 1.0) step = 0.1; // 100m
    else if (visibleSpan <= 3.0) step = 0.5; // 500m
    else if (visibleSpan <= 10.0) step = 1.0; // 1 km
    else step = 2.0;

    const ticks: { kp: number; percent: number; label: string; isMajor: boolean }[] = [];
    const firstTick = Math.ceil(viewStartKp / step) * step;
    for (let kp = firstTick; kp <= viewEndKp; kp += step) {
      const pct = kpToPercent(kp);
      if (pct >= 0 && pct <= 100) {
        ticks.push({
          kp,
          percent: pct,
          label: step < 0.1 ? `${(kp * 1000).toFixed(0)}m` : `KP ${kp.toFixed(3)}`,
          isMajor: Math.abs(kp % (step * 2)) < 0.001 || step >= 1.0,
        });
      }
    }
    return ticks;
  }, [viewStartKp, viewEndKp]);

  // Color helper for Event Badges
  const getEventBadgeColor = (evt: PipelineEventItem) => {
    if (evt.finding_type === "Anomaly") return "bg-red-500 text-white border-red-700 shadow-red-500/50";
    if (evt.finding_type === "Finding") return "bg-amber-500 text-white border-amber-700 shadow-amber-500/50";
    const name = (evt.event_name || evt.event_type || "").toUpperCase();
    if (name.includes("SPAN")) return "bg-emerald-600 text-white border-emerald-700";
    if (name.includes("BURIAL")) return "bg-blue-600 text-white border-blue-700";
    if (name.includes("EXPOSURE")) return "bg-amber-600 text-white border-amber-700";
    if (name.includes("TRENCH")) return "bg-purple-600 text-white border-purple-700";
    if (name.includes("CP")) return "bg-cyan-600 text-white border-cyan-700";
    if (name.includes("ANODE")) return "bg-indigo-600 text-white border-indigo-700";
    return "bg-slate-700 text-white border-slate-900";
  };

  // Event Distance Calculation helper
  const measuredDistance = useMemo(() => {
    if (!measurePoint1 || !measurePoint2) return null;
    const distKp = Math.abs(measurePoint2.kp - measurePoint1.kp);
    const distMeters = distKp * 1000;
    return {
      kp1: measurePoint1.kp,
      kp2: measurePoint2.kp,
      distKp: distKp.toFixed(3),
      distMeters: distMeters.toFixed(2),
    };
  }, [measurePoint1, measurePoint2]);

  // Print Graphics
  const handlePrintGraphics = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-[96vw] h-[92vh] flex flex-col p-0 gap-0 bg-slate-950 text-slate-100 border-slate-800 overflow-hidden rounded-xl shadow-2xl">
        {/* Top Dialog Header Bar */}
        <DialogHeader className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <span>{structureName} — 2D/3D Interactive Pipeline Seabed & Event Map</span>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[9px]">
                  0.000 to {maxCalculatedKp.toFixed(3)} KP ({maxCalculatedKp.toFixed(2)} km)
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-[10px] text-slate-400">
                Full-length 3D metallic pipeline profile, events, continuous spans, anomalies & multi-scale ruler
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isMarkAreaMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsMarkAreaMode(!isMarkAreaMode)}
              className={`h-8 px-2.5 text-[10px] font-bold uppercase ${
                isMarkAreaMode ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-slate-700 text-slate-300"
              }`}
              title="Click & Drag on pipeline to zoom into selected area"
            >
              <Maximize2 className="w-3.5 h-3.5 mr-1" />
              {isMarkAreaMode ? "Drag Area to Zoom..." : "Mark Area"}
            </Button>

            <Button
              variant={isMeasureMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsMeasureMode(!isMeasureMode);
                setMeasurePoint1(null);
                setMeasurePoint2(null);
              }}
              className={`h-8 px-2.5 text-[10px] font-bold uppercase ${
                isMeasureMode ? "bg-cyan-600 hover:bg-cyan-700 text-white" : "border-slate-700 text-slate-300"
              }`}
              title="Click two events to measure distance"
            >
              <Ruler className="w-3.5 h-3.5 mr-1" />
              {isMeasureMode ? "Select 2 Events..." : "Measure Distance"}
            </Button>

            <Button
              variant={showComparison ? "default" : "outline"}
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
              className={`h-8 px-2.5 text-[10px] font-bold uppercase ${
                showComparison ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-slate-700 text-slate-300"
              }`}
              title="Compare with Previous Survey Run"
            >
              <History className="w-3.5 h-3.5 mr-1" />
              {showComparison ? "Hide Compare" : "Compare Previous"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintGraphics}
              className="h-8 px-2.5 text-[10px] font-bold uppercase border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> Print Report
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Toolbar & Filters Bar */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            {/* Filter by Category */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-black uppercase text-slate-400">Category Filter:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {availableCategories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <Badge
                      key={cat}
                      variant="outline"
                      onClick={() => {
                        setSelectedCategories((prev) =>
                          isSelected ? prev.filter((c) => c !== cat) : [...prev, cat]
                        );
                      }}
                      className={`cursor-pointer text-[9px] px-2 py-0.5 font-bold transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-400"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      {cat}
                    </Badge>
                  );
                })}
                {selectedCategories.length > 0 && (
                  <button
                    onClick={() => setSelectedCategories([])}
                    className="text-[9px] text-blue-400 hover:underline ml-1"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Anomalies Only Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-red-400 uppercase bg-red-950/40 border border-red-900/50 px-2 py-1 rounded">
              <Checkbox
                checked={showAnomaliesOnly}
                onCheckedChange={(c) => setShowAnomaliesOnly(!!c)}
                className="border-red-500 data-[state=checked]:bg-red-600"
              />
              <AlertTriangle className="w-3 h-3" /> Anomalies Only
            </label>

            {/* Profile Graph Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-300 uppercase bg-slate-800/60 border border-slate-700 px-2 py-1 rounded">
              <Checkbox
                checked={showProfileGraph}
                onCheckedChange={(c) => setShowProfileGraph(!!c)}
                className="border-slate-500"
              />
              <TrendingUp className="w-3 h-3 text-cyan-400" /> Span/Burial Profile Graph
            </label>

            {/* Search Input */}
            <div className="relative w-48">
              <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search event or KP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-[10px] pl-7 bg-slate-950 border-slate-700 text-slate-200 focus-visible:ring-blue-500"
              />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                className="h-6 w-6 text-slate-300 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[9px] font-mono font-bold text-blue-400 px-1">
                {zoomLevel.toFixed(1)}x
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                className="h-6 w-6 text-slate-300 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetZoom}
                className="h-6 w-6 text-slate-400 hover:text-white"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Graphical Canvas Area */}
        <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden select-none">
          {/* Measure Banner if active */}
          {isMeasureMode && (
            <div className="bg-cyan-950/80 border-b border-cyan-800/80 px-4 py-1.5 flex items-center justify-between text-xs text-cyan-200 z-10">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-cyan-400 animate-bounce" />
                <span className="font-bold uppercase text-[10px] tracking-wider">
                  Distance Measurement Mode:
                </span>
                <span>
                  {!measurePoint1
                    ? "Click on the 1st event marker"
                    : !measurePoint2
                    ? `Point 1 selected (KP ${measurePoint1.kp.toFixed(3)}). Now click 2nd event marker...`
                    : `Result: ${measuredDistance?.distMeters} meters (${measuredDistance?.distKp} KP span)`}
                </span>
              </div>
              {measuredDistance && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMeasurePoint1(null);
                    setMeasurePoint2(null);
                  }}
                  className="h-6 text-[9px] font-bold text-cyan-300 hover:bg-cyan-900/50"
                >
                  Clear Selection
                </Button>
              )}
            </div>
          )}

          {/* Graphical Pipeline View */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`flex-1 relative flex flex-col justify-center p-6 overflow-hidden transition-all ${
              isMarkAreaMode ? "cursor-crosshair bg-amber-950/10" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

            {/* Drag Selection Marquee Overlay */}
            {isSelecting && selectionBox && (
              <div
                className="absolute top-0 bottom-0 bg-amber-500/20 border-2 border-amber-400 pointer-events-none z-30 flex items-center justify-center"
                style={{
                  left: `${Math.min(selectionBox.startX, selectionBox.endX)}px`,
                  width: `${Math.abs(selectionBox.endX - selectionBox.startX)}px`,
                }}
              >
                <span className="text-[10px] font-black uppercase text-amber-300 bg-slate-900/90 px-2 py-0.5 rounded border border-amber-500/50">
                  Release to Zoom
                </span>
              </div>
            )}

            {/* Active KP Range Header Indicator */}
            <div className="absolute top-3 left-4 text-[10px] font-mono text-slate-400 flex items-center gap-3 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
              <span className="text-blue-400 font-bold">VISIBLE KP: {viewStartKp.toFixed(3)} km</span>
              <span>→</span>
              <span className="text-blue-400 font-bold">{viewEndKp.toFixed(3)} km</span>
              <span className="text-slate-500">| Total Span: {(viewEndKp - viewStartKp).toFixed(3)} km</span>
            </div>

            {/* Historical Comparison Parallel Pipeline Track */}
            {showComparison && previousEvents.length > 0 && (
              <div className="relative w-full h-12 mb-6 border-b border-indigo-500/30 flex items-center">
                <div className="absolute top-0 left-2 text-[8px] font-black uppercase tracking-widest text-indigo-400">
                  Previous Survey Run Track (Historical Comparison)
                </div>
                {/* 3D Ghost Pipeline Line */}
                <div className="w-full h-3 rounded-full bg-gradient-to-r from-indigo-900 via-indigo-700 to-indigo-900 opacity-60 border border-indigo-500/40 relative shadow-inner">
                  {previousEvents.map((pevt, idx) => {
                    const pct = kpToPercent(pevt.kp);
                    if (pct < 0 || pct > 100) return null;
                    return (
                      <div
                        key={idx}
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-400 border border-indigo-200"
                        style={{ left: `${pct}%` }}
                        title={`Previous Event: ${pevt.event_name} at KP ${pevt.kp}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* MAIN 3D METALLIC STEEL PIPELINE GRAPHIC */}
            <div className="relative w-full h-24 my-4 flex items-center">
              {/* 3D Pipe Body */}
              <div className="w-full h-10 rounded-full bg-gradient-to-b from-slate-600 via-slate-300 to-slate-800 dark:from-slate-700 dark:via-slate-200 dark:to-slate-900 border border-slate-400/50 shadow-[0_10px_25px_rgba(0,0,0,0.6)] relative overflow-visible flex items-center">
                {/* Specular Highlight Streak running along the 3D pipe */}
                <div className="absolute top-1 left-0 right-0 h-1.5 bg-gradient-to-r from-white/40 via-white/80 to-white/40 blur-[1px] rounded-full pointer-events-none" />

                {/* Weld Joint Rings spaced along length */}
                <div className="absolute inset-0 flex justify-between items-center pointer-events-none px-4 opacity-40">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-1 h-full bg-slate-950 border-r border-white/40" />
                  ))}
                </div>

                {/* SPAN & BURIAL RANGE HIGHLIGHT BANDS */}
                {filteredEvents.map((evt, i) => {
                  if (!evt.end_kp || evt.end_kp <= evt.kp) return null;
                  const startPct = Math.max(0, kpToPercent(evt.kp));
                  const endPct = Math.min(100, kpToPercent(evt.end_kp));
                  const widthPct = endPct - startPct;
                  if (widthPct <= 0 || startPct > 100 || endPct < 0) return null;

                  const isSpan = (evt.event_name || evt.event_type || "").toUpperCase().includes("SPAN");
                  const isBurial = (evt.event_name || evt.event_type || "").toUpperCase().includes("BURIAL");

                  return (
                    <div
                      key={`band-${i}`}
                      onClick={() => setActiveEvent(evt)}
                      className={`absolute top-0 bottom-0 cursor-pointer border-x-2 transition-all hover:brightness-125 z-10 flex items-center justify-center ${
                        isSpan
                          ? "bg-emerald-500/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                          : isBurial
                          ? "bg-blue-500/40 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                          : "bg-amber-500/40 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                      }`}
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                      title={`${evt.event_name} (${evt.kp.toFixed(3)} to ${evt.end_kp.toFixed(3)} KP)`}
                    >
                      <span className="text-[8px] font-black uppercase text-white bg-slate-900/80 px-1 rounded truncate">
                        {evt.event_name || "Span"} ({(evt.end_kp - evt.kp).toFixed(3)} km)
                      </span>
                    </div>
                  );
                })}

                {/* POINT EVENT & ANOMALY MARKERS */}
                {filteredEvents.map((evt, idx) => {
                  const pct = kpToPercent(evt.kp);
                  if (pct < 0 || pct > 100) return null;

                  const isAnomaly = evt.finding_type === "Anomaly" || evt.finding_type === "Finding";
                  const isSelected = activeEvent?.id === evt.id;

                  return (
                    <div
                      key={`evt-${idx}`}
                      onClick={() => {
                        if (isMeasureMode) {
                          if (!measurePoint1) setMeasurePoint1(evt);
                          else if (!measurePoint2) setMeasurePoint2(evt);
                        } else {
                          setActiveEvent(evt);
                          onSelectEvent?.(evt);
                        }
                      }}
                      style={{ left: `${pct}%` }}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer z-20 transition-all transform hover:scale-125 ${
                        isSelected ? "scale-125 z-30" : ""
                      }`}
                    >
                      {/* Anomaly Pulsing Warning Marker */}
                      {isAnomaly ? (
                        <div className="relative group">
                          <span className="absolute -inset-1 rounded-full bg-red-600 animate-ping opacity-75" />
                          <div className="relative w-7 h-7 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-lg shadow-red-600/50 text-white font-black text-[10px]">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          {/* Floating Marker Badge Label */}
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-950 border border-red-700 text-red-200 font-mono font-bold text-[8px] px-1.5 py-0.5 rounded shadow">
                            {evt.anomaly_code || "ANOMALY"} @ KP {evt.kp.toFixed(3)}
                          </div>
                        </div>
                      ) : (
                        /* Regular Event Marker */
                        <div className="relative group">
                          <div
                            className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-md text-white font-bold text-[9px] ${getEventBadgeColor(
                              evt
                            )}`}
                          >
                            <MapPin className="w-3 h-3" />
                          </div>
                          {/* Marker Label */}
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 border border-slate-700 text-slate-200 font-mono text-[8px] px-1.5 py-0.5 rounded shadow opacity-90 group-hover:opacity-100">
                            {evt.event_name || evt.event_type} ({evt.kp.toFixed(3)})
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DYNAMIC SCALE RULER (KM & METER AUTO-ARRANGING TICK MARKS) */}
            <div className="relative w-full h-10 border-t-2 border-slate-700 mt-2 pt-1 flex items-center font-mono text-[9px] text-slate-400 select-none">
              {rulerTicks.map((t, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                  style={{ left: `${t.percent}%` }}
                >
                  <div
                    className={`w-0.5 ${
                      t.isMajor ? "h-3.5 bg-blue-400 font-black" : "h-2 bg-slate-600"
                    }`}
                  />
                  <span className={`mt-0.5 ${t.isMajor ? "text-blue-300 font-bold" : "text-slate-500"}`}>
                    {t.label}
                  </span>
                </div>
              ))}
            </div>

            {/* PROFILE GRAPH (SPAN HEIGHT & BURIAL DEPTH LONGITUDINAL PROFILE) */}
            {showProfileGraph && (
              <div className="w-full h-28 bg-slate-900/60 border border-slate-800 rounded-lg p-2 mt-3 relative flex flex-col">
                <div className="flex items-center justify-between text-[9px] font-black uppercase text-cyan-400 border-b border-slate-800 pb-1 mb-1">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-cyan-400" /> Longitudinal Seabed & Pipe Profile (Span Height / Burial Depth)
                  </span>
                  <span className="text-slate-500 font-normal">Green = Free Span | Blue = Burial Depth</span>
                </div>

                {/* SVG Curve Canvas */}
                <div className="flex-1 relative w-full h-full">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    {/* Seabed Reference Baseline */}
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#475569" strokeDasharray="3 3" strokeWidth="1" />
                    <text x="5" y="45%" fill="#64748b" fontSize="8" fontFamily="monospace">Seabed Level (0m)</text>

                    {/* Render Span Height Bars & Curve */}
                    {filteredEvents.map((evt, idx) => {
                      if (!evt.kp) return null;
                      const pct = kpToPercent(evt.kp);
                      if (pct < 0 || pct > 100) return null;

                      const spanH = evt.span_height || 0;
                      const burialD = evt.burial_depth || 0;

                      if (spanH > 0) {
                        const heightPx = Math.min(35, spanH * 15);
                        return (
                          <g key={`span-graph-${idx}`}>
                            <line x1={`${pct}%`} y1="50%" x2={`${pct}%`} y2={`${50 - heightPx}%`} stroke="#10b981" strokeWidth="2" />
                            <circle cx={`${pct}%`} cy={`${50 - heightPx}%`} r="3" fill="#10b981" />
                            <text x={`${pct}%`} y={`${45 - heightPx}%`} fill="#10b981" fontSize="7" textAnchor="middle">{spanH.toFixed(2)}m</text>
                          </g>
                        );
                      }

                      if (burialD > 0) {
                        const depthPx = Math.min(35, burialD * 15);
                        return (
                          <g key={`burial-graph-${idx}`}>
                            <line x1={`${pct}%`} y1="50%" x2={`${pct}%`} y2={`${50 + depthPx}%`} stroke="#3b82f6" strokeWidth="2" />
                            <circle cx={`${pct}%`} cy={`${50 + depthPx}%`} r="3" fill="#3b82f6" />
                            <text x={`${pct}%`} y={`${62 + depthPx}%`} fill="#60a5fa" fontSize="7" textAnchor="middle">{burialD.toFixed(2)}m</text>
                          </g>
                        );
                      }
                      return null;
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* ACTIVE EVENT DETAILS POPOVER PANEL */}
          {activeEvent && (
            <Card className="absolute bottom-4 right-4 w-96 bg-slate-900/95 border border-slate-700 text-slate-100 p-3 shadow-2xl backdrop-blur-md rounded-xl z-40 animate-in fade-in slide-in-from-bottom-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={getEventBadgeColor(activeEvent)}>
                    {activeEvent.finding_type || "Event"}
                  </Badge>
                  <span className="font-black text-xs uppercase tracking-wider text-white">
                    {activeEvent.event_name || activeEvent.event_type}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveEvent(null)}
                  className="h-5 w-5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono">
                <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2 rounded border border-slate-800">
                  <div>
                    <span className="text-slate-500 uppercase text-[9px] block">KP Position</span>
                    <span className="text-blue-400 font-bold">{activeEvent.kp.toFixed(3)} km</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[9px] block">Depth</span>
                    <span className="text-slate-200 font-bold">{activeEvent.depth || "—"} m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[9px] block">Northing</span>
                    <span className="text-slate-200">{activeEvent.northing || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[9px] block">Easting</span>
                    <span className="text-slate-200">{activeEvent.easting || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[9px] block">CP Reading</span>
                    <span className="text-slate-200">{activeEvent.cp_fg_rdg || "—"} mV</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[9px] block">ROV Heading</span>
                    <span className="text-slate-200">{activeEvent.rov_heading || "—"}°</span>
                  </div>
                </div>

                {activeEvent.event_description && (
                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800 text-[10px] text-slate-300">
                    <span className="text-slate-500 font-bold uppercase text-[8px] block mb-0.5">Description / Remarks</span>
                    {activeEvent.event_description}
                  </div>
                )}

                {activeEvent.findings && (
                  <div className="bg-amber-950/30 p-2 rounded border border-amber-800/50 text-[10px] text-amber-200">
                    <span className="text-amber-500 font-bold uppercase text-[8px] block mb-0.5">Findings</span>
                    {activeEvent.findings}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800 text-[9px]">
                <span className="text-slate-400 font-mono">
                  {activeEvent.inspection_date} {activeEvent.inspection_time}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    onSelectEvent?.(activeEvent);
                    toast.success(`Selected event: ${activeEvent.event_name}`);
                  }}
                  className="h-6 text-[9px] font-bold uppercase bg-blue-600 hover:bg-blue-700 text-white px-2"
                >
                  Load in Form <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Footer Summary & Stats */}
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0">
          <div className="flex items-center gap-4">
            <span>
              Total Filtered Events: <strong className="text-slate-200">{filteredEvents.length}</strong>
            </span>
            <span>
              Anomalies Flagged:{" "}
              <strong className="text-red-400">
                {filteredEvents.filter((e) => e.finding_type === "Anomaly").length}
              </strong>
            </span>
            <span>
              Current Scale Precision:{" "}
              <strong className="text-blue-400 font-bold">
                {zoomLevel > 10 ? "10 cm / Meter Scale" : zoomLevel > 3 ? "100 Meter Scale" : "Kilometer Scale"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              Pipeline Length: {maxCalculatedKp.toFixed(3)} km | Standard Offshore Datum
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PipelineSeabedEventMap;
