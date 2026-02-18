"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Waves,
    Play,
    StopCircle,
    Clock,
    ArrowDown,
    ArrowUp,
    Anchor,
    Home,
    Trash2,
    Edit,
    Save,
    X,
    History,
    MoreHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface DiveLiveDataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    diveJob: any;
}

interface DiveLog {
    movement_id: number;
    movement_time: string;
    movement_type: string;
    remarks?: string;
    depth_meters?: number;
}

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

export default function DiveLiveDataDialog({
    open,
    onOpenChange,
    diveJob,
}: DiveLiveDataDialogProps) {
    const supabase = createClient();
    const [logs, setLogs] = useState<DiveLog[]>([]);
    const [elapsedTime, setElapsedTime] = useState("00:00:00");
    const [loading, setLoading] = useState(false);
    const [diveData, setDiveData] = useState({
        current_depth: 0,
        dive_duration: 0,
        water_temp: 18.5,
        visibility: 12,
    });

    // Editing state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ movement_type: "", time: "" });

    // Helper to get location from action label
    const getLocation = (label: string) => {
        const action = actionsList.find(a => a.label === label);
        return action ? action.location : "Worksite";
    };

    // Determine actions based on dive type
    const actionsList = useMemo(() => {
        const type = diveJob?.dive_type?.toUpperCase() || "AIR";
        return type.includes("BELL") || type.includes("SAT") ? BELL_DIVE_ACTIONS : AIR_DIVE_ACTIONS;
    }, [diveJob]);

    // Fetch logs on open
    useEffect(() => {
        if (open && diveJob?.dive_job_id) {
            fetchLogs();
        }
    }, [open, diveJob]);

    // Timer Logic
    // Timer Logic
    // Timer Logic
    useEffect(() => {
        const interval = setInterval(() => {
            const startLog = logs.find(l => l.movement_type === "Left Surface");
            const endLog = logs.find(l => l.movement_type === "Arrived Surface");

            if (startLog) {
                // Ensure Start time is UTC
                let tStart = startLog.movement_time;
                if (!tStart.includes("Z") && !tStart.includes("+")) tStart += "Z";
                const start = new Date(tStart).getTime();

                let now;
                if (endLog) {
                    // Ensure End time is UTC
                    let tEnd = endLog.movement_time;
                    if (!tEnd.includes("Z") && !tEnd.includes("+")) tEnd += "Z";
                    now = new Date(tEnd).getTime();
                } else {
                    now = new Date().getTime();
                }

                const diff = now - start;

                if (diff > 0) {
                    const hrs = Math.floor(diff / (1000 * 60 * 60));
                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const secs = Math.floor((diff % (1000 * 60)) / 1000);
                    setElapsedTime(
                        `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                    );
                } else {
                    setElapsedTime("00:00:00");
                }
            } else {
                setElapsedTime("00:00:00");
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [logs]);

    async function fetchLogs() {
        if (!diveJob?.dive_job_id) return;

        const { data, error } = await supabase
            .from("insp_dive_movements")
            .select("*")
            .eq("dive_job_id", diveJob.dive_job_id)
            .order("movement_time", { ascending: true });

        if (error) {
            console.error("Error fetching logs:", error);
            toast.error("Failed to load dive logs");
        } else {
            setLogs(data || []);
        }
    }

    async function handleLogAction(action: { label: string, location: string }) {
        if (!diveJob?.dive_job_id) return;

        setLoading(true);
        // Use current time
        const now = new Date().toISOString();
        const user = (await supabase.auth.getUser()).data.user;

        const { data, error } = await supabase
            .from("insp_dive_movements")
            .insert({
                dive_job_id: diveJob.dive_job_id,
                movement_type: action.label,
                movement_time: now,
                depth_meters: diveData.current_depth,
                cr_user: user?.id || 'system',
                workunit: '000'
            })
            .select()
            .single();

        if (error) {
            console.error("Error logging action:", error);
            toast.error("Failed to log action");
        } else {
            setLogs(prev => [...prev, data]);
            toast.success(`Logged: ${action.label}`);
        }
        setLoading(false);
    }

    async function handleDeleteLog(id: number) {
        if (!confirm("Are you sure you want to delete this log entry?")) return;

        const { error } = await supabase
            .from("insp_dive_movements")
            .delete()
            .eq("movement_id", id);

        if (error) {
            toast.error("Failed to delete log");
        } else {
            setLogs(prev => prev.filter(l => l.movement_id !== id));
            toast.success("Log entry deleted");
        }
    }

    async function handleUpdateLog(id: number) {
        const originalLog = logs.find(l => l.movement_id === id);
        if (!originalLog) return;

        let newTimestamp = originalLog.movement_time;
        if (editForm.time) {
            try {
                const datePart = originalLog.movement_time.split('T')[0];
                newTimestamp = `${datePart}T${editForm.time}`;
                const d = new Date(newTimestamp);
                if (isNaN(d.getTime())) throw new Error("Invalid time");
            } catch (e) {
                toast.error("Invalid time format. Use HH:mm:ss");
                return;
            }
        }

        const { error } = await supabase
            .from("insp_dive_movements")
            .update({
                movement_type: editForm.movement_type,
                movement_time: newTimestamp
            })
            .eq("movement_id", id);

        if (error) {
            toast.error("Failed to update log");
        } else {
            setLogs(prev => prev.map(l => l.movement_id === id ? { ...l, movement_type: editForm.movement_type, movement_time: newTimestamp } : l));
            setEditingId(null);
            toast.success("Log updated");
        }
    }

    function startEditing(log: DiveLog) {
        const timeStr = new Date(log.movement_time).toLocaleTimeString('en-GB', { hour12: false });
        setEditForm({ movement_type: log.movement_type, time: timeStr });
        setEditingId(log.movement_id);
    }

    // Determine Next Logical Action
    const suggestNextAction = () => {
        if (logs.length === 0) return actionsList[0];

        const lastActivity = logs[logs.length - 1].movement_type;
        const index = actionsList.findIndex(a => a.label === lastActivity);

        if (index !== -1 && index < actionsList.length - 1) {
            return actionsList[index + 1];
        }
        return null;
    };

    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
    const nextAction = suggestNextAction();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                                <Waves className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">Live Dive Log</DialogTitle>
                                <DialogDescription>
                                    {diveJob?.dive_no} • {diveJob?.dive_type}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-mono font-bold text-slate-900 dark:text-white">
                                {elapsedTime}
                            </div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                                Elapsed Time
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                    {/* Left Panel: Controls */}
                    <div className="col-span-12 md:col-span-7 flex flex-col gap-6">

                        {/* Status Card */}
                        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-medium text-slate-500 mb-2">Current Status</h3>
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold text-blue-600">
                                    {lastLog ? lastLog.movement_type : "Ready to Dive"}
                                </div>
                                {lastLog && (
                                    <Badge variant="outline" className="text-xs">
                                        Last Update: {new Date(lastLog.movement_time).toLocaleTimeString()}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Next Action Button (Big) */}
                        {nextAction && (
                            <Button
                                onClick={() => handleLogAction(nextAction)}
                                disabled={loading}
                                className="h-24 text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-sm font-normal opacity-80 uppercase tracking-widest">Next Action</span>
                                    <span className="flex items-center gap-2">
                                        <Play className="fill-current h-6 w-6" />
                                        {nextAction.label}
                                    </span>
                                </div>
                            </Button>
                        )}

                        {/* All Actions Grid */}
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <MoreHorizontal className="h-4 w-4" /> Available Actions
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                {actionsList.map((action) => (
                                    <Button
                                        key={action.label}
                                        variant="outline"
                                        className="justify-start h-auto py-3 px-4 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onClick={() => handleLogAction(action)}
                                        disabled={loading}
                                    >
                                        <div className="text-left">
                                            <div className="font-medium">{action.label}</div>
                                            <div className="text-xs text-muted-foreground">{action.location}</div>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: History Log */}
                    <div className="col-span-12 md:col-span-5 flex flex-col h-full bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                            <h3 className="font-semibold flex items-center gap-2">
                                <History className="h-4 w-4 text-slate-500" />
                                Dive Log
                            </h3>
                            <Badge variant="secondary">{logs.length} Entries</Badge>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4">
                                {logs.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
                                            <Clock className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <p>No actions logged yet</p>
                                    </div>
                                ) : (
                                    [...logs].reverse().map((log) => (
                                        <div key={log.movement_id} className="relative pl-6 pb-6 border-l-2 border-slate-200 dark:border-slate-800 last:pb-0 last:border-0">
                                            <div className="absolute top-0 left-[-5px] h-2.5 w-2.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900"></div>

                                            {editingId === log.movement_id ? (
                                                <div className="space-y-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-200 shadow-sm">
                                                    <Input
                                                        value={editForm.movement_type}
                                                        onChange={e => setEditForm({ ...editForm, movement_type: e.target.value })}
                                                        placeholder="Action"
                                                    />
                                                    <Input
                                                        type="time"
                                                        step="1"
                                                        value={editForm.time}
                                                        onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                                                    />
                                                    <div className="flex gap-2 justify-end mt-2">
                                                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                                                        <Button size="sm" onClick={() => handleUpdateLog(log.movement_id)}>Save</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="group">
                                                    <div className="flex items-baseline justify-between">
                                                        <span className="text-sm font-mono text-muted-foreground">
                                                            {new Date(log.movement_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-6 w-6"
                                                                onClick={() => startEditing(log)}
                                                            >
                                                                <Edit className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => handleDeleteLog(log.movement_id)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                                        {log.movement_type}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        {getLocation(log.movement_type)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
