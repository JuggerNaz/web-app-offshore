"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ROVMovementLogProps {
    rovJob: any;
}

interface Movement {
    movement_id: number;
    movement_type: string;
    start_time: string;
    end_time?: string;
    position_data?: any;
    remarks?: string;
    status: string;
}

export default function ROVMovementLog({ rovJob }: ROVMovementLogProps) {
    const supabase = createClient();

    const [movements, setMovements] = useState<Movement[]>([]);
    const [currentMovement, setCurrentMovement] = useState<Movement | null>(null);
    const [newMovementType, setNewMovementType] = useState("");
    const [newRemarks, setNewRemarks] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (rovJob) {
            loadMovements();
        }
    }, [rovJob]);

    async function loadMovements() {
        if (!rovJob) return;

        try {
            const { data, error } = await supabase
                .from("insp_rov_movements")
                .select("*")
                .eq("rov_job_id", rovJob.rov_job_id)
                .order("start_time", { ascending: false });

            if (error) throw error;

            setMovements(data || []);

            // Check if there's an ongoing movement
            const ongoing = data?.find((m: Movement) => !m.end_time);
            if (ongoing) setCurrentMovement(ongoing);
        } catch (error) {
            console.error("Error loading movements:", error);
        }
    }

    async function startMovement() {
        if (!newMovementType) {
            toast.error("Please select a movement type");
            return;
        }

        setLoading(true);

        try {
            // End any currently running movement
            if (currentMovement) {
                await endMovement(currentMovement.movement_id);
            }

            const { data, error } = await supabase
                .from("insp_rov_movements")
                .insert({
                    rov_job_id: rovJob.rov_job_id,
                    movement_type: newMovementType,
                    start_time: new Date().toISOString(),
                    position_data: {
                        depth: 125.5,
                        altitude: 3.2,
                        heading: 270,
                        latitude: 4.123456,
                        longitude: 103.567890,
                    },
                    remarks: newRemarks || null,
                    status: "IN_PROGRESS",
                })
                .select()
                .single();

            if (error) throw error;

            setCurrentMovement(data);
            setMovements([data, ...movements]);
            setNewRemarks("");

            toast.success(`Movement started: ${newMovementType}`);
        } catch (error: any) {
            console.error("Error starting movement:", error);
            toast.error(error.message || "Failed to start movement");
        } finally {
            setLoading(false);
        }
    }

    async function endMovement(movementId?: number) {
        const idToEnd = movementId || currentMovement?.movement_id;
        if (!idToEnd) return;

        setLoading(true);

        try {
            const { error } = await supabase
                .from("insp_rov_movements")
                .update({
                    end_time: new Date().toISOString(),
                    status: "COMPLETED",
                })
                .eq("movement_id", idToEnd);

            if (error) throw error;

            setCurrentMovement(null);
            await loadMovements();

            toast.success("Movement ended");
        } catch (error: any) {
            console.error("Error ending movement:", error);
            toast.error(error.message || "Failed to end movement");
        } finally {
            setLoading(false);
        }
    }

    function formatDuration(start: string, end?: string) {
        const startTime = new Date(start);
        const endTime = end ? new Date(end) : new Date();
        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = duration % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    return (
        <div className="grid grid-cols-3 gap-4">
            {/* Left: New Movement Form */}
            <Card className="p-6 shadow-lg border-slate-200 dark:border-slate-800">
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-lg text-slate-900 dark:text-white mb-2">
                            Movement Control
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Log ROV movements and operations
                        </p>
                    </div>

                    {/* Current Movement Status */}
                    {currentMovement && (
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-green-600">
                                    <Play className="h-3 w-3 mr-1" />
                                    In Progress
                                </Badge>
                                <span className="text-xs font-mono text-green-700 dark:text-green-300">
                                    {formatDuration(currentMovement.start_time)}
                                </span>
                            </div>
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                {currentMovement.movement_type}
                            </p>
                            <Button
                                onClick={() => endMovement()}
                                size="sm"
                                variant="outline"
                                className="w-full mt-2"
                                disabled={loading}
                            >
                                <Pause className="h-4 w-4 mr-2" />
                                End Movement
                            </Button>
                        </div>
                    )}

                    {/* New Movement Form */}
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Movement Type *</Label>
                            <Select
                                value={newMovementType}
                                onValueChange={setNewMovementType}
                                disabled={!!currentMovement}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DEPLOYMENT">Deployment</SelectItem>
                                    <SelectItem value="RECOVERY">Recovery</SelectItem>
                                    <SelectItem value="TRANSIT">Transit to Location</SelectItem>
                                    <SelectItem value="TMS_DEPLOY">TMS Deploy</SelectItem>
                                    <SelectItem value="TMS_RECOVER">TMS Recover</SelectItem>
                                    <SelectItem value="CAGE_DEPLOY">Cage Deploy</SelectItem>
                                    <SelectItem value="CAGE_RECOVER">Cage Recover</SelectItem>
                                    <SelectItem value="INSPECTION">Inspection Work</SelectItem>
                                    <SelectItem value="STANDBY">Standby</SelectItem>
                                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Remarks (Optional)</Label>
                            <Textarea
                                value={newRemarks}
                                onChange={(e) => setNewRemarks(e.target.value)}
                                placeholder="Enter movement remarks..."
                                rows={3}
                                disabled={!!currentMovement}
                            />
                        </div>

                        <Button
                            onClick={startMovement}
                            disabled={loading || !newMovementType || !!currentMovement}
                            className="w-full bg-cyan-600 hover:bg-cyan-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Start Movement
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Right: Movement History */}
            <div className="col-span-2">
                <Card className="p-6 shadow-lg border-slate-200 dark:border-slate-800">
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-lg text-slate-900 dark:text-white mb-2">
                                Movement History
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Complete log of ROV movements for this deployment
                            </p>
                        </div>

                        {/* Movement Table */}
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Start Time</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Position</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movements.length > 0 ? (
                                        movements.map((movement) => (
                                            <TableRow key={movement.movement_id}>
                                                <TableCell className="font-medium">
                                                    {movement.movement_type}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {new Date(movement.start_time).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {formatDuration(movement.start_time, movement.end_time)}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {movement.position_data ? (
                                                        <div>
                                                            <div>
                                                                Depth: {movement.position_data.depth?.toFixed(1)}m
                                                            </div>
                                                            <div className="text-muted-foreground">
                                                                {movement.position_data.latitude?.toFixed(4)},
                                                                {movement.position_data.longitude?.toFixed(4)}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            movement.status === "COMPLETED"
                                                                ? "secondary"
                                                                : "default"
                                                        }
                                                        className={
                                                            movement.status === "IN_PROGRESS"
                                                                ? "bg-green-600"
                                                                : ""
                                                        }
                                                    >
                                                        {movement.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8">
                                                <p className="text-muted-foreground">
                                                    No movements logged yet
                                                </p>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Stats */}
                        {movements.length > 0 && (
                            <div className="flex gap-4 pt-4 border-t">
                                <div className="flex-1 text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                                    <p className="text-xs text-muted-foreground mb-1">
                                        Total Movements
                                    </p>
                                    <p className="text-2xl font-bold">{movements.length}</p>
                                </div>
                                <div className="flex-1 text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                                    <p className="text-xs text-muted-foreground mb-1">
                                        Completed
                                    </p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {movements.filter((m) => m.status === "COMPLETED").length}
                                    </p>
                                </div>
                                <div className="flex-1 text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                                    <p className="text-xs text-muted-foreground mb-1">
                                        In Progress
                                    </p>
                                    <p className="text-2xl font-bold text-cyan-600">
                                        {movements.filter((m) => m.status === "IN_PROGRESS").length}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
