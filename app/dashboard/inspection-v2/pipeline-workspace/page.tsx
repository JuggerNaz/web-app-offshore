"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useUserProfile } from "@/components/user-profile-provider";
import { toast } from "sonner";
import { format } from "date-fns";

// Import custom dashboard components
import { PipelineWorkspaceHeader } from "./components/PipelineWorkspaceHeader";
import { PipelineSummaryPanel } from "./components/PipelineSummaryPanel";
import { PipelineLiveCamera } from "./components/PipelineLiveCamera";
import { PipelineEventLog } from "./components/PipelineEventLog";
import { PipelineRovStatus } from "./components/PipelineRovStatus";
import { PipelineVideoLog } from "./components/PipelineVideoLog";
import { PipelineInspectionInfo } from "./components/PipelineInspectionInfo";

import WorkspaceV2Page from "../workspace/page";

export default function PipelineWorkspacePage() {
  return (
    <WorkspaceV2Page />
  );
}

const supabase = createClient();

function PipelineLayoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeCompanyId } = useUserProfile();

  const jobPackId = searchParams.get("jobpack");
  const structureId = searchParams.get("structure");
  const sowIdFull = searchParams.get("sow");
  const targetReportNumber = searchParams.get("sowReport");
  const initialMode = searchParams.get("mode") || "ROV";

  // Dynamic Metadata
  const [clientName, setClientName] = useState("Petronas PCSB");
  const [contractorName, setContractorName] = useState("AMSB");
  const [pipelineName, setPipelineName] = useState("NQ - PL01");
  const [vesselName, setVesselName] = useState("MV JUGGERNAUT");
  const [taskName, setTaskName] = useState("Pipeline ROV Inspection");
  const [jobpackName, setJobpackName] = useState("");

  // Timer & Clock
  const [currentTime, setCurrentTime] = useState("03:34:20");
  const [currentDate, setCurrentDate] = useState("24/12/2025");

  // Telemetry HUD overlay values (loaded dynamically if Serial / Data Acquisition is connected)
  const [telemetry, setTelemetry] = useState({
    easting: "976625.25 m",
    northing: "265319.10 m",
    kp: "12.486",
    depth: "-76.50 m",
    dive: "R007",
    rovType: "Seaye Tiger 887",
    rovHeading: "291°",
    cpValue: "-987 mV",
    date: "24 Dec 2025",
    time: "03:34:20"
  });

  // Summary Metrics (Loaded from SOW scope counters)
  const [stats, setStats] = useState({
    fieldJointsDone: 43,
    fieldJointsTotal: 45,
    anodesDone: 18,
    anodesTotal: 18,
    mgDone: 18,
    mgTotal: 18,
    crossingsDone: 3,
    crossingsTotal: 4,
    exposedDone: 2,
    exposedTotal: 2,
    spansDone: 3,
    spansTotal: 4,
    burialDone: 1,
    burialTotal: 2,
    supportsDone: 2,
    supportsTotal: 2,
    cpStabsDone: 4,
    cpStabsTotal: 4,
    anomaliesCount: 4,
    anomaliesTotal: 5
  });

  // Form Data Capture State
  const [dataCapture, setDataCapture] = useState({
    anodeType: "Bracelet",
    anodeCondition: "Good",
    depletionRate: "50 - 75%",
    cpValue: "-987 mV",
    observation: "No damage observed."
  });

  // Action/Video State
  const [activeMovement, setActiveMovement] = useState("AT WORKSITE");
  const [videoState, setVideoState] = useState<"IDLE" | "RECORDING" | "PAUSED">("IDLE");
  const [tapeCounter, setTapeCounter] = useState(813); // 00:13:33 in seconds
  const [tapeNo, setTapeNo] = useState("21007/NQ/KK01/V001R");
  const [tapeId, setTapeId] = useState<number | null>(null);
  const [streamActive, setStreamActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Event Log search state
  const [eventSearch, setEventSearch] = useState("");
  const [eventLogs, setEventLogs] = useState<any[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString("en-GB"));
      setCurrentDate(d.toLocaleDateString("en-GB"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync Video Counter
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (videoState === "RECORDING") {
      interval = setInterval(() => {
        setTapeCounter((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [videoState]);

  // Load Real Database Values, SOW Items, and Live Event Logs
  const loadCockpitData = useCallback(async () => {
    try {
      if (jobPackId) {
        // Fetch matching platform logic: metadata, contractor, and parallel pipeline/vessel info
        const [jobRes, companyRes] = await Promise.all([
          supabase.from("jobpack").select("name, contractor, metadata").eq("id", Number(jobPackId)).single(),
          supabase.from("company_settings").select("company_name, metadata").single()
        ]);

        const jobData = jobRes.data;
        const compData = companyRes.data;

        if (compData) {
          const compMeta = compData.metadata as any;
          setClientName(compMeta?.client_name || compData.company_name || "Petronas PCSB");
        }

        if (jobData) {
          setContractorName(jobData.contractor || "AMSB");
          setJobpackName(jobData.name || `JP-${jobPackId}`);
          if (jobData.metadata) {
            const meta = jobData.metadata as any;
            if (meta.client) setClientName(meta.client);
            if (meta.plantype) setTaskName(meta.plantype);

            // Fetch active vessel history or fallback
            if (meta.vessel_history && Array.isArray(meta.vessel_history) && meta.vessel_history.length > 0) {
              setVesselName(meta.vessel_history.map((v: any) => v.name || v).join(", "));
            } else if (meta.vessel) {
              setVesselName(meta.vessel);
            } else {
              setVesselName("N/A");
            }
          }
        }
      }

      if (structureId) {
        const isStrIdNumeric = !isNaN(Number(structureId));
        const structTypeQuery = isStrIdNumeric
          ? supabase.from("structure").select("str_type, str_name").eq("str_id", Number(structureId)).single()
          : supabase.from("structure").select("str_type, str_name").eq("str_name", structureId).limit(1).maybeSingle();

        const { data: structTypeData } = await structTypeQuery;

        if (structTypeData) {
          const isPipeline = structTypeData.str_type?.toLowerCase().includes("pipeline");
          if (isPipeline) {
            const pipeQuery = isStrIdNumeric
              ? supabase.from("u_pipeline" as any).select("title").eq("pipe_id", Number(structureId)).maybeSingle()
              : supabase.from("u_pipeline" as any).select("title").eq("title", structureId).limit(1).maybeSingle();

            const { data: pipeData } = await pipeQuery as any;

            if (pipeData) {
              setPipelineName(pipeData.title);
            } else {
              setPipelineName(structTypeData.str_name);
            }
          } else {
            const platQuery = isStrIdNumeric
              ? supabase.from("platform" as any).select("title").eq("plat_id", Number(structureId)).maybeSingle()
              : supabase.from("platform" as any).select("title").eq("title", structureId).limit(1).maybeSingle();

            const { data: platData } = await platQuery as any;

            if (platData) {
              setPipelineName(platData.title);
            } else {
              setPipelineName(structTypeData.str_name);
            }
          }
        }
      }

      // Load Event logs dynamically from public.insp_records
      let recordsQuery = supabase
        .from("insp_records")
        .select(`
          insp_id,
          inspection_date,
          inspection_time,
          status,
          fp_kp,
          elevation,
          inspection_type:inspection_type_id (code, name),
          insp_anomalies (anomaly_ref_no),
          inspection_data,
          rov_job:rov_job_id (deployment_no)
        `)
        .order("inspection_date", { ascending: false })
        .order("inspection_time", { ascending: false });

      if (structureId) {
        recordsQuery = recordsQuery.eq("structure_id", Number(structureId));
      }
      if (jobPackId) {
        recordsQuery = recordsQuery.eq("jobpack_id", Number(jobPackId));
      }

      const { data: dbRecords } = await recordsQuery;
      if (dbRecords) {
        const formattedLogs = dbRecords.map((r: any) => {
          const detailStr = r.inspection_data
            ? Object.entries(r.inspection_data)
                .filter(([k]) => !k.startsWith("_"))
                .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                .join(", ")
            : "No data payload";

          return {
            id: r.insp_id,
            date: format(new Date(r.inspection_date), "dd MMM yyyy"),
            time: r.inspection_time || "--:--:--",
            dive: r.rov_job?.deployment_no || telemetry.dive,
            kp: r.fp_kp !== null && r.fp_kp !== undefined ? r.fp_kp.toFixed(3) : telemetry.kp,
            event: r.inspection_type?.name || "ROV Inspection",
            anomaly: r.insp_anomalies?.[0]?.anomaly_ref_no || "-",
            data: detailStr
          };
        });
      // Load Real SOW Report details dynamically
      let sowReportNo = targetReportNumber || "Pipeline Scope";
      let jobType = "";

      if (structureId && jobPackId) {
        const { data: sowResult } = await supabase
          .from("u_sow")
          .select("id, report_numbers")
          .eq("jobpack_id", Number(jobPackId))
          .eq("structure_id", Number(structureId))
          .maybeSingle();

        if (sowResult) {
          const currentReports = sowResult.report_numbers || [];
          if (targetReportNumber) {
            const match = currentReports.find(
              (r: any) => r.number === targetReportNumber || r.REP_PREFIX === targetReportNumber
            );
            if (match) {
              sowReportNo = match.number || match.REP_PREFIX || targetReportNumber;
              jobType = match.job_type || "";
            }
          } else if (currentReports.length > 0) {
            sowReportNo = currentReports[0].number || currentReports[0].REP_PREFIX || sowReportNo;
            jobType = currentReports[0].job_type || "";
          }
        }
      }

      setTaskName(jobType || "Pipeline ROV Inspection");
      setEventLogs(formattedLogs);
      
      // Update targetReportNumber dynamically to pass through headers
      (window as any).__resolvedSowReportNo = sowReportNo;
      (window as any).__resolvedJobType = jobType;
    }

      // Load Real SOW progress counters
      if (structureId && jobPackId) {
        const { data: sowData } = await supabase
          .from("u_sow")
          .select("id, completed_items, pending_items, total_items")
          .eq("jobpack_id", Number(jobPackId))
          .eq("structure_id", Number(structureId))
          .maybeSingle();

        if (sowData) {
          // Dynamically count tasks based on active database rows
          const { data: sowItems } = await supabase
            .from("u_sow_items")
            .select("inspection_code, status");

          if (sowItems) {
            const getCounts = (code: string) => {
              const matches = sowItems.filter((i) => (i.inspection_code || "").toUpperCase() === code.toUpperCase());
              const done = matches.filter((i) => i.status === "completed").length;
              return { done, total: matches.length || 10 }; // fallback to default mockup totals
            };

            const fj = getCounts("FJ");
            const anode = getCounts("ANODE");
            const mg = getCounts("MG");
            const crossing = getCounts("CROSSING");
            const exp = getCounts("EXPOSED");
            const span = getCounts("SPAN");
            const burial = getCounts("BURIAL");

            setStats((prev) => ({
              ...prev,
              fieldJointsDone: fj.done || prev.fieldJointsDone,
              fieldJointsTotal: fj.total || prev.fieldJointsTotal,
              anodesDone: anode.done || prev.anodesDone,
              anodesTotal: anode.total || prev.anodesTotal,
              mgDone: mg.done || prev.mgDone,
              mgTotal: mg.total || prev.mgTotal,
              crossingsDone: crossing.done || prev.crossingsDone,
              crossingsTotal: crossing.total || prev.crossingsTotal,
              exposedDone: exp.done || prev.exposedDone,
              exposedTotal: exp.total || prev.exposedTotal,
              spansDone: span.done || prev.spansDone,
              spansTotal: span.total || prev.spansTotal,
              burialDone: burial.done || prev.burialDone,
              burialTotal: burial.total || prev.burialTotal
            }));
          }
        }
      }
    } catch (err) {
      console.error("Error loading cockpit metadata", err);
    }
  }, [jobPackId, structureId, targetReportNumber, telemetry.dive, telemetry.kp]);

  useEffect(() => {
    loadCockpitData();
  }, [loadCockpitData, jobPackId, structureId]);

  // Serial Telemetry Port Acquisition Strings
  useEffect(() => {
    // Check local preferences for active Data Acquisition port telemetry
    async function loadSerialDataSettings() {
      try {
        const { data: activePortSettings } = await supabase
          .from("company_settings")
          .select("def_unit")
          .single();

        // Retrieve active serial port acquisition telemetry configuration
        const savedAcq = localStorage.getItem("dataAcqFields");
        if (savedAcq) {
          const parsed = JSON.parse(savedAcq);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const telemetryUpdates: any = {};
            parsed.forEach((field: any) => {
              if (field.targetField && field.value !== undefined) {
                telemetryUpdates[field.targetField] = field.value;
              }
            });
            setTelemetry((prev) => ({
              ...prev,
              ...telemetryUpdates
            }));
          }
        }
      } catch (e) {
        console.warn("Serial acquisition config load skipped:", e);
      }
    }

    loadSerialDataSettings();
    const interval = setInterval(loadSerialDataSettings, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatCounter = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handleSaveCapture = async () => {
    try {
      setIsSaving(true);
      // Construct event details matching the form data capture values
      const eventDetails = `Anode: ${dataCapture.anodeType}, Cond: ${dataCapture.anodeCondition}, Depletion: ${dataCapture.depletionRate}, CP: ${dataCapture.cpValue}`;

      // Insert record
      const { data, error } = await supabase.from("insp_records").insert({
        structure_id: structureId ? Number(structureId) : null,
        jobpack_id: jobPackId ? Number(jobPackId) : null,
        sow_report_no: targetReportNumber || "Pipeline Scope",
        inspection_date: format(new Date(), "yyyy-MM-dd"),
        inspection_time: format(new Date(), "HH:mm:ss"),
        inspection_type_code: "RGVI",
        status: "COMPLETED",
        elevation: parseFloat(telemetry.depth) || 0,
        fp_kp: parseFloat(telemetry.kp) || 0,
        inspection_data: {
          anode_type: dataCapture.anodeType,
          anode_condition: dataCapture.anodeCondition,
          depletion_rate: dataCapture.depletionRate,
          cp_reading_mv: dataCapture.cpValue,
          observation: dataCapture.observation,
          rov_heading: telemetry.rovHeading,
          easting: telemetry.easting,
          northing: telemetry.northing
        }
      }).select("insp_id").single();

      if (error) {
        toast.error(`Error saving inspection record: ${error.message}`);
        return;
      }

      toast.success("Telemetry Event recorded successfully!");
      // Reload event list and scope counters
      await loadCockpitData();
    } catch (e) {
      toast.error("Failed to record event.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleActionTrigger = async (action: string) => {
    setActiveMovement(action);
    try {
      // Log movement to Supabase table
      const { error } = await supabase.from("insp_rov_movements").insert({
        rov_job_id: telemetry.dive,
        movement_time: new Date().toISOString(),
        movement_type: action,
        remarks: "Logged from Pipeline Workspace console"
      });

      if (error) {
        console.warn("Could not save ROV status history to DB:", error.message);
      }
      
      toast.info(`ROV state changed: ${action}`);
      await loadCockpitData();
    } catch (e) {
      console.warn("Database movement log failed:", e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <PipelineWorkspaceHeader
        clientName={clientName}
        contractorName={contractorName}
        pipelineName={pipelineName}
        taskName={(typeof window !== "undefined" && (window as any).__resolvedJobType) || taskName}
        dateStr={currentDate}
        timeStr={currentTime}
        vesselName={vesselName}
        jobpackName={jobpackName}
        sowReportNo={(typeof window !== "undefined" && (window as any).__resolvedSowReportNo) || targetReportNumber || "Pipeline Scope"}
      />

      {/* Main Grid Workspace Dashboard Layout */}
      <main className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0">
        {/* Left Column (Inspection Summary & Data Capture Form) */}
        <div className="col-span-3 h-full min-h-0">
          <PipelineSummaryPanel
            stats={stats}
            dataCapture={dataCapture}
            setDataCapture={setDataCapture}
            onSave={handleSaveCapture}
            onCancel={() => setDataCapture({ anodeType: "Bracelet", anodeCondition: "Good", depletionRate: "0 - 25%", cpValue: "", observation: "" })}
            isSaving={isSaving}
          />
        </div>

        {/* Center Column (Live Camera Stream & HUD Telemetry Overlay + Event Log Table) */}
        <div className="col-span-6 h-full flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0">
            <PipelineLiveCamera
              streamActive={streamActive}
              videoRef={videoRef}
              telemetry={{
                ...telemetry,
                time: currentTime,
                date: currentDate
              }}
              onToggleStream={() => setStreamActive(!streamActive)}
            />
          </div>
          <div className="h-[220px] shrink-0">
            <PipelineEventLog
              events={eventLogs}
              searchTerm={eventSearch}
              setSearchTerm={setEventSearch}
            />
          </div>
        </div>

        {/* Right Column (ROV Action Timelines + Video Log Controls + Target Component Progress) */}
        <div className="col-span-3 h-full flex flex-col gap-4 min-h-0">
          <PipelineRovStatus
            diveNo={telemetry.dive}
            dateStr={currentDate}
            timeStr={currentTime}
            status={activeMovement}
            onActionTrigger={handleActionTrigger}
          />

          <PipelineVideoLog
            tapeNo={tapeNo}
            tapeCounter={formatCounter(tapeCounter)}
            dateStr={currentDate}
            timeStr={currentTime}
            vidState={videoState}
            onStart={() => {
              setVideoState("RECORDING");
              toast.success("Video recording started");
            }}
            onStop={() => {
              setVideoState("IDLE");
              toast.info("Video recording stopped");
            }}
            onPause={() => {
              setVideoState("PAUSED");
              toast.warning("Video recording paused");
            }}
          />

          <PipelineInspectionInfo
            currentKp={parseFloat(telemetry.kp)}
            totalLength={130.0}
            flowDirection="Increase KP"
            nextFieldJointAhead={14}
            nextAnodeAhead={134}
            nextCrossingAhead={614}
          />
        </div>
      </main>
    </div>
  );
}
