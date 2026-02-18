"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Download, Share2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";

interface ReportPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    fileName: string;
    generateReport: () => Promise<Blob | void>;
}

export function ReportPreviewDialog({
    open,
    onOpenChange,
    title,
    fileName,
    generateReport
}: ReportPreviewDialogProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [blob, setBlob] = useState<Blob | null>(null);

    useEffect(() => {
        if (open) {
            loadPreview();
        } else {
            // Cleanup on close
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setBlob(null);
            }
        }
    }, [open]);

    const loadPreview = async () => {
        setIsGenerating(true);
        try {
            const result = await generateReport();
            if (result instanceof Blob) {
                setBlob(result);
                const url = URL.createObjectURL(result);
                setPreviewUrl(url);
            } else {
                toast.error("Failed to generate report preview.");
            }
        } catch (error) {
            console.error("Preview generation error:", error);
            toast.error("Error generating report preview.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = () => {
        if (previewUrl) {
            const iframe = document.querySelector('iframe[title="Report Preview"]') as HTMLIFrameElement;
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.print();
            } else {
                window.open(previewUrl, '_blank');
            }
        }
    };

    const handleDownload = () => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Download started");
        }
    };

    const handleShare = async () => {
        if (!blob) return;

        if (navigator.share) {
            try {
                const file = new File([blob], fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`, { type: 'application/pdf' });
                await navigator.share({
                    title: title,
                    text: `Shared Report: ${title}`,
                    files: [file]
                });
                toast.success("Shared successfully");
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error("Share error:", error);
                    toast.error("Failed to share report");
                }
            }
        } else {
            toast.info("Sharing is not supported on this device. Please download instead.");
        }
    };

    const handleOpenNewTab = () => {
        if (previewUrl) {
            window.open(previewUrl, '_blank');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
                <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <span className="p-1.5 bg-blue-600 rounded-lg text-white">
                            <FileText className="w-4 h-4" />
                        </span>
                        {title}
                    </DialogTitle>
                </div>

                <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
                    {isGenerating ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                            <p className="text-muted-foreground animate-pulse font-medium">Generating preview...</p>
                        </div>
                    ) : previewUrl ? (
                        <iframe
                            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="w-full h-full border-none"
                            title="Report Preview"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            Preview unavailable
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-white dark:bg-slate-950 flex justify-end gap-2">
                    <Button variant="outline" onClick={handleOpenNewTab} disabled={!previewUrl}>
                        <Eye className="w-4 h-4 mr-2" /> Open PDF
                    </Button>
                    <Button variant="outline" onClick={handleShare} disabled={!blob}>
                        <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                    <Button variant="outline" onClick={handlePrint} disabled={!previewUrl}>
                        <Printer className="w-4 h-4 mr-2" /> Print
                    </Button>
                    <Button onClick={handleDownload} disabled={!blob} className="bg-blue-600 hover:bg-blue-700">
                        <Download className="w-4 h-4 mr-2" /> Download
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
