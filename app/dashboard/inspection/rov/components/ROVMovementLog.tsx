"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, ListChecks, Trash2, Edit, Save, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { useUserProfile } from "@/components/user-profile-provider";

import { parseClientDate, formatClientTime, formatClientDate, toLocalDateString, toLocalTimeString, combineLocalDateAndTimeToUtcIso } from "@/utils/client-date";
import { SmartTimeInput } from "@/components/ui/smart-time-input";

const ROV_ACTIONS = [
    { label: "Rov On Hire" },
    { label: "Rov Launched" },
    { label: "Rov at the Worksite" },
    { label: "Rov Leaving the Worksite" },
    { label: "Rov Back to TMS" },
    { label: "Rov Recovered" },
    { label: "Rov Off Hire" }
];

interface ROVMovementLogProps {
    diveJob: any;
    onRefresh?: () => void;
}

interface Movement {
    movement_id?: number;
    movement_time: string;
    movement_type: string;
    remarks: string;
}

export default function ROVMovementLog({ diveJob, onRefresh }: ROVMovementLogProps) {
    const supabase = createClient();
    const { activeCompanyId } = useUserProfile();

    const [movements, setMovements] = useState<Movement[]>([]);
    const [newDate, setNewDate] = useState<string>(() => toLocalDateString(new Date()));
    const [newTime, setNewTime] = useState<string>(() => toLocalTimeString(new Date(), true));
    const [newAction, setNewAction] = useState<string>("");
    const [newRemarks, setNewRemarks] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDate, setEditDate] = useState<string>("");
    const [editTime, setEditTime] = useState<string>("");
    const [editAction, setEditAction] = useState<string>("");
    const [editRemarks, setEditRemarks] = useState<string>("");

    useEffect(() => {
        if (diveJob) {
            loadMovements();
        }
    }, [diveJob]);

    async function loadMovements() {
        if (!diveJob) return;

        try {
            // Support both mapped object {id, raw} and raw object {rov_job_id}
            const rawId = diveJob.rov_job_id || diveJob.id;
            const depId = Number(rawId);
            
            if (isNaN(depId)) {
                console.warn("[ROVMovementLog] Invalid ROV Job ID:", rawId, diveJob);
                return;
            }

            const { data, error } = await supabase
                .from("insp_rov_movements")
                .select("*")
                .eq("rov_job_id", depId)
                .order("movement_time", { ascending: false });

            if (error) {
                console.error("[ROVMovementLog] Supabase error loading movements:", error.message, error.details);
                throw error;
            }
            setMovements(data || []);
        } catch (error: any) {
            console.error("Error loading movements:", error?.message || error);
        }
    }

    async function handleAddMovement() {
        if (!diveJob) {
            toast.error("No active ROV deployment");
            return;
        }

        if (!newDate) {
            toast.error("Date is required");
            return;
        }

        if (!newTime) {
            toast.error("Time is required");
            return;
        }

        if (!newAction) {
            toast.error("Action is required");
            return;
        }

        setLoading(true);

        try {
            const depId = Number(diveJob.id || diveJob.rov_job_id);
            const compId = diveJob.company_id || activeCompanyId || null;
            const finalTime = combineLocalDateAndTimeToUtcIso(newDate, newTime);

            const { error } = await supabase.from("insp_rov_movements").insert({
                rov_job_id: depId,
                movement_time: finalTime,
                movement_type: newAction,
                remarks: newRemarks,
                company_id: compId,
            });

            if (error) throw error;

            // Auto-stop active video log if ROV recovered / back to surface / TMS
            const mTypeLower = (newAction || "").toLowerCase();
            const isRecovery =
                mTypeLower.includes("surface") ||
                mTypeLower.includes("recovered") ||
                mTypeLower.includes("tms") ||
                mTypeLower.includes("deck");

            if (isRecovery) {
                try {
                    const { data: activeTape } = await supabase
                        .from("insp_video_tapes")
                        .select("tape_id")
                        .eq("rov_job_id", depId)
                        .order("tape_id", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (activeTape?.tape_id) {
                        const { data: latestVideoLog } = await supabase
                            .from("insp_video_logs")
                            .select("*")
                            .eq("tape_id", activeTape.tape_id)
                            .order("event_time", { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (latestVideoLog && latestVideoLog.event_type !== "END") {
                            await supabase.from("insp_video_logs").insert({
                                tape_id: activeTape.tape_id,
                                event_type: "END",
                                event_time: finalTime,
                                timecode_start: latestVideoLog.timecode_start || "00:00:00",
                                tape_counter_start: latestVideoLog.tape_counter_start || 0,
                                remarks: "Auto-stopped: ROV returned to surface/TMS/recovered",
                                company_id: compId,
                            });
                            console.log("[AutoStop] Video log automatically stopped on ROV recovery.");
                        }
                    }
                } catch (vErr) {
                    console.warn("[AutoStop] Warning stopping active video log on ROV movement:", vErr);
                }
            }

            toast.success("Movement logged");
            setNewAction("");
            setNewRemarks("");
            setNewDate(toLocalDateString(new Date()));
            setNewTime(toLocalTimeString(new Date(), true));
            await loadMovements();
            onRefresh?.();
        } catch (error: any) {
            console.error("Error adding movement:", error);
            toast.error(error.message || "Failed to log movement. Did you run the SQL to drop the 'chk_rov_movement_type' constraint?");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteMovement(id: number) {
        if (!confirm("Are you sure you want to delete this log?")) return;
        try {
            const { error } = await supabase.from("insp_rov_movements").delete().eq("movement_id", id);
            if (error) throw error;
            toast.success("Movement deleted");
            await loadMovements();
            onRefresh?.();
        } catch (error: any) {
            console.error("Error deleting movement:", error);
            toast.error(error.message || "Failed to delete movement");
        }
    }

    async function handleUpdateMovement() {
        if (!editingId) return;
        try {
            const updatedUtc = combineLocalDateAndTimeToUtcIso(editDate, editTime);
            const { error } = await supabase.from("insp_rov_movements").update({
                movement_time: updatedUtc,
                movement_type: editAction,
                remarks: editRemarks
            }).eq("movement_id", editingId);
            if (error) throw error;
            toast.success("Movement updated");
            setEditingId(null);
            await loadMovements();
            onRefresh?.();
        } catch (error: any) {
            console.error("Error updating movement:", error);
            toast.error(error.message || "Failed to update movement");
        }
    }

    function formatTime(timestamp: string): string {
        return formatClientTime(timestamp);
    }

    function formatDate(timestamp: string): string {
        return formatClientDate(timestamp, "MMM dd, yyyy");
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Left: Add New Movement */}
            <Card className="p-4 shadow-md h-fit border-cyan-100 dark:border-cyan-900/40">
                <div className="flex items-center gap-2 mb-4">
                    <Plus className="h-4 w-4 text-cyan-600" />
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">Log ROV Movement</h3>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="movement_date" className="text-xs font-bold text-slate-700 dark:text-slate-300">Date *</Label>
                            <Input
                                id="movement_date"
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs h-9 font-medium"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="movement_time" className="text-xs font-bold text-slate-700 dark:text-slate-300">Time (Local - 12h or 24h) *</Label>
                            <SmartTimeInput
                                id="movement_time"
                                value={newTime}
                                onChange={(val) => setNewTime(val)}
                                includeSeconds={true}
                                className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="activity">Action *</Label>
                        <Select
                            value={newAction}
                            onValueChange={(val) => setNewAction(val)}
                        >
                            <SelectTrigger id="activity" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                <SelectValue placeholder="Select an action..." />
                            </SelectTrigger>
                            <SelectContent>
                                {ROV_ACTIONS.map(action => (
                                    <SelectItem key={action.label} value={action.label}>{action.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes/Remarks</Label>
                        <Textarea
                            id="notes"
                            value={newRemarks}
                            onChange={(e) => setNewRemarks(e.target.value)}
                            placeholder="Additional details..."
                            rows={3}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        />
                    </div>

                    <Button
                        onClick={handleAddMovement}
                        disabled={loading || !diveJob}
                        className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                        <Plus className="h-4 w-4" />
                        {loading ? "Logging..." : "Add Event"}
                    </Button>
                </div>
            </Card>

            {/* Right: Movement History */}
            <Card className="p-4 shadow-md h-[400px] xl:h-[calc(100vh-250px)] min-h-[350px] flex flex-col border-cyan-100 dark:border-cyan-900/40 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-cyan-600" />
                        <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">Execution Timeline</h3>
                    </div>
                    <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 text-[10px] px-1.5 h-5">{movements.length} logged</Badge>
                </div>

                <div className="space-y-3 overflow-y-auto pr-2 flex-grow scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {movements.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                            <p className="text-sm text-slate-500 font-medium">
                                Timeline is empty
                            </p>
                        </div>
                    ) : (
                        movements.map((movement, index) => {
                            // Calculate elapsed using oldest array movement as baseline
                            const oldestMovement = movements[movements.length - 1];
                            const baselineMs = oldestMovement ? parseClientDate(oldestMovement.movement_time).getTime() : 0;
                            const currentMs = parseClientDate(movement.movement_time).getTime();
                            const diffMs = currentMs - baselineMs;

                            const hrs = Math.floor(Math.max(0, diffMs) / (1000 * 60 * 60));
                            const mins = Math.floor((Math.max(0, diffMs) % (1000 * 60 * 60)) / (1000 * 60));
                            const secs = Math.floor((Math.max(0, diffMs) % (1000 * 60)) / 1000);
                            const elapsedStr = `+${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                            return (
                                <div
                                    key={movement.movement_id || index}
                                    className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-300 dark:hover:border-cyan-700 shadow-sm transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center shrink-0">
                                                <Clock className="h-4 w-4 text-cyan-600" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-mono text-sm font-black text-slate-800 dark:text-slate-200 leading-none">
                                                    {formatTime(movement.movement_time || new Date().toISOString())}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider text-cyan-600/70">Elapsed {elapsedStr}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                                {formatDate(movement.movement_time || new Date().toISOString())}
                                            </span>
                                            {editingId !== movement.movement_id && (
                                                <>
                                                    <button onClick={() => {
                                                        setEditingId(movement.movement_id as number);
                                                        setEditDate(toLocalDateString(movement.movement_time));
                                                        setEditTime(toLocalTimeString(movement.movement_time, true));
                                                        setEditAction(movement.movement_type);
                                                        setEditRemarks(movement.remarks || "");
                                                    }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-600 transition" title="Modify Event"><Edit className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => handleDeleteMovement(movement.movement_id as number)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-slate-400 hover:text-red-500 transition" title="Delete Event"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {editingId === movement.movement_id ? (
                                        <div className="space-y-2.5 mt-4 pb-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Date *</Label>
                                                    <Input
                                                        type="date"
                                                        value={editDate}
                                                        onChange={(e) => setEditDate(e.target.value)}
                                                        className="h-8 font-medium text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Time (Local - 12h or 24h) *</Label>
                                                    <SmartTimeInput
                                                        value={editTime}
                                                        onChange={(val) => setEditTime(val)}
                                                        includeSeconds={true}
                                                        className="h-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Action *</Label>
                                                <Select
                                                    value={editAction}
                                                    onValueChange={(val) => setEditAction(val)}
                                                >
                                                    <SelectTrigger className="h-8 font-bold text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                        <SelectValue placeholder="Action..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ROV_ACTIONS.map(action => (
                                                            <SelectItem key={`edit-${action.label}`} value={action.label}>{action.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Notes/Remarks</Label>
                                                <Textarea
                                                    value={editRemarks}
                                                    onChange={(e) => setEditRemarks(e.target.value)}
                                                    className="min-h-[55px] text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                    placeholder="Notes..."
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-7 text-xs font-bold"><X className="w-3 h-3 mr-1" /> Cancel</Button>
                                                <Button variant="default" size="sm" onClick={handleUpdateMovement} className="h-7 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-md"><Save className="w-3 h-3 mr-1" /> Save Update</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 ml-11">
                                            <div className="inline-block px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide border border-slate-200 dark:border-slate-700">
                                                {movement.movement_type}
                                            </div>

                                            {movement.remarks && (
                                                <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 font-medium whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 p-3 rounded border border-slate-100 dark:border-slate-800/80">
                                                    {movement.remarks}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </Card>
        </div>
    );
}
