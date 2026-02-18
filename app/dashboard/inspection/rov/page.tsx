"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Bot,
    ArrowLeft,
    Settings,
    Play,
    Camera,
    Database,
    ClipboardList,
    MapPin,
    Activity,
    Plus
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

// Import components
import ROVJobSetupDialog from "./components/ROVJobSetupDialog";
import ROVLiveDataDialog from "./components/ROVLiveDataDialog";
import ROVVideoDialog from "./components/ROVVideoDialog";
import ROVInspectionDialog from "./components/ROVInspectionDialog";
import ROVMovementDialog from "./components/ROVMovementDialog";
import ComponentTreeDialog from "./components/ComponentTreeDialog";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";

interface ROVJob {
    rov_job_id: number;
    deployment_no: string;
    rov_serial_no: string;
    rov_operator: string;
    status: string;
    structure_id?: number;
}

function ROVInspectionContent() {
    const searchParams = useSearchParams();
    const supabase = createClient();

    const jobpackId = searchParams.get("jobpack");
    const structureId = searchParams.get("structure");
    const sowId = searchParams.get("sow");

    const [rovJob, setRovJob] = useState<ROVJob | null>(null);
    const [selectedComponent, setSelectedComponent] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Resolve effective structure ID (handle string codes in URL vs numeric ID in job)
    const paramStructureId = structureId && !isNaN(Number(structureId)) ? Number(structureId) : null;
    const effectiveStructureId = paramStructureId ?? rovJob?.structure_id ?? null;

    // Platform Title State
    const [platformTitle, setPlatformTitle] = useState<string>("");

    useEffect(() => {
        async function fetchPlatformTitle() {
            if (!effectiveStructureId) {
                setPlatformTitle("");
                return;
            }

            try {
                let structureData: any = null;
                let title = "";

                // 1. Try 'structure' table first
                const { data: sData, error: sError } = await supabase
                    .from('structure')
                    .select('*')
                    .eq('str_id', effectiveStructureId)
                    .maybeSingle();

                if (!sError && sData) {
                    structureData = sData;
                } else {
                    // 2. Fallback to 'u_structure'
                    const { data: uData, error: uError } = await supabase
                        .from('u_structure')
                        .select('*')
                        .eq('str_id', effectiveStructureId)
                        .maybeSingle();
                    if (!uError && uData) structureData = uData;
                }

                if (structureData) {
                    const type = (structureData.str_type || "").toUpperCase();

                    if (type.includes('PLATFORM') && structureData.plat_id) {
                        const { data: platData } = await supabase
                            .from('platform')
                            .select('title')
                            .eq('plat_id', structureData.plat_id)
                            .maybeSingle();
                        if (platData?.title) title = platData.title;
                        else title = structureData.title || structureData.str_desc;

                    } else if (type.includes('PIPELINE') && structureData.pipe_id) {
                        const { data: pipeData } = await supabase
                            .from('u_pipeline')
                            .select('title')
                            .eq('pipe_id', structureData.pipe_id)
                            .maybeSingle();
                        if (pipeData?.title) title = pipeData.title;
                        else title = structureData.title || structureData.str_desc;

                    } else {
                        title = structureData.title || structureData.str_desc || "STR";
                    }
                }
                setPlatformTitle(title);
            } catch (err) {
                console.error("Error fetching platform title:", err);
            }
        }

        fetchPlatformTitle();
    }, [effectiveStructureId, supabase]);

    // Dialog states
    const [setupDialogOpen, setSetupDialogOpen] = useState(false);
    const [liveDataDialogOpen, setLiveDataDialogOpen] = useState(false);
    const [videoDialogOpen, setVideoDialogOpen] = useState(false);
    const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
    const [movementDialogOpen, setMovementDialogOpen] = useState(false);

    const [componentTreeDialogOpen, setComponentTreeDialogOpen] = useState(false);
    const [specDialogOpen, setSpecDialogOpen] = useState(false);

    // Latest activity states
    const [latestInspection, setLatestInspection] = useState<any>(null);
    const [latestMovement, setLatestMovement] = useState<any>(null);
    const [inspectionCount, setInspectionCount] = useState(0);
    const [movementCount, setMovementCount] = useState(0);

    const [sowReportNumber, setSowReportNumber] = useState<string | null>(null);

    // Resolve SOW report number from URL param
    useEffect(() => {
        async function resolveSowDetails() {
            if (!sowId) {
                setSowReportNumber(null);
                return;
            }

            try {
                const [sRecordId, sItemNo] = sowId.split("-");
                if (sRecordId && sItemNo) {
                    const { data } = await supabase
                        .from("u_sow_items")
                        .select("report_number")
                        .eq("sow_id", sRecordId)
                        .eq("id", sItemNo)
                        .maybeSingle();

                    if (data?.report_number) {
                        setSowReportNumber(data.report_number);
                    }
                }
            } catch (err) {
                console.error("Error resolving SOW details:", err);
            }
        }
        resolveSowDetails();
    }, [sowId, supabase]);

    useEffect(() => {
        checkExistingROVJob();
    }, [jobpackId, effectiveStructureId, sowReportNumber]);

    useEffect(() => {
        if (rovJob) {
            loadLatestData();
            // Refresh latest data every 10 seconds
            const interval = setInterval(loadLatestData, 10000);
            return () => clearInterval(interval);
        }
    }, [rovJob]);

    async function checkExistingROVJob() {
        if (!jobpackId) return;

        try {
            const queryJobPackId = isNaN(Number(jobpackId)) ? jobpackId : Number(jobpackId);

            let query = supabase
                .from("insp_rov_jobs")
                .select("*")
                .eq("jobpack_id", queryJobPackId);

            if (effectiveStructureId) {
                query = query.eq("structure_id", effectiveStructureId);
            }

            if (sowReportNumber) {
                query = query.eq("sow_report_no", sowReportNumber);
            }

            const { data, error } = await query
                .eq("status", "IN_PROGRESS")
                .maybeSingle();

            if (data) {
                setRovJob(data);
            }
            // Don't auto-open setup dialog - let user view historical data
        } catch (error) {
            console.log("No existing ROV job found");
            // Don't auto-open setup dialog
        } finally {
            setLoading(false);
        }
    }

    async function loadLatestData() {
        if (!rovJob) return;

        try {
            // Load latest inspection
            const { data: inspData } = await supabase
                .from("insp_rov_data")
                .select("*")
                .eq("rov_job_id", rovJob.rov_job_id)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            setLatestInspection(inspData);

            // Count inspections
            const { count: inspCount } = await supabase
                .from("insp_rov_data")
                .select("*", { count: "exact", head: true })
                .eq("rov_job_id", rovJob.rov_job_id);

            setInspectionCount(inspCount || 0);

            // Load latest movement
            const { data: moveData } = await supabase
                .from("insp_rov_movements")
                .select("*")
                .eq("rov_job_id", rovJob.rov_job_id)
                .order("timestamp", { ascending: false })
                .limit(1)
                .single();

            setLatestMovement(moveData);

            // Count movements
            const { count: moveCount } = await supabase
                .from("insp_rov_movements")
                .select("*", { count: "exact", head: true })
                .eq("rov_job_id", rovJob.rov_job_id);

            setMovementCount(moveCount || 0);
        } catch (error) {
            console.log("Error loading latest data:", error);
        }
    }

    function handleROVJobCreated(job: ROVJob) {
        setRovJob(job);
        setSetupDialogOpen(false);
        toast.success("ROV deployment created successfully!");
    }

    function handleComponentSelect(component: any) {
        setSelectedComponent(component);
        setComponentTreeDialogOpen(false);
    }

    function formatTime(timestamp: string): string {
        return new Date(timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Bot className="h-12 w-12 animate-spin mx-auto mb-4 text-cyan-600" />
                    <p className="text-muted-foreground">Loading ROV inspection...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50 dark:from-slate-950 dark:via-cyan-950/10 dark:to-slate-950">
            <div className="container max-w-[1920px] mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-800 text-white shadow-lg shadow-cyan-500/20">
                            <Bot className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                {platformTitle ? `${platformTitle} - ROV Inspection` : "ROV Inspection"}
                            </h1>
                            <div className="text-sm text-muted-foreground mt-1">
                                {rovJob ? (
                                    <>
                                        {rovJob.deployment_no} • ROV: {rovJob.rov_serial_no} •{" "}
                                        <Badge variant="default" className="bg-green-600">
                                            {rovJob.status}
                                        </Badge>
                                    </>
                                ) : (
                                    <>
                                        Job Pack: {jobpackId}
                                        {platformTitle && ` • Structure: ${platformTitle}`}
                                        {sowReportNumber && ` • SOW: ${sowReportNumber}`}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <Link href="/dashboard/inspection">
                        <Button variant="outline" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Selection
                        </Button>
                    </Link>
                </div>

                {/* Dashboard Cards Grid */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Deployment Info Card - Full Width */}
                    <Card className="col-span-12 p-6 shadow-xl border-cyan-200 dark:border-cyan-900 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-cyan-600 text-white">
                                    <Bot className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {rovJob ? rovJob.deployment_no : "No Active Deployment"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {rovJob
                                            ? `Operator: ${rovJob.rov_operator} | ROV: ${rovJob.rov_serial_no}`
                                            : "View historical data or create a new deployment to start inspection"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {rovJob && (
                                    <Button
                                        onClick={() => setSetupDialogOpen(true)}
                                        variant="outline"
                                        className="gap-2"
                                    >
                                        <Settings className="h-4 w-4" />
                                        View Details
                                    </Button>
                                )}
                                <Button
                                    onClick={() => setSetupDialogOpen(true)}
                                    variant={rovJob ? "outline" : "default"}
                                    className={rovJob ? "gap-2" : "gap-2 bg-gradient-to-r from-cyan-600 to-cyan-700"}
                                >
                                    <Plus className="h-4 w-4" />
                                    New Deployment
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {/* Live Data Card */}
                    <Card className="col-span-4 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-blue-200 dark:border-blue-900">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-blue-600" />
                                    <h3 className="font-bold">Live Data</h3>
                                </div>
                                <Button
                                    onClick={() => setLiveDataDialogOpen(true)}
                                    disabled={!rovJob}
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                >
                                    <Settings className="h-3 w-3" />
                                    Configure
                                </Button>
                            </div>

                            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                                <p className="text-xs text-blue-900 dark:text-blue-100 font-medium mb-2">
                                    Data Acquisition Status
                                </p>
                                <p className="text-2xl font-black text-blue-600">
                                    {rovJob ? "READY" : "NOT CONFIGURED"}
                                </p>
                            </div>

                            <div className="text-xs text-muted-foreground">
                                {rovJob
                                    ? "Click Configure to start data acquisition"
                                    : "Setup deployment first"}
                            </div>
                        </div>
                    </Card>

                    {/* Video Feed Card */}
                    <Card className="col-span-4 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-purple-200 dark:border-purple-900">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Camera className="h-5 w-5 text-purple-600" />
                                    <h3 className="font-bold">Video & Photos</h3>
                                </div>
                                <Button
                                    onClick={() => setVideoDialogOpen(true)}
                                    disabled={!rovJob}
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                >
                                    <Settings className="h-3 w-3" />
                                    Configure
                                </Button>
                            </div>

                            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                                <p className="text-xs text-purple-900 dark:text-purple-100 font-medium mb-2">
                                    Video Capture Status
                                </p>
                                <p className="text-2xl font-black text-purple-600">
                                    {rovJob ? "READY" : "NOT CONFIGURED"}
                                </p>
                            </div>

                            <div className="text-xs text-muted-foreground">
                                {rovJob
                                    ? "Click Configure to start video/photo capture"
                                    : "Setup deployment first"}
                            </div>
                        </div>
                    </Card>

                    {/* Component Tree Card */}
                    <Card
                        className={`col-span-4 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-green-200 dark:border-green-900 ${selectedComponent ? "bg-green-50/50 dark:bg-green-950/10 ring-2 ring-green-500 ring-offset-2" : ""
                            }`}
                        onClick={() => {
                            if (selectedComponent) {
                                setSpecDialogOpen(true);
                            } else {
                                setComponentTreeDialogOpen(true);
                            }
                        }}
                    >
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Database className="h-5 w-5 text-green-600" />
                                    <h3 className="font-bold">Components</h3>
                                </div>
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setComponentTreeDialogOpen(true);
                                    }}
                                    disabled={!rovJob}
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                >
                                    <Play className="h-3 w-3" />
                                    {selectedComponent ? "Change" : "Select"}
                                </Button>
                            </div>

                            <div className={`p-4 rounded-lg border ${selectedComponent
                                ? "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800"
                                : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                                }`}>
                                <p className="text-xs text-green-900 dark:text-green-100 font-medium mb-2">
                                    {selectedComponent ? "Selected Component" : "No Selection"}
                                </p>
                                <p className="text-lg font-bold text-green-600 truncate">
                                    {selectedComponent
                                        ? (selectedComponent.q_id || selectedComponent.component_qid || "Unknown ID")
                                        : "Click to select"}
                                </p>
                            </div>

                            <div className="text-xs text-muted-foreground">
                                {selectedComponent
                                    ? `ID: ${selectedComponent.q_id || selectedComponent.component_qid} • Click for details`
                                    : "Select component for inspection"}
                            </div>
                        </div>
                    </Card>

                    {/* Inspection Records Card */}
                    <Card className="col-span-6 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-orange-200 dark:border-orange-900">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-orange-600" />
                                    <h3 className="font-bold">Inspection Records</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{inspectionCount} records</Badge>
                                    <Button
                                        onClick={() => setInspectionDialogOpen(true)}
                                        disabled={!rovJob}
                                        size="sm"
                                        variant="outline"
                                        className="gap-2"
                                    >
                                        <Play className="h-3 w-3" />
                                        Record
                                    </Button>
                                </div>
                            </div>

                            {latestInspection ? (
                                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-orange-900 dark:text-orange-100 font-medium">
                                            Latest Inspection
                                        </p>
                                        <span className="text-xs text-muted-foreground">
                                            {formatTime(latestInspection.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                                        {latestInspection.component_qid || "Component N/A"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Type: {latestInspection.inspection_type} | Status:{" "}
                                        {latestInspection.condition}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                                    <p className="text-sm text-center text-muted-foreground">
                                        No inspections recorded yet
                                    </p>
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                                {rovJob
                                    ? "Click Record to add new inspection"
                                    : "Setup deployment first"}
                            </div>
                        </div>
                    </Card>

                    {/* Movement Log Card */}
                    <Card className="col-span-6 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-indigo-200 dark:border-indigo-900">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-indigo-600" />
                                    <h3 className="font-bold">Movement Log</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{movementCount} entries</Badge>
                                    <Button
                                        onClick={() => setMovementDialogOpen(true)}
                                        disabled={!rovJob}
                                        size="sm"
                                        variant="outline"
                                        className="gap-2"
                                    >
                                        <Play className="h-3 w-3" />
                                        Log
                                    </Button>
                                </div>
                            </div>

                            {latestMovement ? (
                                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-indigo-900 dark:text-indigo-100 font-medium">
                                            Latest Movement
                                        </p>
                                        <span className="text-xs text-muted-foreground">
                                            {formatTime(latestMovement.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                                        {latestMovement.location}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {latestMovement.activity}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                                    <p className="text-sm text-center text-muted-foreground">
                                        No movements logged yet
                                    </p>
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                                {rovJob ? "Click Log to add new movement" : "Setup deployment first"}
                            </div>
                        </div>
                    </Card>
                </div>
            </div >

            {/* Dialogs */}
            <ROVJobSetupDialog
                open={setupDialogOpen}
                onOpenChange={setSetupDialogOpen}
                jobpackId={jobpackId}
                sowId={sowReportNumber}
                structureId={effectiveStructureId}
                onJobCreated={handleROVJobCreated}
                existingJob={rovJob}
            />

            <ROVLiveDataDialog
                open={liveDataDialogOpen}
                onOpenChange={setLiveDataDialogOpen}
                rovJob={rovJob}
            />

            <ROVVideoDialog
                open={videoDialogOpen}
                onOpenChange={setVideoDialogOpen}
                rovJob={rovJob}
            />

            <ROVInspectionDialog
                open={inspectionDialogOpen}
                onOpenChange={setInspectionDialogOpen}
                rovJob={rovJob}
                selectedComponent={selectedComponent}
                platformTitle={platformTitle}
                onInspectionSaved={loadLatestData}
            />

            <ROVMovementDialog
                open={movementDialogOpen}
                onOpenChange={setMovementDialogOpen}
                rovJob={rovJob}
                onMovementSaved={loadLatestData}
            />

            <ComponentTreeDialog
                open={componentTreeDialogOpen}
                onOpenChange={setComponentTreeDialogOpen}
                structureId={effectiveStructureId?.toString() || null}
                jobpackId={jobpackId}
                sowId={sowReportNumber}
                onComponentSelect={handleComponentSelect}
                selectedComponent={selectedComponent}
            />


            <ComponentSpecDialog
                open={specDialogOpen}
                onOpenChange={setSpecDialogOpen}
                component={selectedComponent}
            />
        </div >
    );
}

export default function ROVInspectionPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <Bot className="h-12 w-12 animate-spin text-cyan-600" />
                </div>
            }
        >
            <ROVInspectionContent />
        </Suspense>
    );
}
