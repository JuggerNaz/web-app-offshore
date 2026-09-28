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
    Boxes,
    ChevronRight,
    FileText,
    Database,
    Image as ImageIcon,
    MessageSquare,
    Paperclip,
    Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import SpecHead from "@/components/forms/spec1";
import Spec2Platform from "@/components/forms/spec2-platform";
import StructureImage from "@/components/structure-image/structure-image";
import Comments from "@/components/comment/comments";
import Attachments from "@/components/attachment/attachments";
import Components from "@/components/component/components";

import useSWR from "swr";
import { fetcher } from "@/utils/utils";

interface PlatformSpecsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    platformDetails: any;
    isLoading?: boolean;
    onSuccess?: (updatedPlatform: any) => void;
}

export function PlatformSpecsDialog({
    open,
    onOpenChange,
    platformDetails,
    isLoading = false,
    onSuccess,
}: PlatformSpecsDialogProps) {
    const [, setPageId] = useAtom(urlId);
    const [, setPageType] = useAtom(urlType);
    const [activeTab, setActiveTab] = useState("spec1");

    const platId = platformDetails?.plat_id;
    const { data: swrPlatResponse, isLoading: isSwrLoading } = useSWR(
        open && platId ? `/api/platform/${platId}` : null,
        fetcher
    );

    const activePlatform = swrPlatResponse?.data || platformDetails;
    const isActuallyLoading = isLoading || (isSwrLoading && !activePlatform);

    // Sync Jotai global state so sub-tabs (Spec2Platform, StructureImage, Attachments, etc.) load the correct asset data
    useEffect(() => {
        if (open && activePlatform?.plat_id) {
            setPageId(Number(activePlatform.plat_id));
            setPageType("platform");
        }
    }, [open, activePlatform, setPageId, setPageType]);

    const handleOpenEditPage = () => {
        if (activePlatform?.plat_id) {
            onOpenChange(false);
            window.open(`/dashboard/field/platform/${activePlatform.plat_id}`, "_blank");
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
                                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                                    <span className="text-blue-600 dark:text-blue-400">Platform Details</span>
                                    {activePlatform?.plat_id && (
                                        <>
                                            <ChevronRight className="w-3 h-3 text-slate-400 opacity-60" />
                                            <span className="text-slate-500">ID #{activePlatform.plat_id}</span>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                                        <Boxes className="h-5 w-5" />
                                    </div>
                                    <DialogTitle className="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">
                                        {activePlatform?.title || "Platform Specs"}
                                    </DialogTitle>
                                </div>
                            </div>

                            {/* Header Action Buttons */}
                            <div className="flex items-center gap-2">
                                {activePlatform?.plat_id && (
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
                                        className="rounded-xl h-10 px-5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all gap-2"
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
                                label="Platform Specs"
                            />
                            <TabTrigger
                                value="spec2"
                                icon={<Database className="h-3.5 w-3.5" />}
                                label="Extended Data"
                                disabled={!activePlatform?.plat_id}
                            />
                            <TabTrigger
                                value="structure-image"
                                icon={<ImageIcon className="h-3.5 w-3.5" />}
                                label="Visuals"
                                disabled={!activePlatform?.plat_id}
                            />
                            <TabTrigger
                                value="components"
                                icon={<Boxes className="h-3.5 w-3.5" />}
                                label="Components"
                                disabled={!activePlatform?.plat_id}
                            />
                            <TabTrigger
                                value="comments"
                                icon={<MessageSquare className="h-3.5 w-3.5" />}
                                label="Comments"
                                disabled={!activePlatform?.plat_id}
                            />
                            <TabTrigger
                                value="attachments"
                                icon={<Paperclip className="h-3.5 w-3.5" />}
                                label="Attachments"
                                disabled={!activePlatform?.plat_id}
                            />
                        </TabsList>
                    </DialogHeader>

                    {/* Scrollable Tabs Content */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/40 dark:bg-transparent">
                        {isActuallyLoading ? (
                            <div className="py-24 flex flex-col items-center justify-center space-y-3">
                                <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Specifications...</p>
                            </div>
                        ) : !activePlatform ? (
                            <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs">
                                No platform specification data available.
                            </div>
                        ) : (
                            <div className="p-4 sm:p-6">
                                <TabsContent value="spec1" className="focus-visible:outline-none m-0">
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <SpecHead data={activePlatform} onSaved={onSuccess} />
                                    </Suspense>
                                </TabsContent>
                                <TabsContent value="spec2" className="focus-visible:outline-none m-0">
                                    <Suspense fallback={<LoadingSpinner />}>
                                        <Spec2Platform />
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
                "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm border border-transparent",
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
            <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
        </div>
    );
}
