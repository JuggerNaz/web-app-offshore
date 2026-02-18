"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Play, Square } from "lucide-react";
import { toast } from "sonner";

interface ROVLiveDataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rovJob: any;
}

export default function ROVLiveDataDialog({
    open,
    onOpenChange,
    rovJob,
}: ROVLiveDataDialogProps) {
    const [isActive, setIsActive] = useState(false);
    const [liveData, setLiveData] = useState({
        depth: "0.0",
        heading: "0",
        altitude: "0.0",
        temperature: "0.0",
    });

    function handleStart() {
        setIsActive(true);
        toast.success("Data acquisition started");
    }

    function handleStop() {
        setIsActive(false);
        toast.info("Data acquisition stopped");
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                            <Activity className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Live Data Acquisition</DialogTitle>
                            <DialogDescription>
                                Monitor and record ROV telemetry data
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                        <span className="font-medium">Status:</span>
                        {isActive ? (
                            <Badge className="bg-green-600">ACTIVE</Badge>
                        ) : (
                            <Badge variant="secondary">STOPPED</Badge>
                        )}
                    </div>

                    {/* Live Data Display */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
                            <p className="text-xs text-muted-foreground mb-1">Depth</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {liveData.depth} m
                            </p>
                        </div>

                        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-muted-foreground mb-1">Heading</p>
                            <p className="text-2xl font-bold">{liveData.heading}°</p>
                        </div>

                        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-muted-foreground mb-1">Altitude</p>
                            <p className="text-2xl font-bold">{liveData.altitude} m</p>
                        </div>

                        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-muted-foreground mb-1">Temperature</p>
                            <p className="text-2xl font-bold">{liveData.temperature}°C</p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-2 gap-3 pt-4">
                        <Button
                            onClick={handleStart}
                            disabled={isActive}
                            className="gap-2 bg-green-600 hover:bg-green-700"
                        >
                            <Play className="h-4 w-4" />
                            Start Acquisition
                        </Button>
                        <Button
                            onClick={handleStop}
                            disabled={!isActive}
                            variant="destructive"
                            className="gap-2"
                        >
                            <Square className="h-4 w-4" />
                            Stop
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
