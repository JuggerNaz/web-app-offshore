"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  EyeOff,
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
  ExternalLink,
  RefreshCw,
  Hourglass,
  Navigation,
  Radio,
  RadioTower,
  ChevronRight,
  Sparkles,
  Columns,
  Maximize,
  Minimize,
  ChevronUp,
  ChevronDown,
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

export interface PipelineSeabedEventMapProps {
  isOpen: boolean;
  onClose: () => void;
  structureName?: string;
  pipelineLengthKm?: number; // e.g. 10.500 km
  events?: PipelineEventItem[];
  previousEvents?: PipelineEventItem[]; // For historical comparison
  onSelectEvent?: (event: PipelineEventItem) => void;
  // Dynamic fetch & live telemetry props
  supabase?: any;
  jobpackId?: string | number;
  structureId?: string | number;
  sowReportNo?: string | number;
  inspectionDirection?: string; // e.g. "Increase KP" | "Reverse KP" | "Decrease KP"
  liveTelemetry?: any; // dataAcqFields array or object { kp, northing, easting, depth, heading, ... }
  onRefreshInspection?: () => void;
}

export function PipelineSeabedEventMap({
  isOpen,
  onClose,
  structureName = "Pipeline Main Line",
  pipelineLengthKm = 10.0,
  events = [],
  previousEvents = [],
  onSelectEvent,
  supabase,
  jobpackId,
  structureId,
  sowReportNo,
  inspectionDirection = "Increase KP",
  liveTelemetry,
  onRefreshInspection,
}: PipelineSeabedEventMapProps) {
  // Navigation & Zoom State
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x to 50x
  const [viewStartKp, setViewStartKp] = useState<number>(0);
  const [viewEndKp, setViewEndKp] = useState<number>(pipelineLengthKm || 10);
  const [isMarkAreaMode, setIsMarkAreaMode] = useState<boolean>(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; endX: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);

  // Full Data Fetching & Hourglass State
  const [fetchedEvents, setFetchedEvents] = useState<PipelineEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [loadingProgressText, setLoadingProgressText] = useState<string>("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  // Historical Comparison State
  const [availableHistoricalJobpacks, setAvailableHistoricalJobpacks] = useState<any[]>([]);
  const [selectedHistoricalJobpackId, setSelectedHistoricalJobpackId] = useState<string>("");
  const [historicalEvents, setHistoricalEvents] = useState<PipelineEventItem[]>(previousEvents || []);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);

  // Filter State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState<boolean>(false);
  const [showComparison, setShowComparison] = useState<boolean>(false);

  // Bottom Graph Switcher & Sizing State
  const [graphTab, setGraphTab] = useState<"depth" | "plan" | "coords_profile" | "split" | "hidden">("depth");
  const [graphHeightSize, setGraphHeightSize] = useState<"compact" | "medium" | "expanded">("medium");

  // Live ROV Marker & Lookahead State
  const [showLiveRov, setShowLiveRov] = useState<boolean>(true);
  const [lookaheadRangeKm, setLookaheadRangeKm] = useState<number>(1.0); // 0.25, 0.5, 1.0, 2.0 km
  const [showLookaheadHud, setShowLookaheadHud] = useState<boolean>(true);

  // Hover & Tooltips
  const [hoverProfilePoint, setHoverProfilePoint] = useState<{
    xPct: number;
    kp: number;
    depth?: number;
    span?: number;
    burial?: number;
    easting?: number;
    northing?: number;
    event?: PipelineEventItem;
  } | null>(null);
  const [hoverPlanPoint, setHoverPlanPoint] = useState<{
    xPct: number;
    yPct: number;
    kp: number;
    easting: number;
    northing: number;
    depth?: number;
    event?: PipelineEventItem;
  } | null>(null);

  // Measure Tool State
  const [isMeasureMode, setIsMeasureMode] = useState<boolean>(false);
  const [measurePoint1, setMeasurePoint1] = useState<PipelineEventItem | null>(null);
  const [measurePoint2, setMeasurePoint2] = useState<PipelineEventItem | null>(null);

  // Selected Event Popover
  const [activeEvent, setActiveEvent] = useState<PipelineEventItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartViewKpRef = useRef<{ start: number; end: number }>({ start: 0, end: 10 });
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  // Parse Live Telemetry from ROV data string / dataAcqFields
  const liveRovData = useMemo(() => {
    if (!liveTelemetry) return null;

    let kp: number | null = null;
    let northing: number | null = null;
    let easting: number | null = null;
    let depth: number | null = null;
    let heading: number | null = null;
    let cp: number | null = null;

    if (Array.isArray(liveTelemetry)) {
      liveTelemetry.forEach((item: any) => {
        const field = (item.targetField || item.field_name || item.name || item.label || "").toLowerCase();
        const rawVal = item.value ?? item.val ?? "";
        const numVal = parseFloat(String(rawVal).replace(/[^0-9.-]/g, ""));
        if (isNaN(numVal)) return;

        if (field.includes("kp") || field.includes("chainage") || field.includes("fp_kp")) {
          kp = numVal;
        } else if (field.includes("north") || field.includes("utm_n") || field === "n") {
          northing = numVal;
        } else if (field.includes("east") || field.includes("utm_e") || field === "e") {
          easting = numVal;
        } else if (field.includes("depth") || field.includes("water_depth")) {
          depth = numVal;
        } else if (field.includes("heading") || field.includes("hdg") || field.includes("gyro")) {
          heading = numVal;
        } else if (field.includes("cp") || field.includes("fg_rdg")) {
          cp = numVal;
        }
      });
    } else if (typeof liveTelemetry === "object") {
      const obj = liveTelemetry as Record<string, any>;
      const parseNum = (v: any) => {
        if (typeof v === "number") return v;
        const n = parseFloat(String(v || ""));
        return isNaN(n) ? null : n;
      };
      kp = parseNum(obj.kp ?? obj.fp_kp ?? obj.raw_kp ?? obj.KP);
      northing = parseNum(obj.northing ?? obj.utm_northing ?? obj.North ?? obj.N);
      easting = parseNum(obj.easting ?? obj.utm_easting ?? obj.East ?? obj.E);
      depth = parseNum(obj.depth ?? obj.water_depth ?? obj.Depth);
      heading = parseNum(obj.rov_heading ?? obj.heading ?? obj.Heading ?? obj.HDG);
      cp = parseNum(obj.cp_fg_rdg ?? obj.cp ?? obj.CP);
    }

    if (kp === null && northing === null && easting === null && depth === null) {
      return null;
    }

    return {
      kp: kp ?? 0,
      northing,
      easting,
      depth,
      heading: heading ?? 0,
      cp,
    };
  }, [liveTelemetry]);

  // Fetch ALL pipeline inspection records with complete pagination (no row limits)
  const fetchAllPipelineRecords = useCallback(async () => {
    if (!supabase) return;
    const activeStructId = structureId ? String(structureId) : null;
    const activeJobId = jobpackId ? String(jobpackId) : null;
    if (!activeStructId && !activeJobId) return;

    try {
      setIsLoadingEvents(true);
      setLoadingProgressText("Connecting to database & loading complete pipeline records...");

      let allRecords: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("insp_records")
          .select("*");

        if (activeStructId && activeStructId !== "0") {
          query = query.eq("structure_id", activeStructId);
        } else if (activeJobId && activeJobId !== "0") {
          query = query.eq("jobpack_id", activeJobId);
        }

        const from = page * pageSize;
        const to = from + pageSize - 1;
        query = query.order("fp_kp", { ascending: true }).range(from, to);

        const { data, error } = await query;
        if (error) {
          console.error("Error fetching pipeline records chunk:", error);
          break;
        }

        if (data && data.length > 0) {
          allRecords = allRecords.concat(data);
          setLoadingProgressText(`Retrieved ${allRecords.length} records so far...`);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page += 1;
          }
        } else {
          hasMore = false;
        }
      }

      // Map raw records to PipelineEventItem
      const mappedEvents: PipelineEventItem[] = allRecords.map((r: any) => {
        const data = r.inspection_data || {};
        const kpNum = parseFloat(r.fp_kp ?? r.kp ?? data.fp_kp ?? data.kp ?? "0");
        const isAnom =
          r.has_anomaly ||
          (r.insp_anomalies && r.insp_anomalies.length > 0) ||
          r.finding_type === "Anomaly" ||
          data.finding_type === "Anomaly";
        const anomCode =
          r.insp_anomalies?.[0]?.anomaly_ref_no ||
          r.insp_anomalies?.[0]?.defect_type_code ||
          data.anomaly_code ||
          r.anomaly_code ||
          "";

        return {
          id: r.insp_id || r.id,
          event_name: data.event_name || r.event_name || r.inspection_type_code || "Event",
          event_type: data.event_type || r.event_type || "",
          event_position: data.event_position || r.event_position || "",
          event_description: data.event_description || r.event_description || data.remarks || "",
          kp: isNaN(kpNum) ? 0 : kpNum,
          end_kp: data.end_kp ? parseFloat(data.end_kp) : undefined,
          northing: r.northing || data.northing || data.utm_northing || "",
          easting: r.easting || data.easting || data.utm_easting || "",
          depth: data.depth || data.water_depth || data.verification_depth || data.water_depth_m || data.seabed_depth || r.depth || r.elevation || "",
          cp_fg_rdg: data.cp_fg_rdg || data.cp_fg || r.cp_fg_rdg || "",
          rov_heading: data.rov_heading || data.heading || r.rov_heading || "",
          inspection_date: r.inspection_date || data.inspection_date || "",
          inspection_time: r.inspection_time || data.inspection_time || "",
          tape_count_no: r.tape_count_no || data.tape_count_no || "",
          finding_type: isAnom ? "Anomaly" : (r.finding_type || data.finding_type || "Complete"),
          findings: data.findings || r.findings || "",
          anomaly_code: anomCode,
          span_height: data.span_height ? parseFloat(data.span_height) : (data.gap_under_pipe ? parseFloat(data.gap_under_pipe) : undefined),
          burial_depth: data.burial_depth ? parseFloat(data.burial_depth) : (data.depth_of_burial ? parseFloat(data.depth_of_burial) : undefined),
          survey_run: "current",
        };
      });

      if (mappedEvents.length > 0) {
        setFetchedEvents(mappedEvents);
        toast.success(`Loaded all ${mappedEvents.length} full pipeline records successfully.`);
      }
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Pipeline records fetch error:", err);
      toast.error("Failed to load full pipeline records: " + (err.message || "Unknown error"));
    } finally {
      setIsLoadingEvents(false);
      setLoadingProgressText("");
    }
  }, [supabase, structureId, jobpackId]);

  // Fetch Available Historical Jobpacks for this structure
  const fetchHistoricalJobpacks = useCallback(async () => {
    if (!supabase || !structureId) return;
    try {
      const { data, error } = await supabase
        .from("sow_jobpacks")
        .select("jobpack_id, sow_report_no, jobpack_name, created_at")
        .eq("structure_id", structureId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const filtered = data.filter((j: any) => String(j.jobpack_id) !== String(jobpackId));
        setAvailableHistoricalJobpacks(filtered);
      }
    } catch (e) {
      console.error("Error fetching historical jobpacks list:", e);
    }
  }, [supabase, structureId, jobpackId]);

  // Load records for a selected historical jobpack
  const loadHistoricalJobpackRecords = async (histJobId: string) => {
    if (!supabase || !histJobId) {
      setHistoricalEvents(previousEvents || []);
      return;
    }
    try {
      setIsLoadingHistorical(true);
      toast.loading("Retrieving historical survey events...");
      
      let histRecords: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("insp_records")
          .select("*")
          .eq("jobpack_id", histJobId)
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          histRecords = histRecords.concat(data);
          if (data.length < 1000) hasMore = false;
          else page++;
        }
      }

      const mappedHist: PipelineEventItem[] = histRecords.map((r: any) => {
        const data = r.inspection_data || {};
        const kpNum = parseFloat(r.fp_kp ?? r.kp ?? data.fp_kp ?? data.kp ?? "0");
        const isAnom = r.has_anomaly || (r.insp_anomalies && r.insp_anomalies.length > 0) || r.finding_type === "Anomaly";
        return {
          id: `hist-${r.insp_id || r.id}`,
          event_name: `[HIST] ${data.event_name || r.event_name || r.inspection_type_code || "Event"}`,
          event_type: data.event_type || r.event_type || "",
          event_position: data.event_position || r.event_position || "",
          event_description: data.event_description || r.event_description || "",
          kp: isNaN(kpNum) ? 0 : kpNum,
          end_kp: data.end_kp ? parseFloat(data.end_kp) : undefined,
          northing: r.northing || data.northing || "",
          easting: r.easting || data.easting || "",
          depth: data.depth || data.water_depth || data.verification_depth || data.water_depth_m || data.seabed_depth || r.depth || r.elevation || "",
          cp_fg_rdg: data.cp_fg_rdg || r.cp_fg_rdg || "",
          rov_heading: data.rov_heading || r.rov_heading || "",
          inspection_date: r.inspection_date || data.inspection_date || "",
          finding_type: isAnom ? "Anomaly" : "Complete",
          findings: data.findings || r.findings || "",
          anomaly_code: r.insp_anomalies?.[0]?.anomaly_ref_no || data.anomaly_code || "",
          span_height: data.span_height ? parseFloat(data.span_height) : undefined,
          burial_depth: data.burial_depth ? parseFloat(data.burial_depth) : undefined,
          survey_run: "previous",
        };
      });

      setHistoricalEvents(mappedHist);
      setShowComparison(true);
      toast.dismiss();
      toast.success(`Loaded ${mappedHist.length} historical events for comparison.`);
    } catch (e: any) {
      toast.dismiss();
      toast.error("Failed to load historical data: " + e.message);
    } finally {
      setIsLoadingHistorical(false);
    }
  };

  // Trigger full initial fetch when opened
  useEffect(() => {
    if (isOpen) {
      if (supabase && (structureId || jobpackId)) {
        fetchAllPipelineRecords();
        fetchHistoricalJobpacks();
      }
    }
  }, [isOpen, supabase, structureId, jobpackId, fetchAllPipelineRecords, fetchHistoricalJobpacks]);

  // Combine parent provided events with dynamically fetched records
  const effectiveCurrentEvents = useMemo(() => {
    if (fetchedEvents.length > 0) return fetchedEvents;
    return events || [];
  }, [fetchedEvents, events]);

  // Combined Active Survey + Historical Events (when comparison is toggled)
  const combinedEvents = useMemo(() => {
    if (!showComparison || historicalEvents.length === 0) {
      return effectiveCurrentEvents;
    }
    return [...effectiveCurrentEvents, ...historicalEvents];
  }, [effectiveCurrentEvents, historicalEvents, showComparison]);

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
    const isHist = evt.survey_run === "previous";

    if (nameUpper.includes("SEABED") || nameUpper.includes("SEABED PROFILE")) {
      const pTitle = typeUpper ? typeUpper : "SEABED";
      const sTitle = posUpper ? posUpper : "";
      const cat = typeUpper ? `SEABED: ${typeUpper.toUpperCase()}` : posUpper ? `SEABED (${posUpper.toUpperCase()})` : "SEABED PROFILE";
      return {
        category: cat,
        primaryTitle: isHist ? `[PREV] ${pTitle}` : pTitle,
        subTitle: sTitle,
        fullLabel: sTitle ? `${pTitle} (${sTitle})` : pTitle,
        isHist,
      };
    }

    const rawTitle = evt.event_name || evt.event_type || "Event";
    const title = isHist && !rawTitle.startsWith("[") ? `[PREV] ${rawTitle}` : rawTitle;
    return {
      category: evt.event_name || evt.event_type || "Event",
      primaryTitle: title,
      subTitle: posUpper,
      fullLabel: posUpper ? `${title} (${posUpper})` : title,
      isHist,
    };
  };

  // Calculate actual total max KP from events if greater than default pipeline length
  const maxCalculatedKp = useMemo(() => {
    let maxKp = pipelineLengthKm || 1.0;
    combinedEvents.forEach((e) => {
      if (e.kp && e.kp > maxKp) maxKp = e.kp;
      if (e.end_kp && e.end_kp > maxKp) maxKp = e.end_kp;
    });
    return Math.max(maxKp, 0.5);
  }, [combinedEvents, pipelineLengthKm]);

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
    const validKps = effectiveCurrentEvents
      .filter((e) => typeof e.kp === "number" && !isNaN(e.kp) && !isExcludedEvent(e.event_name, e.event_type))
      .map((e) => e.kp);
    if (validKps.length === 0) return null;
    const minKp = Math.min(...validKps);
    const maxKp = Math.max(...validKps);
    return { minKp, maxKp, span: maxKp - minKp };
  }, [effectiveCurrentEvents]);

  // Extract unique categories for filtering
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    combinedEvents.forEach((e) => {
      if (isExcludedEvent(e.event_name, e.event_type)) return;
      const { category } = getEventDisplay(e);
      if (category) cats.add(category.trim().toUpperCase());
    });
    return Array.from(cats).sort();
  }, [combinedEvents]);

  // Filtered Events based on search, anomaly toggle, and category selection
  const filteredEvents = useMemo(() => {
    return combinedEvents.filter((e) => {
      if (isExcludedEvent(e.event_name, e.event_type)) return false;

      if (showAnomaliesOnly) {
        const isAnom =
          e.finding_type === "Anomaly" ||
          e.finding_type === "Finding" ||
          String(e.anomaly_code || "").trim() !== "";
        if (!isAnom) return false;
      }

      if (selectedCategories.length > 0) {
        const { category } = getEventDisplay(e);
        const match = selectedCategories.some((cat) =>
          category.toUpperCase().includes(cat.toUpperCase())
        );
        if (!match) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (e.event_name || "").toLowerCase().includes(q);
        const matchType = (e.event_type || "").toLowerCase().includes(q);
        const matchPos = (e.event_position || "").toLowerCase().includes(q);
        const matchDesc = (e.event_description || "").toLowerCase().includes(q);
        const matchCode = (e.anomaly_code || "").toLowerCase().includes(q);
        const matchKp = e.kp.toFixed(3).includes(q);
        if (!matchName && !matchType && !matchPos && !matchDesc && !matchCode && !matchKp) {
          return false;
        }
      }

      return true;
    });
  }, [combinedEvents, showAnomaliesOnly, selectedCategories, searchQuery]);

  // Directional Lookahead Ahead Events Calculation
  const isIncreaseFlow = useMemo(() => {
    const dir = (inspectionDirection || "").toLowerCase();
    return !dir.includes("reverse") && !dir.includes("decrease");
  }, [inspectionDirection]);

  const upcomingEvents = useMemo(() => {
    const currentRefKp = (showLiveRov && liveRovData?.kp !== null && liveRovData?.kp !== undefined) 
      ? liveRovData.kp 
      : (viewStartKp + viewEndKp) / 2;

    const range = lookaheadRangeKm;

    const ahead = combinedEvents.filter((evt) => {
      if (isExcludedEvent(evt.event_name, evt.event_type)) return false;
      if (typeof evt.kp !== "number" || isNaN(evt.kp)) return false;

      if (isIncreaseFlow) {
        return evt.kp > currentRefKp && evt.kp <= currentRefKp + range;
      } else {
        return evt.kp < currentRefKp && evt.kp >= currentRefKp - range;
      }
    });

    // Sort in direction of travel
    ahead.sort((a, b) => (isIncreaseFlow ? a.kp - b.kp : b.kp - a.kp));

    return ahead.map((evt) => {
      const distMeters = Math.abs(evt.kp - currentRefKp) * 1000;
      const isAnom =
        evt.finding_type === "Anomaly" ||
        evt.finding_type === "Finding" ||
        String(evt.anomaly_code || "").trim() !== "";
      const isHist = evt.survey_run === "previous";

      return {
        event: evt,
        distMeters: Math.round(distMeters),
        distKp: Math.abs(evt.kp - currentRefKp).toFixed(3),
        isAnom,
        isHist,
      };
    });
  }, [combinedEvents, showLiveRov, liveRovData, viewStartKp, viewEndKp, lookaheadRangeKm, isIncreaseFlow]);

  // Fit to Active Survey Range
  const handleFitSurveyRange = () => {
    if (!surveyedRange) {
      toast.info("No surveyed events found to fit.");
      return;
    }
    const pad = Math.max(surveyedRange.span * 0.05, 0.05);
    const nStart = Math.max(0, surveyedRange.minKp - pad);
    const nEnd = Math.min(maxCalculatedKp, surveyedRange.maxKp + pad);
    setViewStartKp(nStart);
    setViewEndKp(nEnd);
    const newSpan = nEnd - nStart;
    setZoomLevel(newSpan > 0 ? maxCalculatedKp / newSpan : 1);
    toast.success(`Fitted view to survey range: ${nStart.toFixed(3)} - ${nEnd.toFixed(3)} KP`);
  };

  // Center view on current ROV position
  const handleCenterOnRov = () => {
    if (!liveRovData || liveRovData.kp === null || liveRovData.kp === undefined) {
      toast.info("No active ROV position data to center on.");
      return;
    }
    const rovKp = liveRovData.kp;
    const span = viewEndKp - viewStartKp;
    let nStart = rovKp - span / 2;
    let nEnd = rovKp + span / 2;
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
    toast.info(`Centered on ROV position (KP ${rovKp.toFixed(3)})`);
  };

  // Pop-out / Floating Window Handler for Extended Screen
  const handlePopOutWindow = () => {
    const url = `/dashboard/inspection-v2/pipeline-map-popout?jobpack=${jobpackId || "0"}&structure=${structureId || "0"}&structureName=${encodeURIComponent(structureName)}&length=${pipelineLengthKm}&dir=${encodeURIComponent(inspectionDirection || "Increase KP")}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "width=1600,height=900,menubar=no,status=no,toolbar=no,resizable=yes");
      toast.success("Opened Pipeline Map in floating window for extended screen monitoring.");
    }
  };

  // Canvas Mouse Drag Panning & Mark Area Selection
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMarkAreaMode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startX = e.clientX - rect.left;
      setIsSelecting(true);
      setSelectionBox({ startX, endX: startX });
      return;
    }

    setIsPanning(true);
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartViewKpRef.current = { start: viewStartKp, end: viewEndKp };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMarkAreaMode && isSelecting && selectionBox) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const endX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      setSelectionBox({ ...selectionBox, endX });
      return;
    }

    if (!isDraggingRef.current || !containerRef.current) return;
    const dx = e.clientX - dragStartXRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width || 1;
    const span = dragStartViewKpRef.current.end - dragStartViewKpRef.current.start;
    const dKp = -(dx / width) * span;

    let newStart = dragStartViewKpRef.current.start + dKp;
    let newEnd = dragStartViewKpRef.current.end + dKp;

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
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (isMarkAreaMode && isSelecting && selectionBox) {
      setIsSelecting(false);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const width = rect.width;
        const x1 = Math.min(selectionBox.startX, selectionBox.endX);
        const x2 = Math.max(selectionBox.startX, selectionBox.endX);
        const span = viewEndKp - viewStartKp;

        const newStartKp = viewStartKp + (x1 / width) * span;
        const newEndKp = viewStartKp + (x2 / width) * span;

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

  // Dynamic Tree / Leaf Top Flags Auto-Arranger
  const arrangedFlags = useMemo(() => {
    const visible = filteredEvents
      .map((evt) => {
        const pct = kpToPercent(evt.kp);
        const display = getEventDisplay(evt);
        return {
          event: evt,
          pct,
          display,
          isAnomaly:
            evt.finding_type === "Anomaly" ||
            evt.finding_type === "Finding" ||
            String(evt.anomaly_code || "").trim() !== "",
          isSelected: activeEvent?.id === evt.id,
          isHist: evt.survey_run === "previous",
        };
      })
      .filter((f) => f.pct >= -4 && f.pct <= 104)
      .sort((a, b) => a.pct - b.pct);

    const totalVisible = visible.length;
    let numTiers = 5;
    let minGapPct = 3.5;

    if (totalVisible > 40) {
      numTiers = 9;
      minGapPct = 1.8;
    } else if (totalVisible > 25) {
      numTiers = 7;
      minGapPct = 2.4;
    } else if (totalVisible > 12) {
      numTiers = 5;
      minGapPct = 3.2;
    } else if (totalVisible > 5) {
      numTiers = 4;
      minGapPct = 4.5;
    } else {
      numTiers = 3;
      minGapPct = 6.0;
    }

    const tierHeights = Array.from({ length: numTiers }, (_, i) => 24 + i * 26);
    const lastPctForTier: number[] = Array(numTiers).fill(-999);

    return visible.map((item) => {
      let assignedTier = 0;
      let foundTier = false;

      for (let t = 0; t < numTiers; t++) {
        if (item.pct - lastPctForTier[t] >= minGapPct) {
          assignedTier = t;
          foundTier = true;
          break;
        }
      }

      if (!foundTier) {
        let lowestLastPctIndex = 0;
        let lowestVal = Infinity;
        for (let t = 0; t < numTiers; t++) {
          if (lastPctForTier[t] < lowestVal) {
            lowestVal = lastPctForTier[t];
            lowestLastPctIndex = t;
          }
        }
        assignedTier = lowestLastPctIndex;
      }

      lastPctForTier[assignedTier] = item.pct;

      return {
        ...item,
        tier: assignedTier,
        stemHeight: Math.min(260, tierHeights[assignedTier]),
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

  // Compute Longitudinal Series Data
  const profileData = useMemo(() => {
    const validEvents = combinedEvents
      .filter((e) => typeof e.kp === "number" && !isNaN(e.kp))
      .map((e) => {
        const rawD = e.depth;
        let d: number | undefined = undefined;
        if (typeof rawD === "number" && !isNaN(rawD)) {
          d = rawD;
        } else if (rawD !== undefined && rawD !== null && String(rawD).trim() !== "") {
          const parsed = parseFloat(String(rawD).replace(/[^0-9.-]/g, ""));
          if (!isNaN(parsed)) d = parsed;
        }

        const rawEast = e.easting;
        let east: number | undefined = undefined;
        if (typeof rawEast === "number" && !isNaN(rawEast)) {
          east = rawEast;
        } else if (rawEast !== undefined && rawEast !== null && String(rawEast).trim() !== "") {
          const parsed = parseFloat(String(rawEast).replace(/[^0-9.-]/g, ""));
          if (!isNaN(parsed)) east = parsed;
        }

        const rawNorth = e.northing;
        let north: number | undefined = undefined;
        if (typeof rawNorth === "number" && !isNaN(rawNorth)) {
          north = rawNorth;
        } else if (rawNorth !== undefined && rawNorth !== null && String(rawNorth).trim() !== "") {
          const parsed = parseFloat(String(rawNorth).replace(/[^0-9.-]/g, ""));
          if (!isNaN(parsed)) north = parsed;
        }

        const span = e.span_height ? (typeof e.span_height === "number" ? e.span_height : parseFloat(String(e.span_height))) : 0;
        const burial = e.burial_depth ? (typeof e.burial_depth === "number" ? e.burial_depth : parseFloat(String(e.burial_depth))) : 0;

        return {
          event: e,
          kp: e.kp,
          depth: d,
          easting: east,
          northing: north,
          span: isNaN(span) ? 0 : span,
          burial: isNaN(burial) ? 0 : burial,
          isHist: e.survey_run === "previous",
        };
      })
      .sort((a, b) => a.kp - b.kp);

    const currentEvents = validEvents.filter((e) => !e.isHist);
    const histEvents = validEvents.filter((e) => e.isHist);

    const knownCoords = (currentEvents.length > 0 ? currentEvents : validEvents)
      .filter((e) => e.easting !== undefined && e.northing !== undefined)
      .sort((a, b) => a.kp - b.kp);

    const getInterpolatedCoords = (kp: number): { easting: number; northing: number } | null => {
      if (knownCoords.length === 0) return null;
      if (knownCoords.length === 1 || kp <= knownCoords[0].kp) {
        return { easting: knownCoords[0].easting!, northing: knownCoords[0].northing! };
      }
      if (kp >= knownCoords[knownCoords.length - 1].kp) {
        return { easting: knownCoords[knownCoords.length - 1].easting!, northing: knownCoords[knownCoords.length - 1].northing! };
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
      return { easting: knownCoords[knownCoords.length - 1].easting!, northing: knownCoords[knownCoords.length - 1].northing! };
    };

    const knownDepths = (currentEvents.length > 0 ? currentEvents : validEvents)
      .filter((e) => e.depth !== undefined)
      .sort((a, b) => a.kp - b.kp);

    const getInterpolatedDepth = (kp: number): number | null => {
      if (knownDepths.length === 0) return null;
      if (knownDepths.length === 1 || kp <= knownDepths[0].kp) {
        return knownDepths[0].depth!;
      }
      if (kp >= knownDepths[knownDepths.length - 1].kp) {
        return knownDepths[knownDepths.length - 1].depth!;
      }
      for (let i = 0; i < knownDepths.length - 1; i++) {
        const p0 = knownDepths[i];
        const p1 = knownDepths[i + 1];
        if (kp >= p0.kp && kp <= p1.kp) {
          const ratio = (kp - p0.kp) / (p1.kp - p0.kp || 1);
          return p0.depth! + (p1.depth! - p0.depth!) * ratio;
        }
      }
      return knownDepths[knownDepths.length - 1].depth!;
    };

    const histKnownDepths = histEvents.filter((e) => e.depth !== undefined).sort((a, b) => a.kp - b.kp);
    const getHistInterpolatedDepth = (kp: number): number | null => {
      if (histKnownDepths.length === 0) return null;
      if (kp <= histKnownDepths[0].kp) return histKnownDepths[0].depth!;
      if (kp >= histKnownDepths[histKnownDepths.length - 1].kp) return histKnownDepths[histKnownDepths.length - 1].depth!;
      for (let i = 0; i < histKnownDepths.length - 1; i++) {
        const p0 = histKnownDepths[i];
        const p1 = histKnownDepths[i + 1];
        if (kp >= p0.kp && kp <= p1.kp) {
          const ratio = (kp - p0.kp) / (p1.kp - p0.kp || 1);
          return p0.depth! + (p1.depth! - p0.depth!) * ratio;
        }
      }
      return histKnownDepths[histKnownDepths.length - 1].depth!;
    };

    const sampleCount = 80;
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
        const histDepth = getHistInterpolatedDepth(kp);
        const matchEvt = validEvents.find((e) => Math.abs(e.kp - kp) < 0.005);
        return {
          kp,
          depth: depth ?? undefined,
          histDepth: histDepth ?? undefined,
          easting: coords?.easting,
          northing: coords?.northing,
          span: matchEvt?.span || 0,
          burial: matchEvt?.burial || 0,
          event: matchEvt?.event,
        };
      });

    const allDepths = validEvents.map((e) => e.depth).filter((d): d is number => d !== undefined);
    const rawMinDepth = allDepths.length > 0 ? Math.min(...allDepths) : 20;
    const rawMaxDepth = allDepths.length > 0 ? Math.max(...allDepths) : 60;
    const dPad = Math.max((rawMaxDepth - rawMinDepth) * 0.08, 1);
    const minDepth = Math.max(0, rawMinDepth - dPad);
    const maxDepth = rawMaxDepth + dPad;

    const allEastings = validEvents.map((e) => e.easting).filter((v): v is number => v !== undefined);
    const allNorthings = validEvents.map((e) => e.northing).filter((v): v is number => v !== undefined);
    const minEasting = allEastings.length > 0 ? Math.min(...allEastings) : 0;
    const maxEasting = allEastings.length > 0 ? Math.max(...allEastings) : 1000;
    const minNorthing = allNorthings.length > 0 ? Math.min(...allNorthings) : 0;
    const maxNorthing = allNorthings.length > 0 ? Math.max(...allNorthings) : 1000;

    return {
      points: continuousPoints,
      rawEvents: validEvents,
      getInterpolatedDepth,
      getInterpolatedCoords,
      minDepth,
      maxDepth: maxDepth === minDepth ? minDepth + 10 : maxDepth,
      minEasting,
      maxEasting: maxEasting === minEasting ? minEasting + 100 : maxEasting,
      minNorthing,
      maxNorthing: maxNorthing === minNorthing ? minNorthing + 100 : maxNorthing,
    };
  }, [combinedEvents, viewStartKp, viewEndKp]);

  // 2D Cartesian Plan Bounds Calculation (Northing as Y, Easting as X, KP as Z trajectory)
  const planBounds = useMemo(() => {
    const coordPts = profileData.points.filter((pt) => pt.northing !== undefined && pt.easting !== undefined);
    if (coordPts.length === 0) {
      return {
        points: [],
        minEasting: profileData.minEasting,
        maxEasting: profileData.maxEasting,
        minNorthing: profileData.minNorthing,
        maxNorthing: profileData.maxNorthing,
        eRange: Math.max(profileData.maxEasting - profileData.minEasting, 100),
        nRange: Math.max(profileData.maxNorthing - profileData.minNorthing, 100),
        hasCoords: false,
      };
    }

    const eastings = coordPts.map((p) => p.easting!);
    const northings = coordPts.map((p) => p.northing!);
    const rawMinE = Math.min(...eastings);
    const rawMaxE = Math.max(...eastings);
    const rawMinN = Math.min(...northings);
    const rawMaxN = Math.max(...northings);

    const rawERange = rawMaxE - rawMinE;
    const rawNRange = rawMaxN - rawMinN;
    const ePad = Math.max(rawERange * 0.08, 15);
    const nPad = Math.max(rawNRange * 0.08, 15);

    const minEasting = rawMinE - ePad;
    const maxEasting = rawMaxE + ePad;
    const minNorthing = rawMinN - nPad;
    const maxNorthing = rawMaxN + nPad;
    const eRange = Math.max(maxEasting - minEasting, 1);
    const nRange = Math.max(maxNorthing - minNorthing, 1);

    return {
      points: coordPts,
      minEasting,
      maxEasting,
      minNorthing,
      maxNorthing,
      eRange,
      nRange,
      hasCoords: coordPts.length >= 2,
    };
  }, [profileData]);

  const eastingToPlanXPct = (easting: number) => {
    if (planBounds.eRange <= 0) return 50;
    return Math.max(3, Math.min(97, ((easting - planBounds.minEasting) / planBounds.eRange) * 100));
  };

  const northingToPlanYPct = (northing: number) => {
    if (planBounds.nRange <= 0) return 50;
    return Math.max(3, Math.min(97, (1 - (northing - planBounds.minNorthing) / planBounds.nRange) * 100));
  };

  // Rulers & Ticks Calculation
  const rulerTicks = useMemo(() => {
    const visibleSpan = viewEndKp - viewStartKp;
    let step = 1.0;
    if (visibleSpan <= 0.2) step = 0.01;
    else if (visibleSpan <= 0.5) step = 0.05;
    else if (visibleSpan <= 1.0) step = 0.1;
    else if (visibleSpan <= 3.0) step = 0.5;
    else if (visibleSpan <= 10.0) step = 1.0;
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
    if (evt.survey_run === "previous") return "bg-purple-700 text-purple-100 border-purple-500 shadow-purple-900";
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

  // Dynamic height class for bottom graphs
  const graphHeightClass = useMemo(() => {
    if (graphHeightSize === "compact") return "h-36";
    if (graphHeightSize === "expanded") return "h-72";
    return "h-52"; // medium default
  }, [graphHeightSize]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[94vh] flex flex-col p-0 gap-0 bg-slate-950 text-slate-100 border-slate-800 overflow-hidden rounded-xl shadow-2xl">
        {/* Top Dialog Header Bar (Clean HTML nesting without <div> inside <p>) */}
        <DialogHeader className="px-4 py-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2 flex-wrap">
                <span>{structureName} — 2D/3D Interactive Pipeline Seabed & Event Map</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/30 text-[9px] font-mono">
                  0.000 to {maxCalculatedKp.toFixed(3)} KP ({maxCalculatedKp.toFixed(2)} km)
                </span>
                {isLoadingEvents && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] animate-pulse">
                    <Hourglass className="w-3 h-3 animate-spin" /> Retrieving all records...
                  </span>
                )}
                {lastRefreshedAt && !isLoadingEvents && (
                  <span className="text-[8.5px] font-mono text-slate-400 font-normal">
                    Refreshed: {lastRefreshedAt}
                  </span>
                )}
              </DialogTitle>
              <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span>3D metallic profile, tree/leaf top flags, continuous bathymetry, live ROV telemetry & historical jobpack comparison</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] bg-slate-800 text-cyan-300 border border-cyan-800 font-mono font-bold">
                  DIR: {inspectionDirection}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Refresh Data Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchAllPipelineRecords();
                onRefreshInspection?.();
              }}
              disabled={isLoadingEvents}
              className="h-7 px-2 text-[9px] font-bold uppercase border-slate-700 text-slate-200 hover:bg-slate-800"
              title="Refresh complete records from database"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingEvents ? "animate-spin text-amber-400" : "text-cyan-400"}`} />
              {isLoadingEvents ? "Loading..." : "Refresh"}
            </Button>

            {/* Float / Pop-out Window for Extended Screen */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePopOutWindow}
              className="h-7 px-2.5 text-[9px] font-bold uppercase border-cyan-700/80 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 shadow-sm"
              title="Open map in floating window for secondary / extended monitor"
            >
              <ExternalLink className="w-3 h-3 mr-1 text-cyan-400" />
              Pop-out / Float
            </Button>

            {/* Mark Area Zoom */}
            <Button
              variant={isMarkAreaMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsMarkAreaMode(!isMarkAreaMode)}
              className={`h-7 px-2 text-[9px] font-bold uppercase ${
                isMarkAreaMode ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-slate-700 text-slate-300"
              }`}
              title="Click & Drag on pipeline to zoom into selected area"
            >
              <Maximize2 className="w-3 h-3 mr-1" />
              {isMarkAreaMode ? "Drag to Zoom..." : "Mark Area"}
            </Button>

            {/* Measure Distance */}
            <Button
              variant={isMeasureMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsMeasureMode(!isMeasureMode);
                setMeasurePoint1(null);
                setMeasurePoint2(null);
              }}
              className={`h-7 px-2 text-[9px] font-bold uppercase ${
                isMeasureMode ? "bg-cyan-600 hover:bg-cyan-700 text-white" : "border-slate-700 text-slate-300"
              }`}
              title="Click two events to measure distance"
            >
              <Ruler className="w-3 h-3 mr-1" />
              {isMeasureMode ? "Select 2 Pts..." : "Measure"}
            </Button>

            {/* Historical Jobpack Comparison */}
            <Button
              variant={showComparison ? "default" : "outline"}
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
              className={`h-7 px-2 text-[9px] font-bold uppercase ${
                showComparison ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-slate-700 text-slate-300"
              }`}
              title="Compare with Historical Jobpack Survey"
            >
              <History className="w-3 h-3 mr-1" />
              {showComparison ? "Hide Compare" : "Compare Hist"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintGraphics}
              className="h-7 px-2 text-[9px] font-bold uppercase border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Hourglass & Loading Progress Banner */}
        {isLoadingEvents && (
          <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-1.5 flex items-center justify-between text-xs text-amber-200 z-20 animate-pulse">
            <div className="flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="font-bold uppercase text-[10px] tracking-wider">
                Retrieving Complete Pipeline Data:
              </span>
              <span className="font-mono text-[10px]">
                {loadingProgressText || "Fetching all inspection records without limits..."}
              </span>
            </div>
            <span className="text-[9px] text-amber-300 font-mono">Full Relational Dataset</span>
          </div>
        )}

        {/* Toolbar & Live Telemetry & Filters Bar */}
        <div className="px-4 py-1.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live ROV Beacon Controls */}
            <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 px-2 py-0.5 rounded">
              <Radio className={`w-3.5 h-3.5 ${liveRovData ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
              <span className="text-[9px] font-bold text-slate-300 uppercase">ROV Beacon:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLiveRov(!showLiveRov)}
                className={`h-5 px-1.5 text-[8.5px] font-bold ${
                  showLiveRov ? "text-emerald-400 bg-emerald-950/60 border border-emerald-800" : "text-slate-400"
                }`}
              >
                {showLiveRov ? "Active (Show)" : "Hidden"}
              </Button>
              {liveRovData && (
                <div className="flex items-center gap-2 font-mono text-[9px] text-emerald-300 pl-1 border-l border-slate-800">
                  <span>KP: <strong>{liveRovData.kp.toFixed(3)}</strong></span>
                  {liveRovData.depth !== null && <span>Depth: {liveRovData.depth.toFixed(1)}m</span>}
                  {liveRovData.heading !== null && <span>Hdg: {liveRovData.heading.toFixed(0)}°</span>}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCenterOnRov}
                    className="h-4 px-1 text-[8px] font-bold text-cyan-300 hover:bg-cyan-950"
                    title="Center view on current ROV position"
                  >
                    🎯 Center
                  </Button>
                </div>
              )}
            </div>

            {/* Historical Jobpack Dropdown Selector (if comparison active) */}
            {showComparison && (
              <div className="flex items-center gap-1 bg-purple-950/40 border border-purple-800/60 px-2 py-0.5 rounded">
                <History className="w-3 h-3 text-purple-400" />
                <span className="text-[9px] font-bold text-purple-300 uppercase">Jobpack Ref:</span>
                <select
                  value={selectedHistoricalJobpackId}
                  onChange={(e) => {
                    const jid = e.target.value;
                    setSelectedHistoricalJobpackId(jid);
                    loadHistoricalJobpackRecords(jid);
                  }}
                  className="h-5 text-[9px] bg-slate-950 border border-purple-700 text-purple-200 rounded px-1"
                >
                  <option value="">Select Historical Jobpack...</option>
                  {availableHistoricalJobpacks.map((j) => (
                    <option key={j.jobpack_id} value={j.jobpack_id}>
                      {j.sow_report_no || j.jobpack_name || `Jobpack #${j.jobpack_id}`}
                    </option>
                  ))}
                </select>
                {isLoadingHistorical && <Hourglass className="w-3 h-3 animate-spin text-purple-400" />}
              </div>
            )}

            {/* Lookahead Range Toggle */}
            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 px-2 py-0.5 rounded">
              <Navigation className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] font-bold text-slate-300 uppercase">Lookahead:</span>
              <div className="flex items-center gap-0.5">
                {[
                  { label: "250m", val: 0.25 },
                  { label: "500m", val: 0.5 },
                  { label: "1km", val: 1.0 },
                  { label: "2km", val: 2.0 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setLookaheadRangeKm(item.val)}
                    className={`text-[8.5px] px-1.5 py-0.2 rounded font-mono font-bold transition-all ${
                      lookaheadRangeKm === item.val
                        ? "bg-cyan-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="w-3 h-3 text-blue-400 ml-1" />
              <div className="flex items-center gap-1 max-w-[280px] overflow-x-auto py-0.5 scrollbar-thin">
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
                      className={`cursor-pointer text-[8.5px] px-1.5 py-0.2 font-bold whitespace-nowrap transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-400"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      {cat}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Anomalies Only Checkbox */}
            <label className="flex items-center gap-1 cursor-pointer text-[9px] font-bold text-red-400 uppercase bg-red-950/40 border border-red-900/50 px-1.5 py-0.5 rounded">
              <Checkbox
                checked={showAnomaliesOnly}
                onCheckedChange={(c) => setShowAnomaliesOnly(!!c)}
                className="w-3 h-3 border-red-500 data-[state=checked]:bg-red-600"
              />
              <AlertTriangle className="w-3 h-3" /> Anomalies
            </label>

            {/* Search Input */}
            <div className="relative w-36">
              <Search className="w-3 h-3 absolute left-1.5 top-1.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search event or KP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-6 text-[9px] pl-6 bg-slate-950 border-slate-700 text-slate-200 focus-visible:ring-blue-500"
              />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-0.5 bg-slate-950 border border-slate-800 p-0.5 rounded">
              {surveyedRange && surveyedRange.span < maxCalculatedKp * 0.95 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFitSurveyRange}
                  className="h-5 px-1.5 text-[8px] font-bold text-cyan-300 border-cyan-800/80 bg-cyan-950/40 hover:bg-cyan-900/60 mr-0.5 shadow-sm"
                  title={`Fit view to active survey KP range (${surveyedRange.minKp.toFixed(2)} - ${surveyedRange.maxKp.toFixed(2)} km)`}
                >
                  <Maximize2 className="w-2.5 h-2.5 mr-0.5 text-cyan-400" />
                  Fit ({surveyedRange.minKp.toFixed(1)}-{surveyedRange.maxKp.toFixed(1)}k)
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                className="h-5 w-5 text-slate-300 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3 h-3" />
              </Button>
              <span className="text-[8.5px] font-mono font-bold text-blue-400 px-0.5">
                {zoomLevel.toFixed(1)}x
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                className="h-5 w-5 text-slate-300 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetZoom}
                className="h-5 w-5 text-slate-400 hover:text-white"
                title="Reset Zoom (Full Pipeline Length)"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* UPCOMING EXPECTED EVENTS LOOKAHEAD HUD STRIP */}
        {showLookaheadHud && (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-cyan-900/50 px-4 py-1 flex items-center justify-between gap-3 text-xs shrink-0 select-none overflow-x-auto scrollbar-thin">
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Upcoming Ahead (+{(lookaheadRangeKm * 1000).toFixed(0)}m | {isIncreaseFlow ? "Increasing KP ➔" : "◀ Reverse KP"}):
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-0.5 scrollbar-none">
              {upcomingEvents.length === 0 ? (
                <span className="text-[9px] text-slate-500 font-mono italic">
                  No registered events within the next {(lookaheadRangeKm * 1000).toFixed(0)}m range along inspection route
                </span>
              ) : (
                upcomingEvents.slice(0, 8).map((ue, idx) => (
                  <div
                    key={`ahead-${idx}`}
                    onClick={() => jumpToKp(ue.event.kp)}
                    className={`cursor-pointer px-2 py-0.5 rounded text-[8.5px] font-mono font-bold flex items-center gap-1.5 transition-all hover:scale-105 shrink-0 border ${
                      ue.isAnom
                        ? "bg-red-950/80 border-red-500 text-red-200 shadow-sm shadow-red-950"
                        : ue.isHist
                        ? "bg-purple-950/80 border-purple-500 text-purple-200 shadow-sm"
                        : "bg-slate-900/90 border-slate-700 text-slate-200 hover:border-cyan-500"
                    }`}
                    title={`Click to jump to ${ue.event.event_name} at KP ${ue.event.kp.toFixed(3)} (+${ue.distMeters}m ahead)`}
                  >
                    <span className="text-cyan-400 font-black">+{ue.distMeters}m</span>
                    <span className="truncate max-w-[110px] text-slate-100">
                      {ue.event.event_name || ue.event.event_type}
                    </span>
                    <span className="text-slate-400 text-[7.5px]">({ue.event.kp.toFixed(3)})</span>
                    {ue.isAnom && (
                      <span className="bg-red-900 text-white text-[7px] px-1 rounded uppercase font-black">
                        {ue.event.anomaly_code || "ANOM"}
                      </span>
                    )}
                    {ue.isHist && (
                      <span className="bg-purple-900 text-purple-200 text-[7px] px-1 rounded uppercase font-black">
                        HIST
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <span className="text-[8.5px] font-mono text-slate-500 shrink-0">
              {upcomingEvents.length} Targets Ahead
            </span>
          </div>
        )}

        {/* Main Graphical Canvas Area */}
        <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden select-none">
          {/* Measure Banner if active */}
          {isMeasureMode && (
            <div className="bg-cyan-950/80 border-b border-cyan-800/80 px-4 py-1 flex items-center justify-between text-xs text-cyan-200 z-10">
              <div className="flex items-center gap-2">
                <Ruler className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                <span className="font-bold uppercase text-[9px] tracking-wider">
                  Distance Measurement Mode:
                </span>
                <span className="text-[9.5px]">
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
                  className="h-5 text-[8.5px] font-bold text-cyan-300 hover:bg-cyan-900/50"
                >
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Graphical Pipeline View (Spans top half) */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`flex-1 relative flex flex-col justify-end p-4 pb-1 overflow-hidden transition-all ${
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
                <span className="text-[9px] font-black uppercase text-amber-300 bg-slate-900/90 px-2 py-0.5 rounded border border-amber-500/50">
                  Release to Zoom
                </span>
              </div>
            )}

            {/* Active KP Range Header Indicator */}
            <div className="absolute top-2 left-4 z-20 flex items-center gap-2 pointer-events-none">
              <span className="inline-flex items-center px-2 py-0.5 rounded border bg-slate-900/90 text-slate-300 border-slate-700 text-[8.5px] font-mono backdrop-blur-md">
                Viewport KP: {viewStartKp.toFixed(3)} - {viewEndKp.toFixed(3)} (Span: {(viewEndKp - viewStartKp).toFixed(3)} km)
              </span>
              {showComparison && (
                <span className="inline-flex items-center px-2 py-0.5 rounded border bg-purple-950/90 text-purple-300 border-purple-700 text-[8.5px] font-mono">
                  Historical Overlay Active ({historicalEvents.length} events)
                </span>
              )}
            </div>

            {/* TREE / LEAF TOP FLAGS LAYER (ABOVE 3D PIPE) */}
            <div className="relative w-full flex-1 pointer-events-auto min-h-[140px]">
              {/* SVG Connecting Stems (Tree Branches to Pipeline) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                {arrangedFlags.map((item, idx) => {
                  const isAnom = item.isAnomaly;
                  const isSel = item.isSelected;
                  const isHist = item.isHist;
                  return (
                    <g key={`stem-${idx}`}>
                      <line
                        x1={`${item.pct}%`}
                        y1={`calc(100% - ${item.stemHeight}px)`}
                        x2={`${item.pct}%`}
                        y2="100%"
                        stroke={isAnom ? "#ef4444" : isHist ? "#c084fc" : isSel ? "#38bdf8" : "#64748b"}
                        strokeWidth={isAnom || isSel ? "2" : "1"}
                        strokeDasharray={isHist ? "2 2" : isAnom ? "3 1" : "none"}
                        opacity={isSel ? "1" : "0.75"}
                      />
                      <circle
                        cx={`${item.pct}%`}
                        cy="100%"
                        r={isAnom ? "4.5" : "3"}
                        fill={isAnom ? "#ef4444" : isHist ? "#a855f7" : isSel ? "#38bdf8" : "#94a3b8"}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* DOM Flag Leaf Cards */}
              {arrangedFlags.map((item, idx) => {
                const evt = item.event;
                const isAnom = item.isAnomaly;
                const isSel = item.isSelected;
                const isHist = item.isHist;

                return (
                  <div
                    key={`flag-${evt.id || idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMeasureMode) {
                        if (!measurePoint1) setMeasurePoint1(evt);
                        else if (!measurePoint2) setMeasurePoint2(evt);
                        return;
                      }
                      setActiveEvent(evt);
                      onSelectEvent?.(evt);
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
                      /* Anomaly Flag Card */
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/90 border border-red-500 shadow-md shadow-red-950 text-white whitespace-nowrap text-[8.5px] font-bold">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="text-red-300 font-extrabold">{evt.anomaly_code || "ANOMALY"}</span>
                        <span className="text-slate-400 font-mono text-[7.5px]">({evt.kp.toFixed(3)})</span>
                        {evt.findings && (
                          <span className="bg-red-900 text-white text-[7.5px] px-1 rounded uppercase font-black">
                            {evt.findings.slice(0, 10)}
                          </span>
                        )}
                      </div>
                    ) : isHist ? (
                      /* Historical Event Flag Card */
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-950/90 border border-dashed border-purple-400 shadow-md text-purple-200 whitespace-nowrap text-[8px] font-bold hover:text-white">
                        <span className="bg-purple-900 text-purple-200 text-[7px] px-0.5 rounded font-black">HIST</span>
                        <span className="truncate max-w-[110px]">{item.display?.primaryTitle || evt.event_name}</span>
                        <span className="text-purple-300 font-mono text-[7.5px]">{evt.kp.toFixed(3)}</span>
                      </div>
                    ) : (
                      /* Standard Event Flag Card */
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
                {/* Specular Highlight Streak */}
                <div className="absolute top-1 left-0 right-0 h-1.5 bg-gradient-to-r from-white/40 via-white/80 to-white/40 blur-[1px] rounded-full pointer-events-none" />

                {/* Weld Joint Rings */}
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
                      <span className="text-[7.5px] font-black uppercase text-white bg-slate-900/80 px-1 rounded truncate">
                        {evt.event_name || "Span"} ({(evt.end_kp - evt.kp).toFixed(3)} km)
                      </span>
                    </div>
                  );
                })}

                {/* LIVE ROV PULSING BEACON MARKER ON 3D PIPE */}
                {showLiveRov && liveRovData && liveRovData.kp !== null && (
                  (() => {
                    const rovPct = kpToPercent(liveRovData.kp);
                    if (rovPct < -2 || rovPct > 102) return null;
                    return (
                      <div
                        style={{ left: `${rovPct}%` }}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
                      >
                        <div className="absolute w-8 h-8 rounded-full border-2 border-emerald-400 animate-ping opacity-60" />
                        <div className="absolute w-5 h-5 rounded-full bg-emerald-500/40 blur-[2px]" />
                        <div className="relative bg-emerald-500 text-slate-950 font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-[0_0_15px_rgba(16,185,129,0.9)] flex items-center gap-1 text-[8px]">
                          <RadioTower className="w-3 h-3 animate-spin" />
                          <span>ROV {liveRovData.kp.toFixed(3)}</span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* DYNAMIC SCALE RULER */}
            <div className="relative w-full h-7 border-t-2 border-slate-700 mt-1 pt-1 flex items-center font-mono text-[8.5px] text-slate-400 select-none shrink-0">
              {rulerTicks.map((t, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                  style={{ left: `${t.percent}%` }}
                >
                  <div
                    className={`w-0.5 ${
                      t.isMajor ? "h-2.5 bg-blue-400 font-black" : "h-1 bg-slate-600"
                    }`}
                  />
                  <span className={`mt-0.5 ${t.isMajor ? "text-blue-300 font-bold" : "text-slate-500"}`}>
                    {t.label}
                  </span>
                </div>
              ))}
            </div>

            {/* INTERACTIVE HORIZONTAL SCROLLBAR & MINI-MAP PAN SLIDER */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-md p-1 my-1 flex items-center gap-2 select-none shrink-0">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePanStep("left")}
                  disabled={viewStartKp <= 0}
                  className="h-5 px-1.5 text-[8.5px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                  title="Pan Left along pipeline"
                >
                  ◀ Pan Left
                </Button>
                {prevMatch && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => jumpToKp(prevMatch.kp)}
                    className="h-5 px-1 text-[7.5px] font-bold text-cyan-300 border-cyan-700 bg-cyan-950/40 hover:bg-cyan-900/60"
                    title={`Jump to previous matching event at KP ${prevMatch.kp.toFixed(3)}`}
                  >
                    ← Match ({prevMatch.kp.toFixed(2)})
                  </Button>
                )}
              </div>

              {/* Interactive Track */}
              <div
                ref={scrollbarTrackRef}
                onClick={handleScrollbarClick}
                className="flex-1 h-4 bg-slate-950 rounded relative border border-slate-800 cursor-pointer overflow-hidden flex items-center"
                title="Click or drag to pan along full pipeline"
              >
                {/* Event dots overview */}
                {combinedEvents.map((e, idx) => {
                  const pct = maxCalculatedKp > 0 ? (e.kp / maxCalculatedKp) * 100 : 0;
                  const isAnom = e.finding_type === "Anomaly" || e.finding_type === "Finding";
                  const isHist = e.survey_run === "previous";
                  return (
                    <div
                      key={`mini-${idx}`}
                      style={{ left: `${pct}%` }}
                      className={`absolute top-0 bottom-0 w-0.5 pointer-events-none opacity-80 ${
                        isAnom ? "bg-red-500" : isHist ? "bg-purple-500" : "bg-blue-400"
                      }`}
                    />
                  );
                })}

                {/* ROV position marker on mini-track */}
                {liveRovData && liveRovData.kp !== null && (
                  <div
                    style={{ left: `${(liveRovData.kp / maxCalculatedKp) * 100}%` }}
                    className="absolute top-0 bottom-0 w-1.5 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,1)] z-20 pointer-events-none"
                  />
                )}

                {/* Viewport Thumb */}
                <div
                  style={{
                    left: `${scrollThumbLeftPct}%`,
                    width: `${scrollThumbWidthPct}%`,
                  }}
                  className="absolute top-0 bottom-0 bg-blue-500/30 border-2 border-cyan-400 rounded-sm shadow-md pointer-events-none flex items-center justify-center"
                >
                  <span className="text-[7.5px] font-black font-mono text-cyan-200">
                    {viewStartKp.toFixed(1)}k-{viewEndKp.toFixed(1)}k
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {nextMatch && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => jumpToKp(nextMatch.kp)}
                    className="h-5 px-1 text-[7.5px] font-bold text-cyan-300 border-cyan-700 bg-cyan-950/40 hover:bg-cyan-900/60"
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
                  className="h-5 px-1.5 text-[8.5px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                  title="Pan Right along pipeline"
                >
                  Pan Right ▶
                </Button>
              </div>
            </div>

            {/* BOTTOM GRAPHS CONTAINER WITH INTERACTIVE TAB SWITCHER & EXPAND CONTROLS */}
            <div className="w-full bg-slate-950/95 border border-slate-800 rounded-lg p-2 mt-1 flex flex-col gap-1 shrink-0 shadow-lg">
              {/* Tab Navigation Toolbar for Bottom Graphs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" /> Graph View:
                  </span>

                  {/* Tab 1: Seabed Depth Bathymetry */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGraphTab("depth")}
                    className={`h-6 px-2 text-[9px] font-bold uppercase transition-all ${
                      graphTab === "depth"
                        ? "bg-cyan-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                  >
                    <TrendingUp className="w-3 h-3 mr-1 text-cyan-300" />
                    1. Seabed Depth (vs KP)
                  </Button>

                  {/* Tab 2: 2D Plan View / Top Elevation */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGraphTab("plan")}
                    className={`h-6 px-2 text-[9px] font-bold uppercase transition-all ${
                      graphTab === "plan"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                  >
                    <Compass className="w-3 h-3 mr-1 text-amber-300" />
                    2. Top Elevation (Plan N/E)
                  </Button>

                  {/* Tab 3: Longitudinal Coordinates vs KP */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGraphTab("coords_profile")}
                    className={`h-6 px-2 text-[9px] font-bold uppercase transition-all ${
                      graphTab === "coords_profile"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                  >
                    <Activity className="w-3 h-3 mr-1 text-indigo-300" />
                    3. Coordinates (N/E vs KP)
                  </Button>

                  {/* Tab 4: Side-by-Side Split View */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGraphTab("split")}
                    className={`h-6 px-2 text-[9px] font-bold uppercase transition-all ${
                      graphTab === "split"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                  >
                    <Columns className="w-3 h-3 mr-1 text-emerald-300" />
                    Split Dual View
                  </Button>

                  {/* Tab 5: Hide Graphs to maximize 3D pipeline view */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGraphTab(graphTab === "hidden" ? "depth" : "hidden")}
                    className={`h-6 px-2 text-[9px] font-bold uppercase transition-all ${
                      graphTab === "hidden"
                        ? "bg-slate-700 text-slate-200"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {graphTab === "hidden" ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                    {graphTab === "hidden" ? "Show Graphs" : "Hide (Maximize Pipe)"}
                  </Button>
                </div>

                {/* Sizing & Expand Controls */}
                {graphTab !== "hidden" && (
                  <div className="flex items-center gap-1 font-mono text-[9px] text-slate-400">
                    <span className="text-[8px] uppercase text-slate-500 mr-0.5">Size:</span>
                    <button
                      onClick={() => setGraphHeightSize("compact")}
                      className={`px-1.5 py-0.5 rounded text-[8px] ${
                        graphHeightSize === "compact" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Small
                    </button>
                    <button
                      onClick={() => setGraphHeightSize("medium")}
                      className={`px-1.5 py-0.5 rounded text-[8px] ${
                        graphHeightSize === "medium" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => setGraphHeightSize("expanded")}
                      className={`px-1.5 py-0.5 rounded text-[8px] ${
                        graphHeightSize === "expanded" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Large
                    </button>
                  </div>
                )}
              </div>

              {/* Render Selected Bottom Graph View */}
              {graphTab !== "hidden" && (
                <div className={`w-full ${graphHeightClass} relative transition-all duration-150`}>
                  {/* MODE 1: FULL SEABED DEPTH BATHYMETRY WITH DIRECT EVENT INDICATORS */}
                  {graphTab === "depth" && (
                    <div 
                      className="w-full h-full relative border border-slate-800/80 rounded bg-slate-900/40 p-1.5 flex flex-col overflow-hidden cursor-crosshair select-none"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                        const targetKp = viewStartKp + (xPct / 100) * (viewEndKp - viewStartKp);
                        const interp = profileData.points.find((p) => Math.abs(p.kp - targetKp) < 0.05);
                        // Check if close to an event
                        const closeEvt = filteredEvents.find((evt) => Math.abs(evt.kp - targetKp) < 0.02);
                        setHoverProfilePoint({
                          xPct,
                          kp: targetKp,
                          depth: interp?.depth,
                          span: interp?.span,
                          burial: interp?.burial,
                          easting: interp?.easting,
                          northing: interp?.northing,
                          event: closeEvt,
                        });
                      }}
                      onMouseLeave={() => setHoverProfilePoint(null)}
                    >
                      <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 pb-1 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-300 font-bold flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                            WATER DEPTH & SEABED TERRAIN PROFILE (BATHYMETRY VS KP)
                          </span>
                          <span className="text-[8px] text-slate-400 bg-slate-800/80 border border-slate-700 px-1.5 py-0.2 rounded font-mono">
                            Click any event marker on graph to view details
                          </span>
                          {showComparison && (
                            <span className="text-[8px] text-purple-400 bg-purple-950/40 border border-purple-600 px-1 rounded">
                              Historical Seabed Profile (Dashed Violet)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-cyan-400 font-bold">
                            Depth Range: {profileData.minDepth.toFixed(1)}m – {profileData.maxDepth.toFixed(1)}m
                          </span>
                          {liveRovData?.depth !== null && liveRovData?.depth !== undefined && (
                            <span className="text-emerald-400 font-bold">
                              ROV Depth: {liveRovData.depth.toFixed(1)}m
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative w-full flex-1 mt-1 overflow-hidden">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Depth Horizontal Grid Lines */}
                          {[0, 25, 50, 75, 100].map((pct, i) => (
                            <line 
                              key={`dgrid-${i}`} 
                              x1="0" 
                              y1={pct} 
                              x2="100" 
                              y2={pct} 
                              stroke="#334155" 
                              strokeWidth="0.5" 
                              strokeDasharray="2 2"
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}

                          {/* Primary Seabed Terrain Gradient Area Fill */}
                          {profileData.points.length > 1 && (
                            <polygon
                              points={`0,100 ${profileData.points
                                .map((p) => {
                                  const x = kpToPercent(p.kp);
                                  const d = p.depth ?? profileData.minDepth;
                                  const dSpan = profileData.maxDepth - profileData.minDepth || 1;
                                  const y = ((d - profileData.minDepth) / dSpan) * 80 + 10;
                                  return `${x},${y}`;
                                })
                                .join(" ")} 100,100`}
                              fill="url(#seabed-gradient-full)"
                              opacity="0.45"
                            />
                          )}

                          {/* Primary Seabed Profile Line */}
                          {profileData.points.length > 1 && (
                            <polyline
                              points={profileData.points
                                .map((p) => {
                                  const x = kpToPercent(p.kp);
                                  const d = p.depth ?? profileData.minDepth;
                                  const dSpan = profileData.maxDepth - profileData.minDepth || 1;
                                  const y = ((d - profileData.minDepth) / dSpan) * 80 + 10;
                                  return `${x},${y}`;
                                })
                                .join(" ")}
                              fill="none"
                              stroke="#06b6d4"
                              strokeWidth="2.5"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}

                          {/* Historical Seabed Profile Line (Dashed Violet) */}
                          {showComparison && profileData.points.some((p) => p.histDepth !== undefined) && (
                            <polyline
                              points={profileData.points
                                .filter((p) => p.histDepth !== undefined)
                                .map((p) => {
                                  const x = kpToPercent(p.kp);
                                  const d = p.histDepth!;
                                  const dSpan = profileData.maxDepth - profileData.minDepth || 1;
                                  const y = ((d - profileData.minDepth) / dSpan) * 80 + 10;
                                  return `${x},${y}`;
                                })
                                .join(" ")}
                              fill="none"
                              stroke="#c084fc"
                              strokeWidth="2"
                              strokeDasharray="4 3"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}

                          {/* Vertical Drop Guidelines connecting from top down to depth profile point */}
                          {filteredEvents.map((evt, idx) => {
                            const x = kpToPercent(evt.kp);
                            if (x < -2 || x > 102) return null;

                            let d = typeof evt.depth === "number" ? evt.depth : parseFloat(String(evt.depth || ""));
                            if (isNaN(d) && profileData.getInterpolatedDepth) {
                              const interp = profileData.getInterpolatedDepth(evt.kp);
                              if (interp !== null && interp !== undefined) d = interp;
                            }
                            if (isNaN(d)) d = (profileData.minDepth + profileData.maxDepth) / 2;

                            const dSpan = profileData.maxDepth - profileData.minDepth || 1;
                            const y = ((d - profileData.minDepth) / dSpan) * 80 + 10;

                            const isAnom =
                              evt.finding_type === "Anomaly" ||
                              evt.finding_type === "Finding" ||
                              String(evt.anomaly_code || "").trim() !== "";
                            const isSelected = activeEvent?.id === evt.id;

                            return (
                              <line
                                key={`d-stem-${evt.id || idx}`}
                                x1={x}
                                y1={0}
                                x2={x}
                                y2={y}
                                stroke={isAnom ? "#ef4444" : isSelected ? "#38bdf8" : "#475569"}
                                strokeWidth={isAnom || isSelected ? "1.5" : "0.5"}
                                strokeDasharray={isAnom ? "2 1" : "1 2"}
                                opacity={isAnom || isSelected ? "0.9" : "0.35"}
                                vectorEffect="non-scaling-stroke"
                              />
                            );
                          })}

                          {/* Hover Crosshair Vertical Line */}
                          {hoverProfilePoint && (
                            <line
                              x1={hoverProfilePoint.xPct}
                              y1="0"
                              x2={hoverProfilePoint.xPct}
                              y2="100"
                              stroke="#38bdf8"
                              strokeWidth="1"
                              strokeDasharray="2 2"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}

                          <defs>
                            <linearGradient id="seabed-gradient-full" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0891b2" stopOpacity="0.85" />
                              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.05" />
                            </linearGradient>
                          </defs>
                        </svg>

                        {/* FIXED-PIXEL CRISP EVENT DOTS HTML OVERLAY (NEVER STRETCHES INTO OVALS) */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          {filteredEvents.map((evt, idx) => {
                            const x = kpToPercent(evt.kp);
                            if (x < -2 || x > 102) return null;

                            let d = typeof evt.depth === "number" ? evt.depth : parseFloat(String(evt.depth || ""));
                            if (isNaN(d) && profileData.getInterpolatedDepth) {
                              const interp = profileData.getInterpolatedDepth(evt.kp);
                              if (interp !== null && interp !== undefined) d = interp;
                            }
                            if (isNaN(d)) d = (profileData.minDepth + profileData.maxDepth) / 2;

                            const dSpan = profileData.maxDepth - profileData.minDepth || 1;
                            const y = ((d - profileData.minDepth) / dSpan) * 80 + 10;

                            const isAnom =
                              evt.finding_type === "Anomaly" ||
                              evt.finding_type === "Finding" ||
                              String(evt.anomaly_code || "").trim() !== "";
                            const isHist = evt.survey_run === "previous";
                            const isSelected = activeEvent?.id === evt.id;

                            const nameUpper = (evt.event_name || evt.event_type || "").toUpperCase();
                            const dotBg = isAnom
                              ? "bg-red-500"
                              : isHist
                              ? "bg-purple-500"
                              : nameUpper.includes("CP")
                              ? "bg-cyan-400"
                              : nameUpper.includes("ANODE")
                              ? "bg-indigo-400"
                              : nameUpper.includes("SPAN")
                              ? "bg-emerald-400"
                              : nameUpper.includes("BURIAL")
                              ? "bg-blue-400"
                              : nameUpper.includes("FIELD JOINT")
                              ? "bg-amber-400"
                              : "bg-sky-400";

                            return (
                              <div
                                key={`depth-dot-html-${evt.id || idx}`}
                                style={{
                                  left: `${x}%`,
                                  top: `${y}%`,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveEvent(evt);
                                  onSelectEvent?.(evt);
                                }}
                                onMouseEnter={() => {
                                  setHoverProfilePoint({
                                    xPct: x,
                                    kp: evt.kp,
                                    depth: d,
                                    span: evt.span_height,
                                    burial: evt.burial_depth,
                                    event: evt,
                                  });
                                }}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer flex items-center justify-center transition-transform duration-100 ${
                                  isSelected ? "scale-125 z-30" : "hover:scale-125 hover:z-30"
                                }`}
                                title={`${evt.event_name || evt.event_type} (KP ${evt.kp.toFixed(3)})`}
                              >
                                {isAnom ? (
                                  <div className="relative flex items-center justify-center">
                                    <span className="absolute w-3.5 h-3.5 rounded-full bg-red-500 opacity-60 animate-ping" />
                                    <span className={`w-2 h-2 rotate-45 bg-red-500 border border-white rounded-[1px] shadow-sm shadow-red-950 ${isSelected ? "ring-2 ring-cyan-300 w-2.5 h-2.5" : ""}`} />
                                  </div>
                                ) : isHist ? (
                                  <div className="relative flex items-center justify-center">
                                    <span className={`w-1.5 h-1.5 rotate-45 bg-purple-500 border border-white rounded-[1px] ${isSelected ? "ring-2 ring-cyan-300 w-2 h-2" : ""}`} />
                                  </div>
                                ) : (
                                  <div className="relative flex items-center justify-center">
                                    {isSelected && (
                                      <span className="absolute w-3.5 h-3.5 rounded-full border-2 border-cyan-400 animate-ping" />
                                    )}
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full border border-white shadow-sm ${dotBg} ${
                                        isSelected ? "ring-2 ring-cyan-300 w-2 h-2" : ""
                                      }`}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* ROV Live Beacon Marker */}
                          {showLiveRov && liveRovData && liveRovData.kp !== null && liveRovData.depth !== null && (
                            (() => {
                              const rx = kpToPercent(liveRovData.kp);
                              const dSpan = profileData.maxDepth - profileData.minDepth || 1;
                              const ry = ((liveRovData.depth - profileData.minDepth) / dSpan) * 80 + 10;
                              return (
                                <div
                                  style={{ left: `${rx}%`, top: `${ry}%` }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-30"
                                >
                                  <span className="absolute w-4 h-4 rounded-full bg-emerald-400 opacity-60 animate-ping" />
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white shadow-[0_0_8px_rgba(16,185,129,1)]" />
                                </div>
                              );
                            })()
                          )}
                        </div>

                        {/* Rich Hover Inspection Tooltip with Event Context */}
                        {hoverProfilePoint && (
                          <div
                            style={{
                              left: `${Math.max(4, Math.min(78, hoverProfilePoint.xPct))}%`,
                              top: "6px",
                            }}
                            className="absolute bg-slate-950/95 border border-cyan-500/80 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-mono shadow-2xl pointer-events-none z-30 flex flex-col gap-1 backdrop-blur-md whitespace-nowrap"
                          >
                            {hoverProfilePoint.event ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase text-white ${
                                      hoverProfilePoint.event.finding_type === "Anomaly"
                                        ? "bg-red-600 animate-pulse"
                                        : hoverProfilePoint.event.survey_run === "previous"
                                        ? "bg-purple-600"
                                        : "bg-cyan-700"
                                    }`}
                                  >
                                    {hoverProfilePoint.event.anomaly_code ||
                                      hoverProfilePoint.event.finding_type ||
                                      hoverProfilePoint.event.event_type ||
                                      "EVENT"}
                                  </span>
                                  <span className="font-bold text-slate-100 text-[9.5px]">
                                    {hoverProfilePoint.event.event_name || hoverProfilePoint.event.event_type}
                                  </span>
                                  {hoverProfilePoint.event.findings && (
                                    <span className="text-amber-300 text-[8px] bg-amber-950/80 px-1 rounded border border-amber-700">
                                      {hoverProfilePoint.event.findings}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-slate-300 text-[8.5px]">
                                  <span className="text-cyan-300 font-bold">📍 KP {hoverProfilePoint.kp.toFixed(3)}</span>
                                  {hoverProfilePoint.depth !== undefined && (
                                    <span className="text-blue-400 font-bold">🌊 Depth: {hoverProfilePoint.depth.toFixed(1)}m</span>
                                  )}
                                  {hoverProfilePoint.span ? (
                                    <span className="text-emerald-400 font-bold">⛰️ Span: {hoverProfilePoint.span.toFixed(2)}m</span>
                                  ) : null}
                                  {hoverProfilePoint.burial ? (
                                    <span className="text-indigo-300 font-bold">🛡️ Burial: {hoverProfilePoint.burial.toFixed(2)}m</span>
                                  ) : null}
                                  <span className="text-cyan-300 font-semibold italic">🖱️ Click to select</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-cyan-300 font-bold">📍 KP {hoverProfilePoint.kp.toFixed(3)}</span>
                                {hoverProfilePoint.depth !== undefined && (
                                  <span className="text-blue-400 font-bold">🌊 Depth: {hoverProfilePoint.depth.toFixed(1)}m</span>
                                )}
                                {hoverProfilePoint.span ? (
                                  <span className="text-emerald-400 font-bold">⛰️ Span: {hoverProfilePoint.span.toFixed(2)}m</span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MODE 2: FULL 2D PLAN VIEW (TOP ELEVATION: NORTHING [Y] VS EASTING [X]) */}
                  {graphTab === "plan" && (
                    <div 
                      className="w-full h-full relative border border-slate-800/80 rounded bg-slate-900/40 p-1.5 flex flex-col overflow-hidden cursor-crosshair select-none"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                        const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                        const curEasting = planBounds.minEasting + (xPct / 100) * planBounds.eRange;
                        const curNorthing = planBounds.maxNorthing - (yPct / 100) * planBounds.nRange;

                        // Find closest event by coordinate proximity
                        const closeEvt = filteredEvents.find((evt) => {
                          const eNum = typeof evt.easting === "number" ? evt.easting : parseFloat(String(evt.easting || ""));
                          const nNum = typeof evt.northing === "number" ? evt.northing : parseFloat(String(evt.northing || ""));
                          if (isNaN(eNum) || isNaN(nNum)) return false;
                          const dE = eNum - curEasting;
                          const dN = nNum - curNorthing;
                          return Math.sqrt(dE * dE + dN * dN) < Math.max(planBounds.eRange, planBounds.nRange) * 0.05;
                        });

                        setHoverPlanPoint({
                          xPct,
                          yPct,
                          kp: closeEvt?.kp || 0,
                          easting: curEasting,
                          northing: curNorthing,
                          depth: closeEvt?.depth ? parseFloat(String(closeEvt.depth)) : undefined,
                          event: closeEvt,
                        });
                      }}
                      onMouseLeave={() => setHoverPlanPoint(null)}
                    >
                      <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 pb-1 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <Compass className="w-3.5 h-3.5 text-amber-400" />
                            TOP ELEVATION 2D PLAN MAP (NORTHING [Y] VS EASTING [X] — KP AS Z-AXIS)
                          </span>
                          <span className="text-[8px] text-slate-400 bg-slate-800/80 border border-slate-700 px-1.5 py-0.2 rounded font-mono">
                            Hover over map to inspect coordinates & events
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-bold text-slate-300">
                          <span className="text-amber-400">Northing: {planBounds.minNorthing.toFixed(0)}m – {planBounds.maxNorthing.toFixed(0)}m</span>
                          <span className="text-purple-300">Easting: {planBounds.minEasting.toFixed(0)}m – {planBounds.maxEasting.toFixed(0)}m</span>
                        </div>
                      </div>

                      <div className="relative w-full flex-1 mt-1 overflow-hidden">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Plan Coordinate Grid */}
                          {[25, 50, 75].map((pct, i) => (
                            <React.Fragment key={`pgrid-${i}`}>
                              <line x1="0" y1={pct} x2="100" y2={pct} stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                              <line x1={pct} y1="0" x2={pct} y2="100" stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                            </React.Fragment>
                          ))}

                          {/* Pipeline Trajectory Path Polyline */}
                          {planBounds.points.length > 1 && (
                            <polyline
                              points={planBounds.points
                                .map((p) => `${eastingToPlanXPct(p.easting!)},${northingToPlanYPct(p.northing!)}`)
                                .join(" ")}
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth="3"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}

                          {/* Hover Crosshairs for Plan Map */}
                          {hoverPlanPoint && (
                            <g>
                              <line
                                x1={hoverPlanPoint.xPct}
                                y1="0"
                                x2={hoverPlanPoint.xPct}
                                y2="100"
                                stroke="#f59e0b"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                                opacity="0.8"
                                vectorEffect="non-scaling-stroke"
                              />
                              <line
                                x1="0"
                                y1={hoverPlanPoint.yPct}
                                x2="100"
                                y2={hoverPlanPoint.yPct}
                                stroke="#f59e0b"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                                opacity="0.8"
                                vectorEffect="non-scaling-stroke"
                              />
                            </g>
                          )}
                        </svg>

                        {/* Events and Anomalies HTML Overlay on Plan Map */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          {filteredEvents.map((evt, idx) => {
                            const east = typeof evt.easting === "number" ? evt.easting : parseFloat(String(evt.easting || ""));
                            const north = typeof evt.northing === "number" ? evt.northing : parseFloat(String(evt.northing || ""));
                            if (isNaN(east) || isNaN(north)) return null;

                            const x = eastingToPlanXPct(east);
                            const y = northingToPlanYPct(north);
                            const isAnom = evt.finding_type === "Anomaly" || evt.finding_type === "Finding";
                            const isSelected = activeEvent?.id === evt.id;

                            return (
                              <div
                                key={`plan-dot-${idx}`}
                                style={{ left: `${x}%`, top: `${y}%` }}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer ${
                                  isSelected ? "scale-125 z-30" : "hover:scale-125 hover:z-30"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveEvent(evt);
                                  onSelectEvent?.(evt);
                                }}
                                onMouseEnter={() => {
                                  setHoverPlanPoint({
                                    xPct: x,
                                    yPct: y,
                                    kp: evt.kp,
                                    easting: east,
                                    northing: north,
                                    depth: evt.depth ? parseFloat(String(evt.depth)) : undefined,
                                    event: evt,
                                  });
                                }}
                              >
                                {isAnom ? (
                                  <div className="w-2 h-2 rotate-45 bg-red-500 border border-white rounded-[1px] shadow-sm shadow-red-950" />
                                ) : (
                                  <div className={`w-1.5 h-1.5 rounded-full bg-cyan-400 border border-white shadow-sm ${isSelected ? "ring-2 ring-cyan-300 w-2 h-2" : ""}`} />
                                )}
                              </div>
                            );
                          })}

                          {/* ROV Live Marker with Gyro Heading on Plan Map */}
                          {showLiveRov && liveRovData && liveRovData.easting !== null && liveRovData.northing !== null && (
                            (() => {
                              const rx = eastingToPlanXPct(liveRovData.easting);
                              const ry = northingToPlanYPct(liveRovData.northing);
                              const hdg = liveRovData.heading || 0;
                              return (
                                <div
                                  style={{ left: `${rx}%`, top: `${ry}%` }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-30"
                                >
                                  <span className="absolute w-5 h-5 rounded-full bg-emerald-400 opacity-40 animate-ping" />
                                  <div className="relative w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-lg">
                                    <div
                                      style={{ transform: `rotate(${hdg}deg)` }}
                                      className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-white"
                                    />
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>

                        {/* Rich Hover Inspection Tooltip on Plan Map */}
                        {hoverPlanPoint && (
                          <div
                            style={{
                              left: `${Math.max(4, Math.min(78, hoverPlanPoint.xPct))}%`,
                              top: "6px",
                            }}
                            className="absolute bg-slate-950/95 border border-amber-500/80 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-mono shadow-2xl pointer-events-none z-30 flex flex-col gap-1 backdrop-blur-md whitespace-nowrap"
                          >
                            {hoverPlanPoint.event ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase text-white ${
                                      hoverPlanPoint.event.finding_type === "Anomaly"
                                        ? "bg-red-600 animate-pulse"
                                        : hoverPlanPoint.event.survey_run === "previous"
                                        ? "bg-purple-600"
                                        : "bg-amber-600"
                                    }`}
                                  >
                                    {hoverPlanPoint.event.anomaly_code ||
                                      hoverPlanPoint.event.finding_type ||
                                      hoverPlanPoint.event.event_type ||
                                      "EVENT"}
                                  </span>
                                  <span className="font-bold text-slate-100 text-[9.5px]">
                                    {hoverPlanPoint.event.event_name || hoverPlanPoint.event.event_type}
                                  </span>
                                  {hoverPlanPoint.event.findings && (
                                    <span className="text-amber-300 text-[8px] bg-amber-950/80 px-1 rounded border border-amber-700">
                                      {hoverPlanPoint.event.findings}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-slate-300 text-[8.5px]">
                                  {hoverPlanPoint.kp !== undefined && (
                                    <span className="text-cyan-300 font-bold">📍 KP {hoverPlanPoint.kp.toFixed(3)}</span>
                                  )}
                                  <span className="text-amber-300">🧭 N: {hoverPlanPoint.northing.toFixed(1)}m</span>
                                  <span className="text-purple-300">E: {hoverPlanPoint.easting.toFixed(1)}m</span>
                                  {hoverPlanPoint.depth !== undefined && (
                                    <span className="text-blue-400 font-bold">🌊 Depth: {hoverPlanPoint.depth.toFixed(1)}m</span>
                                  )}
                                  <span className="text-cyan-300 font-semibold italic">🖱️ Click to select</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-amber-300 font-bold">🧭 Northing: {hoverPlanPoint.northing.toFixed(1)}m</span>
                                <span className="text-purple-300 font-bold">Easting: {hoverPlanPoint.easting.toFixed(1)}m</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MODE 3: LONGITUDINAL COORDINATES VS KP */}
                  {graphTab === "coords_profile" && (
                    <div 
                      className="w-full h-full relative border border-slate-800/80 rounded bg-slate-900/40 p-1.5 flex flex-col overflow-hidden cursor-crosshair select-none"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                        const targetKp = viewStartKp + (xPct / 100) * (viewEndKp - viewStartKp);
                        const coords = profileData.getInterpolatedCoords?.(targetKp);
                        const depth = profileData.getInterpolatedDepth?.(targetKp);
                        const closeEvt = filteredEvents.find((evt) => Math.abs(evt.kp - targetKp) < 0.02);

                        setHoverProfilePoint({
                          xPct,
                          kp: targetKp,
                          easting: coords?.easting,
                          northing: coords?.northing,
                          depth: depth ?? undefined,
                          event: closeEvt,
                        });
                      }}
                      onMouseLeave={() => setHoverProfilePoint(null)}
                    >
                      <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400 pb-1 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-300 font-bold flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5 text-indigo-400" />
                            COORDINATES VS KP PROFILE (NORTHING IN AMBER, EASTING IN PURPLE)
                          </span>
                          <span className="text-[8px] text-slate-400 bg-slate-800/80 border border-slate-700 px-1.5 py-0.2 rounded font-mono">
                            Move cursor over graph to inspect coordinates
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-amber-400 font-bold">Northing Range: {planBounds.minNorthing.toFixed(0)}m – {planBounds.maxNorthing.toFixed(0)}m</span>
                          <span className="text-purple-300 font-bold">Easting Range: {planBounds.minEasting.toFixed(0)}m – {planBounds.maxEasting.toFixed(0)}m</span>
                        </div>
                      </div>

                      <div className="relative w-full flex-1 mt-1 overflow-hidden">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Northing Line (Amber) */}
                          {profileData.points.filter((p) => p.northing !== undefined).length > 1 && (
                            <polyline
                              points={profileData.points
                                .filter((p) => p.northing !== undefined)
                                .map((p) => {
                                  const x = kpToPercent(p.kp);
                                  const nSpan = planBounds.maxNorthing - planBounds.minNorthing || 1;
                                  const y = 90 - ((p.northing! - planBounds.minNorthing) / nSpan) * 80;
                                  return `${x},${y}`;
                                })
                                .join(" ")}
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="2.5"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}

                          {/* Easting Line (Purple) */}
                          {profileData.points.filter((p) => p.easting !== undefined).length > 1 && (
                            <polyline
                              points={profileData.points
                                .filter((p) => p.easting !== undefined)
                                .map((p) => {
                                  const x = kpToPercent(p.kp);
                                  const eSpan = planBounds.maxEasting - planBounds.minEasting || 1;
                                  const y = 90 - ((p.easting! - planBounds.minEasting) / eSpan) * 80;
                                  return `${x},${y}`;
                                })
                                .join(" ")}
                              fill="none"
                              stroke="#c084fc"
                              strokeWidth="2"
                              strokeDasharray="4 2"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}

                          {/* Hover Crosshair Vertical Line */}
                          {hoverProfilePoint && (
                            <line
                              x1={hoverProfilePoint.xPct}
                              y1="0"
                              x2={hoverProfilePoint.xPct}
                              y2="100"
                              stroke="#818cf8"
                              strokeWidth="1"
                              strokeDasharray="2 2"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                        </svg>

                        {/* Rich Hover Inspection Tooltip on Coordinates Graph */}
                        {hoverProfilePoint && (
                          <div
                            style={{
                              left: `${Math.max(4, Math.min(78, hoverProfilePoint.xPct))}%`,
                              top: "6px",
                            }}
                            className="absolute bg-slate-950/95 border border-indigo-500/80 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-mono shadow-2xl pointer-events-none z-30 flex flex-col gap-1 backdrop-blur-md whitespace-nowrap"
                          >
                            {hoverProfilePoint.event ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase text-white ${
                                      hoverProfilePoint.event.finding_type === "Anomaly"
                                        ? "bg-red-600 animate-pulse"
                                        : "bg-indigo-600"
                                    }`}
                                  >
                                    {hoverProfilePoint.event.anomaly_code ||
                                      hoverProfilePoint.event.finding_type ||
                                      "EVENT"}
                                  </span>
                                  <span className="font-bold text-slate-100 text-[9.5px]">
                                    {hoverProfilePoint.event.event_name || hoverProfilePoint.event.event_type}
                                  </span>
                                  {hoverProfilePoint.event.findings && (
                                    <span className="text-amber-300 text-[8px] bg-amber-950/80 px-1 rounded border border-amber-700">
                                      {hoverProfilePoint.event.findings}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-slate-300 text-[8.5px]">
                                  <span className="text-cyan-300 font-bold">📍 KP {hoverProfilePoint.kp.toFixed(3)}</span>
                                  {hoverProfilePoint.northing !== undefined && (
                                    <span className="text-amber-300">🧭 N: {hoverProfilePoint.northing.toFixed(1)}m</span>
                                  )}
                                  {hoverProfilePoint.easting !== undefined && (
                                    <span className="text-purple-300">E: {hoverProfilePoint.easting.toFixed(1)}m</span>
                                  )}
                                  {hoverProfilePoint.depth !== undefined && (
                                    <span className="text-blue-400 font-bold">🌊 Depth: {hoverProfilePoint.depth.toFixed(1)}m</span>
                                  )}
                                  <span className="text-cyan-300 font-semibold italic">🖱️ Click to select</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-cyan-300 font-bold">📍 KP {hoverProfilePoint.kp.toFixed(3)}</span>
                                {hoverProfilePoint.northing !== undefined && (
                                  <span className="text-amber-300 font-bold">🧭 N: {hoverProfilePoint.northing.toFixed(1)}m</span>
                                )}
                                {hoverProfilePoint.easting !== undefined && (
                                  <span className="text-purple-300 font-bold">E: {hoverProfilePoint.easting.toFixed(1)}m</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MODE 4: DUAL SPLIT VIEW (50/50 DEPTH & PLAN SIDE BY SIDE) */}
                  {graphTab === "split" && (
                    <div className="w-full h-full grid grid-cols-2 gap-2">
                      {/* Left: Seabed Depth with Fixed-Pixel Event Dots & Hover Tooltip */}
                      <div 
                        className="h-full relative border border-slate-800/80 rounded bg-slate-900/40 p-1 flex flex-col overflow-hidden cursor-crosshair select-none"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                          const targetKp = viewStartKp + (xPct / 100) * (viewEndKp - viewStartKp);
                          const interp = profileData.points.find((p) => Math.abs(p.kp - targetKp) < 0.05);
                          const closeEvt = filteredEvents.find((evt) => Math.abs(evt.kp - targetKp) < 0.02);
                          setHoverProfilePoint({
                            xPct,
                            kp: targetKp,
                            depth: interp?.depth,
                            span: interp?.span,
                            burial: interp?.burial,
                            easting: interp?.easting,
                            northing: interp?.northing,
                            event: closeEvt,
                          });
                        }}
                        onMouseLeave={() => setHoverProfilePoint(null)}
                      >
                        <div className="flex items-center justify-between text-[7.5px] font-mono text-slate-400 pb-0.5 border-b border-slate-800 shrink-0">
                          <span className="text-cyan-300 font-bold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-cyan-400" /> Depth vs KP
                          </span>
                          <span className="text-slate-400">{profileData.minDepth.toFixed(1)}m – {profileData.maxDepth.toFixed(1)}m</span>
                        </div>
                        <div className="relative w-full flex-1 overflow-hidden">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {profileData.points.length > 1 && (
                              <polyline
                                points={profileData.points
                                  .map((p) => {
                                    const x = kpToPercent(p.kp);
                                    const d = p.depth ?? profileData.minDepth;
                                    const dSpan = profileData.maxDepth - profileData.minDepth || 1;
                                    const y = ((d - profileData.minDepth) / dSpan) * 80 + 10;
                                    return `${x},${y}`;
                                  })
                                  .join(" ")}
                                fill="none"
                                stroke="#06b6d4"
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                              />
                            )}

                            {/* Hover Crosshair Vertical Line */}
                            {hoverProfilePoint && (
                              <line
                                x1={hoverProfilePoint.xPct}
                                y1="0"
                                x2={hoverProfilePoint.xPct}
                                y2="100"
                                stroke="#38bdf8"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                                vectorEffect="non-scaling-stroke"
                              />
                            )}
                          </svg>

                          {/* HTML Overlay Fixed-Pixel Dots on Split Depth */}
                          <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {filteredEvents.map((evt, idx) => {
                              const x = kpToPercent(evt.kp);
                              if (x < -2 || x > 102) return null;

                              let d = typeof evt.depth === "number" ? evt.depth : parseFloat(String(evt.depth || ""));
                              if (isNaN(d) && profileData.getInterpolatedDepth) {
                                const interp = profileData.getInterpolatedDepth(evt.kp);
                                if (interp !== null && interp !== undefined) d = interp;
                              }
                              if (isNaN(d)) d = (profileData.minDepth + profileData.maxDepth) / 2;

                              const dSpan = profileData.maxDepth - profileData.minDepth || 1;
                              const y = ((d - profileData.minDepth) / dSpan) * 80 + 10;

                              const isAnom =
                                evt.finding_type === "Anomaly" ||
                                evt.finding_type === "Finding" ||
                                String(evt.anomaly_code || "").trim() !== "";
                              const isSelected = activeEvent?.id === evt.id;

                              return (
                                <div
                                  key={`split-depth-dot-${evt.id || idx}`}
                                  style={{ left: `${x}%`, top: `${y}%` }}
                                  className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer ${
                                    isSelected ? "scale-125 z-30" : "hover:scale-125 hover:z-30"
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveEvent(evt);
                                    onSelectEvent?.(evt);
                                  }}
                                >
                                  {isAnom ? (
                                    <div className="w-1.5 h-1.5 rotate-45 bg-red-500 border border-white rounded-[1px]" />
                                  ) : (
                                    <div className={`w-1.5 h-1.5 rounded-full bg-cyan-400 border border-white ${isSelected ? "ring-2 ring-cyan-300" : ""}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Split Depth Hover Tooltip */}
                          {hoverProfilePoint && (
                            <div
                              style={{
                                left: `${Math.max(4, Math.min(65, hoverProfilePoint.xPct))}%`,
                                top: "4px",
                              }}
                              className="absolute bg-slate-950/95 border border-cyan-500/80 text-white px-2 py-1 rounded text-[8px] font-mono shadow-xl pointer-events-none z-30 flex flex-col gap-0.5 backdrop-blur-md whitespace-nowrap"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-cyan-300 font-bold">📍 KP {hoverProfilePoint.kp.toFixed(3)}</span>
                                {hoverProfilePoint.depth !== undefined && (
                                  <span className="text-blue-400">🌊 {hoverProfilePoint.depth.toFixed(1)}m</span>
                                )}
                              </div>
                              {hoverProfilePoint.event && (
                                <span className="text-slate-200 font-bold truncate max-w-[140px]">
                                  {hoverProfilePoint.event.event_name || hoverProfilePoint.event.event_type}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: 2D Plan View with Fixed-Pixel Event Dots & Hover Tooltip */}
                      <div 
                        className="h-full relative border border-slate-800/80 rounded bg-slate-900/40 p-1 flex flex-col overflow-hidden cursor-crosshair select-none"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                          const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                          const curEasting = planBounds.minEasting + (xPct / 100) * planBounds.eRange;
                          const curNorthing = planBounds.maxNorthing - (yPct / 100) * planBounds.nRange;

                          const closeEvt = filteredEvents.find((evt) => {
                            const eNum = typeof evt.easting === "number" ? evt.easting : parseFloat(String(evt.easting || ""));
                            const nNum = typeof evt.northing === "number" ? evt.northing : parseFloat(String(evt.northing || ""));
                            if (isNaN(eNum) || isNaN(nNum)) return false;
                            const dE = eNum - curEasting;
                            const dN = nNum - curNorthing;
                            return Math.sqrt(dE * dE + dN * dN) < Math.max(planBounds.eRange, planBounds.nRange) * 0.08;
                          });

                          setHoverPlanPoint({
                            xPct,
                            yPct,
                            kp: closeEvt?.kp || 0,
                            easting: curEasting,
                            northing: curNorthing,
                            depth: closeEvt?.depth ? parseFloat(String(closeEvt.depth)) : undefined,
                            event: closeEvt,
                          });
                        }}
                        onMouseLeave={() => setHoverPlanPoint(null)}
                      >
                        <div className="flex items-center justify-between text-[7.5px] font-mono text-slate-400 pb-0.5 border-b border-slate-800 shrink-0">
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <Compass className="w-3 h-3 text-amber-400" /> Plan Map (N vs E)
                          </span>
                          <span className="text-slate-400">KP Station Path</span>
                        </div>
                        <div className="relative w-full flex-1 overflow-hidden">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {planBounds.points.length > 1 && (
                              <polyline
                                points={planBounds.points
                                  .map((p) => `${eastingToPlanXPct(p.easting!)},${northingToPlanYPct(p.northing!)}`)
                                  .join(" ")}
                                fill="none"
                                stroke="#fbbf24"
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                              />
                            )}

                            {/* Split Plan Crosshairs */}
                            {hoverPlanPoint && (
                              <g>
                                <line x1={hoverPlanPoint.xPct} y1="0" x2={hoverPlanPoint.xPct} y2="100" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                                <line x1="0" y1={hoverPlanPoint.yPct} x2="100" y2={hoverPlanPoint.yPct} stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                              </g>
                            )}
                          </svg>

                          {/* HTML Overlay Fixed-Pixel Dots on Split Plan */}
                          <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {filteredEvents.map((evt, idx) => {
                              const east = typeof evt.easting === "number" ? evt.easting : parseFloat(String(evt.easting || ""));
                              const north = typeof evt.northing === "number" ? evt.northing : parseFloat(String(evt.northing || ""));
                              if (isNaN(east) || isNaN(north)) return null;

                              const x = eastingToPlanXPct(east);
                              const y = northingToPlanYPct(north);
                              const isAnom = evt.finding_type === "Anomaly" || evt.finding_type === "Finding";

                              return (
                                <div
                                  key={`split-plan-dot-${evt.id || idx}`}
                                  style={{ left: `${x}%`, top: `${y}%` }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveEvent(evt);
                                    onSelectEvent?.(evt);
                                  }}
                                >
                                  {isAnom ? (
                                    <div className="w-1.5 h-1.5 rotate-45 bg-red-500 border border-white rounded-[1px]" />
                                  ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 border border-white" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Split Plan Hover Tooltip */}
                          {hoverPlanPoint && (
                            <div
                              style={{
                                left: `${Math.max(4, Math.min(65, hoverPlanPoint.xPct))}%`,
                                top: "4px",
                              }}
                              className="absolute bg-slate-950/95 border border-amber-500/80 text-white px-2 py-1 rounded text-[8px] font-mono shadow-xl pointer-events-none z-30 flex flex-col gap-0.5 backdrop-blur-md whitespace-nowrap"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-300">N: {hoverPlanPoint.northing.toFixed(0)}m</span>
                                <span className="text-purple-300">E: {hoverPlanPoint.easting.toFixed(0)}m</span>
                              </div>
                              {hoverPlanPoint.event && (
                                <span className="text-slate-200 font-bold truncate max-w-[140px]">
                                  {hoverPlanPoint.event.event_name || hoverPlanPoint.event.event_type}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
        <div className="px-4 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[9.5px] text-slate-400 font-mono shrink-0">
          <div className="flex items-center gap-4">
            <span>
              Total Pipeline Records: <strong className="text-slate-200">{combinedEvents.length}</strong>
            </span>
            <span>
              Filtered: <strong className="text-cyan-400">{filteredEvents.length}</strong>
            </span>
            <span>
              Anomalies:{" "}
              <strong className="text-red-400">
                {filteredEvents.filter((e) => e.finding_type === "Anomaly").length}
              </strong>
            </span>
            <span>
              Direction: <strong className="text-emerald-400">{inspectionDirection}</strong>
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
