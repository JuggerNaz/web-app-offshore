"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
    Save,
    ExternalLink,
    Activity,
    ChevronRight,
    FileText,
    Globe,
    Image as ImageIcon,
    MessageSquare,
    Paperclip,
    Boxes
} from "lucide-react";
import { cn } from "@/lib/utils";
import Spec1Pipeline from "@/components/forms/spec1-pipeline";
import Spec2Pipeline from "@/components/forms/spec2-pipeline";
import StructureImage from "@/components/structure-image/structure-image";
import Comments from "@/components/comment/comments";
import Attachments from "@/components/attachment/attachments";
import Components from "@/components/component/components";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";

interface PipelineSpecsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pipelineDetails: any;
    isLoading?: boolean;
}

export function PipelineSpecsDialog({
    open,
    onOpenChange,
    pipelineDetails,
    isLoading = false,
}: PipelineSpecsDialogProps) {
    const [, setPageId] = useAtom(urlId);
    const [, setPageType] = useAtom(urlType);
    const [activeTab, setActiveTab] = useState("spec1");

    const pipeId = pipelineDetails?.pipe_id;
    const { data: swrPipeResponse, isLoading: isSwrLoading } = useSWR(
        open && pipeId ? `/api/pipeline/${pipeId}` : null,
        fetcher
    );

    const activePipeline = swrPipeResponse?.data || pipelineDetails;
    const isActuallyLoading = isLoading || (isSwrLoading && !activePipeline);

    // Sync Jotai global state so sub-tabs (Spec2Pipeline, StructureImage, Attachments, etc.) load the correct asset data
    useEffect(() => {
        if (open && activePipeline?.pipe_id) {
            setPageId(Number(activePipeline.pipe_id));
            setPageType("pipeline");
        }
    }, [open, activePipeline, setPageId, setPageType]);

    const handleOpenEditPage = () => {
        if (activePipeline?.pipe_id) {
            onOpenChange(false);
            window.open(`/dashboard/field/pipeline/${activePipeline.pipe_id}`, "_blank");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[94vh] flex flex-col p-0 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full h-full flex flex-col overflow-hidden"
                >
                    {/* Header Section */}
                    <DialogHeader className="px-6 pt-5 pb-4 bg-slate-50/90 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex flex-col">
                                {/* Subtitle / Breadcrumb */}
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">
                                    <span className="opacity-60">Engineering</span>
                                    <div className="h-1 w-1 rounded-full bg-cyan-500" />
                                    <span className="text-cyan-600 dark:text-cyan-400">Pipeline Details</span>
                                    {activePipeline?.pipe_id && (
                                        <>
                                            <ChevronRight className="w-3 h-3 text-slate-400 opacity-60" />
                                            <span className="text-slate-500">ID #{activePipeline.pipe_id}</span>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <DialogTitle className="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">
                                        {activePipeline?.title || "Pipeline Specs"}
                                    </DialogTitle>
                                </div>
                            </div>

                            {/* Header Action Buttons */}
                            <div className="flex items-center gap-2">
                                {activePipeline?.pipe_id && (
                                    <Button
                                        onClick={handleOpenEditPage}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl h-10 px-4 font-bold text-xs gap-1.5 border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <span>Full Page</span>
                                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                                    </Button>
                                )}

                                {activeTab === "spec1" && (
                                    <Button
                                        form="asset-form"
                                        type="submit"
                                        size="sm"
                                        className="rounded-xl h-10 px-5 font-bold text-xs bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-500/20 transition-all gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        <span>Save Changes</span>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Navigation Tabs List */}
                        <TabsList className="w-full flex h-11 items-center justify-start bg-slate-200/50 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200/70 dark:border-slate-800/60 overflow-x-auto overflow-y-hidden no-scrollbar">
                            <TabTrigger
                                value="spec1"
                                icon={<FileText className="h-3.5 w-3.5" />}
                                label="Pipeline Specs"
                            />
                            <TabTrigger
                                value="spec2"
                                icon={<Globe className="h-3.5 w-3.5" />}
                                label="Geodetic Parameter"
                                disabled={!activePipeline?.pipe_id}
                            />
                            <TabTrigger
                                value="structure-image"
                                icon={<ImageIcon className="h-3.5 w-3.5" />}
                                label="Photos"
                                disabled={!activePipeline?.pipe_id}
                            />
                            <TabTrigger
                                value="components"
                                icon={<Boxes className="h-3.5 w-3.5" />}
                                label="Components"
                                disabled={!activePipeline?.pipe_id}
                            />
                            <TabTrigger
                                value="comments"
                                icon={<MessageSquare className="h-3.5 w-3.5" />}
                                label="Comments"
                                disabled={!activePipeline?.pipe_id}
                            />
                            <TabTrigger
                                value="attachments"
                                icon={<Paperclip className="h-3.5 w-3.5" />}
                                label="Attachments"
                                disabled={!activePipeline?.pipe_id}
                            />
                        </TabsList>
                    </DialogHeader>

                    {/* Scrollable Tabs Content */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/40 dark:bg-transparent">
                        {isActuallyLoading ? (
                            <div className="py-24 flex flex-col items-center justify-center space-y-3">
                                <div className="w-10 h-10 border-4 border-slate-100 border-t-cyan-600 rounded-full animate-spin" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Specifications...</p>
                            </div>
                        ) : !activePipeline ? (
                            <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs">
                                No pipeline specification data available.
                            </div>
                        ) : (
                            <div className="p-4 sm:p-6">
                                <TabsContent value="spec1" className="focus-visible:outline-none m-0">
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <Spec1Pipeline data={activePipeline} />
                                    </Suspense>
                                </TabsContent>
                                <TabsContent value="spec2" className="focus-visible:outline-none m-0">
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <Spec2Pipeline />
                                    </Suspense>
                                </TabsContent>
                                <TabsContent value="structure-image" className="focus-visible:outline-none m-0">
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <StructureImage />
                                    </Suspense>
                                </TabsContent>
                                <TabsContent value="components" className="focus-visible:outline-none m-0">
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <Components />
                                    </Suspense>
                                </TabsContent>
                                <TabsContent value="comments" className="focus-visible:outline-none m-0">
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <Comments />
                                    </Suspense>
                                </TabsContent>
                                <TabsContent value="attachments" className="focus-visible:outline-none m-0">
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <Attachments />
                                    </Suspense>
                                </TabsContent>
                            </div>
                        )}
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function TabTrigger({
    value,
    icon,
    label,
    disabled,
}: {
    value: string;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
}) {
    return (
        <TabsTrigger
            value={value}
            disabled={disabled}
            className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 h-9 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200",
                "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400 data-[state=active]:shadow-sm border border-transparent",
                "data-[state=inactive]:text-slate-500 hover:data-[state=inactive]:text-slate-900 dark:hover:data-[state=inactive]:text-white",
                disabled && "opacity-40 grayscale pointer-events-none"
            )}
        >
            <span className="shrink-0">{icon}</span>
            <span>{label}</span>
        </TabsTrigger>
    );
}

function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center p-20">
            <div className="w-8 h-8 border-3 border-slate-100 border-t-cyan-600 rounded-full animate-spin" />
        </div>
    );
}
