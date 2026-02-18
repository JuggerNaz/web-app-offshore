"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ship, Settings2, Info } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface ROVJobSetupProps {
    jobpackId: string | null;
    sowId: string | null;
    structureId: string | null;
    onJobCreated: (job: any) => void;
}

export default function ROVJobSetup({
    jobpackId,
    sowId,
    structureId,
    onJobCreated,
}: ROVJobSetupProps) {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        deployment_no: "",
        rov_serial_no: "",
        rov_operator: "",
        rov_supervisor: "",
        report_coordinator: "",
        deployment_date: new Date().toISOString().split("T")[0],
        start_time: new Date().toTimeString().slice(0, 5),
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        generateDeploymentNo();
    }, []);

    function generateDeploymentNo() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const random = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, "0");
        setFormData((prev) => ({
            ...prev,
            deployment_no: `ROV-${year}${month}-${random}`,
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("insp_rov_jobs")
                .insert({
                    deployment_no: formData.deployment_no,
                    structure_id: structureId ? parseInt(structureId) : null,
                    jobpack_id: jobpackId ? parseInt(jobpackId) : null,
                    sow_report_no: sowId,
                    rov_serial_no: formData.rov_serial_no,
                    rov_operator: formData.rov_operator,
                    rov_supervisor: formData.rov_supervisor,
                    report_coordinator: formData.report_coordinator,
                    deployment_date: formData.deployment_date,
                    start_time: formData.start_time,
                    // Settings from localStorage will be loaded in the inspection components
                    rov_data_config_id: null,
                    video_grab_config_id: null,
                    auto_capture_data: true,
                    auto_grab_video: true,
                    status: "IN_PROGRESS",
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("ROV deployment created successfully!");
            onJobCreated(data);
        } catch (error: any) {
            console.error("Error creating ROV job:", error);
            toast.error(error.message || "Failed to create ROV deployment");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="p-8 shadow-xl border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/20">
                    <Ship className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        ROV Deployment Setup
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Configure ROV deployment details
                    </p>
                </div>
            </div>

            {/* Info Alert about Settings */}
            <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            Using Settings Configuration
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            This inspection will use the settings configured in{" "}
                            <Link
                                href="/dashboard/settings/data-acquisition"
                                className="underline font-semibold hover:text-blue-900"
                            >
                                Data Acquisition
                            </Link>
                            {" "}and{" "}
                            <Link
                                href="/dashboard/settings/video-capture"
                                className="underline font-semibold hover:text-blue-900"
                            >
                                Video Capture
                            </Link>
                            {" "}from the Settings page.
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Details */}
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
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rov_serial_no">ROV Serial Number *</Label>
                        <Input
                            id="rov_serial_no"
                            value={formData.rov_serial_no}
                            onChange={(e) =>
                                setFormData({ ...formData, rov_serial_no: e.target.value })
                            }
                            placeholder="e.g., ROV-001"
                            required
                        />
                    </div>
                </div>

                {/* Personnel */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="rov_operator">ROV Operator *</Label>
                        <Input
                            id="rov_operator"
                            value={formData.rov_operator}
                            onChange={(e) =>
                                setFormData({ ...formData, rov_operator: e.target.value })
                            }
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rov_supervisor">ROV Supervisor *</Label>
                        <Input
                            id="rov_supervisor"
                            value={formData.rov_supervisor}
                            onChange={(e) =>
                                setFormData({ ...formData, rov_supervisor: e.target.value })
                            }
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
                            required
                        />
                    </div>
                </div>

                {/* Date & Time */}
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
                        <Label htmlFor="start_time">Start Time *</Label>
                        <Input
                            id="start_time"
                            type="time"
                            value={formData.start_time}
                            onChange={(e) =>
                                setFormData({ ...formData, start_time: e.target.value })
                            }
                            required
                        />
                    </div>
                </div>

                {/* Settings Info Box */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Settings2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                            Active Settings
                        </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div>
                            <strong className="text-slate-700 dark:text-slate-300">Data Acquisition:</strong> From Settings page
                        </div>
                        <div>
                            <strong className="text-slate-700 dark:text-slate-300">Video Capture:</strong> From Settings page
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Data fields and video settings will be loaded from your configured Settings when inspection starts.
                    </p>
                </div>

                {/* Submit Button */}
                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                >
                    {loading ? "Creating deployment..." : "Create ROV Deployment"}
                </Button>
            </form>
        </Card>
    );
}
