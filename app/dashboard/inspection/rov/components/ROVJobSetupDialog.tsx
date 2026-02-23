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
import { Ship, Info, Users, RotateCw, Trash2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface ROVJobSetupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobpackId: string | null;
    sowId: string | null;
    structureId: string | null;
    onJobCreated: (job: any | null) => void;
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

    // Team Rotation State
    const [teamCombos, setTeamCombos] = useState<any[]>([]);
    const [hiddenCombos, setHiddenCombos] = useState<string[]>([]);
    const [recommendedTeam, setRecommendedTeam] = useState<any>(null);
    const [loadingTeams, setLoadingTeams] = useState(false);

    const [loading, setLoading] = useState(false);
    const [diveHistory, setDiveHistory] = useState<any[]>([]);

    useEffect(() => {
        if (!open) return; // Only run when opening

        if (!existingJob) {
            // Reset for new deployment
            setFormData({
                deployment_no: "",
                rov_serial_no: "",
                rov_operator: "",
                rov_supervisor: "",
                report_coordinator: "",
                deployment_date: new Date().toISOString().split("T")[0],
                start_time: new Date().toTimeString().slice(0, 5),
            });
            setTeamCombos([]);
            setDiveHistory([]);
            setRecommendedTeam(null);

            // Generate new number and fetch
            generateDeploymentNo();
            fetchHistoricalTeams(true); // Force auto-fill for new job
        } else {
            // Load existing
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
    }, [existingJob, open]);

    // AI Treatment: Intelligent Auto-Increment for Deployment Number
    useEffect(() => {
        if (existingJob || !open || diveHistory.length === 0) return;

        const lastJob = diveHistory[0];

        if (lastJob && lastJob.deployment_no) {
            const nextNo = generateNextDeploymentNumber(lastJob.deployment_no);
            if (nextNo) {
                setFormData(prev => ({ ...prev, deployment_no: nextNo }));
            }
        }
    }, [diveHistory, open, existingJob]);

    function generateNextDeploymentNumber(current: string): string | null {
        const regex = /^(.*?)(\d+)(\D*)$/;
        const match = current.match(regex);

        if (match) {
            const prefix = match[1];
            const numberStr = match[2];
            const suffix = match[3];

            const nextNum = parseInt(numberStr) + 1;
            const paddedNum = nextNum.toString().padStart(numberStr.length, "0");

            return `${prefix}${paddedNum}${suffix}`;
        }
        return null;
    }

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

    // --- Team Rotation Logic ---

    async function fetchHistoricalTeams(forceFill: boolean = false) {
        if (!jobpackId) return;
        setLoadingTeams(true);

        try {
            const hiddenKey = `hidden_rov_teams_${jobpackId}`;
            const storedHidden = localStorage.getItem(hiddenKey);
            const hiddenList = storedHidden ? JSON.parse(storedHidden) : [];
            setHiddenCombos(hiddenList);

            const qId = parseInt(jobpackId);
            if (isNaN(qId)) return;

            let query = supabase
                .from("insp_rov_jobs")
                .select("rov_operator, rov_supervisor, report_coordinator, deployment_date, start_time, cr_date, deployment_no")
                .eq("jobpack_id", qId)
                .order('cr_date', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                setDiveHistory(data);
                processTeams(data, hiddenList, forceFill);
            }
        } catch (err) {
            console.error("Error fetching teams", err);
        } finally {
            setLoadingTeams(false);
        }
    }

    function processTeams(history: any[], hiddenList: string[], forceFill: boolean = false) {
        const comboMap = new Map();

        const parseDateTime = (dateStr: string, timeStr: string, createdStr?: string): number => {
            let timestamp = 0;

            if (dateStr) {
                let time = timeStr || "00:00";
                const match = time.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
                if (match) {
                    let [_, h, m, mod] = match;
                    let hours = parseInt(h, 10);
                    if (hours === 12) hours = mod.toUpperCase() === 'AM' ? 0 : 12;
                    else if (mod.toUpperCase() === 'PM') hours += 12;
                    time = `${hours.toString().padStart(2, '0')}:${m}:00`;
                } else if (time.length === 5 && !time.includes(":00")) {
                    time += ":00";
                }

                const dtString = `${dateStr}T${time}`;
                timestamp = new Date(dtString).getTime();
            }

            if ((isNaN(timestamp) || timestamp === 0) && createdStr) {
                timestamp = new Date(createdStr).getTime();
            }

            return isNaN(timestamp) ? 0 : timestamp;
        };

        history.forEach(job => {
            const signature = `${job.rov_operator?.trim()}|${job.rov_supervisor?.trim()}|${job.report_coordinator?.trim()}`;

            if (!job.rov_operator || hiddenList.includes(signature)) return;

            const existing = comboMap.get(signature);
            const jobTime = parseDateTime(job.deployment_date, job.start_time, job.cr_date);
            const crTime = job.cr_date ? new Date(job.cr_date).getTime() : 0;

            if (jobTime === 0) return;

            if (!existing) {
                comboMap.set(signature, {
                    signature,
                    rov_operator: job.rov_operator,
                    rov_supervisor: job.rov_supervisor,
                    report_coordinator: job.report_coordinator,
                    lastUsed: jobTime,
                    lastUsedDate: job.deployment_date,
                    firstUsed: jobTime,
                    minCrDate: crTime,
                    count: 1
                });
            } else {
                const newLast = Math.max(existing.lastUsed, jobTime);
                const newFirst = Math.min(existing.firstUsed, jobTime);
                let newMinCr = existing.minCrDate;
                if (crTime > 0) {
                    if (existing.minCrDate === 0 || crTime < existing.minCrDate) {
                        newMinCr = crTime;
                    }
                }

                comboMap.set(signature, {
                    ...existing,
                    lastUsed: newLast,
                    firstUsed: newFirst,
                    minCrDate: newMinCr,
                    count: existing.count + 1
                });
            }
        });

        const combos = Array.from(comboMap.values());

        const sortedByLRU = [...combos].sort((a, b) => {
            if (a.lastUsed !== b.lastUsed) {
                return a.lastUsed - b.lastUsed;
            }
            if (a.minCrDate !== b.minCrDate) {
                return a.minCrDate - b.minCrDate;
            }
            return a.signature.localeCompare(b.signature);
        });

        const nextUp = sortedByLRU.length > 0 ? sortedByLRU[0] : null;

        combos.sort((a, b) => {
            if (a.minCrDate !== b.minCrDate) {
                return a.minCrDate - b.minCrDate;
            }
            return a.signature.localeCompare(b.signature);
        });

        setTeamCombos(combos);

        if (nextUp) {
            setRecommendedTeam(nextUp);
            if (forceFill || (!formData.rov_operator && !formData.rov_supervisor)) {
                setFormData(prev => ({
                    ...prev,
                    rov_operator: nextUp.rov_operator || "",
                    rov_supervisor: nextUp.rov_supervisor || "",
                    report_coordinator: nextUp.report_coordinator || ""
                }));
            }
        }
    }

    function applyTeam(team: any) {
        setFormData(prev => ({
            ...prev,
            rov_operator: team.rov_operator || "",
            rov_supervisor: team.rov_supervisor || "",
            report_coordinator: team.report_coordinator || ""
        }));
        toast.success("Team applied");
    }

    function hideTeam(e: React.MouseEvent, signature: string) {
        e.stopPropagation();
        if (!confirm("Remove this team combination from future suggestions?")) return;

        const newList = [...hiddenCombos, signature];
        setHiddenCombos(newList);
        localStorage.setItem(`hidden_rov_teams_${jobpackId}`, JSON.stringify(newList));

        setTeamCombos(prev => prev.filter(t => t.signature !== signature));
        toast.success("Team removed from rotation suggestions");
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.deployment_no || !formData.rov_operator || !formData.rov_supervisor) {
            toast.error("Please fill in all required fields");
            return;
        }

        setLoading(true);

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error("Unable to get current user. Please log in again.");
            }

            let query;
            const payload = {
                deployment_no: formData.deployment_no,
                rov_operator: formData.rov_operator,
                rov_supervisor: formData.rov_supervisor,
                report_coordinator: formData.report_coordinator,
                rov_serial_no: formData.rov_serial_no,
                deployment_date: formData.deployment_date,
                start_time: formData.start_time,
            };

            if (existingJob) {
                query = supabase
                    .from("insp_rov_jobs")
                    .update(payload)
                    .eq("rov_job_id", existingJob.rov_job_id)
                    .select()
                    .single();
            } else {
                query = supabase
                    .from("insp_rov_jobs")
                    .insert({
                        ...payload,
                        structure_id: structureId ? parseInt(structureId) : null,
                        jobpack_id: jobpackId ? parseInt(jobpackId) : null,
                        sow_report_no: sowId,
                        status: "IN_PROGRESS",
                        cr_user: user.id,
                        rov_data_config_id: null,
                        video_grab_config_id: null,
                        auto_capture_data: true,
                        auto_grab_video: true,
                    })
                    .select()
                    .single();
            }

            const { data, error } = await query;

            if (error) throw error;

            toast.success(existingJob ? "ROV deployment updated successfully!" : "ROV deployment created successfully!");
            onJobCreated(data);
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error saving ROV job:", error);
            const errorMessage = error.message || "Failed to save ROV deployment";
            const errorDetails = error.details || "";
            const errorHint = error.hint || "";
            toast.error(`${errorMessage}${errorDetails ? ` - ${errorDetails}` : ""}${errorHint ? ` (${errorHint})` : ""}`);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(e: React.MouseEvent) {
        e.preventDefault();
        if (!existingJob) return;

        if (!confirm("Are you sure you want to delete this deployment? This action cannot be undone.")) return;

        setLoading(true);
        try {
            const jobId = existingJob.rov_job_id;

            const { count: inspCount, error: inspError } = await supabase
                .from("insp_records")
                .select("*", { count: "exact", head: true })
                .eq("rov_job_id", jobId);

            if (inspError) throw inspError;

            const { count: movCount, error: movError } = await supabase
                .from("insp_rov_movements")
                .select("*", { count: "exact", head: true })
                .eq("rov_job_id", jobId);

            if (movError) throw movError;

            if ((inspCount || 0) > 0) {
                toast.error(`Cannot delete: This deployment has ${inspCount} inspection records. Please remove them first.`);
                return;
            }

            const { error: matchError } = await supabase
                .from("insp_records")
                .delete()
                .eq("rov_job_id", jobId);

            if (matchError) {
                console.warn("Could not delete from insp_records directly (might be a view or permission issue, or just dependency):", matchError);
            }

            const { error: moveDelError } = await supabase
                .from("insp_rov_movements")
                .delete()
                .eq("rov_job_id", jobId);

            if (moveDelError) {
                console.error("Error cleaning up movements:", moveDelError);
                throw moveDelError;
            }

            const { error: deleteError } = await supabase
                .from("insp_rov_jobs")
                .delete()
                .eq("rov_job_id", jobId);

            if (deleteError) throw deleteError;

            const { count: checkCount } = await supabase
                .from("insp_rov_jobs")
                .select("*", { count: "exact", head: true })
                .eq("rov_job_id", jobId);

            if (checkCount !== null && checkCount > 0) {
                throw new Error("Deletion failed. Policy restrictions may be preventing deletion.");
            }

            toast.success("Deployment deleted successfully");
            onJobCreated(null);
            onOpenChange(false);

        } catch (err: any) {
            console.error("Error deleting deployment:", err);
            toast.error(err.message || "Failed to delete deployment");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

                <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-cyan-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-cyan-900 dark:text-cyan-100 mb-1">
                                Using Settings Configuration
                            </p>
                            <p className="text-xs text-cyan-700 dark:text-cyan-300">
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
                            <Label htmlFor="rov_serial_no">ROV Serial Number</Label>
                            <Input
                                id="rov_serial_no"
                                value={formData.rov_serial_no}
                                onChange={(e) =>
                                    setFormData({ ...formData, rov_serial_no: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                            <h3 className="font-semibold text-sm">ROV Team</h3>

                            {!existingJob && teamCombos.length > 0 && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="ml-auto h-7 gap-2 bg-white dark:bg-slate-950">
                                            <RotateCw className="h-3 w-3 text-cyan-600" />
                                            {recommendedTeam ? "Next: " + recommendedTeam.rov_operator : "Select Team"}
                                            <History className="h-3 w-3 text-muted-foreground ml-1" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0" align="end">
                                        <div className="p-3 border-b bg-slate-50 dark:bg-slate-900 rounded-t-md">
                                            <h4 className="font-medium text-xs text-muted-foreground uppercase">Team Rotation (LRU)</h4>
                                        </div>
                                        <ScrollArea className="h-[200px]">
                                            <div className="p-1">
                                                {teamCombos.map((team, idx) => (
                                                    <div
                                                        key={team.signature}
                                                        className={cn(
                                                            "group flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-sm",
                                                            formData.rov_operator === team.rov_operator && formData.rov_supervisor === team.rov_supervisor ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200" : ""
                                                        )}
                                                        onClick={() => applyTeam(team)}
                                                    >
                                                        <div className="flex-1 space-y-1">
                                                            <div className="font-medium flex items-center gap-2">
                                                                {recommendedTeam?.signature === team.signature && <Badge variant="secondary" className="px-1 py-0 text-[10px] bg-green-100 text-green-700">NEXT</Badge>}
                                                                {team.rov_operator}
                                                                <span className="text-muted-foreground font-normal">+ {team.rov_supervisor}</span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                RC: {team.report_coordinator || 'N/A'} • Last: {new Date(team.lastUsed).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50"
                                                            onClick={(e) => hideTeam(e, team.signature)}
                                                            title="Discard this combo"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="rov_operator">ROV Pilot / Operator *</Label>
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

                            <div className="space-y-2 lg:col-span-1 col-span-2">
                                <Label htmlFor="report_coordinator">Report Coordinator</Label>
                                <Input
                                    id="report_coordinator"
                                    value={formData.report_coordinator}
                                    onChange={(e) =>
                                        setFormData({ ...formData, report_coordinator: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                    </div>

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

                    {!existingJob ? (
                        <div className="pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-600 to-cyan-700"
                            >
                                {loading ? "Creating..." : "Create ROV Deployment"}
                            </Button>
                        </div>
                    ) : (
                        <div className="pt-4 flex items-center justify-between gap-4">
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={loading}
                                className="h-10"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="flex-1 h-10 bg-cyan-600 hover:bg-cyan-700"
                            >
                                {loading ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
}

