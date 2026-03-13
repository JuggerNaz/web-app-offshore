"use client";

import React, { Suspense } from "react";
import { InspectionProvider } from "@/components/inspection/inspection-context";
import { InspectionLayout } from "@/components/inspection/inspection-layout";
import { InspectionChecklist } from "@/components/inspection/inspection-checklist";
import { InspectionForm } from "@/components/inspection/inspection-form";
import { Inspection3DView } from "@/components/inspection/inspection-3d-view";
import VideoRecorderWidget from "@/components/inspection/video-recorder-widget";
import { useSearchParams } from "next/navigation";

export default function WorkspaceV2Page() {
    return (
        <Suspense fallback={<div className="p-10 flex min-h-screen items-center justify-center font-bold text-slate-500">Loading Workspace...</div>}>
            <InspectionWorkspaceContent />
        </Suspense>
    );
}

function InspectionWorkspaceContent() {
    const searchParams = useSearchParams();
    const structureId = searchParams.get('structure') || undefined;
    const componentId = searchParams.get('component') || undefined;

    return (
        <InspectionProvider initialData={{ componentId: componentId || "" }}>
            <div className="flex flex-col h-screen bg-slate-950">
                {/* Workspace Header */}
                <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-6 justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">I2</div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-100">Inspection 2 Workspace</h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Live Session • Structure {structureId || "N/A"}</p>
                        </div>
                    </div>
                </header>

                {/* Modular Layout */}
                <InspectionLayout
                    leftPanel={<InspectionChecklist />}
                    centerPanel={<InspectionForm />}
                    rightPanel={
                        <div className="space-y-6">
                            <Inspection3DView />
                            <div className="relative h-[400px] rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
                                <VideoRecorderWidget
                                    mode="sidebar"
                                    platformId={structureId}
                                    componentId={componentId}
                                />
                            </div>
                        </div>
                    }
                />
            </div>
        </InspectionProvider>
    );
}
