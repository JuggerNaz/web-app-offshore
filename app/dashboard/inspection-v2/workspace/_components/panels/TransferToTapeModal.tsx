"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Film,
  Calendar,
  Clock,
  Timer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sliders,
  Sparkles,
  Anchor,
  Layers,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TransferToTapeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRecords: any[];
  jobTapes: any[];
  deployments?: any[];
  activeDep?: any;
  inspMethod?: "DIVING" | "ROV";
  supabase: any;
  onTransferComplete: () => Promise<void> | void;
  container?: HTMLElement | null;
}

interface TapeBoundaryInfo {
  tapeDate: string | null;
  tapeStartTime: string | null;
  tapeEndTime: string | null;
  minCounter: number;
  maxCounter: number;
  hasLogs: boolean;
}

export function TransferToTapeModal({
  open,
  onOpenChange,
  selectedRecords,
  jobTapes = [],
  deployments = [],
  activeDep,
  inspMethod = "DIVING",
  supabase,
  onTransferComplete,
  container,
}: TransferToTapeModalProps) {
  const [transferScope, setTransferScope] = useState<"CURRENT_DIVE" | "DIFFERENT_DIVE">("CURRENT_DIVE");
  const [targetDiveId, setTargetDiveId] = useState<string>("");
  const [targetDiveTapes, setTargetDiveTapes] = useState<any[]>([]);
  const [loadingDiveTapes, setLoadingDiveTapes] = useState(false);
  
  const [targetTapeId, setTargetTapeId] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alignMode, setAlignMode] = useState<"AUTO" | "KEEP">("AUTO");
  const [boundaryInfo, setBoundaryInfo] = useState<TapeBoundaryInfo | null>(null);

  const isDiving = inspMethod === "DIVING";
  const jobTerm = isDiving ? "Dive" : "ROV Job";

  // Reset/initialize state when dialog opens
  useEffect(() => {
    if (open) {
      setTransferScope("CURRENT_DIVE");
      if (activeDep?.id) {
        setTargetDiveId(String(activeDep.id));
      } else if (deployments.length > 0) {
        setTargetDiveId(String(deployments[0].id || deployments[0].dive_job_id || deployments[0].rov_job_id || ""));
      }

      if (jobTapes.length > 0) {
        const currentTapeId = selectedRecords[0]?.tape_id;
        const otherTape = jobTapes.find((t) => String(t.tape_id) !== String(currentTapeId));
        setTargetTapeId(String(otherTape?.tape_id || jobTapes[0]?.tape_id || ""));
      }
    }
  }, [open, jobTapes, selectedRecords, activeDep, deployments]);

  // When transferScope switches to DIFFERENT_DIVE, initialize target dive if needed
  useEffect(() => {
    if (transferScope === "DIFFERENT_DIVE" && deployments.length > 0) {
      const otherDep = deployments.find((d) => String(d.id || d.dive_job_id || d.rov_job_id) !== String(activeDep?.id));
      const chosenDepId = String(otherDep?.id || otherDep?.dive_job_id || otherDep?.rov_job_id || deployments[0]?.id || "");
      setTargetDiveId(chosenDepId);
    }
  }, [transferScope, deployments, activeDep]);

  // When targetDiveId changes under DIFFERENT_DIVE, fetch tapes for that specific dive
  useEffect(() => {
    if (!open || !targetDiveId || !supabase) return;

    if (transferScope === "CURRENT_DIVE") {
      setTargetDiveTapes(jobTapes);
      return;
    }

    let isMounted = true;
    async function fetchTapesForTargetDive() {
      setLoadingDiveTapes(true);
      try {
        const jobCol = isDiving ? "dive_job_id" : "rov_job_id";
        const { data: tapes, error } = await supabase
          .from("insp_video_tapes")
          .select("tape_id, tape_no, chapter_no, status, cr_date")
          .eq(jobCol, Number(targetDiveId))
          .order("tape_id", { ascending: false });

        if (error) throw error;

        if (isMounted) {
          const loadedTapes = tapes || [];
          setTargetDiveTapes(loadedTapes);
          if (loadedTapes.length > 0) {
            setTargetTapeId(String(loadedTapes[0].tape_id));
          } else {
            setTargetTapeId("");
          }
        }
      } catch (err) {
        console.error("Error loading tapes for target dive:", err);
      } finally {
        if (isMounted) setLoadingDiveTapes(false);
      }
    }

    fetchTapesForTargetDive();
    return () => {
      isMounted = false;
    };
  }, [targetDiveId, transferScope, open, supabase, isDiving, jobTapes]);

  // Fetch tape logs to detect date/time/counter boundaries whenever targetTapeId changes
  useEffect(() => {
    if (!targetTapeId || !supabase) {
      // Fallback boundary to target dive date if available
      const activeDiveObj = deployments.find((d) => String(d.id || d.dive_job_id || d.rov_job_id) === String(targetDiveId)) || activeDep;
      const diveDate = activeDiveObj?.date || activeDiveObj?.dive_date || activeDiveObj?.rov_date || format(new Date(), "yyyy-MM-dd");
      setBoundaryInfo({
        tapeDate: diveDate,
        tapeStartTime: activeDiveObj?.start_time ? String(activeDiveObj.start_time).slice(0, 8) : "08:00:00",
        tapeEndTime: activeDiveObj?.end_time ? String(activeDiveObj.end_time).slice(0, 8) : null,
        minCounter: 0,
        maxCounter: 7200,
        hasLogs: false,
      });
      return;
    }

    let isMounted = true;
    async function fetchTapeBoundaries() {
      setLoadingLogs(true);
      try {
        const { data: logs, error } = await supabase
          .from("insp_video_logs")
          .select("event_type, event_time, tape_counter_start, timecode_start")
          .eq("tape_id", Number(targetTapeId))
          .order("event_time", { ascending: true });

        if (error) throw error;

        if (isMounted) {
          const activeDiveObj = deployments.find((d) => String(d.id || d.dive_job_id || d.rov_job_id) === String(targetDiveId)) || activeDep;
          const fallbackDate = activeDiveObj?.date || activeDiveObj?.dive_date || activeDiveObj?.rov_date || format(new Date(), "yyyy-MM-dd");

          if (logs && logs.length > 0) {
            const startLog = logs.find((l: any) => l.event_type === "NEW_LOG_START" || l.event_type === "RESUME") || logs[0];
            const endLog = logs[logs.length - 1];

            let tapeDate: string | null = null;
            let tapeStartTime: string | null = null;
            let tapeEndTime: string | null = null;

            if (startLog?.event_time) {
              const [d, t] = String(startLog.event_time).split("T");
              tapeDate = d;
              tapeStartTime = t ? t.slice(0, 8) : null;
            }

            if (endLog?.event_time) {
              const [, t] = String(endLog.event_time).split("T");
              tapeEndTime = t ? t.slice(0, 8) : null;
            }

            let minC = 0;
            let maxC = 0;
            logs.forEach((l: any) => {
              const c = Number(l.tape_counter_start || 0);
              if (c > maxC) maxC = c;
            });

            setBoundaryInfo({
              tapeDate: tapeDate || fallbackDate,
              tapeStartTime: tapeStartTime || "08:00:00",
              tapeEndTime,
              minCounter: minC,
              maxCounter: maxC || 7200,
              hasLogs: true,
            });
          } else {
            const availableTapes = transferScope === "CURRENT_DIVE" ? jobTapes : targetDiveTapes;
            const matchedTape = availableTapes.find((t) => String(t.tape_id) === String(targetTapeId));
            const tapeDate = matchedTape?.cr_date ? String(matchedTape.cr_date).split("T")[0] : fallbackDate;

            setBoundaryInfo({
              tapeDate,
              tapeStartTime: activeDiveObj?.start_time ? String(activeDiveObj.start_time).slice(0, 8) : "08:00:00",
              tapeEndTime: activeDiveObj?.end_time ? String(activeDiveObj.end_time).slice(0, 8) : null,
              minCounter: 0,
              maxCounter: 7200,
              hasLogs: false,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching target tape boundaries:", err);
      } finally {
        if (isMounted) setLoadingLogs(false);
      }
    }

    fetchTapeBoundaries();
    return () => {
      isMounted = false;
    };
  }, [targetTapeId, targetDiveId, transferScope, supabase, jobTapes, targetDiveTapes, deployments, activeDep]);

  function formatCounter(seconds: number | string): string {
    if (seconds === undefined || seconds === null || seconds === "") return "00:00:00";
    const str = String(seconds).trim();
    if (str.includes(":")) {
      const parts = str.split(":").map((p) => p.trim());
      if (parts.length === 3) return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
      if (parts.length === 2) return `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
    const totalSeconds = typeof seconds === "string" ? parseFloat(seconds) : seconds;
    if (isNaN(totalSeconds)) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function parseTimecode(tc: string): number {
    if (!tc) return 0;
    const parts = String(tc).split(":").map((p) => parseInt(p, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(tc) || 0;
  }

  function addSecondsToTimeString(timeStr: string, secondsToAdd: number): string {
    if (!timeStr) return "10:00:00";
    const parts = timeStr.split(":").map((p) => parseInt(p, 10) || 0);
    const totalSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0) + secondsToAdd;
    const h = Math.floor((totalSec / 3600) % 24);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // Calculate adjusted record properties based on alignment mode
  const getAdjustedRecordData = (record: any) => {
    if (alignMode === "KEEP" || !boundaryInfo) {
      return {
        inspection_date: record.inspection_date,
        inspection_time: record.inspection_time || "00:00:00",
        tape_count_no: record.tape_count_no || 0,
        timecode: record.inspection_data?._meta_timecode || formatCounter(record.tape_count_no || 0),
      };
    }

    // AUTO ALIGN:
    // 1. Match date to target tape/dive log date
    const targetDate = boundaryInfo.tapeDate || record.inspection_date || format(new Date(), "yyyy-MM-dd");

    // 2. Validate/Clamp counter
    const originalCounterSec = Number(
      record.tape_count_no !== undefined && record.tape_count_no !== null && record.tape_count_no !== ""
        ? record.tape_count_no
        : parseTimecode(record.inspection_data?._meta_timecode || "0")
    );
    const clampedCounterSec = Math.max(
      boundaryInfo.minCounter,
      Math.min(boundaryInfo.maxCounter > 0 ? boundaryInfo.maxCounter : originalCounterSec, originalCounterSec)
    );
    const formattedTimecode = formatCounter(clampedCounterSec);

    // 3. Match time inside tape start and end
    let targetTime = record.inspection_time || "10:00:00";
    if (boundaryInfo.tapeStartTime) {
      targetTime = addSecondsToTimeString(boundaryInfo.tapeStartTime, clampedCounterSec);
      if (boundaryInfo.tapeEndTime && targetTime > boundaryInfo.tapeEndTime) {
        targetTime = boundaryInfo.tapeEndTime;
      }
    }

    return {
      inspection_date: targetDate,
      inspection_time: targetTime,
      tape_count_no: clampedCounterSec,
      timecode: formattedTimecode,
    };
  };

  // Helper to auto-create a tape for a dive if none exists yet
  const handleAutoCreateTapeForDive = async (diveIdNum: number) => {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data?.user;
    const targetDepObj = deployments.find((d) => String(d.id || d.dive_job_id || d.rov_job_id) === String(diveIdNum));
    const postfix = isDiving ? "D" : "R";
    const rawJob = targetDepObj?.jobNo || `JOB-${diveIdNum}`;
    const tapeName = `${String(rawJob).replace(/\s+/g, "")}/V001${postfix}`;

    const { data: newTape, error } = await supabase
      .from("insp_video_tapes")
      .insert({
        tape_no: tapeName,
        tape_type: "DIGITAL - PRIMARY",
        chapter_no: 1,
        status: "ACTIVE",
        [isDiving ? "dive_job_id" : "rov_job_id"]: diveIdNum,
        cr_user: user?.id || "system",
      })
      .select("tape_id, tape_no, chapter_no, status")
      .single();

    if (error) throw error;
    return newTape;
  };

  const handleConfirmTransfer = async () => {
    if (selectedRecords.length === 0) {
      toast.error("No records selected for transfer.");
      return;
    }

    const availableTapes = transferScope === "CURRENT_DIVE" ? jobTapes : targetDiveTapes;
    let finalTapeId = targetTapeId ? Number(targetTapeId) : null;
    const jobCol = isDiving ? "dive_job_id" : "rov_job_id";
    const targetDepIdNum = transferScope === "DIFFERENT_DIVE" 
      ? Number(targetDiveId) 
      : Number(activeDep?.id || selectedRecords[0]?.[jobCol]);

    if (!targetDepIdNum) {
      toast.error(`Please select a valid ${jobTerm}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // If no tape exists for this target dive, create one automatically
      if (!finalTapeId && transferScope === "DIFFERENT_DIVE") {
        const createdTape = await handleAutoCreateTapeForDive(targetDepIdNum);
        if (createdTape) {
          finalTapeId = createdTape.tape_id;
        }
      }

      if (!finalTapeId) {
        toast.error("Please select or create a destination tape.");
        setIsSubmitting(false);
        return;
      }

      const matchedTargetTape = [...jobTapes, ...targetDiveTapes].find((t) => String(t.tape_id) === String(finalTapeId));
      const targetTapeNo = matchedTargetTape?.tape_no || `Tape #${finalTapeId}`;
      const targetDepObj = deployments.find((d) => String(d.id || d.dive_job_id || d.rov_job_id) === String(targetDepIdNum));
      const targetDepLabel = targetDepObj?.jobNo || `${jobTerm} #${targetDepIdNum}`;

      const nowIso = new Date().toISOString();
      const updates = selectedRecords.map(async (rec) => {
        const adjusted = getAdjustedRecordData(rec);
        const payload: any = {
          [jobCol]: targetDepIdNum,
          tape_id: finalTapeId,
          inspection_date: adjusted.inspection_date,
          inspection_time: adjusted.inspection_time,
          tape_count_no: adjusted.tape_count_no,
          inspection_data: {
            ...(rec.inspection_data || {}),
            _meta_timecode: adjusted.timecode,
            tape_count_no: adjusted.timecode,
            counter: adjusted.timecode,
            inspection_date: adjusted.inspection_date,
            inspection_time: adjusted.inspection_time,
          },
          md_date: nowIso,
        };

        const { error } = await supabase
          .from("insp_records")
          .update(payload)
          .eq("insp_id", rec.insp_id);

        if (error) throw error;
      });

      await Promise.all(updates);

      toast.success(
        `Transferred ${selectedRecords.length} event(s) to ${targetDepLabel} • ${targetTapeNo}`
      );

      if (onTransferComplete) {
        await onTransferComplete();
      }

      onOpenChange(false);
    } catch (err: any) {
      console.error("Error transferring records:", err);
      toast.error(`Transfer failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableTapes = transferScope === "CURRENT_DIVE" ? jobTapes : targetDiveTapes;
  const targetTape = availableTapes.find((t) => String(t.tape_id) === String(targetTapeId));
  const activeDiveObj = deployments.find((d) => String(d.id || d.dive_job_id || d.rov_job_id) === String(targetDiveId)) || activeDep;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden text-slate-800 dark:text-slate-100"
      >
        <DialogHeader className="p-4 bg-slate-900 text-white space-y-1 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-600/30 border border-blue-500/40 text-blue-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-black uppercase tracking-wider text-white">
                Transfer Inspection Events
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Move {selectedRecords.length} event{selectedRecords.length > 1 ? "s" : ""} across {jobTerm} Numbers or Video Tapes
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Transfer Scope Toggle */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Transfer Destination Scope
            </Label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTransferScope("CURRENT_DIVE")}
                className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  transferScope === "CURRENT_DIVE"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Same {jobTerm} (Change Tape)
              </button>
              <button
                type="button"
                onClick={() => setTransferScope("DIFFERENT_DIVE")}
                className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  transferScope === "DIFFERENT_DIVE"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Anchor className="w-3.5 h-3.5" />
                Different {jobTerm} No.
              </button>
            </div>
          </div>

          {/* If DIFFERENT_DIVE: Target Dive Selection */}
          {transferScope === "DIFFERENT_DIVE" && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Anchor className="w-3 h-3 text-blue-500" />
                Target {jobTerm} Deployment
              </Label>
              <Select value={targetDiveId} onValueChange={setTargetDiveId}>
                <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder={`Select destination ${jobTerm}...`} />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-950 dark:border-slate-800 shadow-xl">
                  {deployments.map((d) => {
                    const dId = String(d.id || d.dive_job_id || d.rov_job_id);
                    const isCurrent = String(activeDep?.id) === dId;
                    return (
                      <SelectItem key={dId} value={dId} className="text-xs py-2">
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {d.jobNo || d.dive_no || `JOB-${dId}`} {isCurrent ? "(Current)" : ""}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {d.name || d.diver_name || d.rov_system || ""} • {d.date || d.dive_date || d.status || ""}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Target Tape Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Film className="w-3 h-3 text-blue-500" />
                Target Video Tape ({transferScope === "DIFFERENT_DIVE" ? `For Selected ${jobTerm}` : "Current Deployment"})
              </Label>
              {loadingDiveTapes && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
            </div>

            {availableTapes.length > 0 ? (
              <Select value={targetTapeId} onValueChange={setTargetTapeId}>
                <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder="Select target tape..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-950 dark:border-slate-800 shadow-xl">
                  {availableTapes.map((t) => (
                    <SelectItem key={t.tape_id} value={String(t.tape_id)} className="text-xs py-2">
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{t.tape_no}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Ch: {t.chapter_no || 1} • {t.status || "ACTIVE"}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
                <span>No tapes found for this {jobTerm}. A primary tape will be auto-created on transfer.</span>
                <Badge variant="outline" className="text-[9px] font-mono uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300">
                  Auto-Create Tape
                </Badge>
              </div>
            )}
          </div>

          {/* Detected Target Timeline & Boundaries */}
          <div className="p-3.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-blue-600" />
                Target Timeline Boundaries ({activeDiveObj?.jobNo || `Job #${targetDiveId}`})
              </span>
              {loadingLogs ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              ) : (
                <Badge variant="outline" className="text-[9px] h-4 bg-white/80 dark:bg-slate-900 text-blue-600 border-blue-200 dark:border-blue-800">
                  {boundaryInfo?.hasLogs ? "Active Video Log" : "Target Deployment Timeline"}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block">Target Date</span>
                <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {boundaryInfo?.tapeDate || activeDiveObj?.date || "Current Date"}
                </span>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block">Time Window</span>
                <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {boundaryInfo?.tapeStartTime ? `${boundaryInfo.tapeStartTime} - ${boundaryInfo.tapeEndTime || "..."}` : "Flexible"}
                </span>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block">Valid Counter</span>
                <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {formatCounter(boundaryInfo?.minCounter || 0)} - {formatCounter(boundaryInfo?.maxCounter || 7200)}
                </span>
              </div>
            </div>
          </div>

          {/* Alignment Mode Selection */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Date, Time & Counter Alignment Strategy
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAlignMode("AUTO")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  alignMode === "AUTO"
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500 text-slate-900 dark:text-white"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center gap-1.5 font-black text-xs text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Auto-Align to Target (Recommended)
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Aligns inspection date to the new {jobTerm}/tape, recalculates timestamps inside the time window, and clamps counter.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAlignMode("KEEP")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  alignMode === "KEEP"
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500 text-slate-900 dark:text-white"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Keep Original Values
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Transfers {jobTerm} & tape references only. Preserves original date, time, and counter values without re-alignment.
                </p>
              </button>
            </div>
          </div>

          {/* Preview of Transferred Records */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Preview Events ({selectedRecords.length})
            </Label>
            <ScrollArea className="h-32 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-2">
              <div className="space-y-1.5 text-xs">
                {selectedRecords.map((r) => {
                  const adjusted = getAdjustedRecordData(r);
                  const typeName = r.inspection_type?.name || r.inspection_type_code || r.inspection_data?.event_name || "Inspection Event";
                  const compName = r.structure_components?.q_id || r.structure_components?.name || r.component_qid || r.inspection_data?.event_position || "-";
                  const originalDiveNo = r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.job_no || activeDep?.jobNo || "N/A";
                  const originalTapeNo = r.insp_video_tapes?.tape_no || "N/A";

                  return (
                    <div
                      key={r.insp_id}
                      className="p-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{typeName}</span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {originalDiveNo} ({originalTapeNo}) <ArrowRight className="w-2.5 h-2.5 inline mx-0.5" /> {activeDiveObj?.jobNo || "Target Dive"} ({targetTape?.tape_no || "Auto Tape"})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-right font-mono text-[11px]">
                        <div className="flex flex-col items-end">
                          <span className="text-slate-400 line-through text-[9px]">{r.inspection_date || "-"} {r.inspection_time || ""} ({formatCounter(r.tape_count_no || 0)})</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400 text-[10px]">{adjusted.inspection_date} {adjusted.inspection_time} ({adjusted.timecode})</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmTransfer}
            disabled={isSubmitting || selectedRecords.length === 0}
            className="text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                Transfer {selectedRecords.length} Event{selectedRecords.length > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
