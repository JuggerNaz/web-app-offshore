import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import DiveVideoRecorder from "@/components/dive-video-recorder";

interface ROVVideoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rovJob: any;
}

export default function ROVVideoDialog({
    open,
    onOpenChange,
    rovJob,
}: ROVVideoDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-4 bg-transparent border-none shadow-none text-white">
                <DialogHeader className="hidden">
                    <DialogTitle>ROV Video</DialogTitle>
                    <DialogDescription>ROV Video Recording</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 bg-background rounded-lg border shadow-xl overflow-hidden relative">
                    <DiveVideoRecorder
                        diveJob={rovJob}
                        onClose={() => onOpenChange(false)}
                        className="h-full w-full border-none rounded-none"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
