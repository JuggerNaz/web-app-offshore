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

// DIVE ACTIONS
const AIR_DIVE_ACTIONS = [
    { label: "Left Surface", value: "LEAVING_SURFACE", location: "Surface" },
    { label: "Arrived Bottom", value: "AT_WORKSITE", location: "Bottom" },
    { label: "Diver at Worksite", value: "AT_WORKSITE", location: "Worksite" },
    { label: "Diver Left Worksite", value: "LEAVING_WORKSITE", location: "Worksite" },
    { label: "Left Bottom", value: "LEAVING_WORKSITE", location: "Bottom" },
    { label: "Arrived Surface", value: "BACK_TO_SURFACE", location: "Surface" }
];

const BELL_DIVE_ACTIONS = [
    { value: "Left Surface", label: "Left Surface", location: "Surface" },
    { value: "Arrived Bottom", label: "Arrived Bottom", location: "Bottom" },
    { value: "Diver Left Bell", label: "Diver Left Bell", location: "Bell" },
    { value: "Diver Return Bell", label: "Diver Return Bell", location: "Bell" },
    { value: "Left Bottom", label: "Left Bottom", location: "Bottom" },
    { value: "Bell on Surface", label: "Bell on Surface", location: "Surface" },
    { value: "TUP Complete", label: "TUP Complete", location: "Surface" }
];

interface DiveMovementLogProps {
    diveJob: any;
    onRefresh?: () => void;
}

interface Movement {
    id?: number;
    timestamp: string;
    activity: string;
    notes: string;
    location?: string;
}

