"use client";

import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import DiveVideoRecorder from "@/components/dive-video-recorder";

interface DiveVideoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    diveJob: any;
    onToggleMode?: () => void;
    refreshKey?: string | number;
}

export default function DiveVideoDialog({
    open,
    onOpenChange,
    diveJob,
    onToggleMode,
    refreshKey
}: DiveVideoDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-none shadow-2xl sm:rounded-xl">
                <div className="sr-only">
                    <DialogTitle>Video Inspection</DialogTitle>
                    <DialogDescription>Live video feed and recording tools</DialogDescription>
                </div>
                <DiveVideoRecorder
                    diveJob={diveJob}
                    onClose={() => onOpenChange(false)}
                    onToggleMode={onToggleMode}
                    isFloating={false}
                    className="flex-1 w-full h-full border-none rounded-none shadow-none"
                    refreshKey={refreshKey}
                />
            </DialogContent>
        </Dialog>
    );
}
