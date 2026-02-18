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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ship, Info } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface ROVJobSetupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobpackId: string | null;
    sowId: string | null;
    structureId: number | string | null;
    onJobCreated: (job: any) => void;
    existingJob: any;
}

export default function ROVJobSetupDialog({
    open,
    onOpenChange,
    jobpackId,
    sowId,
    structureId,
    onJobCreated,
    existingJob,
}: ROVJobSetupDialogProps) {
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
        if (!existingJob) {
            generateDeploymentNo();
        } else {
            setFormData({
                deployment_no: existingJob.deployment_no,
                rov_serial_no: existingJob.rov_serial_no,
                rov_operator: existingJob.rov_operator,
                rov_supervisor: existingJob.rov_supervisor,
                report_coordinator: existingJob.report_coordinator,
                deployment_date: existingJob.deployment_date,
                start_time: existingJob.start_time,
            });
        }
    }, [existingJob]);

    function generateDeploymentNo() {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
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

        if (!formData.deployment_no || !formData.rov_serial_no || !formData.rov_operator) {
            toast.error("Please fill in all required fields");
            return;
        }

        setLoading(true);

        try {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error("Unable to get current user. Please log in again.");
            }

            const { data, error } = await supabase
                .from("insp_rov_jobs")
                .insert({
                    deployment_no: formData.deployment_no,
                    structure_id: structureId ? parseInt(structureId.toString()) : null,
                    jobpack_id: jobpackId ? parseInt(jobpackId) : null,
                    sow_report_no: sowId,
                    rov_serial_no: formData.rov_serial_no,
                    rov_operator: formData.rov_operator,
                    rov_supervisor: formData.rov_supervisor,
                    report_coordinator: formData.report_coordinator,
                    deployment_date: formData.deployment_date,
                    start_time: formData.start_time,
                    rov_data_config_id: null,
                    video_grab_config_id: null,
                    auto_capture_data: true,
                    auto_grab_video: true,
                    status: "IN_PROGRESS",
                    cr_user: user.id, // Add current user ID
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("ROV deployment created successfully!");
            onJobCreated(data);
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error creating ROV job:", error);

            // Show detailed error information
            const errorMessage = error.message || "Failed to create ROV deployment";
            const errorDetails = error.details || "";
            const errorHint = error.hint || "";
            const errorCode = error.code || "";

            console.error("Error details:", {
                message: errorMessage,
                details: errorDetails,
                hint: errorHint,
                code: errorCode,
            });

            toast.error(`${errorMessage}${errorDetails ? ` - ${errorDetails}` : ""}${errorHint ? ` (${errorHint})` : ""}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/20">
                            <Ship className="h-6 w-6 text-cyan-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">
                                {existingJob ? "ROV Deployment Info" : "ROV Deployment Setup"}
                            </DialogTitle>
                            <DialogDescription>
                                {existingJob
                                    ? "View deployment details"
                                    : "Configure ROV deployment details"}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Info Banner */}
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                                Using Settings Configuration
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                Data Acquisition and Video Capture settings will be loaded from{" "}
                                <Link
                                    href="/dashboard/settings/data-acquisition"
                                    className="underline font-semibold"
                                >
                                    Settings page
                                </Link>
                                .
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Deployment Number and ROV Serial */}
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
                                disabled={!!existingJob}
                                className="font-mono"
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
                                placeholder="e.g., rv001"
                                required
                                disabled={!!existingJob}
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
                                placeholder="Operator name"
                                required
                                disabled={!!existingJob}
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
                                placeholder="Supervisor name"
                                required
                                disabled={!!existingJob}
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
                                placeholder="Coordinator name"
                                required
                                disabled={!!existingJob}
                            />
                        </div>
                    </div>

                    {/* Date and Time */}
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
                                disabled={!!existingJob}
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
                                disabled={!!existingJob}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    {!existingJob && (
                        <div className="pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-600 to-cyan-700"
                            >
                                {loading ? "Creating..." : "Create ROV Deployment"}
                            </Button>
                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
}
