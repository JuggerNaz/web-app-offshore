
"use client";

import { useAttachmentStore } from "@/stores/attachment-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { processAttachmentUrl, formatBytes } from "@/utils/storage";
import { useEffect, useState } from "react";
import { FileText, Calendar, HardDrive, ExternalLink, Download, Trash2, Save, X, Loader2 } from "lucide-react";
import moment from "moment";
import { toast } from "sonner";
import { fetcher } from "@/utils/utils";
import { mutate } from "swr";

export function AttachmentSlideOver() {
    const { isSlideOverOpen, closeSlideOver, activeAttachment } = useAttachmentStore();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (activeAttachment) {
            setTitle(activeAttachment.name || "");
            setDescription(""); // Description not in current schema, would need to add to DB or meta
        } else {
            setTitle("");
            setDescription("");
        }
    }, [activeAttachment]);

    const onSave = async () => {
        if (!activeAttachment) return;

        try {
            setIsSaving(true);
            // Update API call here
            // For now, let's pretend we update the name in the DB
            // await fetcher(`/api/attachment/${activeAttachment.id}`, { method: 'PATCH', body: JSON.stringify({ name: title }) })

            await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
            toast.success("Changes saved successfully");
            closeSlideOver();
            mutate('/api/attachment'); // Refresh list
        } catch (e) {
            toast.error("Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    if (!activeAttachment && !isSlideOverOpen) return null;

    const { fileUrl, isImage, fileName, fileType } = activeAttachment ? processAttachmentUrl(activeAttachment) : { fileUrl: "", isImage: false, fileName: "", fileType: "" };
    const enriched = activeAttachment as any || {};

    return (
        <Sheet open={isSlideOverOpen} onOpenChange={(open: boolean) => !open && closeSlideOver()}>
            <SheetContent className="w-full sm:w-[540px] flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-0 border-l border-slate-200 dark:border-slate-800 shadow-xl gap-0">

                {/* Header */}
                <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <SheetHeader>
                        <SheetTitle className="text-xl font-bold flex items-center gap-2">
                            {activeAttachment ? "Edit Attachment" : "Add Attachment"}
                        </SheetTitle>
                        <SheetDescription>
                            {activeAttachment ? "Update attachment details and metadata." : "Upload new files to the system."}
                        </SheetDescription>
                    </SheetHeader>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Preview Section */}
                    {activeAttachment && (
                        <div className="space-y-4">
                            <div className="aspect-video w-full bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center relative shadow-inner">
                                {isImage ? (
                                    <img src={fileUrl || ""} alt={fileName} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-slate-400">
                                        <FileText className="h-16 w-16 opacity-50" />
                                        <span className="text-xs font-bold uppercase tracking-widest">{fileType}</span>
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                    <Button variant="secondary" size="sm" onClick={() => fileUrl && window.open(fileUrl, '_blank')}>
                                        <ExternalLink className="mr-2 h-4 w-4" /> Open Original
                                    </Button>
                                </div>
                            </div>

                            {/* File Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                        <HardDrive className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">File Size</p>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formatBytes((activeAttachment.meta as any)?.file_size || 0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Uploaded</p>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{moment(activeAttachment.created_at).format("DD MMM YYYY")}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wide text-slate-500">Display Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-white dark:bg-slate-900"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="desc" className="text-xs font-bold uppercase tracking-wide text-slate-500">Description</Label>
                            <Textarea
                                id="desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-white dark:bg-slate-900 resize-none h-24"
                                placeholder="Add a description for this attachment..."
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 pt-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Associated Structure</Label>
                                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    {(enriched.structure_name || enriched.source_type) ? (
                                        <span className="text-sm font-medium">
                                            {enriched.structure_name || (
                                                <span className="capitalize opacity-70">{enriched.source_type?.replace('_', ' ')}</span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-slate-400 italic">None linked</span>
                                    )}
                                </div>
                            </div>
                            {enriched.component_name && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Associated Component</Label>
                                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        <span className="text-sm font-medium">{enriched.component_name}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer actions */}
                <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 mt-auto">
                    <SheetFooter className="flex-row gap-3 justify-end w-full">
                        <Button onClick={onSave} disabled={isSaving} size="icon" className="bg-blue-600 hover:bg-blue-700" title="Save Changes">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:border-red-900/30" title="Delete">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" onClick={closeSlideOver}>Cancel</Button>
                    </SheetFooter>
                </div>

            </SheetContent>
        </Sheet>
    );
}
