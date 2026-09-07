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
  const [showDepthGraph, setShowDepthGraph] = useState<boolean>(true);
  const [showCoordinatesGraph, setShowCoordinatesGraph] = useState<boolean>(true);
  const [showDepthTerrain, setShowDepthTerrain] = useState<boolean>(true);
  const [showSpanBurialLines, setShowSpanBurialLines] = useState<boolean>(true);
  const [showNorthingLine, setShowNorthingLine] = useState<boolean>(true);
  const [showEastingLine, setShowEastingLine] = useState<boolean>(true);
  const [hoverProfilePoint, setHoverProfilePoint] = useState<{
    xPct: number;
    kp: number;
    depth?: number;
    span?: number;
    burial?: number;
    easting?: number;
    northing?: number;
  } | null>(null);

  // Measure Tool State
  const [isMeasureMode, setIsMeasureMode] = useState<boolean>(false);
  const [measurePoint1, setMeasurePoint1] = useState<PipelineEventItem | null>(null);
  const [measurePoint2, setMeasurePoint2] = useState<PipelineEventItem | null>(null);

  // Selected Event Popover
  const [activeEvent, setActiveEvent] = useState<PipelineEventItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to filter out VIDEO LOG and MARINE GROWTH
  const isExcludedEvent = (name?: string, type?: string) => {
    const n = (name || "").toUpperCase().trim();
    const t = (type || "").toUpperCase().trim();
    if (
      n.includes("VIDEO LOG") ||
      n.includes("VIDEOLOG") ||
      n.includes("VIDEO_LOG") ||
      n.includes("TAPE LOG") ||
      t.includes("VIDEO LOG") ||
      t.includes("VIDEOLOG") ||
      t.includes("VIDEO_LOG") ||
      t.includes("TAPE LOG")
    ) {
      return true;
    }
    if (
      n.includes("MARINE GROWTH") ||
      n.includes("MARINE_GROWTH") ||
      n === "MGI" ||
      n === "DMGI" ||
      n === "RMGI" ||
      t.includes("MARINE GROWTH") ||
      t.includes("MARINE_GROWTH") ||
      t === "MGI" ||
      t === "DMGI" ||
      t === "RMGI"
    ) {
      return true;
    }
    return false;
  };

  // Helper to split Seabed Profile into Event Type and Position
  const getEventDisplay = (evt: PipelineEventItem) => {
    const nameUpper = (evt.event_name || "").toUpperCase().trim();
    const typeUpper = (evt.event_type || "").trim();
    const posUpper = (evt.event_position || "").trim();

    if (nameUpper.includes("SEABED") || nameUpper.includes("SEABED PROFILE")) {
      const pTitle = typeUpper ? typeUpper : "SEABED";
      const sTitle = posUpper ? posUpper : "";
      const cat = typeUpper ? `SEABED: ${typeUpper.toUpperCase()}` : posUpper ? `SEABED (${posUpper.toUpperCase()})` : "SEABED PROFILE";
      return {
        category: cat,
        primaryTitle: pTitle,
        subTitle: sTitle,
        fullLabel: sTitle ? `${pTitle} (${sTitle})` : pTitle,
      };
    }

    const title = evt.event_name || evt.event_type || "Event";
    return {
      category: title,
      primaryTitle: title,
      subTitle: posUpper,
      fullLabel: posUpper ? `${title} (${posUpper})` : title,
    };
  };

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

  // Surveyed events KP range
  const surveyedRange = useMemo(() => {
    const validKps = events
      .filter((e) => typeof e.kp === "number" && !isNaN(e.kp) && !isExcludedEvent(e.event_name, e.event_type))
      .map((e) => e.kp);
    if (validKps.length === 0) return null;
    const minKp = Math.min(...validKps);
    const maxKp = Math.max(...validKps);
    return { minKp, maxKp, span: maxKp - minKp };
  }, [events]);

  const handleFitSurveyRange = () => {
    if (!surveyedRange) return;
    const padding = Math.max(0.05, surveyedRange.span * 0.05);
    const nStart = Math.max(0, surveyedRange.minKp - padding);
    const nEnd = Math.min(maxCalculatedKp, surveyedRange.maxKp + padding);
    setViewStartKp(nStart);
    setViewEndKp(nEnd);
    setZoomLevel(maxCalculatedKp / (nEnd - nStart));
    toast.info(`Zoomed to active survey data range: KP ${nStart.toFixed(3)} - ${nEnd.toFixed(3)}`);
  };

  // Event Categories list (Excluding Video Log and Marine Growth, and splitting Seabed Profile)
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (isExcludedEvent(e.event_name, e.event_type)) return;
      const { category } = getEventDisplay(e);
      if (category) set.add(category);
    });
    return Array.from(set).sort();
  }, [events]);

  // Filtered Events List
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Exclude Video Log and Marine Growth
      if (isExcludedEvent(evt.event_name, evt.event_type)) return false;

      // Category filter
      if (selectedCategories.length > 0) {
        const { category, primaryTitle } = getEventDisplay(evt);
        const isMatch =
          selectedCategories.includes(category) ||
          selectedCategories.includes(primaryTitle) ||
          (selectedCategories.includes("SEABED PROFILE") && (evt.event_name || "").toUpperCase().includes("SEABED"));
        if (!isMatch) return false;
      }
      // Anomalies only filter
      if (showAnomaliesOnly && evt.finding_type !== "Anomaly" && evt.finding_type !== "Finding" && !evt.anomaly_code) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = evt.event_name?.toLowerCase().includes(q);
        const matchType = evt.event_type?.toLowerCase().includes(q);
        const matchPos = evt.event_position?.toLowerCase().includes(q);
        const matchDesc = evt.event_description?.toLowerCase().includes(q);
        const matchKp = evt.kp?.toString().includes(q);
        const matchAnomaly = evt.anomaly_code?.toLowerCase().includes(q);
        if (!matchName && !matchType && !matchPos && !matchDesc && !matchKp && !matchAnomaly) {
          return false;
        }
      }
      return true;
    });
  }, [events, selectedCategories, showAnomaliesOnly, searchQuery]);

  // Handle Box Selection & Canvas Panning
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartX, setPanStartX] = useState<number>(0);
  const [panStartKpRange, setPanStartKpRange] = useState<{ start: number; end: number }>({ start: 0, end: 10 });
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState<boolean>(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (isMarkAreaMode) {
      setSelectionBox({ startX: x, endX: x });
      setIsSelecting(true);
    } else {
      // Pan mode
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartKpRange({ start: viewStartKp, end: viewEndKp });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    if (isSelecting && selectionBox) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setSelectionBox((prev) => (prev ? { ...prev, endX: x } : null));
    } else if (isPanning) {
      const deltaX = e.clientX - panStartX;
      const width = containerRef.current.clientWidth;
      if (width > 0) {
        const span = panStartKpRange.end - panStartKpRange.start;
        const deltaKp = -(deltaX / width) * span;
        let newStart = panStartKpRange.start + deltaKp;
        let newEnd = panStartKpRange.end + deltaKp;

        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        }
        if (newEnd > maxCalculatedKp) {
          newEnd = maxCalculatedKp;
          newStart = Math.max(0, maxCalculatedKp - span);
        }
        setViewStartKp(newStart);
        setViewEndKp(newEnd);
      }
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionBox && containerRef.current) {
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
    }
    setIsPanning(false);
  };

  // Scrollbar Pan Controls
  const handleScrollbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollbarTrackRef.current) return;
    const rect = scrollbarTrackRef.current.getBoundingClientRect();
    const clickFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const span = viewEndKp - viewStartKp;
    const centerKp = clickFraction * maxCalculatedKp;
    let nStart = centerKp - span / 2;
    let nEnd = centerKp + span / 2;

    if (nStart < 0) {
      nStart = 0;
      nEnd = span;
    }
    if (nEnd > maxCalculatedKp) {
      nEnd = maxCalculatedKp;
      nStart = Math.max(0, maxCalculatedKp - span);
    }
    setViewStartKp(nStart);
    setViewEndKp(nEnd);
  };

  const handlePanStep = (direction: "left" | "right") => {
    const span = viewEndKp - viewStartKp;
    const step = span * 0.25;
    if (direction === "left") {
      let nStart = Math.max(0, viewStartKp - step);
      let nEnd = nStart + span;
      setViewStartKp(nStart);
      setViewEndKp(nEnd);
    } else {
      let nEnd = Math.min(maxCalculatedKp, viewEndKp + step);
      let nStart = Math.max(0, nEnd - span);
      setViewStartKp(nStart);
      setViewEndKp(nEnd);
    }
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

  // Dynamic Tree / Leaf Top Flags Auto-Arranger (Auto-scales and spaces flags when few/many events visible)
  const arrangedFlags = useMemo(() => {
    const visible = filteredEvents
      .map((evt) => {
        const pct = kpToPercent(evt.kp);
        const display = getEventDisplay(evt);
        return {
          event: evt,
          pct,
          display,
          isAnomaly: evt.finding_type === "Anomaly" || evt.finding_type === "Finding" || String(evt.anomaly_code || "").trim() !== "",
          isSelected: activeEvent?.id === evt.id,
        };
      })
      .filter((f) => f.pct >= -4 && f.pct <= 104)
      .sort((a, b) => a.pct - b.pct);

    const visibleCount = visible.length;
    if (visibleCount === 0) return [];

    // Dynamically adjust vertical tier spacing based on density of events on screen
    let minStem = 36;
    let tierStep = 44;
    let maxTiers = 5;

    if (visibleCount <= 5) {
      minStem = 45;
      tierStep = 55;
      maxTiers = 4;
    } else if (visibleCount <= 12) {
      minStem = 38;
      tierStep = 48;
      maxTiers = 5;
    } else if (visibleCount <= 25) {
      minStem = 34;
      tierStep = 40;
      maxTiers = 6;
    } else {
      minStem = 30;
      tierStep = 34;
      maxTiers = 6;
    }

    const tierHeights = Array.from({ length: maxTiers }, (_, i) => minStem + i * tierStep);
    const lastPctForTier = new Array(maxTiers).fill(-100);
    const minGapPct = visibleCount <= 8 ? 7.0 : visibleCount <= 18 ? 5.5 : 4.5;

    return visible.map((item, idx) => {
      const prevItem = visible[idx - 1];
      const nextItem = visible[idx + 1];
      const prevDist = prevItem ? Math.abs(item.pct - prevItem.pct) : 999;
      const nextDist = nextItem ? Math.abs(item.pct - nextItem.pct) : 999;
      const isIsolated = prevDist > 14 && nextDist > 14;

      let assignedTier = 0;

      if (isIsolated && visibleCount <= 10) {
        // When there are few events and they are well separated, auto-arrange them across staggered heights to fill space nicely
        assignedTier = idx % Math.min(3, maxTiers);
      } else {
        // Find the first available tier that avoids horizontal collision
        let foundTier = -1;
        for (let t = 0; t < maxTiers; t++) {
          if (item.pct - lastPctForTier[t] >= minGapPct) {
            foundTier = t;
            break;
          }
        }
        if (foundTier !== -1) {
          assignedTier = foundTier;
        } else {
          // All tiers occupied recently; pick the tier with the greatest distance
          let bestTier = 0;
          let maxDist = -1;
          for (let i = 0; i < maxTiers; i++) {
            const dist = item.pct - lastPctForTier[i];
            if (dist > maxDist) {
              maxDist = dist;
              bestTier = i;
            }
          }
          assignedTier = bestTier;
        }
      }

      lastPctForTier[assignedTier] = item.pct;

      return {
        ...item,
        tier: assignedTier,
        stemHeight: Math.min(240, tierHeights[assignedTier]),
      };
    });
  }, [filteredEvents, viewStartKp, viewEndKp, activeEvent]);

  // Jump to KP Position helper
  const jumpToKp = (targetKp: number) => {
    const span = viewEndKp - viewStartKp;
    let nStart = targetKp - span / 2;
    let nEnd = targetKp + span / 2;
    if (nStart < 0) {
      nStart = 0;
      nEnd = span;
    }
    if (nEnd > maxCalculatedKp) {
      nEnd = maxCalculatedKp;
      nStart = Math.max(0, maxCalculatedKp - span);
    }
    setViewStartKp(nStart);
    setViewEndKp(nEnd);
    toast.info(`Jumped to KP ${targetKp.toFixed(3)}`);
  };

  const currentMidKp = (viewStartKp + viewEndKp) / 2;
  const prevMatch = useMemo(() => {
    const matchesBefore = filteredEvents.filter((e) => e.kp < viewStartKp).sort((a, b) => b.kp - a.kp);
    return matchesBefore[0] || null;
  }, [filteredEvents, viewStartKp]);

  const nextMatch = useMemo(() => {
    const matchesAfter = filteredEvents.filter((e) => e.kp > viewEndKp).sort((a, b) => a.kp - b.kp);
    return matchesAfter[0] || null;
  }, [filteredEvents, viewEndKp]);

  const nearestMatch = useMemo(() => {
    if (filteredEvents.length === 0) return null;
    let closest = filteredEvents[0];
    let minDiff = Math.abs(closest.kp - currentMidKp);
    for (const evt of filteredEvents) {
      const diff = Math.abs(evt.kp - currentMidKp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = evt;
      }
    }
    return closest;
  }, [filteredEvents, currentMidKp]);

  // Compute Longitudinal Series Data (Continuous Trajectory Interpolation, Bathymetry Depth, Spans & Burials)
  const profileData = useMemo(() => {
    const validEvents = events
      .filter((e) => typeof e.kp === "number" && !isNaN(e.kp))
      .map((e) => {
        const d = typeof e.depth === "number" ? e.depth : parseFloat(String(e.depth || ""));
        const east = typeof e.easting === "number" ? e.easting : parseFloat(String(e.easting || ""));
        const north = typeof e.northing === "number" ? e.northing : parseFloat(String(e.northing || ""));
        const span = e.span_height ? (typeof e.span_height === "number" ? e.span_height : parseFloat(String(e.span_height))) : 0;
        const burial = e.burial_depth ? (typeof e.burial_depth === "number" ? e.burial_depth : parseFloat(String(e.burial_depth))) : 0;

        return {
          event: e,
          kp: e.kp,
          depth: isNaN(d) ? undefined : d,
          easting: isNaN(east) ? undefined : east,
          northing: isNaN(north) ? undefined : north,
          span: isNaN(span) ? 0 : span,
          burial: isNaN(burial) ? 0 : burial,
        };
      })
      .sort((a, b) => a.kp - b.kp);

    // 1. Coordinates Trajectory Interpolation Model (Strictly within surveyed KP bounds)
    const knownCoords = validEvents
      .filter((e) => e.easting !== undefined && e.northing !== undefined)
      .sort((a, b) => a.kp - b.kp);

    const getInterpolatedCoords = (kp: number): { easting: number; northing: number } | null => {
      if (knownCoords.length === 0) return null;
      if (knownCoords.length === 1) {
        return kp === knownCoords[0].kp ? { easting: knownCoords[0].easting!, northing: knownCoords[0].northing! } : null;
      }
      if (kp < knownCoords[0].kp || kp > knownCoords[knownCoords.length - 1].kp) {
        return null; // Do not extrapolate beyond actual survey boundaries
      }
      for (let i = 0; i < knownCoords.length - 1; i++) {
        const p0 = knownCoords[i];
        const p1 = knownCoords[i + 1];
        if (kp >= p0.kp && kp <= p1.kp) {
          const ratio = (kp - p0.kp) / (p1.kp - p0.kp || 1);
          return {
            easting: p0.easting! + (p1.easting! - p0.easting!) * ratio,
            northing: p0.northing! + (p1.northing! - p0.northing!) * ratio,
          };
        }
      }
      return null;
    };

    // 2. Depth Seabed Terrain Interpolation Model (Strictly within surveyed KP bounds)
    const knownDepths = validEvents
      .filter((e) => e.depth !== undefined)
      .sort((a, b) => a.kp - b.kp);

    const getInterpolatedDepth = (kp: number): number | null => {
      if (knownDepths.length === 0) return null;
      if (knownDepths.length === 1) {
        return kp === knownDepths[0].kp ? knownDepths[0].depth! : null;
      }
      if (kp < knownDepths[0].kp || kp > knownDepths[knownDepths.length - 1].kp) {
        return null; // Do not draw artificial flatline where no depth was measured
      }
      for (let i = 0; i < knownDepths.length - 1; i++) {
        const p0 = knownDepths[i];
        const p1 = knownDepths[i + 1];
        if (kp >= p0.kp && kp <= p1.kp) {
          const ratio = (kp - p0.kp) / (p1.kp - p0.kp || 1);
          return p0.depth! + (p1.depth! - p0.depth!) * ratio;
        }
      }
      return null;
    };

    // High-resolution sample points for the top zoomed viewport
    const sampleCount = 60;
    const vSpan = viewEndKp - viewStartKp;
    const sampleKps = new Set<number>();
    for (let i = 0; i <= sampleCount; i++) {
      sampleKps.add(viewStartKp + (i / sampleCount) * vSpan);
    }
    validEvents.forEach((e) => {
      if (e.kp >= viewStartKp && e.kp <= viewEndKp) sampleKps.add(e.kp);
    });

    const continuousPoints = Array.from(sampleKps)
      .sort((a, b) => a - b)
      .map((kp) => {
        const coords = getInterpolatedCoords(kp);
        const depth = getInterpolatedDepth(kp);
        const matchEvt = validEvents.find((e) => Math.abs(e.kp - kp) < 0.005);
        return {
          kp,
          depth: depth ?? undefined,
          easting: coords?.easting,
          northing: coords?.northing,
          span: matchEvt?.span || 0,
          burial: matchEvt?.burial || 0,
          event: matchEvt?.event,
        };
      });

    const allDepths = continuousPoints.map((e) => e.depth).filter((d): d is number => d !== undefined);
    const minDepth = allDepths.length > 0 ? Math.min(...allDepths) : 20;
    const maxDepth = allDepths.length > 0 ? Math.max(...allDepths) : 60;

    const allEastings = continuousPoints.map((e) => e.easting).filter((v): v is number => v !== undefined);
    const allNorthings = continuousPoints.map((e) => e.northing).filter((v): v is number => v !== undefined);
    const minEasting = allEastings.length > 0 ? Math.min(...allEastings) : 0;
    const maxEasting = allEastings.length > 0 ? Math.max(...allEastings) : 1000;
    const minNorthing = allNorthings.length > 0 ? Math.min(...allNorthings) : 0;
    const maxNorthing = allNorthings.length > 0 ? Math.max(...allNorthings) : 1000;

    return {
      points: continuousPoints,
      rawEvents: validEvents,
      minDepth,
      maxDepth: maxDepth === minDepth ? minDepth + 10 : maxDepth,
      minEasting,
      maxEasting: maxEasting === minEasting ? minEasting + 100 : maxEasting,
      minNorthing,
      maxNorthing: maxNorthing === minNorthing ? minNorthing + 100 : maxNorthing,
    };
  }, [events, viewStartKp, viewEndKp]);

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

  // Scrollbar thumb metrics
  const scrollThumbLeftPct = maxCalculatedKp > 0 ? (viewStartKp / maxCalculatedKp) * 100 : 0;
  const scrollThumbWidthPct = maxCalculatedKp > 0 ? Math.max(3, ((viewEndKp - viewStartKp) / maxCalculatedKp) * 100) : 100;

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
                Full-length 3D metallic pipeline profile, tree/leaf top flags, continuous spans, anomalies & interactive panning scrollbar
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

            {/* Depth & KP Graph Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-300 uppercase bg-slate-800/60 border border-slate-700 px-2 py-1 rounded hover:border-cyan-500/50 transition-colors">
              <Checkbox
                checked={showDepthGraph}
                onCheckedChange={(c) => setShowDepthGraph(!!c)}
                className="border-cyan-500 data-[state=checked]:bg-cyan-600"
              />
              <TrendingUp className="w-3 h-3 text-cyan-400" /> Depth & KP
            </label>

            {/* Coordinates Graph Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-300 uppercase bg-slate-800/60 border border-slate-700 px-2 py-1 rounded hover:border-amber-500/50 transition-colors">
              <Checkbox
                checked={showCoordinatesGraph}
                onCheckedChange={(c) => setShowCoordinatesGraph(!!c)}
                className="border-amber-500 data-[state=checked]:bg-amber-600"
              />
              <Compass className="w-3 h-3 text-amber-400" /> Coordinates (N/E)
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
              {surveyedRange && surveyedRange.span < maxCalculatedKp * 0.95 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFitSurveyRange}
                  className="h-6 px-2 text-[9px] font-bold text-cyan-300 border-cyan-800/80 bg-cyan-950/40 hover:bg-cyan-900/60 mr-0.5 shadow-sm"
                  title={`Fit view to active survey KP range (${surveyedRange.minKp.toFixed(2)} - ${surveyedRange.maxKp.toFixed(2)} km)`}
                >
                  <Maximize2 className="w-3 h-3 mr-1 text-cyan-400" />
                  Fit Survey Range ({surveyedRange.minKp.toFixed(1)}-{surveyedRange.maxKp.toFixed(1)}k)
                </Button>
              )}
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
                title="Reset Zoom (Full Pipeline Length)"
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
            className={`flex-1 relative flex flex-col justify-end p-6 pb-2 overflow-hidden transition-all ${
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
            <div className="absolute top-3 left-4 text-[10px] font-mono text-slate-400 flex items-center gap-3 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800 z-10">
              <span className="text-blue-400 font-bold">VISIBLE KP: {viewStartKp.toFixed(3)} km</span>
              <span>→</span>
              <span className="text-blue-400 font-bold">{viewEndKp.toFixed(3)} km</span>
              <span className="text-slate-500">| Total Span: {(viewEndKp - viewStartKp).toFixed(3)} km</span>
              {zoomLevel > 1 && (
                <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/30">
                  Drag canvas or use bottom scrollbar to pan
                </Badge>
              )}
            </div>

            {/* Historical Comparison Parallel Pipeline Track */}
            {showComparison && previousEvents.length > 0 && (
              <div className="relative w-full h-10 mb-4 border-b border-indigo-500/30 flex items-center shrink-0">
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

            {/* TREE / LEAF TOP FLAGS LAYER (Placed Above Pipeline) */}
            <div className="relative w-full h-64 mb-1 overflow-visible select-none">
              {/* Notice Banner when filtered events exist on the pipeline but are outside current viewport */}
              {filteredEvents.length > 0 && arrangedFlags.length === 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/95 border border-blue-500/50 rounded-xl p-4 shadow-2xl flex flex-col items-center gap-2 z-30 max-w-md text-center backdrop-blur-md">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase">
                    <Search className="w-4 h-4" />
                    <span>{filteredEvents.length} Matching Events Found On Pipeline</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    No matching events in current visible range (KP {viewStartKp.toFixed(3)} - {viewEndKp.toFixed(3)}).
                    Click any highlighted dot on the bottom scrollbar or jump to nearest match:
                  </p>
                  {nearestMatch && (
                    <Button
                      size="sm"
                      onClick={() => jumpToKp(nearestMatch.kp)}
                      className="h-7 text-[10px] font-bold uppercase bg-blue-600 hover:bg-blue-700 text-white mt-1 px-3 shadow"
                    >
                      Jump to Nearest Match @ KP {nearestMatch.kp.toFixed(3)} →
                    </Button>
                  )}
                </div>
              )}

              {/* SVG Connecting Branches/Stems */}
              <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-10">
                {arrangedFlags.map((item, idx) => {
                  const xPct = `${item.pct}%`;
                  const bottomY = 256; // bottom of flags canvas (connects to pipe)
                  const topY = bottomY - item.stemHeight;
                  const isAnom = item.isAnomaly;
                  const strokeColor = item.isSelected ? "#38bdf8" : isAnom ? "#ef4444" : "#475569";
                  const strokeWidth = item.isSelected ? 2 : isAnom ? 1.5 : 1;

                  return (
                    <g key={`stem-${idx}`}>
                      {/* Vertical branch line */}
                      <line
                        x1={xPct}
                        y1={topY}
                        x2={xPct}
                        y2={bottomY}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={item.tier > 2 ? "2 2" : "none"}
                        opacity={item.isSelected ? 1 : 0.75}
                      />
                      {/* Anchor pin dot at pipe connection */}
                      <circle
                        cx={xPct}
                        cy={bottomY}
                        r={isAnom ? 4 : 2.5}
                        fill={isAnom ? "#ef4444" : item.isSelected ? "#38bdf8" : "#94a3b8"}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* HTML Interactive Flag / Leaf Cards */}
              {arrangedFlags.map((item, idx) => {
                const isAnom = item.isAnomaly;
                const isSel = item.isSelected;
                const evt = item.event;

                return (
                  <div
                    key={`flag-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMeasureMode) {
                        if (!measurePoint1) setMeasurePoint1(evt);
                        else if (!measurePoint2) setMeasurePoint2(evt);
                      } else {
                        setActiveEvent(evt);
                        onSelectEvent?.(evt);
                      }
                    }}
                    style={{
                      left: `${item.pct}%`,
                      bottom: `${item.stemHeight}px`,
                    }}
                    className={`absolute -translate-x-1/2 cursor-pointer transition-all duration-150 transform hover:scale-110 hover:z-50 ${
                      isSel ? "scale-110 z-50 ring-2 ring-cyan-400 rounded shadow-cyan-500/50 shadow-lg" : "z-20"
                    }`}
                  >
                    {isAnom ? (
                      /* Anomaly Flag Card (Glowing Red / Warning Leaf) */
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-950/90 border border-red-500 shadow-md shadow-red-950 text-white whitespace-nowrap text-[9px] font-bold">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="text-red-300 font-extrabold">{evt.anomaly_code || "ANOMALY"}</span>
                        <span className="text-slate-400 font-mono text-[8px]">({evt.kp.toFixed(3)})</span>
                        {evt.findings && (
                          <span className="bg-red-900 text-white text-[8px] px-1 rounded uppercase font-black">
                            {evt.findings.slice(0, 10)}
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Standard Event Flag Card (Leaf-style Glass Tag) */
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 hover:border-slate-500 shadow-md text-slate-200 whitespace-nowrap text-[8.5px] font-bold hover:text-white">
                        <div className={`w-2 h-2 rounded-full ${getEventBadgeColor(evt)}`} />
                        <span className="truncate max-w-[130px]">{item.display?.primaryTitle || evt.event_name || evt.event_type || "Event"}</span>
                        {item.display?.subTitle && (
                          <span className="text-[7.5px] text-amber-300 bg-amber-950/70 px-1 py-0.2 rounded border border-amber-800/40 uppercase font-black">
                            {item.display.subTitle}
                          </span>
                        )}
                        <span className="text-blue-400 font-mono text-[8px]">{evt.kp.toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* MAIN 3D METALLIC STEEL PIPELINE GRAPHIC */}
            <div className="relative w-full h-12 my-1 flex items-center shrink-0">
              {/* 3D Pipe Body */}
              <div className="w-full h-9 rounded-full bg-gradient-to-b from-slate-600 via-slate-300 to-slate-800 dark:from-slate-700 dark:via-slate-200 dark:to-slate-900 border border-slate-400/50 shadow-[0_10px_25px_rgba(0,0,0,0.6)] relative overflow-visible flex items-center">
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
              </div>
            </div>

            {/* DYNAMIC SCALE RULER (KM & METER AUTO-ARRANGING TICK MARKS) */}
            <div className="relative w-full h-8 border-t-2 border-slate-700 mt-1 pt-1 flex items-center font-mono text-[9px] text-slate-400 select-none shrink-0">
              {rulerTicks.map((t, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                  style={{ left: `${t.percent}%` }}
                >
                  <div
                    className={`w-0.5 ${
                      t.isMajor ? "h-3 bg-blue-400 font-black" : "h-1.5 bg-slate-600"
                    }`}
                  />
                  <span className={`mt-0.5 ${t.isMajor ? "text-blue-300 font-bold" : "text-slate-500"}`}>
                    {t.label}
                  </span>
                </div>
              ))}
            </div>

            {/* INTERACTIVE HORIZONTAL SCROLLBAR & MINI-MAP PAN SLIDER */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-md p-1.5 my-2 flex items-center gap-2 select-none shrink-0">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePanStep("left")}
                  disabled={viewStartKp <= 0}
                  className="h-6 px-2 text-[9px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                  title="Pan Left along pipeline"
                >
                  ◀ Pan Left
                </Button>
                {prevMatch && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => jumpToKp(prevMatch.kp)}
                    className="h-6 px-1.5 text-[8px] font-bold text-cyan-300 border-cyan-700 bg-cyan-950/40 hover:bg-cyan-900/60"
                    title={`Jump to previous matching event at KP ${prevMatch.kp.toFixed(3)}`}
                  >
                    ← Match ({prevMatch.kp.toFixed(2)})
                  </Button>
                )}
              </div>

              {/* Scrollbar Track Rendering Filtered Event Ticks */}
              <div
                ref={scrollbarTrackRef}
                onClick={handleScrollbarClick}
                className="flex-1 h-5 bg-slate-950 border border-slate-800 rounded relative cursor-pointer overflow-hidden flex items-center"
              >
                {/* Filtered Event Markers in mini-track */}
                {filteredEvents.map((e, idx) => {
                  if (!maxCalculatedKp) return null;
                  const ePct = (e.kp / maxCalculatedKp) * 100;
                  const isAnom = e.finding_type === "Anomaly" || e.finding_type === "Finding" || !!e.anomaly_code;
                  return (
                    <div
                      key={`mini-evt-${idx}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        jumpToKp(e.kp);
                      }}
                      className={`absolute top-1/2 -translate-y-1/2 rounded-full cursor-pointer hover:scale-150 transition-transform ${
                        isAnom
                          ? "bg-red-500 z-10 w-2 h-3.5 shadow-[0_0_6px_rgba(239,68,68,0.9)] ring-1 ring-red-300"
                          : "bg-cyan-400 w-1.5 h-2.5 shadow-[0_0_4px_rgba(34,211,238,0.7)]"
                      }`}
                      style={{ left: `${ePct}%` }}
                      title={`Click to jump to: ${e.event_name || e.event_type} @ KP ${e.kp.toFixed(3)}`}
                    />
                  );
                })}

                {/* Draggable Viewport Slider Thumb */}
                <div
                  style={{
                    left: `${scrollThumbLeftPct}%`,
                    width: `${scrollThumbWidthPct}%`,
                  }}
                  className="absolute top-0 bottom-0 bg-blue-600/30 border-2 border-blue-400 rounded shadow-[0_0_10px_rgba(59,130,246,0.5)] flex items-center justify-center transition-all cursor-grab active:cursor-grabbing hover:bg-blue-600/40"
                >
                  <span className="text-[8px] font-black uppercase text-blue-200 tracking-tighter truncate px-1 pointer-events-none">
                    {viewStartKp.toFixed(1)}k - {viewEndKp.toFixed(1)}k
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {nextMatch && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => jumpToKp(nextMatch.kp)}
                    className="h-6 px-1.5 text-[8px] font-bold text-cyan-300 border-cyan-700 bg-cyan-950/40 hover:bg-cyan-900/60"
                    title={`Jump to next matching event at KP ${nextMatch.kp.toFixed(3)}`}
                  >
                    Match ({nextMatch.kp.toFixed(2)}) →
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePanStep("right")}
                  disabled={viewEndKp >= maxCalculatedKp}
                  className="h-6 px-2 text-[9px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                  title="Pan Right along pipeline"
                >
                  Pan Right ▶
                </Button>
              </div>
            </div>

            {/* 1. DEPTH & KP PROFILE GRAPH (SEABED BATHYMETRY, SPAN & BURIAL PROFILES) */}
            {showDepthGraph && (
              <div className="w-full h-32 bg-slate-900/90 border border-slate-800 rounded-lg p-2 mt-2 relative flex flex-col shrink-0 select-none">
                {/* Header with Interactive Channel Toggles */}
                <div className="flex flex-wrap items-center justify-between text-[9px] font-black uppercase text-cyan-400 border-b border-slate-800 pb-1.5 mb-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-cyan-400 font-bold">1. Seabed Depth & Pipe Profile</span>
                      <span className="text-slate-500 font-normal">(Water Depth Bathymetry vs KP)</span>
                    </span>
                  </div>

                  {/* Channel Badges / Toggles */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setShowDepthTerrain(!showDepthTerrain)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${
                        showDepthTerrain
                          ? "bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                          : "bg-slate-900 border-slate-700 text-slate-500 opacity-50"
                      }`}
                      title="Toggle Seabed Terrain / Water Depth Bathymetry profile"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Seabed Depth ({profileData.minDepth.toFixed(1)}m - {profileData.maxDepth.toFixed(1)}m)
                    </button>

                    <button
                      onClick={() => setShowSpanBurialLines(!showSpanBurialLines)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${
                        showSpanBurialLines
                          ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                          : "bg-slate-900 border-slate-700 text-slate-500 opacity-50"
                      }`}
                      title="Toggle Free Span & Burial Depth profiles"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Free Span
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-1" />
                      Burial
                    </button>
                  </div>
                </div>

                {/* SVG Curve Canvas with Interactive Crosshair */}
                <div
                  className="flex-1 relative w-full h-full cursor-crosshair overflow-hidden"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    const currentSpan = viewEndKp - viewStartKp;
                    const hoverKp = viewStartKp + (xPct / 100) * currentSpan;

                    // Find closest point in profile data
                    let closest = profileData.points[0];
                    let minDiff = 9999;
                    profileData.points.forEach((pt) => {
                      const diff = Math.abs(pt.kp - hoverKp);
                      if (diff < minDiff) {
                        minDiff = diff;
                        closest = pt;
                      }
                    });

                    setHoverProfilePoint({
                      xPct,
                      kp: hoverKp,
                      depth: closest?.depth,
                      span: closest?.span,
                      burial: closest?.burial,
                      easting: closest?.easting,
                      northing: closest?.northing,
                    });
                  }}
                  onMouseLeave={() => setHoverProfilePoint(null)}
                >
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <defs>
                      {/* Seabed Bathymetry Terrain Linear Gradient */}
                      <linearGradient id="seabedTerrainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                        <stop offset="40%" stopColor="#0284c7" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#082f49" stopOpacity="0.05" />
                      </linearGradient>

                      {/* Span Height Glowing Area Gradient */}
                      <linearGradient id="spanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>

                      {/* Burial Depth Glowing Area Gradient */}
                      <linearGradient id="burialAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>

                    {/* Seabed Reference Grid Lines */}
                    <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#1e293b" strokeDasharray="2 2" strokeWidth="1" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#334155" strokeDasharray="3 3" strokeWidth="1.5" />
                    <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#1e293b" strokeDasharray="2 2" strokeWidth="1" />
                    <text x="6" y="48%" fill="#64748b" fontSize="7.5" fontFamily="monospace" fontWeight="bold">Seabed Datum (0m)</text>
                    <text x="6" y="18%" fill="#06b6d4" fontSize="7" fontFamily="monospace">Min: {profileData.minDepth.toFixed(1)}m</text>
                    <text x="6" y="90%" fill="#06b6d4" fontSize="7" fontFamily="monospace">Max: {profileData.maxDepth.toFixed(1)}m</text>

                    {/* 1. SEABED TERRAIN / WATER DEPTH BATHYMETRY SMOOTH MESH */}
                    {showDepthTerrain && profileData.points.length >= 2 && (() => {
                      const depthPoints = profileData.points.filter((pt) => pt.depth !== undefined);
                      if (depthPoints.length < 2) return null;

                      const dMin = profileData.minDepth;
                      const dMax = profileData.maxDepth;
                      const dRange = Math.max(dMax - dMin, 1);

                      const pts = depthPoints.map((pt) => ({
                        x: kpToPercent(pt.kp),
                        y: 20 + (((pt.depth! - dMin) / dRange) * 55),
                      }));

                      // Smooth cubic curve path
                      let pathD = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
                      for (let i = 0; i < pts.length - 1; i++) {
                        const p0 = pts[i === 0 ? 0 : i - 1];
                        const p1 = pts[i];
                        const p2 = pts[i + 1];
                        const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];

                        const cp1x = p1.x + (p2.x - p0.x) / 6;
                        const cp1y = p1.y + (p2.y - p0.y) / 6;
                        const cp2x = p2.x - (p3.x - p1.x) / 6;
                        const cp2y = p2.y - (p3.y - p1.y) / 6;

                        pathD += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
                      }

                      const closedPolygonD = `${pathD} L ${pts[pts.length - 1].x.toFixed(2)} 100 L ${pts[0].x.toFixed(2)} 100 Z`;

                      return (
                        <g key="seabed-terrain-mesh">
                          {/* Smooth Shaded Underwater Bathymetry Area */}
                          <path d={closedPolygonD} fill="url(#seabedTerrainGrad)" />
                          {/* Top Smooth Bathymetry Contour Line */}
                          <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="2.5" />
                          {/* Discrete Survey Sampling Points */}
                          {depthPoints.map((pt, idx) => {
                            const x = kpToPercent(pt.kp);
                            if (x < 0 || x > 100) return null;
                            const y = 20 + (((pt.depth! - dMin) / dRange) * 55);
                            return (
                              <circle
                                key={`d-pt-${idx}`}
                                cx={`${x}%`}
                                cy={`${y}%`}
                                r="2"
                                fill="#06b6d4"
                                opacity="0.9"
                              />
                            );
                          })}
                        </g>
                      );
                    })()}

                    {/* FREE SPAN & BURIAL DEPTH SMOOTH PROFILES & BARS */}
                    {showSpanBurialLines && (() => {
                      const spanBurialPts = profileData.points;
                      const hasSpans = spanBurialPts.some((p) => p.span > 0);
                      const hasBurials = spanBurialPts.some((p) => p.burial > 0);

                      // Build Span Curve & Shaded Envelope
                      const spanCurvePts = spanBurialPts.map((p) => ({
                        x: kpToPercent(p.kp),
                        y: 50 - Math.min(32, (p.span || 0) * 16),
                      }));

                      const burialCurvePts = spanBurialPts.map((p) => ({
                        x: kpToPercent(p.kp),
                        y: 50 + Math.min(32, (p.burial || 0) * 16),
                      }));

                      let spanPath = `M ${spanCurvePts[0].x.toFixed(2)} ${spanCurvePts[0].y.toFixed(2)}`;
                      for (let i = 0; i < spanCurvePts.length - 1; i++) {
                        const p0 = spanCurvePts[i === 0 ? 0 : i - 1];
                        const p1 = spanCurvePts[i];
                        const p2 = spanCurvePts[i + 1];
                        const p3 = spanCurvePts[i + 2 >= spanCurvePts.length ? spanCurvePts.length - 1 : i + 2];
                        const cp1x = p1.x + (p2.x - p0.x) / 6;
                        const cp1y = p1.y + (p2.y - p0.y) / 6;
                        const cp2x = p2.x - (p3.x - p1.x) / 6;
                        const cp2y = p2.y - (p3.y - p1.y) / 6;
                        spanPath += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
                      }

                      let burialPath = `M ${burialCurvePts[0].x.toFixed(2)} ${burialCurvePts[0].y.toFixed(2)}`;
                      for (let i = 0; i < burialCurvePts.length - 1; i++) {
                        const p0 = burialCurvePts[i === 0 ? 0 : i - 1];
                        const p1 = burialCurvePts[i];
                        const p2 = burialCurvePts[i + 1];
                        const p3 = burialCurvePts[i + 2 >= burialCurvePts.length ? burialCurvePts.length - 1 : i + 2];
                        const cp1x = p1.x + (p2.x - p0.x) / 6;
                        const cp1y = p1.y + (p2.y - p0.y) / 6;
                        const cp2x = p2.x - (p3.x - p1.x) / 6;
                        const cp2y = p2.y - (p3.y - p1.y) / 6;
                        burialPath += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
                      }

                      const closedSpanArea = `${spanPath} L ${spanCurvePts[spanCurvePts.length - 1].x.toFixed(2)} 50 L ${spanCurvePts[0].x.toFixed(2)} 50 Z`;
                      const closedBurialArea = `${burialPath} L ${burialCurvePts[burialCurvePts.length - 1].x.toFixed(2)} 50 L ${burialCurvePts[0].x.toFixed(2)} 50 Z`;

                      return (
                        <g key="span-burial-curves">
                          {/* Span Shaded Area & Smooth Emerald Curve */}
                          {hasSpans && (
                            <>
                              <path d={closedSpanArea} fill="url(#spanAreaGrad)" />
                              <path d={spanPath} fill="none" stroke="#10b981" strokeWidth="2.5" />
                            </>
                          )}

                          {/* Burial Shaded Area & Smooth Blue Curve */}
                          {hasBurials && (
                            <>
                              <path d={closedBurialArea} fill="url(#burialAreaGrad)" />
                              <path d={burialPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                            </>
                          )}

                          {/* Discrete Peak / Valley Callout Markers */}
                          {filteredEvents.map((evt, idx) => {
                            if (!evt.kp) return null;
                            const pct = kpToPercent(evt.kp);
                            if (pct < 0 || pct > 100) return null;

                            const spanH = evt.span_height || 0;
                            const burialD = evt.burial_depth || 0;

                            if (spanH > 0) {
                              const heightPx = Math.min(30, spanH * 15);
                              return (
                                <g key={`span-marker-${idx}`}>
                                  <line x1={`${pct}%`} y1="50%" x2={`${pct}%`} y2={`${50 - heightPx}%`} stroke="#10b981" strokeWidth="2" strokeDasharray="2 2" />
                                  <circle cx={`${pct}%`} cy={`${50 - heightPx}%`} r="3.5" fill="#10b981" className="animate-pulse" />
                                  <text x={`${pct}%`} y={`${42 - heightPx}%`} fill="#34d399" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                                    +{spanH.toFixed(2)}m
                                  </text>
                                </g>
                              );
                            }

                            if (burialD > 0) {
                              const depthPx = Math.min(30, burialD * 15);
                              return (
                                <g key={`burial-marker-${idx}`}>
                                  <line x1={`${pct}%`} y1="50%" x2={`${pct}%`} y2={`${50 + depthPx}%`} stroke="#3b82f6" strokeWidth="2" strokeDasharray="2 2" />
                                  <circle cx={`${pct}%`} cy={`${50 + depthPx}%`} r="3.5" fill="#3b82f6" />
                                  <text x={`${pct}%`} y={`${62 + depthPx}%`} fill="#60a5fa" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                                    -{burialD.toFixed(2)}m
                                  </text>
                                </g>
                              );
                            }
                            return null;
                          })}
                        </g>
                      );
                    })()}

                    {/* HOVER SCANNING CROSSHAIR LINE */}
                    {hoverProfilePoint && (
                      <g key="hover-crosshair-depth">
                        <line
                          x1={`${hoverProfilePoint.xPct}%`}
                          y1="0"
                          x2={`${hoverProfilePoint.xPct}%`}
                          y2="100%"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                        <circle cx={`${hoverProfilePoint.xPct}%`} cy="50%" r="3" fill="#38bdf8" />
                      </g>
                    )}
                  </svg>

                  {/* Interactive Floating Hover Pill */}
                  {hoverProfilePoint && (
                    <div
                      style={{
                        left: `${Math.max(10, Math.min(90, hoverProfilePoint.xPct))}%`,
                        top: "4px",
                      }}
                      className="absolute -translate-x-1/2 bg-slate-950/95 border border-cyan-500/70 text-slate-100 px-2 py-1 rounded shadow-xl pointer-events-none text-[8px] font-mono z-30 flex items-center gap-2 whitespace-nowrap backdrop-blur-sm"
                    >
                      <span className="text-blue-300 font-bold">KP {hoverProfilePoint.kp.toFixed(3)}</span>
                      {hoverProfilePoint.depth !== undefined && (
                        <span className="text-cyan-400 font-semibold">🌊 Depth: {hoverProfilePoint.depth.toFixed(1)}m</span>
                      )}
                      {hoverProfilePoint.span ? (
                        <span className="text-emerald-400 font-semibold">Span: +{hoverProfilePoint.span.toFixed(2)}m</span>
                      ) : null}
                      {hoverProfilePoint.burial ? (
                        <span className="text-blue-400 font-semibold">Burial: -{hoverProfilePoint.burial.toFixed(2)}m</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. COORDINATES PROFILE GRAPH (NORTHING & EASTING VS KP) */}
            {showCoordinatesGraph && (
              <div className="w-full h-32 bg-slate-900/90 border border-slate-800 rounded-lg p-2 mt-2 relative flex flex-col shrink-0 select-none">
                {/* Header with Interactive Channel Toggles */}
                <div className="flex flex-wrap items-center justify-between text-[9px] font-black uppercase text-amber-400 border-b border-slate-800 pb-1.5 mb-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <Compass className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-400 font-bold">2. Coordinates Profile</span>
                      <span className="text-slate-500 font-normal">(Northing & Easting Grid vs KP)</span>
                    </span>
                  </div>

                  {/* Channel Badges / Toggles */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setShowNorthingLine(!showNorthingLine)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${
                        showNorthingLine
                          ? "bg-amber-950/80 border-amber-500 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                          : "bg-slate-900 border-slate-700 text-slate-500 opacity-50"
                      }`}
                      title="Toggle Northing (Y) Trajectory curve"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Northing (Y): {profileData.minNorthing.toFixed(0)}m - {profileData.maxNorthing.toFixed(0)}m
                    </button>

                    <button
                      onClick={() => setShowEastingLine(!showEastingLine)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${
                        showEastingLine
                          ? "bg-purple-950/80 border-purple-500 text-purple-300 shadow-[0_0_8px_rgba(192,132,252,0.4)]"
                          : "bg-slate-900 border-slate-700 text-slate-500 opacity-50"
                      }`}
                      title="Toggle Easting (X) Trajectory curve"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      Easting (X): {profileData.minEasting.toFixed(0)}m - {profileData.maxEasting.toFixed(0)}m
                    </button>
                  </div>
                </div>

                {/* SVG Curve Canvas with Interactive Crosshair */}
                <div
                  className="flex-1 relative w-full h-full cursor-crosshair overflow-hidden"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    const currentSpan = viewEndKp - viewStartKp;
                    const hoverKp = viewStartKp + (xPct / 100) * currentSpan;

                    let closest = profileData.points[0];
                    let minDiff = 9999;
                    profileData.points.forEach((pt) => {
                      const diff = Math.abs(pt.kp - hoverKp);
                      if (diff < minDiff) {
                        minDiff = diff;
                      }
                    });

                    setHoverProfilePoint({
                      xPct,
                      kp: hoverKp,
                      depth: closest?.depth,
                      span: closest?.span,
                      burial: closest?.burial,
                      easting: closest?.easting,
                      northing: closest?.northing,
                    });
                  }}
                  onMouseLeave={() => setHoverProfilePoint(null)}
                >
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    {/* Coordinate Reference Grid Lines */}
                    <line x1="0" y1="20%" x2="100%" y2="20%" stroke="#1e293b" strokeDasharray="2 2" strokeWidth="1" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#334155" strokeDasharray="3 3" strokeWidth="1.5" />
                    <line x1="0" y1="80%" x2="100%" y2="80%" stroke="#1e293b" strokeDasharray="2 2" strokeWidth="1" />
                    
                    {/* Axis Bounds Labels */}
                    <text x="6" y="16%" fill="#f59e0b" fontSize="7.5" fontFamily="monospace" fontWeight="bold">N-Max: {profileData.maxNorthing.toFixed(0)}m</text>
                    <text x="6" y="88%" fill="#f59e0b" fontSize="7.5" fontFamily="monospace" fontWeight="bold">N-Min: {profileData.minNorthing.toFixed(0)}m</text>
                    
                    <text x="98%" y="16%" fill="#c084fc" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="end">E-Max: {profileData.maxEasting.toFixed(0)}m</text>
                    <text x="98%" y="88%" fill="#c084fc" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="end">E-Min: {profileData.minEasting.toFixed(0)}m</text>

                    {/* FULL-LENGTH COORDINATE TRAJECTORY CURVES (NORTHING & EASTING) */}
                    {profileData.points.length >= 2 && (() => {
                      const coordPts = profileData.points.filter((pt) => pt.northing !== undefined && pt.easting !== undefined);
                      if (coordPts.length < 2) return null;

                      const nMin = profileData.minNorthing;
                      const nMax = profileData.maxNorthing;
                      const nRange = Math.max(nMax - nMin, 1);

                      const eMin = profileData.minEasting;
                      const eMax = profileData.maxEasting;
                      const eRange = Math.max(eMax - eMin, 1);

                      const northPts = coordPts.map((c) => ({
                        x: kpToPercent(c.kp),
                        y: 80 - (((c.northing! - nMin) / nRange) * 60),
                      }));

                      const eastPts = coordPts.map((c) => ({
                        x: kpToPercent(c.kp),
                        y: 80 - (((c.easting! - eMin) / eRange) * 60),
                      }));

                      // Smooth cubic curve for Northing
                      let northPath = `M ${northPts[0].x.toFixed(2)} ${northPts[0].y.toFixed(2)}`;
                      for (let i = 0; i < northPts.length - 1; i++) {
                        const p0 = northPts[i === 0 ? 0 : i - 1];
                        const p1 = northPts[i];
                        const p2 = northPts[i + 1];
                        const p3 = northPts[i + 2 >= northPts.length ? northPts.length - 1 : i + 2];
                        const cp1x = p1.x + (p2.x - p0.x) / 6;
                        const cp1y = p1.y + (p2.y - p0.y) / 6;
                        const cp2x = p2.x - (p3.x - p1.x) / 6;
                        const cp2y = p2.y - (p3.y - p1.y) / 6;
                        northPath += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
                      }

                      // Smooth cubic curve for Easting
                      let eastPath = `M ${eastPts[0].x.toFixed(2)} ${eastPts[0].y.toFixed(2)}`;
                      for (let i = 0; i < eastPts.length - 1; i++) {
                        const p0 = eastPts[i === 0 ? 0 : i - 1];
                        const p1 = eastPts[i];
                        const p2 = eastPts[i + 1];
                        const p3 = eastPts[i + 2 >= eastPts.length ? eastPts.length - 1 : i + 2];
                        const cp1x = p1.x + (p2.x - p0.x) / 6;
                        const cp1y = p1.y + (p2.y - p0.y) / 6;
                        const cp2x = p2.x - (p3.x - p1.x) / 6;
                        const cp2y = p2.y - (p3.y - p1.y) / 6;
                        eastPath += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
                      }

                      return (
                        <g key="coordinates-profile-lines">
                          {/* Continuous Northing Amber Dashed Line */}
                          {showNorthingLine && (
                            <>
                              <path d={northPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.95" />
                              {northPts.map((pt, idx) => {
                                if (pt.x < 0 || pt.x > 100) return null;
                                return (
                                  <circle
                                    key={`n-pt-${idx}`}
                                    cx={`${pt.x}%`}
                                    cy={`${pt.y}%`}
                                    r="2"
                                    fill="#f59e0b"
                                    opacity="0.8"
                                  />
                                );
                              })}
                            </>
                          )}

                          {/* Continuous Easting Purple Solid Line */}
                          {showEastingLine && (
                            <>
                              <path d={eastPath} fill="none" stroke="#c084fc" strokeWidth="2.5" opacity="0.95" />
                              {eastPts.map((pt, idx) => {
                                if (pt.x < 0 || pt.x > 100) return null;
                                return (
                                  <circle
                                    key={`e-pt-${idx}`}
                                    cx={`${pt.x}%`}
                                    cy={`${pt.y}%`}
                                    r="2"
                                    fill="#c084fc"
                                    opacity="0.8"
                                  />
                                );
                              })}
                            </>
                          )}
                        </g>
                      );
                    })()}

                    {/* HOVER SCANNING CROSSHAIR LINE */}
                    {hoverProfilePoint && (
                      <g key="hover-crosshair-coords">
                        <line
                          x1={`${hoverProfilePoint.xPct}%`}
                          y1="0"
                          x2={`${hoverProfilePoint.xPct}%`}
                          y2="100%"
                          stroke="#f59e0b"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                        <circle cx={`${hoverProfilePoint.xPct}%`} cy="50%" r="3" fill="#f59e0b" />
                      </g>
                    )}
                  </svg>

                  {/* Interactive Floating Hover Pill */}
                  {hoverProfilePoint && (
                    <div
                      style={{
                        left: `${Math.max(10, Math.min(90, hoverProfilePoint.xPct))}%`,
                        top: "4px",
                      }}
                      className="absolute -translate-x-1/2 bg-slate-950/95 border border-amber-500/70 text-slate-100 px-2 py-1 rounded shadow-xl pointer-events-none text-[8px] font-mono z-30 flex items-center gap-2 whitespace-nowrap backdrop-blur-sm"
                    >
                      <span className="text-blue-300 font-bold">KP {hoverProfilePoint.kp.toFixed(3)}</span>
                      {hoverProfilePoint.northing !== undefined && (
                        <span className="text-amber-400 font-semibold">🧭 N: {hoverProfilePoint.northing.toFixed(1)}m</span>
                      )}
                      {hoverProfilePoint.easting !== undefined && (
                        <span className="text-purple-300 font-semibold">📍 E: {hoverProfilePoint.easting.toFixed(1)}m</span>
                      )}
                    </div>
                  )}
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
                  {activeEvent.event_position && (
                    <Badge variant="outline" className="text-[9px] text-amber-300 border-amber-500/40 bg-amber-950/40">
                      {activeEvent.event_position}
                    </Badge>
                  )}
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
                    <span className="text-slate-500 uppercase text-[9px] block">Event Type</span>
                    <span className="text-slate-200 font-bold">{activeEvent.event_type || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-[9px] block">Position</span>
                    <span className="text-slate-200">{activeEvent.event_position || "—"}</span>
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
