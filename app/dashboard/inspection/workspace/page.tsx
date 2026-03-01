"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LifeBuoy, ArrowLeft, Anchor, Waves } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";

import { DiveInspectionContent } from "../dive/page";
import { ROVInspectionContent } from "../rov/page";

function WorkspaceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const jobpackId = searchParams.get("jobpack");
    const structureId = searchParams.get("structure");
    const sowId = searchParams.get("sow");

    const defaultMode = searchParams.get("mode") || "DIVING";
    const [activeTab, setActiveTab] = useState(defaultMode);

    // Structure Title State
    const [platformTitle, setPlatformTitle] = useState<string>("");
    const effectiveStructureId = structureId && !isNaN(Number(structureId)) ? Number(structureId) : null;

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
                    .from("structure")
                    .select("*")
                    .eq("str_id", effectiveStructureId)
                    .maybeSingle();

                if (!sError && sData) {
                    structureData = sData;
                } else {
                    // 2. Fallback to 'u_structure'
                    const { data: uData, error: uError } = await supabase
                        .from("u_structure")
                        .select("*")
                        .eq("str_id", effectiveStructureId)
                        .maybeSingle();
                    if (!uError && uData) structureData = uData;
                }

                if (structureData) {
                    const type = (structureData.str_type || "").toUpperCase();
                    if (type.includes("PLATFORM")) {
                        const searchId = structureData.plat_id || structureData.str_id;
                        const { data: platData } = await supabase
                            .from("platform")
                            .select("title")
                            .eq("plat_id", searchId)
                            .maybeSingle();
                        title = platData?.title || structureData.str_desc || structureData.title || structureData.str_id;
                    } else if (type.includes("PIPELINE")) {
                        const searchId = structureData.pipe_id || structureData.str_id;
                        const { data: pipeData } = await supabase
                            .from("u_pipeline")
                            .select("title")
                            .eq("pipe_id", searchId)
                            .maybeSingle();
                        title = pipeData?.title || structureData.str_desc || structureData.title || structureData.str_id;
                    } else {
                        title = structureData.title || structureData.str_desc || structureData.str_type || "STR";
                    }
                }
                setPlatformTitle(title || "STR");
            } catch (err) {
                console.error("Unexpected error fetching platform title:", err);
            }
        }
        fetchPlatformTitle();
    }, [effectiveStructureId, supabase]);

    // Job Pack Name State
    const [jobPackName, setJobPackName] = useState<string>("");

    useEffect(() => {
        async function fetchJobPackName() {
            if (!jobpackId) return;
            try {
                const qId = isNaN(Number(jobpackId)) ? jobpackId : Number(jobpackId);
                const { data } = await supabase
                    .from("jobpack")
                    .select("name")
                    .eq("id", qId)
                    .maybeSingle();
                if (data?.name) {
                    setJobPackName(data.name);
                } else {
                    setJobPackName(`Job Pack ${jobpackId}`);
                }
            } catch (err) {
                console.error("Error fetching jobpack name:", err);
                setJobPackName(`Job Pack ${jobpackId}`);
            }
        }
        fetchJobPackName();
    }, [jobpackId, supabase]);

    // SOW Report Number State
    const [sowReportNumber, setSowReportNumber] = useState<string | null>(null);

    useEffect(() => {
        async function resolveSowDetails() {
            if (!sowId) {
                setSowReportNumber(null);
                return;
            }
            try {
                const [sRecordId, sItemNo] = sowId.split("-");
                if (sRecordId && sItemNo) {
                    const { data: itemData } = await supabase
                        .from("u_sow_items")
                        .select("report_number, sow_id, id")
                        .eq("sow_id", sRecordId)
                        .eq("id", sItemNo)
                        .maybeSingle();
                    if (itemData) {
                        if (itemData.report_number) {
                            setSowReportNumber(itemData.report_number);
                        } else {
                            const { data: sowData } = await supabase
                                .from("u_sow")
                                .select("structure_title")
                                .eq("id", sRecordId)
                                .maybeSingle();
                            if (sowData?.structure_title) {
                                setSowReportNumber(`${sowData.structure_title}-${itemData.id}`);
                            } else {
                                setSowReportNumber(`${sRecordId}-${sItemNo}`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error resolving SOW details:", err);
            }
        }
        resolveSowDetails();
    }, [sowId, supabase]);

    return (
        <div className="flex flex-col h-screen min-h-0 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950">
            <div className="flex flex-col flex-1 min-h-0 w-full max-w-[1920px] mx-auto px-4 py-3 pb-0">

                {/* Main Header */}
                <div className="mb-3 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/20">
                            <LifeBuoy className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                                {platformTitle ? `${platformTitle}` : "Inspection Workspace"}
                                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent border-l-2 border-slate-300 dark:border-slate-700 pl-3">
                                    Workspace
                                </span>
                            </h1>
                            <div className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2">
                                <span className="text-slate-700 dark:text-slate-300 font-bold tracking-wide">{jobPackName || jobpackId}</span>
                                {sowReportNumber && (
                                    <>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span className="text-blue-600 dark:text-blue-400 font-semibold">{sowReportNumber}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Unified Tab Selector */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-row">
                            <TabsList className="bg-slate-200/50 dark:bg-slate-800/50 p-1 border shadow-inner">
                                <TabsTrigger value="DIVING" className="gap-2 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow text-sm font-bold transition-all">
                                    <Waves className="h-4 w-4" /> Diving
                                </TabsTrigger>
                                <TabsTrigger value="ROV" className="gap-2 px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow text-sm font-bold transition-all">
                                    <Anchor className="h-4 w-4" /> ROV
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Link href="/dashboard/inspection">
                            <Button variant="outline" className="gap-2 shadow-sm whitespace-nowrap">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Selection
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex-1 w-full relative min-h-0 bg-white/50 dark:bg-slate-950/20 rounded-xl overflow-hidden ring-1 ring-slate-200/50 dark:ring-slate-800/50 shadow-sm backdrop-blur-3xl">
                    {activeTab === "DIVING" && (
                        <DiveInspectionContent hideHeader={true} />
                    )}
                    {activeTab === "ROV" && (
                        <ROVInspectionContent hideHeader={true} />
                    )}
                </div>

            </div>
        </div>
    );
}

export default function WorkspacePage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <LifeBuoy className="h-12 w-12 animate-bounce text-blue-600" />
                </div>
            }
        >
            <WorkspaceContent />
        </Suspense>
    );
}
