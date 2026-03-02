
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateJobPackSummaryReport } from "@/utils/report-generators/jobpack-summary-report";
import { ReportConfig } from "@/utils/pdf-generator";
import { Loader2, Printer, Download } from "lucide-react";

interface JobPackSummaryPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobPack: any;
}

export function JobPackSummaryPreviewDialog({
    open,
    onOpenChange,
    jobPack
}: JobPackSummaryPreviewDialogProps) {
    const [loading, setLoading] = useState(false);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        if (open && jobPack) {
            setLoading(true);
            // Generate Report with reasonable defaults
            const config: ReportConfig = {
                reportNoPrefix: "RPT",
                reportYear: new Date().getFullYear().toString(),
                preparedBy: { name: "", date: "" },
                reviewedBy: { name: "", date: "" },
                approvedBy: { name: "", date: "" },
                watermark: { enabled: true, text: "DRAFT", transparency: 0.1 },
                showContractorLogo: true,
                showPageNumbers: true,
                returnBlob: true
            };

            const settings = {
                company_name: "NasQuest Resources Sdn Bhd",
                // logo_url can be fetched if needed, or rely on defaults
            };

            generateJobPackSummaryReport(jobPack, settings, config)
                .then((blob: any) => {
                    if (active && blob instanceof Blob) {
                        const url = URL.createObjectURL(blob);
                        setBlobUrl(url);
                    }
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        }

        return () => {
            active = false;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, jobPack]);

    const handleDownload = () => {
        if (blobUrl) {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `JobPack_Summary_${jobPack?.name || 'report'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handlePrint = () => {
        if (blobUrl) {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = blobUrl;
            document.body.appendChild(iframe);
            // Wait for load? usually blob loads instantly
            setTimeout(() => {
                iframe.contentWindow?.print();
                // Clean up iframe after print dialog closes (approx)
                setTimeout(() => document.body.removeChild(iframe), 60000);
            }, 100);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b bg-white dark:bg-slate-950 rounded-t-lg items-center flex-row justify-between space-y-0">
                    <DialogTitle>Job Pack Summary Report</DialogTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint} disabled={!blobUrl}>
                            <Printer className="w-4 h-4 mr-2" /> Print
                        </Button>
                        <Button variant="default" size="sm" onClick={handleDownload} disabled={!blobUrl}>
                            <Download className="w-4 h-4 mr-2" /> Download
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 bg-slate-100 dark:bg-slate-900 p-4 overflow-hidden relative">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-10">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                            <span className="mt-4 text-slate-700 dark:text-slate-300 font-medium animate-pulse">Generating Report preview...</span>
                        </div>
                    ) : null}

                    {blobUrl ? (
                        <iframe
                            src={`${blobUrl}#toolbar=0&navpanes=0`}
                            className="w-full h-full rounded-md shadow-sm border bg-white"
                            title="PDF Preview"
                        />
                    ) : (
                        !loading && (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                <div className="text-center">
                                    <p>Failed to load preview.</p>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
