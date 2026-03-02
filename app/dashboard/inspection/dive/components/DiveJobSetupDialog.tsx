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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Anchor, Info, Users, RotateCw, Trash2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface DiveJobSetupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobpackId: string | null;
    sowId: string | null;
    structureId: string | null;
    onJobCreated: (job: any | null) => void;
    existingJob: any;
}

export default function DiveJobSetupDialog({
    open,
    onOpenChange,
    jobpackId,
    sowId,
    structureId,
    onJobCreated,
    existingJob,
}: DiveJobSetupDialogProps) {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        dive_no: "",
        diver_name: "",
        standby_diver: "",
        dive_supervisor: "",
        report_coordinator: "",
        bell_operator: "",
        life_support_technician: "",
        dive_type: "AIR",
        dive_date: new Date().toISOString().split("T")[0],
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
                dive_no: "",
                diver_name: "",
                standby_diver: "",
                dive_supervisor: "",
                report_coordinator: "",
                bell_operator: "",
                life_support_technician: "",
                dive_type: "AIR",
                dive_date: new Date().toISOString().split("T")[0],
                start_time: new Date().toTimeString().slice(0, 5),
            });
            setTeamCombos([]);
            setDiveHistory([]);
            setRecommendedTeam(null);

            // Generate new number and fetch
            generateDiveNo();
            fetchHistoricalTeams(true); // Force auto-fill for new job
        } else {
            // Load existing
            setFormData({
                dive_no: existingJob.dive_no,
                diver_name: existingJob.diver_name,
                standby_diver: existingJob.standby_diver,
                dive_supervisor: existingJob.dive_supervisor,
                report_coordinator: existingJob.report_coordinator,
                bell_operator: existingJob.bell_operator || "",
                life_support_technician: existingJob.life_support_technician || "",
                dive_type: existingJob.dive_type,
                dive_date: existingJob.dive_date,
                start_time: existingJob.start_time,
            });
        }
    }, [existingJob, open]);

    // AI Treatment: Intelligent Auto-Increment for Dive Number
    useEffect(() => {
        if (existingJob || !open || diveHistory.length === 0) return;

        // 1. Find the relevant last dive number
        // We prioritize history of the SAME type to preserve type-specific formatting (e.g. AIR-01 vs SAT-01)
        // If no same-type history, we fallback to the latest global job to respect global sequencing (e.g. D-01, D-02)
        const sameTypeJobs = diveHistory.filter(j => j.dive_type === formData.dive_type);
        const lastJob = sameTypeJobs.length > 0 ? sameTypeJobs[0] : diveHistory[0];

        if (lastJob && lastJob.dive_no) {
            const nextNo = generateNextDiveNumber(lastJob.dive_no);
            if (nextNo) {
                setFormData(prev => ({ ...prev, dive_no: nextNo }));
                // toast.info(`Auto-generated Dive No: ${nextNo}`);
            }
        }
    }, [diveHistory, formData.dive_type, open, existingJob]);

    function generateNextDiveNumber(current: string): string | null {
        // Regex to find the LAST numeric sequence in the string
        // Captures: 1=Prefix, 2=Number, 3=Suffix
        const regex = /^(.*?)(\d+)(\D*)$/;
        const match = current.match(regex);

        if (match) {
            const prefix = match[1];
            const numberStr = match[2];
            const suffix = match[3];

            // Increment and pad with same length
            const nextNum = parseInt(numberStr) + 1;
            const paddedNum = nextNum.toString().padStart(numberStr.length, "0");

            return `${prefix}${paddedNum}${suffix}`;
        }
        return null;
    }

    function generateDiveNo() {
        // ... (existing implementation)
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const random = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, "0");
        setFormData((prev) => ({
            ...prev,
            dive_no: `DIVE-${year}${month}-${random}`,
        }));
    }

    // --- Team Rotation Logic ---

    async function fetchHistoricalTeams(forceFill: boolean = false) {
        if (!jobpackId) return;
        setLoadingTeams(true);

        try {
            // Load hidden combos from local storage
            const hiddenKey = `hidden_teams_${jobpackId}`;
            const storedHidden = localStorage.getItem(hiddenKey);
            const hiddenList = storedHidden ? JSON.parse(storedHidden) : [];
            setHiddenCombos(hiddenList);

            // Fetch history
            const qId = parseInt(jobpackId);
            if (isNaN(qId)) return;

            let query = supabase
                .from("insp_dive_jobs")
                .select("diver_name, dive_supervisor, report_coordinator, standby_diver, dive_date, start_time, cr_date, dive_no, dive_type")
                .eq("jobpack_id", qId)
                .order('cr_date', { ascending: false }); // Ensure latest is first

            // Relax SOW filter to show all historical teams within the JobPack
            // if (sowId) {
            //    query = query.eq("sow_report_no", sowId);
            // }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                setDiveHistory(data); // Store for Auto-Increment logic
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

        // Helper for robust time parsing
        const parseDateTime = (dateStr: string, timeStr: string, createdStr?: string): number => {
            let timestamp = 0;

            if (dateStr) {
                let time = timeStr || "00:00";
                // Handle AM/PM
                const match = time.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
                if (match) {
                    let [_, h, m, mod] = match;
                    let hours = parseInt(h, 10);
                    if (hours === 12) hours = mod.toUpperCase() === 'AM' ? 0 : 12;
                    else if (mod.toUpperCase() === 'PM') hours += 12;
                    time = `${hours.toString().padStart(2, '0')}:${m}:00`;
                } else if (time.length === 5 && !time.includes(":00")) {
                    // Handle basic "HH:MM" -> "HH:MM:00"
                    time += ":00";
                }

                const dtString = `${dateStr}T${time}`;
                timestamp = new Date(dtString).getTime();
            }

            // Fallback to cr_date if invalid or missing dive_date
            if ((isNaN(timestamp) || timestamp === 0) && createdStr) {
                timestamp = new Date(createdStr).getTime();
            }

            return isNaN(timestamp) ? 0 : timestamp;
        };

        // Group by unique signature
        history.forEach(job => {
            // Signature: Diver|Sup|RC|Standby
            const signature = `${job.diver_name?.trim()}|${job.dive_supervisor?.trim()}|${job.report_coordinator?.trim()}`;

            // Skip empty or hidden
            if (!job.diver_name || hiddenList.includes(signature)) return;

            const existing = comboMap.get(signature);
            // We want to track the LAST usage of this combo for rotation
            const jobTime = parseDateTime(job.dive_date, job.start_time, job.cr_date);
            // We track strict creation date for sorting order
            const crTime = job.cr_date ? new Date(job.cr_date).getTime() : 0;

            if (jobTime === 0) return; // Skip completely invalid

            if (!existing) {
                // First time encountering this team
                comboMap.set(signature, {
                    signature,
                    diver_name: job.diver_name,
                    dive_supervisor: job.dive_supervisor,
                    report_coordinator: job.report_coordinator,
                    standby_diver: job.standby_diver, // Take latest standby too
                    lastUsed: jobTime,
                    lastUsedDate: job.dive_date,
                    firstUsed: jobTime, // Keep this for backup logic/logic consistency
                    minCrDate: crTime, // Strict creation date
                    count: 1
                });
            } else {
                // Update stats
                const newLast = Math.max(existing.lastUsed, jobTime);
                const newFirst = Math.min(existing.firstUsed, jobTime);
                // Only update minCrDate if current is valid and older (though typically we want the oldest ever)
                // If existing.minCrDate is 0, take current. If current is 0, keep existing. Else min.
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

        // Convert to array
        const combos = Array.from(comboMap.values());

        // 1. Determine "Next Rotation" (LRU - Least Recently Used)
        // We create a copy to sort by lastUsed for recommendation logic
        const sortedByLRU = [...combos].sort((a, b) => {
            if (a.lastUsed !== b.lastUsed) {
                return a.lastUsed - b.lastUsed;
            }
            // Tie-breaker: Plan Order (Earliest Created First)
            if (a.minCrDate !== b.minCrDate) {
                return a.minCrDate - b.minCrDate;
            }
            return a.signature.localeCompare(b.signature);
        });

        const nextUp = sortedByLRU.length > 0 ? sortedByLRU[0] : null;

        // 2. Sort the DISPLAY list by strict Creation Date (as requested)
        combos.sort((a, b) => {
            // Sort by earliest creation date found for this team
            if (a.minCrDate !== b.minCrDate) {
                return a.minCrDate - b.minCrDate;
            }
            return a.signature.localeCompare(b.signature);
        });

        setTeamCombos(combos);

        // Recommend the LRU one
        if (nextUp) {
            setRecommendedTeam(nextUp);
            // Auto-fill if empty form OR forceFill is enabled
            if (forceFill || (!formData.diver_name && !formData.dive_supervisor)) {
                setFormData(prev => ({
                    ...prev,
                    diver_name: nextUp.diver_name || "",
                    dive_supervisor: nextUp.dive_supervisor || "",
                    report_coordinator: nextUp.report_coordinator || "",
                    standby_diver: nextUp.standby_diver || ""
                }));
            }
        }
    }

    function applyTeam(team: any) {
        setFormData(prev => ({
            ...prev,
            diver_name: team.diver_name || "",
            dive_supervisor: team.dive_supervisor || "",
            report_coordinator: team.report_coordinator || "",
            standby_diver: team.standby_diver || ""
        }));
        toast.success("Team applied");
    }

    function hideTeam(e: React.MouseEvent, signature: string) {
        e.stopPropagation();
        if (!confirm("Remove this team combination from future suggestions?")) return;

        const newList = [...hiddenCombos, signature];
        setHiddenCombos(newList);
        localStorage.setItem(`hidden_teams_${jobpackId}`, JSON.stringify(newList));

        // Refresh list
        setTeamCombos(prev => prev.filter(t => t.signature !== signature));
        toast.success("Team removed from rotation suggestions");
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.dive_no || !formData.diver_name || !formData.dive_supervisor) {
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

            let query;
            const payload = {
                dive_no: formData.dive_no,
                // structure_id: structureId ? parseInt(structureId) : null, // Assuming structure/jobpack shouldn't change on edit easily, or maybe they should? 
                // Let's safe update all fields except IDs if it's an update, or include them if it's harmless
                // For safety on INSERT we need them. For UPDATE they might not change.
                diver_name: formData.diver_name,
                standby_diver: formData.standby_diver,
                dive_supervisor: formData.dive_supervisor,
                report_coordinator: formData.report_coordinator,
                bell_operator: formData.bell_operator,
                life_support_technician: formData.life_support_technician,
                dive_type: formData.dive_type,
                dive_date: formData.dive_date,
                start_time: formData.start_time,
                // status: "IN_PROGRESS", // Don't reset status on update
                // cr_user: user.id, // Don't change creator on update
            };

            if (existingJob) {
                // UPDATE
                query = supabase
                    .from("insp_dive_jobs")
                    .update(payload)
                    .eq("dive_job_id", existingJob.dive_job_id)
                    .select()
                    .single();
            } else {
                // CREATE
                query = supabase
                    .from("insp_dive_jobs")
                    .insert({
                        ...payload,
                        structure_id: structureId ? parseInt(structureId) : null,
                        jobpack_id: jobpackId ? parseInt(jobpackId) : null,
                        sow_report_no: sowId,
                        status: "IN_PROGRESS",
                        cr_user: user.id,
                    })
                    .select()
                    .single();
            }

            const { data, error } = await query;

            if (error) throw error;

            toast.success(existingJob ? "Dive deployment updated successfully!" : "Dive deployment created successfully!");
            onJobCreated(data);
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error saving dive job:", error);
            // ... (keep existing error handling)
            const errorMessage = error.message || "Failed to save dive deployment";
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
            const jobId = existingJob.dive_job_id;

            // 1. Check for inspection records
            const { count: inspCount, error: inspError } = await supabase
                .from("insp_records")
                .select("*", { count: "exact", head: true })
                .eq("dive_job_id", jobId);

            if (inspError) throw inspError;

            // 2. Check for dive movements (logs)
            const { count: movCount, error: movError } = await supabase
                .from("insp_dive_movements")
                .select("*", { count: "exact", head: true })
                .eq("dive_job_id", jobId);

            if (movError) throw movError;

            // 3. Validation: Prevent delete ONLY if inspection records exist
            // (We allow deleting logs/movements, as that's just time tracking)
            if ((inspCount || 0) > 0) {
                toast.error(`Cannot delete: This deployment has ${inspCount} inspection records. Please remove them first.`);
                return;
            }

            // 4. Cleanup dependencies to prevent FK constraint errors
            // Order is important: Data -> Logs -> Job

            // A. Clean insp_records (Findings) - this might be the core blocker
            // We ignore errors here in case it's a view, but we try it.
            const { error: matchError } = await supabase
                .from("insp_records")
                .delete()
                .eq("dive_job_id", jobId);

            if (matchError) {
                console.warn("Could not delete from insp_records directly (might be a view or permission issue, or just dependency):", matchError);
            }



            // B. Clean insp_dive_movements (Logs) - Must be deleted before Job if FK exists
            const { error: moveDelError } = await supabase
                .from("insp_dive_movements")
                .delete()
                .eq("dive_job_id", jobId);

            if (moveDelError) {
                console.error("Error cleaning up movements:", moveDelError);
                throw moveDelError;
            }

            // 4. Delete the job
            const { error: deleteError } = await supabase
                .from("insp_dive_jobs")
                .delete()
                .eq("dive_job_id", jobId);

            if (deleteError) throw deleteError;

            // Verify deletion by checking if record still exists
            const { count: checkCount } = await supabase
                .from("insp_dive_jobs")
                .select("*", { count: "exact", head: true })
                .eq("dive_job_id", jobId);

            if (checkCount !== null && checkCount > 0) {
                // Even if delete didn't error, if count is still > 0, it failed (RLS)
                throw new Error("Deletion failed. Policy restrictions may be preventing deletion.");
            }

            toast.success("Deployment deleted successfully");
            onJobCreated(null); // Signal deletion
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
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                            <Anchor className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">
                                {existingJob ? "Dive Deployment Info" : "Dive Deployment Setup"}
                            </DialogTitle>
                            <DialogDescription>
                                {existingJob
                                    ? "View deployment details"
                                    : "Configure dive deployment details"}
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
                                Diver Safety Information
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                Ensure all safety protocols are followed. Standby diver must be ready at all times.
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Dive Number and Dive Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dive_no">Dive Number *</Label>
                            <Input
                                id="dive_no"
                                value={formData.dive_no}
                                onChange={(e) =>
                                    setFormData({ ...formData, dive_no: e.target.value })
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
                                    <SelectItem value="AIR">Air Dive</SelectItem>
                                    <SelectItem value="BELL">Bell Dive</SelectItem>
                                    <SelectItem value="SATURATION">Saturation Dive</SelectItem>
                                    <SelectItem value="SCUBA">SCUBA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Dive Team */}
                    <div className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                            <h3 className="font-semibold text-sm">Dive Team</h3>

                            {/* Team Presets dropdown */}
                            {!existingJob && teamCombos.length > 0 && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="ml-auto h-7 gap-2 bg-white dark:bg-slate-950">
                                            <RotateCw className="h-3 w-3 text-blue-600" />
                                            {recommendedTeam ? "Next: " + recommendedTeam.diver_name : "Select Team"}
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
                                                            formData.diver_name === team.diver_name && formData.dive_supervisor === team.dive_supervisor ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200" : ""
                                                        )}
                                                        onClick={() => applyTeam(team)}
                                                    >
                                                        <div className="flex-1 space-y-1">
                                                            <div className="font-medium flex items-center gap-2">
                                                                {recommendedTeam?.signature === team.signature && <Badge variant="secondary" className="px-1 py-0 text-[10px] bg-green-100 text-green-700">NEXT</Badge>}
                                                                {team.diver_name}
                                                                <span className="text-muted-foreground font-normal">+ {team.dive_supervisor}</span>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="diver_name">Primary Diver *</Label>
                                <Input
                                    id="diver_name"
                                    value={formData.diver_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, diver_name: e.target.value })
                                    }
                                    required

                                />
                            </div>

                            {(formData.dive_type === "BELL" || formData.dive_type === "SATURATION") && (
                                <div className="space-y-2">
                                    <Label htmlFor="standby_diver">Standby Diver *</Label>
                                    <Input
                                        id="standby_diver"
                                        value={formData.standby_diver}
                                        onChange={(e) =>
                                            setFormData({ ...formData, standby_diver: e.target.value })
                                        }
                                        required

                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="dive_supervisor">Dive Supervisor *</Label>
                                <Input
                                    id="dive_supervisor"
                                    value={formData.dive_supervisor}
                                    onChange={(e) =>
                                        setFormData({ ...formData, dive_supervisor: e.target.value })
                                    }
                                    required

                                />
                            </div>

                            <div className="space-y-2">
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

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dive_date">Dive Date *</Label>
                            <Input
                                id="dive_date"
                                type="date"
                                value={formData.dive_date}
                                onChange={(e) =>
                                    setFormData({ ...formData, dive_date: e.target.value })
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

                    {/* Additional Personnel - Only for Bell/Sat Dives */}
                    {(formData.dive_type === "BELL" || formData.dive_type === "SATURATION") && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="bell_operator">Bell Operator</Label>
                                <Input
                                    id="bell_operator"
                                    value={formData.bell_operator}
                                    onChange={(e) =>
                                        setFormData({ ...formData, bell_operator: e.target.value })
                                    }

                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="life_support_technician">Life Support Technician</Label>
                                <Input
                                    id="life_support_technician"
                                    value={formData.life_support_technician}
                                    onChange={(e) =>
                                        setFormData({ ...formData, life_support_technician: e.target.value })
                                    }

                                />
                            </div>
                        </div>
                    )}

                    {/* Submit */}
                    {!existingJob ? (
                        <div className="pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700"
                            >
                                {loading ? "Creating..." : "Create Dive Deployment"}
                            </Button>
                        </div>
                    ) : (
                        <div className="pt-4 flex items-center justify-between gap-4">
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={loading}
                                onClick={handleDelete}
                                className="flex-1"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Deployment
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {loading ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    )}
                </form>

                {/* Historical Teams List (Bottom) */}
                {!existingJob && teamCombos.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-4">
                            <History className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                                Historical Team Combinations
                            </h3>
                            <Badge variant="outline" className="ml-auto text-xs font-normal">
                                {teamCombos.length} found for this Scope
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {teamCombos.map((team, idx) => (
                                <div
                                    key={team.signature}
                                    className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer transition-all group relative"
                                    onClick={() => applyTeam(team)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            {team.diver_name}
                                            {recommendedTeam?.signature === team.signature && <Badge className="mx-2 h-4 px-1 text-[9px] bg-green-600 font-normal">Next Rotation</Badge>}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                            Used {team.count}x
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground grid grid-cols-2 gap-y-1">
                                        <span>Sup: {team.dive_supervisor}</span>
                                        <span>RC: {team.report_coordinator || '-'}</span>
                                    </div>
                                    {team.lastUsed && (
                                        <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-1 flex justify-between">
                                            <span>Last: {new Date(team.lastUsed).toLocaleDateString()}</span>
                                        </div>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50"
                                        onClick={(e) => hideTeam(e, team.signature)}
                                        title="Hide/Discard"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
