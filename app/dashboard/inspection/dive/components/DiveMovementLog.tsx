"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, ListChecks } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface DiveMovementLogProps {
    diveJob: any;
}

interface Movement {
    id?: number;
    timestamp: string;
    location: string;
    activity: string;
    notes: string;
}

export default function DiveMovementLog({ diveJob }: DiveMovementLogProps) {
    const supabase = createClient();

    const [movements, setMovements] = useState<Movement[]>([]);
    const [newMovement, setNewMovement] = useState({
        location: "",
        activity: "",
        notes: "",
    });
    const [loading, setLoading] = useState(false);

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
                .order("timestamp", { ascending: false });

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

        if (!newMovement.location || !newMovement.activity) {
            toast.error("Location and activity are required");
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.from("insp_dive_movements").insert({
                dive_job_id: diveJob.dive_job_id,
                timestamp: new Date().toISOString(),
                location: newMovement.location,
                activity: newMovement.activity,
                notes: newMovement.notes,
            });

            if (error) throw error;

            toast.success("Movement logged");
            setNewMovement({ location: "", activity: "", notes: "" });
            loadMovements();
        } catch (error: any) {
            console.error("Error adding movement:", error);
            toast.error(error.message || "Failed to log movement");
        } finally {
            setLoading(false);
        }
    }

    function formatTime(timestamp: string): string {
        const date = new Date(timestamp);
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function formatDate(timestamp: string): string {
        const date = new Date(timestamp);
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
                        <Label htmlFor="location">Location *</Label>
                        <Input
                            id="location"
                            value={newMovement.location}
                            onChange={(e) =>
                                setNewMovement({ ...newMovement, location: e.target.value })
                            }
                            placeholder="e.g., Leg A1, Column B2, Node 3"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="activity">Activity *</Label>
                        <Input
                            id="activity"
                            value={newMovement.activity}
                            onChange={(e) =>
                                setNewMovement({ ...newMovement, activity: e.target.value })
                            }
                            placeholder="e.g., Visual inspection, CP reading"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={newMovement.notes}
                            onChange={(e) =>
                                setNewMovement({ ...newMovement, notes: e.target.value })
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
            <Card className="p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-blue-600" />
                        <h3 className="font-bold text-lg">Movement History</h3>
                    </div>
                    <Badge variant="secondary">{movements.length} entries</Badge>
                </div>

                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {movements.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                            <p className="text-sm text-muted-foreground">
                                No movements logged yet
                            </p>
                        </div>
                    ) : (
                        movements.map((movement, index) => (
                            <div
                                key={movement.id || index}
                                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-blue-600" />
                                        <span className="font-mono text-sm font-semibold text-blue-600">
                                            {formatTime(movement.timestamp)}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDate(movement.timestamp)}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-start gap-2">
                                        <span className="text-xs font-medium text-slate-500 min-w-[70px]">
                                            Location:
                                        </span>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {movement.location}
                                        </span>
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <span className="text-xs font-medium text-slate-500 min-w-[70px]">
                                            Activity:
                                        </span>
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            {movement.activity}
                                        </span>
                                    </div>

                                    {movement.notes && (
                                        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                            <span className="text-xs font-medium text-slate-500 min-w-[70px]">
                                                Notes:
                                            </span>
                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                                {movement.notes}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}
