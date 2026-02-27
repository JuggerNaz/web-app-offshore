
"use client";

import { useAttachmentStore } from "@/stores/attachment-store";
import { cn } from "@/lib/utils";
import { AttachmentToolbar } from "./attachment-toolbar";
import { AttachmentSlideOver } from "./attachment-slide-over";
import AttachmentTreeView from "@/components/attachment/attachment-tree-view";
import { Toaster } from "@/components/ui/sonner";

export function AttachmentLayout() {
    return (
        <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Toolbar */}
                <AttachmentToolbar />

                {/* View Area */}
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <AttachmentTreeView />
                </div>
            </div>

            {/* Slide Over Panel */}
            <AttachmentSlideOver />

            <Toaster />
        </div>
    );
}
