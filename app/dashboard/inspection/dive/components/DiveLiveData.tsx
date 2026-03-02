"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waves, Clock, Gauge, Thermometer, Wind, Activity } from "lucide-react";

interface DiveLiveDataProps {
    diveJob: any;
}

export default function DiveLiveData({ diveJob }: DiveLiveDataProps) {
    const [diveData, setDiveData] = useState({
        current_depth: 0,
        dive_duration: 0,
        water_temp: 0,
        visibility: 0,
        current_speed: 0,
        diver_status: "OK",
    });

    const [isActive, setIsActive] = useState(false);
    const [startTime, setStartTime] = useState<Date | null>(null);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isActive && startTime) {
            interval = setInterval(() => {
                const duration = Math.floor((Date.now() - startTime.getTime()) / 1000 / 60);
                setDiveData((prev) => ({
                    ...prev,
                    dive_duration: duration,
                }));
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [isActive, startTime]);

    function handleStart() {
        setIsActive(true);
        setStartTime(new Date());
    }

    function handleStop() {
        setIsActive(false);
    }

    function formatDuration(minutes: number): string {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    }

    return (
        <Card className="p-4 shadow-lg border-blue-200 dark:border-blue-900">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-sm">Live Dive Data</h3>
                </div>
                {isActive && (
                    <Badge variant="default" className="bg-green-600 animate-pulse">
                        ACTIVE
                    </Badge>
                )}
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <Button
                    onClick={handleStart}
                    disabled={isActive}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                >
                    Start Tracking
                </Button>
                <Button
                    onClick={handleStop}
                    disabled={!isActive}
                    size="sm"
                    variant="destructive"
                >
                    Stop
                </Button>
            </div>

            {/* Dive Data */}
            <div className="space-y-3">
                {/* Depth */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                    <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Current Depth
                        </span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                        {diveData.current_depth.toFixed(1)} m
                    </span>
                </div>

                {/* Duration */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Dive Duration
                        </span>
                    </div>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatDuration(diveData.dive_duration)}
                    </span>
                </div>

                {/* Water Temperature */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Water Temp
                        </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {diveData.water_temp.toFixed(1)} °C
                    </span>
                </div>

                {/* Visibility */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Visibility
                        </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {diveData.visibility.toFixed(0)} m
                    </span>
                </div>

                {/* Current Speed */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Current Speed
                        </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {diveData.current_speed.toFixed(2)} kn
                    </span>
                </div>

                {/* Diver Status */}
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-green-900 dark:text-green-100">
                            Diver Status
                        </span>
                        <Badge
                            variant="default"
                            className="bg-green-600"
                        >
                            {diveData.diver_status}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-muted-foreground text-center">
                    {isActive
                        ? "Monitoring dive parameters..."
                        : "Start tracking to monitor dive data"}
                </p>
            </div>
        </Card>
    );
}
