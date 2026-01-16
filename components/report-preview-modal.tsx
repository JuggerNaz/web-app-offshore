"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, Printer, X } from "lucide-react";
import { useState } from "react";

interface ReportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportHtml: string;
    structureName: string;
    onDownload: () => void;
    onPrint: () => void;
}

export function ReportPreviewModal({
    isOpen,
    onClose,
    reportHtml,
    structureName,
    onDownload,
    onPrint,
}: ReportPreviewModalProps) {
    const [shareMenuOpen, setShareMenuOpen] = useState(false);

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Structure Report - ${structureName}`,
                    text: `Structure Specification Report for ${structureName}`,
                });
            } catch (error) {
                console.error("Error sharing:", error);
            }
        } else {
            setShareMenuOpen(!shareMenuOpen);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
        setShareMenuOpen(false);
    };

    const handleEmailShare = () => {
        const subject = encodeURIComponent(`Structure Report - ${structureName}`);
        const body = encodeURIComponent(`Please find the structure specification report for ${structureName}.`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        setShareMenuOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Report Preview - {structureName}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={onDownload}
                            >
                                <Download className="w-4 h-4" />
                                Download PDF
                            </Button>

                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={handleShare}
                                >
                                    <Share2 className="w-4 h-4" />
                                    Share
                                </Button>

                                {shareMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border rounded-lg shadow-lg z-50">
                                        <button
                                            className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 rounded-t-lg"
                                            onClick={handleCopyLink}
                                        >
                                            Copy Link
                                        </button>
                                        <button
                                            className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 rounded-b-lg"
                                            onClick={handleEmailShare}
                                        >
                                            Share via Email
                                        </button>
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={onPrint}
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto border rounded-lg bg-white">
                    <div
                        className="p-8"
                        dangerouslySetInnerHTML={{ __html: reportHtml }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