export default function DiveMovementLog({ diveJob, onRefresh }: DiveMovementLogProps) {
    const supabase = createClient();
    const { activeCompanyId } = useUserProfile();

    const diveActionsList = ((diveJob?.dive_type?.toUpperCase() || "AIR")).includes("BELL") || ((diveJob?.dive_type?.toUpperCase() || "AIR")).includes("SAT") ? BELL_DIVE_ACTIONS : AIR_DIVE_ACTIONS;

    const [movements, setMovements] = useState<Movement[]>([]);
    const [activeSchema, setActiveSchema] = useState<"corrected" | "standard" | null>(null);
    const [newDate, setNewDate] = useState<string>(() => toLocalDateString(new Date()));
    const [newTime, setNewTime] = useState<string>(() => toLocalTimeString(new Date(), true));
    const [newActivity, setNewActivity] = useState<string>("");
    const [newNotes, setNewNotes] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDate, setEditDate] = useState<string>("");
    const [editTime, setEditTime] = useState<string>("");
    const [editActivity, setEditActivity] = useState<string>("");
    const [editNotes, setEditNotes] = useState<string>("");
    const [editLocation, setEditLocation] = useState<string>("");

    useEffect(() => {
        if (diveJob) {
            loadMovements();
        }
    }, [diveJob]);

    async function loadMovements() {
        if (!diveJob) return;

        try {
            // Support both mapped object {id, raw} and raw object {dive_job_id}
            const rawId = diveJob.dive_job_id || diveJob.id;
            const depId = Number(rawId);
            
            if (isNaN(depId)) {
                console.warn("[DiveMovementLog] Invalid Dive Job ID:", rawId, diveJob);
                return;
            }

            let data: any[] | null = null;

            // Try corrected schema (movement_time, movement_type, remarks) first
            const tryCorrected = await supabase
                .from("insp_dive_movements")
                .select("*")
                .eq("dive_job_id", depId)
                .order("movement_time", { ascending: false });

            if (!tryCorrected.error) {
                setActiveSchema("corrected");
                data = (tryCorrected.data || []).map((row: any) => ({
                    id: Number(row.movement_id || row.id),
                    timestamp: row.movement_time || row.timestamp,
                    activity: row.movement_type || row.activity,
                    notes: row.remarks || row.notes || "",
                    location: row.location || "N/A"
                }));
            } else {
                // Fallback to standard schema (timestamp, activity, notes)
                const tryStandard = await supabase
                    .from("insp_dive_movements")
                    .select("*")
                    .eq("dive_job_id", depId)
                    .order("timestamp", { ascending: false });

                if (tryStandard.error) {
                    console.error("[DiveMovementLog] Supabase error loading movements:", tryStandard.error.message, tryStandard.error.details);
                    throw tryStandard.error;
                }
                
                setActiveSchema("standard");
                data = (tryStandard.data || []).map((row: any) => ({
                    id: Number(row.id),
                    timestamp: row.timestamp,
                    activity: row.activity,
                    notes: row.notes || "",
                    location: row.location || "N/A"
                }));
            }

            setMovements(data || []);
        } catch (error: any) {
            console.error("Error loading movements:", error?.message || error);
        }
    }

    async function handleAddMovement() {
        if (!diveJob) {
            toast.error("No active dive job");
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

        if (!newActivity) {
            toast.error("Action is required");
            return;
        }

        setLoading(true);

        try {
            const depId = Number(diveJob.id || diveJob.dive_job_id);
            const compId = diveJob.company_id || activeCompanyId || null;
            const finalTime = combineLocalDateAndTimeToUtcIso(newDate, newTime);
            const selectedAction = diveActionsList.find(a => a.label === newActivity || a.value === newActivity);

            let insertPayload: Record<string, any> = {
                company_id: compId,
            };
            if (activeSchema === "corrected") {
                insertPayload.dive_job_id = depId;
                insertPayload.movement_time = finalTime;
                insertPayload.movement_type = newActivity;
                insertPayload.remarks = newNotes;
            } else {
                insertPayload.dive_job_id = depId;
                insertPayload.timestamp = finalTime;
                insertPayload.activity = newActivity;
                insertPayload.notes = newNotes;
                insertPayload.location = selectedAction?.location || "N/A";
            }

            const { error } = await supabase.from("insp_dive_movements").insert(insertPayload);

            if (error) throw error;

            // Auto-stop active video log if diver reaches surface/recovered
            const actLower = (newActivity || "").toLowerCase();
            const isRecovery =
                actLower.includes("surface") ||
                actLower.includes("recovered") ||
                actLower.includes("tms") ||
                actLower.includes("deck") ||
                actLower.includes("chamber");

            if (isRecovery) {
                try {
                    // Find active video tape for this dive job
                    const { data: activeTape } = await supabase
                        .from("insp_video_tapes")
                        .select("tape_id")
                        .eq("dive_job_id", depId)
                        .order("tape_id", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (activeTape?.tape_id) {
                        // Check if latest video log is recording or paused (not END)
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
                                remarks: "Auto-stopped: Diver returned to surface/chamber/recovered",
                                company_id: compId,
                            });
                            console.log("[AutoStop] Video log automatically stopped on diver recovery.");
                        }
                    }
                } catch (vErr) {
                    console.warn("[AutoStop] Warning stopping active video log on dive movement:", vErr);
                }
            }

            toast.success("Movement logged");
            setNewActivity("");
            setNewNotes("");
            setNewDate(toLocalDateString(new Date()));
            setNewTime(toLocalTimeString(new Date(), true));
            await loadMovements();
            onRefresh?.();
        } catch (error: any) {
            console.error("Error adding movement:", error);
            toast.error(error.message || "Failed to log movement");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteMovement(id: number) {
        if (!confirm("Are you sure you want to delete this log?")) return;
        try {
            const pkField = activeSchema === "corrected" ? "movement_id" : "id";
            const { error } = await supabase.from("insp_dive_movements").delete().eq(pkField, id);
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
            const selectedAction = diveActionsList.find(a => a.label === editActivity || a.value === editActivity);
            const pkField = activeSchema === "corrected" ? "movement_id" : "id";
            const finalTime = combineLocalDateAndTimeToUtcIso(editDate, editTime);

            let updatePayload: Record<string, any> = {};

            if (activeSchema === "corrected") {
                updatePayload.movement_time = finalTime;
                updatePayload.movement_type = editActivity;
                updatePayload.remarks = editNotes;
            } else {
                updatePayload.timestamp = finalTime;
                updatePayload.activity = editActivity;
                updatePayload.notes = editNotes;
                updatePayload.location = selectedAction?.location || editLocation || "N/A";
            }

            const { error } = await supabase
                .from("insp_dive_movements")
                .update(updatePayload)
                .eq(pkField, editingId);

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
            <Card className="p-4 shadow-md h-fit border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                    <Plus className="h-4 w-4 text-blue-600" />
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">Log Dive Movement</h3>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="dive_movement_date" className="text-xs font-bold text-slate-700 dark:text-slate-300">Date *</Label>
                            <Input
                                id="dive_movement_date"
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs h-9 font-medium"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="dive_movement_time" className="text-xs font-bold text-slate-700 dark:text-slate-300">Time (Local - 12h or 24h) *</Label>
                            <SmartTimeInput
                                id="dive_movement_time"
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
                            value={newActivity}
                            onValueChange={(val) => setNewActivity(val)}
                        >
                            <SelectTrigger id="activity" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                <SelectValue placeholder="Select an action..." />
                            </SelectTrigger>
                            <SelectContent>
                                {diveActionsList.map(action => (
                                    <SelectItem key={action.label} value={action.label}>{action.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes/Remarks</Label>
                        <Textarea
                            id="notes"
                            value={newNotes}
                            onChange={(e) => setNewNotes(e.target.value)}
                            placeholder="Additional details..."
                            rows={3}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        />
                    </div>

                    <Button
                        onClick={handleAddMovement}
                        disabled={loading || !diveJob}
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Plus className="h-4 w-4" />
                        {loading ? "Logging..." : "Add Movement"}
                    </Button>
                </div>
            </Card>

            {/* Right: Movement History */}
            <Card className="p-4 shadow-md h-[400px] xl:h-[calc(100vh-250px)] min-h-[350px] flex flex-col border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-blue-600" />
                        <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">Movement History</h3>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-[10px] px-1.5 h-5">{movements.length} entries</Badge>
                </div>

                <div className="space-y-3 overflow-y-auto pr-2 flex-grow scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {movements.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                            <p className="text-sm text-muted-foreground">
                                No movements logged yet
                            </p>
                        </div>
                    ) : (
                        movements.map((movement, index) => {
                            // Calculate elapsed using oldest array movement as baseline
                            const oldestMovement = movements[movements.length - 1];
                            const baselineMs = oldestMovement ? parseClientDate(oldestMovement.timestamp).getTime() : 0;
                            const currentMs = parseClientDate(movement.timestamp).getTime();
                            const diffMs = currentMs - baselineMs;

                            const hrs = Math.floor(Math.max(0, diffMs) / (1000 * 60 * 60));
                            const mins = Math.floor((Math.max(0, diffMs) % (1000 * 60 * 60)) / (1000 * 60));
                            const secs = Math.floor((Math.max(0, diffMs) % (1000 * 60)) / 1000);
                            const elapsedStr = `+${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                            return (
                                <div
                                    key={movement.id || index}
                                    className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                                                <Clock className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-mono text-sm font-black text-slate-800 dark:text-slate-200 leading-none">
                                                    {formatTime(movement.timestamp || new Date().toISOString())}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider text-blue-600/70">Elapsed {elapsedStr}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                                {formatDate(movement.timestamp || new Date().toISOString())}
                                            </span>
                                            {editingId !== movement.id && (
                                                <>
                                                    <button onClick={() => {
                                                        setEditingId(movement.id as number);
                                                        setEditDate(toLocalDateString(movement.timestamp));
                                                        setEditTime(toLocalTimeString(movement.timestamp, true));
                                                        setEditActivity(movement.activity);
                                                        setEditNotes(movement.notes || "");
                                                        setEditLocation(movement.location || "N/A");
                                                    }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-600 transition" title="Modify Event"><Edit className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => handleDeleteMovement(movement.id as number)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-slate-400 hover:text-red-500 transition" title="Delete Event"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {editingId === movement.id ? (
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
                                                    value={diveActionsList.find(a => a.value === editActivity || a.label === editActivity)?.label || editActivity || ""}
                                                    onValueChange={(val) => setEditActivity(val)}
                                                >
                                                    <SelectTrigger className="h-8 font-bold text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                        <SelectValue placeholder="Action..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {diveActionsList.map(action => (
                                                            <SelectItem key={`edit-${action.label}`} value={action.label}>{action.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Notes/Remarks</Label>
                                                <Textarea
                                                    value={editNotes}
                                                    onChange={(e) => setEditNotes(e.target.value)}
                                                    className="min-h-[55px] text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                    placeholder="Notes..."
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-7 text-xs font-bold"><X className="w-3 h-3 mr-1" /> Cancel</Button>
                                                <Button variant="default" size="sm" onClick={handleUpdateMovement} className="h-7 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md"><Save className="w-3 h-3 mr-1" /> Save Update</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs font-medium text-slate-500 min-w-[70px]">
                                                    Action:
                                                </span>
                                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {diveActionsList.find(a => a.value === movement.activity || a.label === movement.activity)?.label || movement.activity}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs font-medium text-slate-500 min-w-[70px]">
                                                    Location:
                                                </span>
                                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                                    {movement.location || "N/A"}
                                                </span>
                                            </div>

                                            {movement.notes && (
                                                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                                    <span className="text-xs font-medium text-slate-500 min-w-[70px]">
                                                        Notes:
                                                    </span>
                                                    <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                                        {movement.notes}
                                                    </span>
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
