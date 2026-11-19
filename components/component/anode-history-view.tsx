"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  History,
  RefreshCw,
  PlusCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Calendar,
  Briefcase,
  Activity,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Printer,
  Wrench,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getClientLocalDate, getClientTimePayload } from "@/utils/client-time";

interface AnodeHistoryViewProps {
  componentId: number;
  qId?: string;
  isFullPage?: boolean;
  onSpecUpdated?: (updatedComponent: any) => void;
}

export function AnodeHistoryView({
  componentId,
  qId,
  isFullPage = false,
  onSpecUpdated,
}: AnodeHistoryViewProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedHistIds, setExpandedHistIds] = useState<Record<number, boolean>>({});
  const [showCurrentReadings, setShowCurrentReadings] = useState(false);

  // Manual replacement modal state
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<number | null>(null);
  const [rollbackConfirmHist, setRollbackConfirmHist] = useState<any>(null);

  const [newSpecForm, setNewSpecForm] = useState({
    thetype: "",
    material: "",
    fitting: "",
    position: "",
    type: "Retrofit",
    inst_date: getClientLocalDate(),
    life: "",
    jobpackId: "none",
    remarks: "",
  });

  const fetchHistory = useCallback(async () => {
    if (!componentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/structure-components/item/${componentId}/anode-history`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load anode history");
      }
      const payload = json?.data ?? json;
      setData(payload);
    } catch (err: any) {
      setError(err.message || "Failed to load anode history");
    } finally {
      setLoading(false);
    }
  }, [componentId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const openManualReplaceModal = () => {
    const cur = data?.currentSpec || {};
    setReplaceError(null);
    setNewSpecForm({
      thetype: cur.thetype || "",
      material: cur.material || "",
      fitting: cur.fitting || "",
      position: cur.position || "",
      type: "Retrofit",
      inst_date: getClientLocalDate(),
      life: cur.life || "",
      jobpackId: "none",
      remarks: "",
    });
    setReplaceModalOpen(true);
  };

  const handleManualReplace = async () => {
    setSubmitting(true);
    setReplaceError(null);
    try {
      const selectedJp =
        newSpecForm.jobpackId !== "none"
          ? (data?.jobpacks || []).find((j: any) => String(j.id) === newSpecForm.jobpackId)
          : null;
      const clientTime = getClientTimePayload();

      const res = await fetch(`/api/structure-components/item/${componentId}/anode-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "MANUAL",
          replacedDate: newSpecForm.inst_date || clientTime.clientLocalDate,
          jobpackId: selectedJp ? selectedJp.id : null,
          jobpackName: selectedJp ? selectedJp.name : null,
          remarks: newSpecForm.remarks || null,
          ...clientTime,
          newSpec: {
            thetype: newSpecForm.thetype || null,
            material: newSpecForm.material || null,
            fitting: newSpecForm.fitting || null,
            position: newSpecForm.position || null,
            type: newSpecForm.type || null,
            inst_date: newSpecForm.inst_date || clientTime.clientLocalDate,
            life: newSpecForm.life || null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || json?.message || "Replacement failed");
      }
      const result = json?.data ?? json;
      toast.success(
        `Anode replaced — previous spec archived as Generation #${result.generation_no || ""}${
          result.archived_records_count ? ` (${result.archived_records_count} prior readings archived)` : ""
        }.`
      );
      setReplaceModalOpen(false);
      await fetchHistory();
      if (result.updatedComponent && onSpecUpdated) {
        onSpecUpdated(result.updatedComponent);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to replace anode";
      setReplaceError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRollback = async (hist: any) => {
    setRollingBackId(hist.id);
    try {
      const clientTime = getClientTimePayload();
      const res = await fetch(
        `/api/structure-components/item/${componentId}/anode-history?historyId=${hist.id}&clientTimestamp=${encodeURIComponent(clientTime.clientTimestamp)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || json?.message || "Rollback failed");
      }
      const result = json?.data ?? json;
      toast.success(
        `Rolled back to Generation #${hist.generation_no} spec${
          result.restored_records_count ? ` (${result.restored_records_count} readings restored to active anode)` : ""
        }.`
      );
      setRollbackConfirmHist(null);
      await fetchHistory();
      if (result.updatedComponent && onSpecUpdated) {
        onSpecUpdated(result.updatedComponent);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to roll back replacement");
    } finally {
      setRollingBackId(null);
    }
  };

  const resolveLib = (code: string, val: any) => {
    if (val === null || val === undefined || val === "") return "—";
    const map = data?.libraryMap?.[code];
    if (map && map[String(val)]) return map[String(val)];
    return String(val);
  };

  const formatCp = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return "N/A";
    return `${val} mV`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading Anode replacement history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 p-6 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
        <Button size="sm" variant="outline" onClick={fetchHistory}>
          Retry
        </Button>
      </div>
    );
  }

  const currentSpec = data?.currentSpec || {};
  const history: any[] = data?.history || [];
  const currentReadings = data?.currentReadings || {};
  const libraryMap = data?.libraryMap || {};
  const displayQid = qId || data?.component?.q_id || `Component #${componentId}`;

  return (
    <div className="space-y-6">
      {data?.migrationPending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Database migration <code>20261119_anode_spec_history.sql</code> has not been applied yet. Apply it in Supabase to enable historical archiving and replacements.
          </span>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            Anode Replacement History — <span className="font-mono text-blue-600 dark:text-blue-400">{displayQid}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tracks every anode replacement for this QID, archived specifications, and generation-isolated CP & depletion readings.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={fetchHistory}
            className="rounded-xl h-9 text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={openManualReplaceModal}
            className="rounded-xl h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            Manual Replace Anode
          </Button>
          {isFullPage && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="rounded-xl h-9 text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            Total Replacements
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {data?.replacementCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Active Generation #{data?.activeGeneration || 1}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            Current Active Since
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1.5 truncate">
            {currentSpec.inst_date || "Not Set"}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Design Life: {currentSpec.life ? `${currentSpec.life} yrs` : "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            Current Anode CP
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1.5">
            {currentReadings.cpCount > 0
              ? `${formatCp(currentReadings.cpMin)} / ${formatCp(currentReadings.cpMax)}`
              : "No Readings"}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {currentReadings.cpCount || 0} active CP reading(s)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            Current Depletion
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {currentReadings.latestDepletion !== null && currentReadings.latestDepletion !== undefined
              ? `${currentReadings.latestDepletion}%`
              : "—"}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {currentReadings.latestDepletionDate || "No depletion recorded"}
          </div>
        </div>
      </div>

      {/* Current Active Anode Card */}
      <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-wider">
              CURRENT ACTIVE · GEN #{data?.activeGeneration || 1}
            </Badge>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Used for all current CP statistics & anode life forecasts
            </span>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {currentReadings.readings?.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowCurrentReadings((v) => !v)}
                className="h-7 text-xs font-bold text-emerald-700 dark:text-emerald-400"
              >
                {showCurrentReadings ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                {currentReadings.readings.length} Active Inspection Record(s)
              </Button>
            )}
            {history.length > 0 && history[0]?.replacement_source === "MANUAL" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRollbackConfirmHist(history[0])}
                className="h-7 text-xs font-bold text-rose-600 border-rose-200 bg-white hover:bg-rose-50 dark:bg-slate-950 dark:border-rose-900 dark:hover:bg-rose-950/30"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Delete &amp; Rollback
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Anode Type</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {resolveLib("ANOD_TYP", currentSpec.thetype)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Material Alloy</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {resolveLib("ANOD_MAT", currentSpec.material)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Fitting</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {resolveLib("FITTING", currentSpec.fitting)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Position</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {resolveLib("POSITION", currentSpec.position)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Installed Type</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {currentSpec.type || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Install Date</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {currentSpec.inst_date || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Design Life</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {currentSpec.life ? `${currentSpec.life} years` : "—"}
            </div>
          </div>
        </div>

        {showCurrentReadings && currentReadings.readings?.length > 0 && (
          <div className="border-t border-emerald-200/60 dark:border-emerald-900/40 pt-3">
            <ReadingsMiniTable readings={currentReadings.readings} />
          </div>
        )}
      </div>

      {/* Historical Archived Anodes */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
          Archived / Historical Anode Specifications ({history.length})
        </h4>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500 text-xs space-y-2">
            <History className="w-7 h-7 mx-auto text-slate-300" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No historical replacements recorded yet</p>
            <p>
              When this anode is replaced via <strong>Anode Maintenance (ANMAIN)</strong> or <strong>Manual Replace Anode</strong>, the previous specification and its CP/depletion readings will be archived here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((h, idx) => {
              const isLatestHist = idx === 0;
              const isExpanded = !!expandedHistIds[h.id];
              const rs = h.readingsSummary || {};

              return (
                <div
                  key={h.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 space-y-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-black text-[10px] uppercase tracking-wider">
                        HISTORICAL · GEN #{h.generation_no}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold uppercase flex items-center gap-1",
                          h.replacement_source === "ANMAIN"
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                            : "border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
                        )}
                      >
                        {h.replacement_source === "ANMAIN" ? (
                          <FileCheck2 className="w-3 h-3" />
                        ) : (
                          <Wrench className="w-3 h-3" />
                        )}
                        {h.replacement_source === "ANMAIN" ? "ANMAIN Task" : "Manual Replace"}
                      </Badge>
                      {h.replaced_by_jobpack_name && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          Jobpack: <strong>{h.replaced_by_jobpack_name}</strong>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Active: {h.effective_from || h.inst_date || "Unknown"} →{" "}
                        <strong className="text-slate-700 dark:text-slate-200">{h.effective_to}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                      {rs.readings?.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedHistIds((prev) => ({ ...prev, [h.id]: !prev[h.id] }))
                          }
                          className="h-7 text-xs font-bold text-blue-600 dark:text-blue-400"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                          Readings ({rs.readings.length})
                        </Button>
                      )}
                      {isLatestHist && h.replacement_source === "MANUAL" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setRollbackConfirmHist(h)}
                          className="h-7 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Delete &amp; Rollback
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Archived Parameters Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Anode Type</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {resolveLib("ANOD_TYP", h.anode_type)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Material Alloy</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {resolveLib("ANOD_MAT", h.material)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Fitting</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {resolveLib("FITTING", h.fitting)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Position</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {resolveLib("POSITION", h.position)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Installed Type</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {h.installed_type || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Install Date</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {h.inst_date || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Design Life</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {h.life ? `${h.life} years` : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Archived Readings Summary Strip */}
                  <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-50 dark:bg-slate-900/60 rounded-xl px-3.5 py-2.5">
                    <span>
                      <strong className="text-slate-500 uppercase text-[10px] mr-1">Historical CP:</strong>
                      {rs.cpCount > 0 ? (
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          Min {formatCp(rs.cpMin)} · Max {formatCp(rs.cpMax)} ({rs.cpCount} readings)
                        </span>
                      ) : (
                        <span className="text-slate-400">None recorded</span>
                      )}
                    </span>
                    <span>
                      <strong className="text-slate-500 uppercase text-[10px] mr-1">Final Depletion:</strong>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {rs.latestDepletion !== null && rs.latestDepletion !== undefined
                          ? `${rs.latestDepletion}%`
                          : "—"}
                      </span>
                    </span>
                    {h.replaced_at_local && (
                      <span className="text-slate-500">
                        <strong className="text-slate-500 uppercase text-[10px] mr-1">Recorded:</strong>
                        <span className="font-mono text-[11px]">{h.replaced_at_local}</span>
                        {h.client_timezone ? ` · ${h.client_timezone}` : ""}
                      </span>
                    )}
                    {h.remarks && (
                      <span className="text-slate-500 italic">Remarks: {h.remarks}</span>
                    )}
                  </div>

                  {isExpanded && rs.readings?.length > 0 && (
                    <div className="pt-1">
                      <ReadingsMiniTable readings={rs.readings} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Replacement Modal */}
      <Dialog open={replaceModalOpen} onOpenChange={setReplaceModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600" />
              Manual Anode Replacement — {displayQid}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Archives the current anode specification (and its prior CP/depletion readings) as{" "}
              <strong>Generation #{data?.activeGeneration || 1}</strong>, then replaces the active specification with the new anode details below.
            </DialogDescription>
          </DialogHeader>

          {replaceError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{replaceError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Replacement Jobpack (Optional)
              </Label>
              <Select
                value={newSpecForm.jobpackId}
                onValueChange={(v) => setNewSpecForm((f) => ({ ...f, jobpackId: v }))}
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Select Jobpack..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Jobpack / External Campaign</SelectItem>
                  {(data?.jobpacks || []).map((jp: any) => (
                    <SelectItem key={jp.id} value={String(jp.id)}>
                      {jp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Installed / Replacement Date *
              </Label>
              <Input
                type="date"
                value={newSpecForm.inst_date}
                onChange={(e) => setNewSpecForm((f) => ({ ...f, inst_date: e.target.value }))}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                New Anode Type
              </Label>
              <Select
                value={newSpecForm.thetype || "__empty"}
                onValueChange={(v) =>
                  setNewSpecForm((f) => ({ ...f, thetype: v === "__empty" ? "" : v }))
                }
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Select Anode Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty">— Unchanged / None —</SelectItem>
                  {Object.entries(libraryMap.ANOD_TYP || {}).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {String(label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Material Alloy
              </Label>
              <Select
                value={newSpecForm.material || "__empty"}
                onValueChange={(v) =>
                  setNewSpecForm((f) => ({ ...f, material: v === "__empty" ? "" : v }))
                }
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Select Material Alloy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty">— Unchanged / None —</SelectItem>
                  {Object.entries(libraryMap.ANOD_MAT || {}).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {String(label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Fitting Type
              </Label>
              <Select
                value={newSpecForm.fitting || "__empty"}
                onValueChange={(v) =>
                  setNewSpecForm((f) => ({ ...f, fitting: v === "__empty" ? "" : v }))
                }
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Select Fitting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty">— Unchanged / None —</SelectItem>
                  {Object.entries(libraryMap.FITTING || {}).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {String(label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Position
              </Label>
              <Select
                value={newSpecForm.position || "__empty"}
                onValueChange={(v) =>
                  setNewSpecForm((f) => ({ ...f, position: v === "__empty" ? "" : v }))
                }
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Select Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty">— Unchanged / None —</SelectItem>
                  {Object.entries(libraryMap.POSITION || {}).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {String(label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Installed Type
              </Label>
              <Select
                value={newSpecForm.type || "Retrofit"}
                onValueChange={(v) => setNewSpecForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retrofit">Retrofit</SelectItem>
                  <SelectItem value="Original">Original</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Design Life (Years)
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 20"
                value={newSpecForm.life}
                onChange={(e) => setNewSpecForm((f) => ({ ...f, life: e.target.value }))}
                className="rounded-xl h-10 text-xs"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Remarks / Replacement Reference
              </Label>
              <Textarea
                rows={2}
                placeholder="Optional notes (e.g. Replaced during external diving campaign, WO#...)"
                value={newSpecForm.remarks}
                onChange={(e) => setNewSpecForm((f) => ({ ...f, remarks: e.target.value }))}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReplaceModalOpen(false)}
              disabled={submitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleManualReplace}
              disabled={submitting || !newSpecForm.inst_date}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? "Archiving & Replacing..." : "Archive Old Spec & Apply New Spec"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Modal */}
      <Dialog
        open={!!rollbackConfirmHist}
        onOpenChange={(o) => {
          if (!o) setRollbackConfirmHist(null);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Delete Replacement &amp; Rollback Old Spec?
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will delete the latest replacement entry, restore <strong>Generation #{rollbackConfirmHist?.generation_no}</strong> back as the current active anode specification (including in the Specifications tab), and restore its archived CP/depletion readings back to active status without losing any prior data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRollbackConfirmHist(null)}
              disabled={rollingBackId !== null}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => rollbackConfirmHist && handleRollback(rollbackConfirmHist)}
              disabled={rollingBackId !== null}
              className="rounded-xl"
            >
              {rollingBackId !== null ? "Rolling back..." : "Confirm Rollback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReadingsMiniTable({ readings }: { readings: any[] }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
            <th className="p-2.5">Date</th>
            <th className="p-2.5">Inspection</th>
            <th className="p-2.5">CP Readings (mV)</th>
            <th className="p-2.5">Depletion</th>
            <th className="p-2.5">Findings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {readings.map((r) => (
            <tr key={r.insp_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
              <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{r.inspection_date || "—"}</td>
              <td className="p-2.5 font-bold">{r.inspection_type_code || "—"}</td>
              <td className="p-2.5 font-mono font-semibold text-blue-600 dark:text-blue-400">
                {r.cp_values?.length > 0 ? r.cp_values.map((v: number) => `${v} mV`).join(", ") : "—"}
              </td>
              <td className="p-2.5 font-semibold">
                {r.depletion !== null && r.depletion !== undefined ? `${r.depletion}%` : "—"}
              </td>
              <td className="p-2.5 text-slate-500 max-w-xs truncate">{r.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
