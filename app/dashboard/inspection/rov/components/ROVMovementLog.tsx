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
}

interface Movement {
    movement_id?: number;
    movement_time: string;
    movement_type: string;
    remarks: string;
}

export default function ROVMovementLog({ diveJob }: ROVMovementLogProps) {
    const supabase = createClient();

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
                .from("insp_rov_movements")
                .select("*")
                .eq("rov_job_id", diveJob.rov_job_id)
                .order("movement_time", { ascending: false });

            if (error) throw error;
            setMovements(data || []);
        } catch (error) {
            console.error("Error loading movements:", error);
        }
    }

    async function handleAddMovement() {
        if (!diveJob) {
            toast.error("No active ROV deployment");
            return;
        }

        if (!newMovement.movement_type) {
            toast.error("Action is required");
            return;
        }

        setLoading(true);

        try {
            const finalTime = newMovement.movement_time ? new Date(newMovement.movement_time).toISOString() : new Date().toISOString();

            const { error } = await supabase.from("insp_rov_movements").insert({
                rov_job_id: diveJob.rov_job_id,
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
            loadMovements();
        } catch (error: any) {
            console.error("Error deleting movement:", error);
            toast.error(error.message || "Failed to delete movement");
        }
    }

    async function handleUpdateMovement() {
        if (!editForm || !editForm.movement_id) return;
        try {
            const { error } = await supabase.from("insp_rov_movements").update({
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
        <div className="grid md:grid-cols-2 gap-6 min-h-[500px]">
            {/* Left: Add New Movement */}
            <Card className="p-6 shadow-lg h-fit border-cyan-100 dark:border-cyan-900/40">
                <div className="flex items-center gap-2 mb-6">
                    <Plus className="h-5 w-5 text-cyan-600" />
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Log ROV Movement</h3>
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
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="activity">Action *</Label>
                        <Select
                            value={newMovement.movement_type}
                            onValueChange={(val) => setNewMovement({ ...newMovement, movement_type: val })}
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
                            value={newMovement.remarks}
                            onChange={(e) =>
                                setNewMovement({ ...newMovement, remarks: e.target.value })
                            }
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
            <Card className="p-6 shadow-lg h-[calc(100vh-200px)] min-h-[500px] flex flex-col border-cyan-100 dark:border-cyan-900/40 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div className="flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-cyan-600" />
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Execution Timeline</h3>
                    </div>
                    <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300">{movements.length} logged</Badge>
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
                                            <span className="text-xs font-bold text-slate-400 mr-1 uppercase">
                                                {formatDate(movement.movement_time || new Date().toISOString())}
                                            </span>
                                            {editingId !== movement.movement_id && (
                                                <>
                                                    <button onClick={() => { setEditingId(movement.movement_id as number); setEditForm(movement); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-600 transition" title="Modify Event"><Edit className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => handleDeleteMovement(movement.movement_id as number)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-slate-400 hover:text-red-500 transition" title="Delete Event"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {editingId === movement.movement_id ? (
                                        <div className="space-y-2 mt-4 pb-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                                            <Input type="datetime-local" value={editForm?.movement_time ? new Date(parseDbDate(editForm.movement_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={(e) => setEditForm({ ...editForm!, movement_time: new Date(e.target.value).toISOString() })} className="h-9 font-bold bg-white dark:bg-slate-900" />
                                            <Select
                                                value={editForm?.movement_type || ""}
                                                onValueChange={(val) => setEditForm(editForm ? { ...editForm, movement_type: val } : null)}
                                            >
                                                <SelectTrigger className="h-9 font-bold bg-white dark:bg-slate-900">
                                                    <SelectValue placeholder="Action..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ROV_ACTIONS.map(action => (
                                                        <SelectItem key={`edit-${action.label}`} value={action.label}>{action.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Textarea value={editForm?.remarks || ""} onChange={(e) => setEditForm({ ...editForm!, remarks: e.target.value })} className="min-h-[60px] text-sm font-medium bg-white dark:bg-slate-900" placeholder="Notes..." />
                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-8 font-bold"><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
                                                <Button variant="default" size="sm" onClick={handleUpdateMovement} className="h-8 font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-md"><Save className="w-3.5 h-3.5 mr-1" /> Save Update</Button>
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
