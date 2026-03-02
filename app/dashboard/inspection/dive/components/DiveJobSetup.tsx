"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Anchor, Users, Info } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface DiveJobSetupProps {
    jobpackId: string | null;
    sowId: string | null;
    structureId: string | null;
    onJobCreated: (job: any) => void;
}

export default function DiveJobSetup({
    jobpackId,
    sowId,
    structureId,
    onJobCreated,
}: DiveJobSetupProps) {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        deployment_no: "",
        diver_name: "",
        standby_diver: "",
        dive_supervisor: "",
        report_coordinator: "",
        dive_type: "Air Dive",
        deployment_date: new Date().toISOString().split("T")[0],
        dive_start_time: new Date().toTimeString().slice(0, 5),
        max_depth: "",
        planned_duration: "",
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        generateDeploymentNo();
    }, []);

    function generateDeploymentNo() {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const random = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, "0");
        setFormData((prev) => ({
            ...prev,
            deployment_no: `DIVE-${year}${month}-${random}`,
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("insp_dive_jobs")
                .insert({
                    deployment_no: formData.deployment_no,
                    structure_id: structureId ? parseInt(structureId) : null,
                    jobpack_id: jobpackId ? parseInt(jobpackId) : null,
                    sow_report_no: sowId,
                    diver_name: formData.diver_name,
                    standby_diver: formData.standby_diver,
                    dive_supervisor: formData.dive_supervisor,
                    report_coordinator: formData.report_coordinator,
                    dive_type: formData.dive_type,
                    deployment_date: formData.deployment_date,
                    dive_start_time: formData.dive_start_time,
                    max_depth: formData.max_depth ? parseFloat(formData.max_depth) : null,
                    planned_duration: formData.planned_duration ? parseInt(formData.planned_duration) : null,
                    status: "IN_PROGRESS",
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("Dive deployment created successfully!");
            onJobCreated(data);
        } catch (error: any) {
            console.error("Error creating dive job:", error);
            toast.error(error.message || "Failed to create dive deployment");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="p-8 shadow-xl border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                    <Anchor className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Dive Deployment Setup
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Configure dive deployment details
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Diver Safety Information
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            Ensure all safety protocols are followed. Standby diver must be ready at all times.
                            Maximum dive duration and depth should be within certified limits.
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Deployment Number and Dive Type */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="deployment_no">Deployment Number *</Label>
                        <Input
                            id="deployment_no"
                            value={formData.deployment_no}
                            onChange={(e) =>
                                setFormData({ ...formData, deployment_no: e.target.value })
                            }
                            required
                            className="font-mono"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="dive_type">Dive Type *</Label>
                        <Select
                            value={formData.dive_type}
                            onValueChange={(value) =>
                                setFormData({ ...formData, dive_type: value })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Air Dive">Air Dive</SelectItem>
                                <SelectItem value="Bell Dive">Bell Dive</SelectItem>
                                <SelectItem value="Saturation Dive">Saturation Dive</SelectItem>
                                <SelectItem value="SCUBA">SCUBA</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Diver Information */}
                <div className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                            Dive Team
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="diver_name">Primary Diver *</Label>
                            <Input
                                id="diver_name"
                                value={formData.diver_name}
                                onChange={(e) =>
                                    setFormData({ ...formData, diver_name: e.target.value })
                                }
                                placeholder="Enter diver name"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="standby_diver">Standby Diver *</Label>
                            <Input
                                id="standby_diver"
                                value={formData.standby_diver}
                                onChange={(e) =>
                                    setFormData({ ...formData, standby_diver: e.target.value })
                                }
                                placeholder="Enter standby diver"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dive_supervisor">Dive Supervisor *</Label>
                            <Input
                                id="dive_supervisor"
                                value={formData.dive_supervisor}
                                onChange={(e) =>
                                    setFormData({ ...formData, dive_supervisor: e.target.value })
                                }
                                placeholder="Enter supervisor name"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="report_coordinator">Report Coordinator *</Label>
                            <Input
                                id="report_coordinator"
                                value={formData.report_coordinator}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        report_coordinator: e.target.value,
                                    })
                                }
                                placeholder="Enter coordinator"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Dive Schedule */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="deployment_date">Deployment Date *</Label>
                        <Input
                            id="deployment_date"
                            type="date"
                            value={formData.deployment_date}
                            onChange={(e) =>
                                setFormData({ ...formData, deployment_date: e.target.value })
                            }
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="dive_start_time">Dive Start Time *</Label>
                        <Input
                            id="dive_start_time"
                            type="time"
                            value={formData.dive_start_time}
                            onChange={(e) =>
                                setFormData({ ...formData, dive_start_time: e.target.value })
                            }
                            required
                        />
                    </div>
                </div>

                {/* Dive Parameters */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="max_depth">Maximum Depth (meters)</Label>
                        <Input
                            id="max_depth"
                            type="number"
                            step="0.1"
                            value={formData.max_depth}
                            onChange={(e) =>
                                setFormData({ ...formData, max_depth: e.target.value })
                            }
                            placeholder="e.g., 50.0"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="planned_duration">Planned Duration (minutes)</Label>
                        <Input
                            id="planned_duration"
                            type="number"
                            value={formData.planned_duration}
                            onChange={(e) =>
                                setFormData({ ...formData, planned_duration: e.target.value })
                            }
                            placeholder="e.g., 45"
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    >
                        {loading ? "Creating..." : "Create Dive Deployment"}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
