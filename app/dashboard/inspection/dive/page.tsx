"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LifeBuoy,
  ArrowLeft,
  Settings,
  Play,
  Camera,
  ClipboardList,
  MapPin,
  Waves,
  Plus,
  RotateCcw,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import components
import DiveJobSetupDialog from "./components/DiveJobSetupDialog";
import DiveLiveDataDialog from "./components/DiveLiveDataDialog";
import DiveVideoDialog from "./components/DiveVideoDialog";
import DiveVideoRecorder from "@/components/dive-video-recorder";
import InspectionRecordingDialog from "./components/InspectionRecordingDialog";
import DiveMovementDialog from "./components/DiveMovementDialog";
import DiveInspectionTypeCard from "./components/DiveInspectionTypeCard";
import DiveInspectionList from "./components/DiveInspectionList";
import ComponentTreeDialog from "../rov/components/ComponentTreeDialog";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import { useSetAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";

interface DiveJob {
  dive_job_id: number;
  dive_no: string;
  diver_name: string;
  dive_supervisor: string;
  status: string;
  structure_id?: number;
  sow_report_no?: string;
  u_structure?: {
    type: string;
  };
  workunit?: string;
  jobpack_id: number;
}

const AIR_DIVE_ACTIONS = [
  { label: "Left Surface", location: "Surface" },
  { label: "Arrived Bottom", location: "Bottom" },
  { label: "Diver at Worksite", location: "Worksite" },
  { label: "Diver Left Worksite", location: "Worksite" },
  { label: "Left Bottom", location: "Bottom" },
  { label: "Arrived Surface", location: "Surface" },
];

function DiveInspectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const jobpackId = searchParams.get("jobpack");
  const structureId = searchParams.get("structure");
  const sowId = searchParams.get("sow");

  const [activeDiveJobs, setActiveDiveJobs] = useState<DiveJob[]>([]);
  const [completedDiveJobs, setCompletedDiveJobs] = useState<DiveJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  // Derived state for the currently selected job
  const selectedDiveJob =
    activeDiveJobs.find((j) => j.dive_job_id === selectedJobId) ||
    completedDiveJobs.find((j) => j.dive_job_id === selectedJobId) ||
    null;

  const [selectedComponents, setSelectedComponents] = useState<Record<number, any>>({});
  const selectedComponent = selectedJobId ? selectedComponents[selectedJobId] : null;
  const [loading, setLoading] = useState(true);

  // Persist selectedComponents
  useEffect(() => {
    const saved = localStorage.getItem("dive_selected_components_map");
    if (saved) {
      try {
        setSelectedComponents(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved components", e);
      }
    }
  }, []);

  useEffect(() => {
    if (Object.keys(selectedComponents).length > 0) {
      localStorage.setItem("dive_selected_components_map", JSON.stringify(selectedComponents));
    }
  }, [selectedComponents]);

  // Resolve effective structure ID (handle string codes in URL vs numeric ID in job)
  const paramStructureId = structureId && !isNaN(Number(structureId)) ? Number(structureId) : null;
  const effectiveStructureId = paramStructureId ?? selectedDiveJob?.structure_id ?? null;

  // Structure Title State
  const [platformTitle, setPlatformTitle] = useState<string>("");

  useEffect(() => {
    async function fetchPlatformTitle() {
      if (!effectiveStructureId) {
        console.log("No effective structure ID yet");
        setPlatformTitle("");
        return;
      }

      try {
        // Robust fetch logic with fallback
        let structureData: any = null;
        let title = "";

        console.log("Fetching title for structure ID:", effectiveStructureId);

        // 1. Try 'structure' table first
        const { data: sData, error: sError } = await supabase
          .from("structure")
          .select("*")
          .eq("str_id", effectiveStructureId)
          .maybeSingle();

        if (!sError && sData) {
          structureData = sData;
          console.log("Found in 'structure' table:", structureData);
        } else {
          if (sError) console.warn("Error in 'structure' fetch:", sError);
          // 2. Fallback to 'u_structure'
          const { data: uData, error: uError } = await supabase
            .from("u_structure")
            .select("*")
            .eq("str_id", effectiveStructureId)
            .maybeSingle();

          if (!uError && uData) {
            structureData = uData;
            console.log("Found in 'u_structure' table:", structureData);
          } else if (uError) {
            console.error("Error in 'u_structure' fetch:", uError);
          }
        }

        if (structureData) {
          const type = (structureData.str_type || "").toUpperCase();
          console.log("Structure type determined as:", type);

          if (type.includes("PLATFORM")) {
            const searchId = structureData.plat_id || structureData.str_id;
            console.log("Querying 'platform' table for plat_id:", searchId);
            const { data: platData, error: platError } = await supabase
              .from("platform")
              .select("title")
              .eq("plat_id", searchId)
              .maybeSingle();

            if (platData?.title) {
              title = platData.title;
            } else {
              if (platError) console.warn("Platform fetch error:", platError);
              // Fallback to str_desc if title is missing
              title = structureData.str_desc || structureData.title || structureData.str_id;
            }
          } else if (type.includes("PIPELINE")) {
            const searchId = structureData.pipe_id || structureData.str_id;
            console.log("Querying 'u_pipeline' table for pipe_id:", searchId);
            const { data: pipeData, error: pipeError } = await supabase
              .from("u_pipeline")
              .select("title")
              .eq("pipe_id", searchId)
              .maybeSingle();

            if (pipeData?.title) {
              title = pipeData.title;
            } else {
              if (pipeError) console.warn("Pipeline fetch error:", pipeError);
              // Fallback to str_desc if title is missing
              title = structureData.str_desc || structureData.title || structureData.str_id;
            }
          } else {
            console.log("No specific plat_id/pipe_id or direct type match. Using fallbacks.");
            title =
              structureData.title || structureData.str_desc || structureData.str_type || "STR";
          }
        }

        console.log("Final resolved platform title:", title);
        setPlatformTitle(title || "STR");
      } catch (err) {
        console.error("Unexpected error fetching platform title:", err);
      }
    }

    fetchPlatformTitle();
  }, [effectiveStructureId, supabase]);

  // Job Pack Name State
  const [jobPackName, setJobPackName] = useState<string>("");

  useEffect(() => {
    async function fetchJobPackName() {
      if (!jobpackId) return;
      try {
        const qId = isNaN(Number(jobpackId)) ? jobpackId : Number(jobpackId);
        const { data } = await supabase
          .from("jobpack")
          .select("name")
          .eq("id", qId)
          .maybeSingle();

        if (data?.name) {
          setJobPackName(data.name);
        } else {
          setJobPackName(`Job Pack ${jobpackId}`);
        }
      } catch (err) {
        console.error("Error fetching jobpack name:", err);
        setJobPackName(`Job Pack ${jobpackId}`);
      }
    }
    fetchJobPackName();
  }, [jobpackId, supabase]);

  // Dialog states
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [liveDataDialogOpen, setLiveDataDialogOpen] = useState(false);
  const [videoMode, setVideoMode] = useState<"embedded" | "modal" | "floating">("embedded");

  // Helper to maintain compatibility with existing handlers
  const setVideoDialogOpen = (open: boolean) => setVideoMode(open ? "modal" : "embedded");
  const videoDialogOpen = videoMode === "modal";

  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [componentTreeDialogOpen, setComponentTreeDialogOpen] = useState(false);
  const [specDialogOpen, setSpecDialogOpen] = useState(false);

  // Global state
  const setUrlId = useSetAtom(urlId);
  const setUrlType = useSetAtom(urlType);

  // Latest activity states
  const [latestInspection, setLatestInspection] = useState<any>(null);
  const [latestMovement, setLatestMovement] = useState<any>(null);
  const [inspectionCount, setInspectionCount] = useState(0);
  const [movementCount, setMovementCount] = useState(0);

  // SOW Tasks for selected component
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [sowReportNumber, setSowReportNumber] = useState<string | null>(null);

  // Resolve SOW report number from URL param
  useEffect(() => {
    async function resolveSowDetails() {
      if (!sowId) {
        setSowReportNumber(null);
        return;
      }

      try {
        const [sRecordId, sItemNo] = sowId.split("-");
        if (sRecordId && sItemNo) {
          // Fetch item details
          const { data: itemData, error: itemError } = await supabase
            .from("u_sow_items")
            .select("report_number, sow_id, id")
            .eq("sow_id", sRecordId)
            .eq("id", sItemNo)
            .maybeSingle();

          if (itemError) {
            console.error("Error fetching SOW item:", itemError);
          }

          if (itemData) {
            if (itemData.report_number) {
              setSowReportNumber(itemData.report_number);
            } else {
              // Fallback: Fetch SOW parent for structure title
              const { data: sowData } = await supabase
                .from("u_sow")
                .select("structure_title")
                .eq("id", sRecordId)
                .maybeSingle();

              if (sowData?.structure_title) {
                setSowReportNumber(`${sowData.structure_title}-${itemData.id}`);
              } else {
                setSowReportNumber(`${sRecordId}-${sItemNo}`);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error resolving SOW details:", err);
      }
    }
    resolveSowDetails();
  }, [sowId, supabase]);

  // Live Data State
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  useEffect(() => {
    checkExistingDiveJob();
  }, [jobpackId, effectiveStructureId, sowReportNumber]);

  useEffect(() => {
    if (effectiveStructureId) {
      setUrlId(effectiveStructureId);
      setUrlType("platform");
    }
  }, [effectiveStructureId, setUrlId, setUrlType]);

  useEffect(() => {
    if (selectedDiveJob) {
      loadLatestData();
      // Refresh latest data every 5 seconds (faster to feel live)
      const interval = setInterval(loadLatestData, 5000);
      return () => clearInterval(interval);
    } else {
      // Reset data when no job is selected
      setLatestInspection(null);
      setLatestMovement(null);
      setInspectionCount(0);
      setMovementCount(0);
      setStartTime(null);
      setEndTime(null);
      setElapsedTime("00:00:00");
      setElapsedTime("00:00:00");
    }
  }, [selectedDiveJob, selectedComponent?.id]);

  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  const [selectedSowTask, setSelectedSowTask] = useState<any>(null);
  const [recordToEdit, setRecordToEdit] = useState<any>(null);

  // Check SOW tasks when component or jobpack/structure context changes
  useEffect(() => {
    if (selectedComponent && jobpackId && effectiveStructureId) {
      fetchAssignedTasks();
    } else {
      setAssignedTasks([]);
    }
  }, [selectedComponent, jobpackId, effectiveStructureId]);

  // Timer Logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (startTime) {
        const now = endTime || new Date().getTime();
        const diff = now - startTime;
        if (diff > 0) {
          const hrs = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          setElapsedTime(
            `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
          );
        }
      } else {
        setElapsedTime("00:00:00");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  async function checkExistingDiveJob() {
    if (!jobpackId) return;

    console.log("Checking jobs for jobpack:", jobpackId);

    try {
      const queryJobPackId = isNaN(Number(jobpackId)) ? jobpackId : Number(jobpackId);

      let query = supabase.from("insp_dive_jobs").select("*").eq("jobpack_id", queryJobPackId);

      if (effectiveStructureId) {
        query = query.eq("structure_id", effectiveStructureId);
      }

      if (sowReportNumber) {
        // query = query.eq("sow_report_no", sowReportNumber);
        // Relaxing filter: Allow viewing all dives for this structure/jobpack regardless of specific SOW label
        console.log("Skipping SOW filter to show all structure jobs");
      }

      const { data, error } = await query.order("cr_date", { ascending: true });

      if (error) {
        console.error("Error fetching dive jobs:", error);
        toast.error("Failed to load dive jobs");
        return;
      }

      if (data) {
        // Fetch structure types for these jobs separately to avoid 400 error on join
        const structureIds = Array.from(
          new Set(data.map((j: any) => j.structure_id).filter(Boolean))
        ) as number[];

        if (structureIds.length > 0) {
          const { data: strData } = await supabase
            .from("structure_components")
            .select("id, component_type")
            .in("id", structureIds);

          if (strData) {
            const typeMap = new Map(strData.map((s: any) => [s.id, s.component_type]));
            (data as any[]).forEach((j: any) => {
              if (j.structure_id && typeMap.has(j.structure_id)) {
                // Assign as 'type' to match expected u_structure interface
                j.u_structure = { type: typeMap.get(j.structure_id) };
              }
            });
          }
        }

        // Robust filtering
        const active = (data as DiveJob[]).filter(
          (j: any) => j.status?.trim().toUpperCase() === "IN_PROGRESS"
        );
        const completed = (data as DiveJob[]).filter(
          (j: any) => j.status?.trim().toUpperCase() !== "IN_PROGRESS"
        );

        setActiveDiveJobs(active);
        setCompletedDiveJobs(completed);

        // Auto-select first active job if exists and no job selected
        if (active.length > 0 && !selectedJobId) {
          setSelectedJobId(active[0].dive_job_id);
        } else if (active.length === 0 && completed.length > 0 && !selectedJobId) {
          // If no active jobs but we have historical, auto-select the MOST RECENT one
          // The query is ordered by cr_date ASC currently, but we likely want the LAST one (most recent)
          // Wait, query order is `order("cr_date", { ascending: true })`
          // So the LAST item is the most recent.
          const mostRecent = completed[completed.length - 1];
          setSelectedJobId(mostRecent.dive_job_id);
        }
      }
    } catch (error) {
      console.log("No existing dive job found or error fetching", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLatestData() {
    if (!selectedDiveJob) return;

    try {
      // Load latest inspection
      const { data: inspData } = await supabase
        .from("insp_records")
        .select("*")
        .eq("dive_job_id", selectedDiveJob.dive_job_id)
        .order("cr_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLatestInspection(inspData);

      // Count inspections
      const { count: inspCount } = await supabase
        .from("insp_records")
        .select("*", { count: "exact", head: true })
        .eq("dive_job_id", selectedDiveJob.dive_job_id);

      setInspectionCount(inspCount || 0);

      // Load latest movement (using correct schema: movement_time, movement_type)
      const { data: moveData } = await supabase
        .from("insp_dive_movements")
        .select("*")
        .eq("dive_job_id", selectedDiveJob.dive_job_id)
        .order("movement_time", { ascending: false })
        .limit(1)
        .single();

      setLatestMovement(moveData);

      if (moveData?.movement_type === "Arrived Surface") {
        let t = moveData.movement_time;
        if (!t.includes("Z") && !t.includes("+")) t += "Z";
        setEndTime(new Date(t).getTime());
      } else {
        setEndTime(null);
      }

      // Count movements
      const { count: moveCount } = await supabase
        .from("insp_dive_movements")
        .select("*", { count: "exact", head: true })
        .eq("dive_job_id", selectedDiveJob.dive_job_id);

      setMovementCount(moveCount || 0);

      // Find Start Time (Left Surface log)
      const { data: startLog } = await supabase
        .from("insp_dive_movements")
        .select("movement_time")
        .eq("dive_job_id", selectedDiveJob.dive_job_id)
        .eq("movement_type", "Left Surface")
        .order("movement_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (startLog) {
        // Fix: Ensure timestamp is treated as UTC if valid ISO but missing TZ
        let t = startLog.movement_time;
        if (!t.includes("Z") && !t.includes("+")) t += "Z";
        setStartTime(new Date(t).getTime());
      } else {
        setStartTime(null);
      }
    } catch (error) {
      console.log("Error loading latest data:", error);
    }
  }

  async function handleUndoLastAction() {
    if (!latestMovement) return;
    if (
      !confirm(
        `Are you sure you want to remove the last action: "${latestMovement.movement_type}"?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("insp_dive_movements")
        .delete()
        .eq("movement_id", latestMovement.movement_id);

      if (error) throw error;

      // If we undid "Arrived Surface", reopen the job
      if (latestMovement.movement_type === "Arrived Surface" && selectedDiveJob) {
        await supabase
          .from("insp_dive_jobs")
          .update({ status: "IN_PROGRESS" })
          .eq("dive_job_id", selectedDiveJob.dive_job_id);

        // No need to update state here as the job is likely already in activeDiveJobs if selected
        // But if it was removed (unlikely as we are viewing it), we might want to refresh job list
        // However, since we are viewing it, it must be active (or we allow viewing completed jobs?)
        // Assuming we only view ACTIVE jobs, resurrecting a completed job (which would have been hidden) requires logic update.
        // But wait, if it was completed, it wouldn't be in activeDiveJobs, so we wouldn't be viewing it.
        // Actually, this logic is for when we JUST clicked undo on the "Arrived Surface" action.
        // If it was "Arrived Surface", the job would be complete and removed from view?
        // Ah, if the job is COMPLETE, we might not be able to undo it from this UI unless we show completed jobs.
        // For now, assuming user UNDOES before leaving or switching context.
      }

      toast.success("Action removed");
      loadLatestData(); // Refresh immediately
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove action");
    }
  }

  async function handleQuickLog(actionLabel: string) {
    if (!selectedDiveJob) return;
    if (selectedDiveJob.status === "COMPLETED") {
      toast.error("Cannot log actions to a completed deployment.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      const { error } = await supabase.from("insp_dive_movements").insert({
        dive_job_id: selectedDiveJob.dive_job_id,
        movement_type: actionLabel,
        movement_time: new Date().toISOString(),
        depth_meters: 0,
        cr_user: user?.id || "system",
        workunit: "000",
      });

      if (error) throw error;

      // If "Arrived Surface", complete the job
      if (actionLabel === "Arrived Surface") {
        await supabase
          .from("insp_dive_jobs")
          .update({ status: "COMPLETED" })
          .eq("dive_job_id", selectedDiveJob.dive_job_id);

        toast.success("Dive Completed");

        // Remove from active list and select next available if any
        const updatedList = activeDiveJobs.filter(
          (j) => j.dive_job_id !== selectedDiveJob.dive_job_id
        );
        setActiveDiveJobs(updatedList);
        setCompletedDiveJobs((prev) => [...prev, { ...selectedDiveJob, status: "COMPLETED" }]);

        setSelectedJobId(updatedList.length > 0 ? updatedList[0].dive_job_id : null);
      } else {
        toast.success(`Logged: ${actionLabel}`);
        loadLatestData(); // Refresh immediately
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to log action");
    }
  }

  // SOW Record ID (numeric)
  const [sowRecordId, setSowRecordId] = useState<number | null>(null);

  async function fetchAssignedTasks() {
    if (!jobpackId || !effectiveStructureId || !selectedComponent) return;

    try {
      // Get SOW ID
      const { data: sow, error: sowError } = await supabase
        .from("u_sow")
        .select("id, report_numbers")
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", effectiveStructureId)
        .maybeSingle();

      if (sowError) {
        console.error("Error fetching SOW:", sowError);
      }

      if (sow) {
        setSowRecordId(sow.id);

        // Extract report number from JSONB array
        let reportNo = null;
        if (Array.isArray(sow.report_numbers) && sow.report_numbers.length > 0) {
          // Check if it's an object with 'number' or just a string
          const entry = sow.report_numbers[0];
          reportNo = typeof entry === "object" ? entry?.number : entry;
        }

        // Only override if we don't have a specific SOW ID from URL
        if (!sowId) {
          setSowReportNumber(reportNo);
        }

        // Get items for this component
        const { data: items, error: itemsError } = await supabase
          .from("u_sow_items")
          .select(
            `
                        *,
                        inspection_type!u_sow_items_inspection_type_id_fkey (id, name, code)
                    `
          )
          .eq("sow_id", sow.id)
          .eq("component_id", selectedComponent.id);

        if (itemsError) {
          console.error("Error fetching SOW items:", itemsError);
        }

        setAssignedTasks(items || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }

  function handleDiveJobCreated(job: DiveJob | null) {
    if (!job) {
      // Job was deleted
      // Optimistically remove from list to ensure immediate UI update
      if (selectedJobId) {
        setActiveDiveJobs((prev) => prev.filter((j) => j.dive_job_id !== selectedJobId));
        setCompletedDiveJobs((prev) => prev.filter((j) => j.dive_job_id !== selectedJobId));
      }
      setSelectedJobId(null);

      // Delay fetch slightly to allow DB propagation
      setTimeout(() => {
        checkExistingDiveJob();
      }, 500);
      return;
    }

    // Check if it's an update to an existing job
    const existsInActive = activeDiveJobs.some((j) => j.dive_job_id === job.dive_job_id);
    const existsInCompleted = completedDiveJobs.some((j) => j.dive_job_id === job.dive_job_id);

    if (existsInActive) {
      setActiveDiveJobs((prev) =>
        prev.map((j) => (j.dive_job_id === job.dive_job_id ? job : j))
      );
    } else if (existsInCompleted) {
      setCompletedDiveJobs((prev) =>
        prev.map((j) => (j.dive_job_id === job.dive_job_id ? job : j))
      );
    } else {
      // New Job
      setActiveDiveJobs((prev) => [...prev, job]);
    }

    setSelectedJobId(job.dive_job_id);
    setSetupDialogOpen(false);
    // Toast handled in dialog
    // toast.success("Dive deployment saved successfully!"); 
  }

  async function handleComponentSelect(component: any) {
    // Detect source: SOW items have 'component_qid', Structure Components have 'q_id'
    const isSOW = component.component_qid !== undefined;

    // Use ID if available (SOW items are now linked to structure components)
    const compId = component.id;

    // Prioritize URL structureId, then diveJob, then component's own structure_id
    const targetStructureId = structureId
      ? Number(structureId)
      : selectedDiveJob?.structure_id || component.structure_id;

    // Normalize QID for fallback/SOW
    let qid = component.component_qid || component.q_id;
    if (typeof qid === "string") {
      qid = qid.trim();
    }

    console.log("Selecting component:", {
      isSOW,
      compId,
      qid,
      targetStructureId,
      source: isSOW ? "SOW" : "Structure Tree",
    });

    // 1. Try fetching by ID and Structure ID (Primary Strategy for Structure Components)
    if (compId && targetStructureId) {
      try {
        const { data } = await supabase
          .from("structure_components")
          .select("*")
          .eq("id", compId)
          .eq("structure_id", targetStructureId)
          .maybeSingle();

        if (data) {
          console.log("Found component by ID:", data);
          if (selectedJobId) {
            setSelectedComponents((prev) => ({
              ...prev,
              [selectedJobId]: data,
            }));
          }
          setComponentTreeDialogOpen(false);
          return;
        }
      } catch (err) {
        console.error("Error fetching by ID:", err);
      }
    }

    // 2. Fallback/Primary for SOW: Fetch by QID and Structure ID
    if (qid && targetStructureId) {
      try {
        let { data } = await supabase
          .from("structure_components")
          .select("*")
          .eq("structure_id", targetStructureId)
          .eq("q_id", qid)
          .maybeSingle();

        // Case-insensitive fallback
        if (!data && typeof qid === "string") {
          const { data: fallbackData } = await supabase
            .from("structure_components")
            .select("*")
            .eq("structure_id", targetStructureId)
            .ilike("q_id", qid)
            .maybeSingle();
          data = fallbackData;
        }

        if (data) {
          console.log("Found component by QID:", data);
          if (selectedJobId) {
            setSelectedComponents((prev) => ({
              ...prev,
              [selectedJobId]: data,
            }));
          }
        } else {
          console.warn(`Component details not found. QID: ${qid}, Structure: ${targetStructureId}`);
          // Fallback to original component data
          if (selectedJobId) {
            setSelectedComponents((prev) => ({
              ...prev,
              [selectedJobId]: component,
            }));
          }
          toast.warning("Detailed specs not found for this component");
        }
      } catch (err) {
        console.error("Error fetching component details:", err);
        if (selectedJobId) {
          setSelectedComponents((prev) => ({
            ...prev,
            [selectedJobId]: component,
          }));
        }
      }
    } else {
      console.warn("Missing ID/QID or Structure ID for fetch", { compId, qid, targetStructureId });
      if (selectedJobId) {
        setSelectedComponents((prev) => ({
          ...prev,
          [selectedJobId]: component,
        }));
      }
    }
    setComponentTreeDialogOpen(false);
  }

  function formatTime(timestamp: string): string {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  const getNextAction = (currentAction: string) => {
    const idx = AIR_DIVE_ACTIONS.findIndex((a) => a.label === currentAction);
    if (idx !== -1 && idx < AIR_DIVE_ACTIONS.length - 1) {
      return AIR_DIVE_ACTIONS[idx + 1].label;
    }
    return "Complete";
  };

  const getLocation = (label: string) => {
    const action = AIR_DIVE_ACTIONS.find((a) => a.label === label);
    return action ? action.location : "Worksite";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LifeBuoy className="h-12 w-12 animate-bounce mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Loading dive inspection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950">
      <div className="container max-w-[1920px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/20">
              <LifeBuoy className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {platformTitle ? `${platformTitle} - Diving Inspection` : "Diving Inspection"}
              </h1>
              <div className="text-sm text-muted-foreground mt-1">
                {selectedDiveJob ? (
                  <>
                    <span className="font-bold">{jobPackName || selectedDiveJob.dive_no}</span>
                    {(sowReportNumber || selectedDiveJob.sow_report_no) && (
                      <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
                        • {sowReportNumber || selectedDiveJob.sow_report_no}
                      </span>
                    )}
                    {" "}• Diver: {selectedDiveJob.diver_name} •{" "}
                    <Badge variant="default" className="bg-green-600">
                      {selectedDiveJob.status}
                    </Badge>
                  </>
                ) : (
                  <>
                    Job Pack: {jobPackName || jobpackId}
                    {platformTitle && ` • Structure: ${platformTitle}`}
                    {sowReportNumber && ` • SOW: ${sowReportNumber}`}
                  </>
                )}
              </div>
            </div>
          </div>
          <Link href="/dashboard/inspection">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Selection
            </Button>
          </Link>
        </div>

        {/* Deployment Selection Tabs */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Deployments
              </h2>
              <Badge variant="secondary">{activeDiveJobs.length + completedDiveJobs.length}</Badge>
            </div>
            <Button
              onClick={() => {
                setIsEditing(false);
                setSetupDialogOpen(true);
              }}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Plus className="h-4 w-4" />
              New Deployment
            </Button>
          </div>

          {activeDiveJobs.length > 0 || completedDiveJobs.length > 0 ? (
            <Tabs
              value={String(selectedJobId)}
              onValueChange={(v) => setSelectedJobId(Number(v))}
              className="w-full"
            >
              <TabsList className="bg-white/50 dark:bg-slate-900/50 p-1 border border-slate-200 dark:border-slate-800 h-auto flex-wrap justify-start gap-2">
                {activeDiveJobs.map((job) => (
                  <TabsTrigger
                    key={job.dive_job_id}
                    value={String(job.dive_job_id)}
                    className="h-10 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-100"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-start text-xs">
                        <span className="font-bold">{job.dive_no}</span>
                        <span className="text-muted-foreground">{job.diver_name}</span>
                      </div>
                      <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                  </TabsTrigger>
                ))}

                {completedDiveJobs.length > 0 && <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2" />}

                {completedDiveJobs.map((job) => (
                  <TabsTrigger
                    key={job.dive_job_id}
                    value={String(job.dive_job_id)}
                    className="h-10 opacity-75 data-[state=active]:opacity-100 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100 grayscale hover:grayscale-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-start text-xs">
                        <span className="font-bold">{job.dive_no}</span>
                        <span className="text-muted-foreground">{job.diver_name}</span>
                      </div>
                      <span className="flex h-2 w-2 rounded-full bg-slate-400" />
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <Card className="p-8 border-dashed border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-center space-y-4">
                <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full w-fit mx-auto">
                  <LifeBuoy className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">No Deployments</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Create a new deployment to start logging inspection data.
                  </p>
                  <p className="text-xs text-muted-foreground/50">
                    Filter: JobPack {jobpackId}
                    {platformTitle && ` • Structure: ${platformTitle}`}
                    {sowReportNumber && ` • SOW: ${sowReportNumber}`}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setSetupDialogOpen(true);
                  }}
                  size="lg"
                  className="gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Create First Deployment
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Dashboard Cards Grid */}
        {selectedDiveJob && (
          <div className="grid grid-cols-12 gap-4">
            {/* Deployment Info Banner */}
            <Card className="col-span-12 p-4 border-l-4 border-l-blue-600 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Current Deployment
                    </p>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">
                        {selectedDiveJob.dive_no}
                      </h3>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {selectedDiveJob.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Dive Team
                    </p>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Diver:</span>
                        <span>{selectedDiveJob.diver_name}</span>
                      </div>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Supv:</span>
                        <span>{selectedDiveJob.dive_supervisor}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setIsEditing(true);
                    setSetupDialogOpen(true);
                  }}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Details
                </Button>
              </div>
            </Card>

            {/* Left Column Stack: Live Data & Components */}
            <div className="col-span-12 lg:col-span-3 xl:col-span-2 flex flex-col h-[calc(100vh-240px)] min-w-0">
              <ScrollArea className="flex-1 w-full">
                <div className="space-y-4 pb-4 pr-3 pl-1">
                  {/* Live Dive Data Card */}
                  <Card
                    className="w-full p-3 shadow-md hover:shadow-lg transition-shadow cursor-pointer border-blue-200 dark:border-blue-900 relative overflow-hidden"
                    onClick={() => setLiveDataDialogOpen(true)}
                  >
                    <div className="space-y-3 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Waves className="h-4 w-4 text-blue-600" />
                          <h3 className="font-bold text-sm">Live Data</h3>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLiveDataDialogOpen(true);
                          }}
                          disabled={!selectedDiveJob}
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-blue-600 hover:bg-blue-50"
                          title="Monitor"
                        >
                          <Timer className="h-4 w-4" />
                        </Button>
                      </div>

                      {selectedDiveJob ? (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-2">
                          <div className="flex items-center justify-between min-w-0 gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] text-blue-900 dark:text-blue-100 font-medium uppercase tracking-wide truncate">
                                Elapsed Time
                              </p>
                              <p className="text-lg xl:text-xl font-black font-mono text-blue-600 truncate">
                                {elapsedTime}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUndoLastAction();
                              }}
                              title="Undo Last Action"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                            <div className="flex flex-col gap-2">
                              <div className="w-full">
                                <p className="text-[9px] text-muted-foreground uppercase">Action</p>
                                <p className="font-bold text-xs lg:text-sm text-slate-900 dark:text-slate-100 truncate w-full">
                                  {latestMovement ? latestMovement.movement_type : "Ready"}
                                </p>
                              </div>
                              {latestMovement && selectedDiveJob.status !== "COMPLETED" && (
                                <div className="w-full">
                                  <p className="text-[9px] text-muted-foreground uppercase">Next</p>
                                  <Badge
                                    variant="outline"
                                    className="bg-white/50 hover:bg-white hover:text-blue-600 cursor-pointer transition-colors text-[10px] h-5 px-1.5 w-full justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = getNextAction(latestMovement.movement_type);
                                      if (next !== "Complete") handleQuickLog(next);
                                    }}
                                  >
                                    <span className="truncate">
                                      {getNextAction(latestMovement.movement_type)}
                                    </span>
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border-dashed border-2 border-slate-200 dark:border-slate-700">
                          <p className="text-xs text-muted-foreground text-center">
                            Not Configured
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Component Tree Card */}
                  <Card
                    className={`w-full p-3 shadow-md hover:shadow-lg transition-shadow cursor-pointer border-green-200 dark:border-green-900 ${selectedComponent
                      ? "bg-green-50/50 dark:bg-green-950/10 ring-1 ring-green-500"
                      : ""
                      }`}
                    onClick={() => {
                      if (selectedComponent) {
                        setSpecDialogOpen(true);
                      } else {
                        setComponentTreeDialogOpen(true);
                      }
                    }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-green-600" />
                          <h3 className="font-bold text-sm">Component</h3>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setComponentTreeDialogOpen(true);
                          }}
                          disabled={!selectedDiveJob}
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-green-600 hover:bg-green-50"
                          title={selectedComponent ? "Change" : "Select"}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>

                      <div
                        className={`p-3 rounded-lg border ${selectedComponent
                          ? "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800"
                          : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                          }`}
                      >
                        <p className="text-[9px] lg:text-[10px] text-green-900 dark:text-green-100 font-medium mb-1 uppercase tracking-wide">
                          {selectedComponent ? "Selected ID" : "No Selection"}
                        </p>
                        <p className="text-xs lg:text-sm xl:text-base font-bold text-green-600 truncate">
                          {selectedComponent
                            ? selectedComponent.q_id || selectedComponent.component_qid
                            : "Click to select"}
                        </p>
                      </div>
                    </div>

                    {/* Assigned Tasks Mini-List */}
                    {selectedComponent && assignedTasks.length > 0 && (
                      <div className="pt-2 border-t border-green-200 dark:border-green-800">
                        <p className="text-[10px] text-muted-foreground uppercase mb-1.5">
                          Assigned Tasks
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {assignedTasks.map((task) => {
                            const typeName =
                              task.inspection_type?.code || task.inspection_name || "UNK";
                            const isCompleted = task.status === "completed";
                            return (
                              <Badge
                                key={task.id}
                                variant={isCompleted ? "default" : "outline"}
                                className={`text-[9px] h-4 px-1.5 gap-1 ${isCompleted
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-white text-slate-600 border-slate-200"
                                  }`}
                              >
                                {typeName}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Inspection Types Card */}
                  {selectedComponent && sowRecordId && (
                    <DiveInspectionTypeCard
                      sowId={sowRecordId}
                      componentId={selectedComponent.id}
                      componentQid={selectedComponent.q_id || selectedComponent.component_qid}
                      componentType={
                        selectedComponent.component_type ||
                        selectedComponent.type ||
                        selectedComponent.code
                      }
                      assignedTasks={assignedTasks}
                      onTasksUpdated={fetchAssignedTasks}
                      reportNumber={sowReportNumber || selectedDiveJob?.sow_report_no}
                      diveJob={selectedDiveJob}
                    />
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Middle Column: Inspection & Movement Logs */}
            <div
              className={`col-span-12 flex flex-col h-[calc(100vh-240px)] transition-all duration-300 min-w-0 ${videoMode === "embedded"
                ? "lg:col-span-5 xl:col-span-5"
                : "lg:col-span-7 xl:col-span-8"
                }`}
            >
              <ScrollArea className="flex-1 w-full">
                <div className="space-y-4 pb-4 pr-3 pl-1">
                  {/* Inspection Records Card */}
                  <Card className="w-full p-3 shadow-md hover:shadow-lg transition-shadow cursor-pointer border-orange-200 dark:border-orange-900">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <ClipboardList className="h-4 w-4 text-orange-600 shrink-0" />
                          <h3 className="font-bold text-sm truncate">Inspection Records</h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                            {inspectionCount}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                disabled={!selectedDiveJob || assignedTasks.length === 0}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs gap-1 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                              >
                                <Play className="h-3 w-3 fill-current" />
                                Record
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Select Inspection Type</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {assignedTasks.map((task) => (
                                <DropdownMenuItem
                                  key={task.id}
                                  onClick={() => {
                                    setSelectedSowTask(task);
                                    setInspectionDialogOpen(true);
                                  }}
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <span>
                                    {task.inspection_type?.code ||
                                      task.inspection_name ||
                                      "Inspection"}
                                  </span>
                                  {task.status === "completed" && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] h-4 px-1 border-green-200 text-green-700 bg-green-50"
                                    >
                                      Done
                                    </Badge>
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Assigned Tasks Badges Removed per request */}

                      <DiveInspectionList
                        diveJobId={selectedDiveJob?.dive_job_id}
                        // componentId={selectedComponent?.id} // Disabled to show all records for deployment
                        // No type filtering for list as requested
                        selectedType={null}
                        onEdit={(record) => {
                          setRecordToEdit(record);
                          setInspectionDialogOpen(true);
                        }}
                        onDelete={() => {
                          loadLatestData();
                          setLastUpdated(new Date().toISOString());
                        }}
                        timestamp={lastUpdated}
                      />
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            </div>

            {/* Right Column: Video Recorder */}
            <div
              className={`col-span-12 flex flex-col h-[calc(100vh-240px)] transition-all duration-300 min-w-0 ${videoMode === "embedded"
                ? "lg:col-span-4 xl:col-span-5"
                : "lg:col-span-2 xl:col-span-2"
                }`}
            >
              <Card className="w-full h-full p-0 overflow-hidden shadow-lg border-purple-200 dark:border-purple-900 flex flex-col relative group shrink-0">
                {videoMode === "embedded" ? (
                  selectedDiveJob ? (
                    <DiveVideoRecorder
                      className="h-full w-full border-none rounded-none"
                      diveJob={selectedDiveJob}
                      isFloating={false}
                      onToggleMode={() => setVideoMode("modal")}
                      refreshKey={lastUpdated}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-purple-50/50 dark:bg-purple-900/10">
                      <div className="p-4 bg-purple-100 dark:bg-purple-900/40 rounded-full">
                        <Camera className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Video System</h3>
                        <p className="text-sm text-muted-foreground">
                          Setup deployment to enable video logging
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setIsEditing(false);
                          setSetupDialogOpen(true);
                        }}
                        variant="outline"
                      >
                        Setup Deployment
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 p-6 text-center space-y-4">
                    <div className="p-4 bg-primary/10 rounded-full animate-pulse">
                      <Camera className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Video Undocked</h3>
                      <p className="text-sm text-muted-foreground">
                        Video is currently {videoMode === "modal" ? "in full screen" : "floating"}.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setVideoMode("embedded")}>
                      Restore to Dashboard
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <DiveJobSetupDialog
        open={setupDialogOpen}
        onOpenChange={setSetupDialogOpen}
        jobpackId={jobpackId}
        sowId={sowReportNumber}
        structureId={effectiveStructureId?.toString() || null}
        onJobCreated={handleDiveJobCreated}
        existingJob={isEditing ? selectedDiveJob : null}
      />

      {selectedDiveJob && (
        <>
          <DiveLiveDataDialog
            open={liveDataDialogOpen}
            onOpenChange={setLiveDataDialogOpen}
            diveJob={selectedDiveJob}
          />

          <DiveVideoDialog
            open={videoDialogOpen}
            onOpenChange={setVideoDialogOpen}
            diveJob={selectedDiveJob}
            onToggleMode={() => setVideoMode("floating")}
            refreshKey={lastUpdated}
          />

          {videoMode === "floating" && (
            <div className="fixed bottom-6 right-6 z-50 w-[480px] aspect-video shadow-2xl rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 bg-background animate-in slide-in-from-bottom-10 fade-in duration-300">
              <DiveVideoRecorder
                className="h-full w-full"
                diveJob={selectedDiveJob}
                isFloating={true}
                onClose={() => setVideoMode("embedded")}
                onToggleMode={() => setVideoMode("modal")}
                refreshKey={lastUpdated}
              />
            </div>
          )}

          <InspectionRecordingDialog
            open={inspectionDialogOpen}
            onOpenChange={(open) => {
              setInspectionDialogOpen(open);
              if (!open) {
                setRecordToEdit(null);
                setSelectedSowTask(null);
              }
            }}
            platformTitle={platformTitle}
            sowItem={
              recordToEdit
                ? assignedTasks.find(
                  (t) => t.inspection_type_id === recordToEdit.inspection_type_id
                )
                : selectedSowTask || assignedTasks[0]
            }
            diveJob={selectedDiveJob}
            currentRecord={recordToEdit}
            structureType={
              selectedDiveJob?.u_structure?.type?.toLowerCase()?.includes("pipeline")
                ? "pipeline"
                : "platform"
            }
            onSaved={() => {
              loadLatestData();
              fetchAssignedTasks();
              // checkExistingDiveJob(); // Removed to prevent resetting active job filter/state
              setRecordToEdit(null);
              setSelectedSowTask(null);
              // Add small delay to ensure DB propagation for list refresh
              setTimeout(() => {
                setLastUpdated(new Date().toISOString());
              }, 500);
            }}
          />

          <DiveMovementDialog
            open={movementDialogOpen}
            onOpenChange={setMovementDialogOpen}
            diveJob={selectedDiveJob}
            onMovementSaved={loadLatestData}
          />

          <ComponentTreeDialog
            open={componentTreeDialogOpen}
            onOpenChange={setComponentTreeDialogOpen}
            structureId={effectiveStructureId?.toString() || null}
            jobpackId={jobpackId}
            sowId={sowId}
            onComponentSelect={handleComponentSelect}
            selectedComponent={selectedComponent}
          />

          <ComponentSpecDialog
            open={specDialogOpen}
            onOpenChange={setSpecDialogOpen}
            component={selectedComponent}
          // mode="view"
          />
        </>
      )}
    </div>
  );
}

export default function DiveInspectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <LifeBuoy className="h-12 w-12 animate-bounce text-blue-600" />
        </div>
      }
    >
      <DiveInspectionContent />
    </Suspense>
  );
}
