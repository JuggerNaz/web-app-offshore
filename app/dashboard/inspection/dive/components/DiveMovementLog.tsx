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

// DIVE ACTIONS
const AIR_DIVE_ACTIONS = [
    { label: "Left Surface", location: "Surface" },
    { label: "Arrived Bottom", location: "Bottom" },
    { label: "Diver at Worksite", location: "Worksite" },
    { label: "Diver Left Worksite", location: "Worksite" },
    { label: "Left Bottom", location: "Bottom" },
    { label: "Arrived Surface", location: "Surface" }
];

const BELL_DIVE_ACTIONS = [
    { label: "Left Surface", location: "Surface" },
    { label: "Bell at Working Depth", location: "Bottom" },
    { label: "Diver Locked Out", location: "Worksite" },
    { label: "Diver Locked In", location: "Bell" },
    { label: "Bell Left Bottom", location: "Bottom" },
    { label: "Bell on Surface", location: "Surface" },
    { label: "TUP Complete", location: "Deck" }
];

interface DiveMovementLogProps {
    diveJob: any;
}

interface Movement {
    movement_id?: number;
    movement_time: string;
    movement_type: string;
    remarks: string;
}

export default function DiveMovementLog({ diveJob }: DiveMovementLogProps) {
    const supabase = createClient();

    const diveActionsList = ((diveJob?.dive_type?.toUpperCase() || "AIR")).includes("BELL") || ((diveJob?.dive_type?.toUpperCase() || "AIR")).includes("SAT") ? BELL_DIVE_ACTIONS : AIR_DIVE_ACTIONS;

    const getLocalDatetimeString = (date = new Date()) => {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    const parseDbDate = (dateString?: string | null) => {
        if (!dateString) return new Date();
        const t = dateString.replace(' ', 'T');
        return new Date(t.includes('Z') || t.includes('+') ? t : `${t}Z`);
    };

    const [movements, setMovements] = useState<Movement[]>([]);
    const [newMovement, setNewMovement] = useState({
        movement_type: "",
        remarks: "",
        movement_time: getLocalDatetimeString(),
    });
    const [loading, setLoading] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Movement | null>(null);

    useEffect(() => {
        if (diveJob) {
            loadMovements();
        }
    }, [diveJob]);

    async function loadMovements() {
        if (!diveJob) return;

        try {
            const { data, error } = await supabase
                .from("insp_dive_movements")
                .select("*")
                .eq("dive_job_id", diveJob.dive_job_id)
                .order("movement_time", { ascending: false });

            if (error) throw error;

            setMovements(data || []);
        } catch (error) {
            console.error("Error loading movements:", error);
        }
    }

    async function handleAddMovement() {
        if (!diveJob) {
            toast.error("No active dive job");
            return;
        }

        if (!newMovement.movement_type) {
            toast.error("Action is required");
            return;
        }

        setLoading(true);

        try {
            const finalTime = newMovement.movement_time ? new Date(newMovement.movement_time).toISOString() : new Date().toISOString();

            const { error } = await supabase.from("insp_dive_movements").insert({
                dive_job_id: diveJob.dive_job_id,
                movement_time: finalTime,
                movement_type: newMovement.movement_type,
                remarks: newMovement.remarks,
            });

            if (error) throw error;

            toast.success("Movement logged");
            setNewMovement({ movement_type: "", remarks: "", movement_time: getLocalDatetimeString() });
            loadMovements();
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
            const { error } = await supabase.from("insp_dive_movements").delete().eq("movement_id", id);
            if (error) throw error;
            toast.success("Movement deleted");
            loadMovements();
        } catch (error: any) {
            console.error("Error deleting movement:", error);
            toast.error(error.message || "Failed to delete movement");
        }
    }

    async function handleUpdateMovement() {
        if (!editForm || !editForm.movement_id) return;
        try {
            const { error } = await supabase.from("insp_dive_movements").update({
                movement_time: new Date(editForm.movement_time).toISOString(),
                movement_type: editForm.movement_type,
                remarks: editForm.remarks
            }).eq("movement_id", editForm.movement_id);
            if (error) throw error;
            toast.success("Movement updated");
            setEditingId(null);
            loadMovements();
        } catch (error: any) {
            console.error("Error updating movement:", error);
            toast.error(error.message || "Failed to update movement");
        }
    }

    function formatTime(timestamp: string): string {
        const date = parseDbDate(timestamp);
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function formatDate(timestamp: string): string {
        const date = parseDbDate(timestamp);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    return (
        <div className="grid grid-cols-2 gap-6">
            {/* Left: Add New Movement */}
            <Card className="p-6 shadow-lg h-fit">
                <div className="flex items-center gap-2 mb-6">
                    <Plus className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-lg">Log Movement</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="movement_time">Time *</Label>
                        <Input
                            id="movement_time"
                            type="datetime-local"
                            value={newMovement.movement_time}
                            onChange={(e) =>
                                setNewMovement({ ...newMovement, movement_time: e.target.value })
                            }
                            className="bg-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="activity">Action *</Label>
                        <Select
                            value={newMovement.movement_type}
                            onValueChange={(val) => setNewMovement({ ...newMovement, movement_type: val })}
                        >
                            <SelectTrigger id="activity" className="bg-white">
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
                            value={newMovement.remarks}
                            onChange={(e) =>
                                setNewMovement({ ...newMovement, remarks: e.target.value })
                            }
                            placeholder="Additional details..."
                            rows={3}
                        />
                    </div>

                    <Button
                        onClick={handleAddMovement}
                        disabled={loading || !diveJob}
                        className="w-full gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        {loading ? "Logging..." : "Add Movement"}
                    </Button>
                </div>
            </Card>

            {/* Right: Movement History */}
            <Card className="p-6 shadow-lg h-[calc(100vh-200px)] min-h-[500px] flex flex-col">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div className="flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-blue-600" />
                        <h3 className="font-bold text-lg">Movement History</h3>
                    </div>
                    <Badge variant="secondary">{movements.length} entries</Badge>
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
                            const baselineMs = oldestMovement ? parseDbDate(oldestMovement.movement_time).getTime() : 0;
                            const currentMs = parseDbDate(movement.movement_time).getTime();
                            const diffMs = currentMs - baselineMs;

                            const hrs = Math.floor(Math.max(0, diffMs) / (1000 * 60 * 60));
                            const mins = Math.floor((Math.max(0, diffMs) % (1000 * 60 * 60)) / (1000 * 60));
                            const secs = Math.floor((Math.max(0, diffMs) % (1000 * 60)) / 1000);
                            const elapsedStr = `+${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                            return (
                                <div
                                    key={movement.movement_id || index}
                                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-4 w-4 text-blue-600" />
                                            <div className="flex flex-col">
                                                <span className="font-mono text-sm font-semibold text-blue-600 leading-none">
                                                    {formatTime(movement.movement_time || new Date().toISOString())}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">Elapsed: {elapsedStr}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground mr-1">
                                                {formatDate(movement.movement_time || new Date().toISOString())}
                                            </span>
                                            {editingId !== movement.movement_id && (
                                                <>
                                                    <button onClick={() => { setEditingId(movement.movement_id as number); setEditForm(movement); }} className="p-1 hover:bg-white rounded text-slate-500 hover:text-blue-600 transition" title="Modify Event"><Edit className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => handleDeleteMovement(movement.movement_id as number)} className="p-1 hover:bg-red-50 rounded text-red-500 transition" title="Delete Event"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {editingId === movement.movement_id ? (
                                        <div className="space-y-2 mt-2 pb-2">
                                            <Input type="datetime-local" value={editForm?.movement_time ? new Date(parseDbDate(editForm.movement_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={(e) => setEditForm({ ...editForm!, movement_time: new Date(e.target.value).toISOString() })} className="h-8 text-sm bg-white" />
                                            <Select
                                                value={editForm?.movement_type || ""}
                                                onValueChange={(val) => setEditForm(editForm ? { ...editForm, movement_type: val } : null)}
                                            >
                                                <SelectTrigger className="h-8 text-sm bg-white">
                                                    <SelectValue placeholder="Action..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {diveActionsList.map(action => (
                                                        <SelectItem key={`edit-${action.label}`} value={action.label}>{action.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Textarea value={editForm?.remarks || ""} onChange={(e) => setEditForm({ ...editForm!, remarks: e.target.value })} className="min-h-[60px] text-sm bg-white" placeholder="Notes..." />
                                            <div className="flex justify-end gap-2 pt-1">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-7 text-xs px-2"><X className="w-3 h-3 mr-1" /> Cancel</Button>
                                                <Button variant="default" size="sm" onClick={handleUpdateMovement} className="h-7 text-xs px-2 bg-blue-600"><Save className="w-3 h-3 mr-1" /> Save</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs font-medium text-slate-500 min-w-[70px]">
                                                    Action:
                                                </span>
                                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {movement.movement_type}
                                                </span>
                                            </div>

                                            {movement.remarks && (
                                                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                                    <span className="text-xs font-medium text-slate-500 min-w-[70px]">
                                                        Notes:
                                                    </span>
                                                    <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                                        {movement.remarks}
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
