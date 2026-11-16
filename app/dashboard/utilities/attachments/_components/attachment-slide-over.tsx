
"use client";

import { useAttachmentStore } from "@/stores/attachment-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/dialogs/delete-confirm-dialog";
import { processAttachmentUrl, formatBytes } from "@/utils/storage";
import { getAttachmentCategory, isMediaAttachment } from "@/utils/attachment-category";
import { refreshAttachmentCaches } from "@/utils/attachment-sync";
import { getAttachmentUrl } from "@/utils/attachment-utils";
import { createClient } from "@/utils/supabase/client";
import { fetcher } from "@/utils/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { FileText, Calendar, HardDrive, ExternalLink, Trash2, Save, Loader2, Upload, RefreshCw, Film, Tag, Copy, Paperclip, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";
import { toast } from "sonner";

type TargetType = "platform" | "component" | "inspection";

async function readError(res: Response, fallback: string) {
    try {
        const json = await res.json();
        return json?.error || json?.message || fallback;
    } catch {
        return fallback;
    }
}

export function AttachmentSlideOver() {
    const { isSlideOverOpen, closeSlideOver, activeAttachment, addPreset, selectedPlatformId } = useAttachmentStore();
    const supabase = useMemo(() => createClient(), []);

    const [name, setName] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [replaceFile, setReplaceFile] = useState<File | null>(null);
    const [newFile, setNewFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Add-mode target
    const [targetType, setTargetType] = useState<TargetType>("platform");
    const [targetComponentId, setTargetComponentId] = useState<string>("");
    const [targetInspectionId, setTargetInspectionId] = useState<string>("");
    const [inspectionOptions, setInspectionOptions] = useState<{ id: number; label: string }[]>([]);

    const replaceInputRef = useRef<HTMLInputElement>(null);
    const newInputRef = useRef<HTMLInputElement>(null);

    const isAddMode = !activeAttachment;
    const isMedia = activeAttachment ? isMediaAttachment(activeAttachment) : false;

    // Components of the selected platform (add mode, slim projection)
    const { data: componentsData } = useSWR(
        isSlideOverOpen && isAddMode && selectedPlatformId
            ? `/api/structure-components/lookup?structure_id=${selectedPlatformId}&pageSize=1000`
            : null,
        fetcher
    );
    const components: any[] = componentsData?.data || [];

    // Platform data for resolving platform title
    const { data: platformsData } = useSWR(
        isSlideOverOpen && selectedPlatformId ? '/api/platform?pageSize=1000' : null,
        fetcher
    );
    const activePlatform = useMemo(() => {
        return (platformsData?.data || []).find((p: any) => p.plat_id === selectedPlatformId);
    }, [platformsData, selectedPlatformId]);

    useEffect(() => {
        if (activeAttachment) {
            const meta = ((activeAttachment as any).meta || {}) as any;
            setName(activeAttachment.name || "");
            setTitle(meta.title || activeAttachment.name || "");
            setDescription(meta.description || "");
        } else {
            setName("");
            setTitle("");
            setDescription("");
        }
        setReplaceFile(null);
        setNewFile(null);
        setTargetType(addPreset?.sourceType || "platform");
        setTargetComponentId(addPreset?.sourceType === "component" && addPreset.sourceId ? String(addPreset.sourceId) : "");
        setTargetInspectionId(addPreset?.sourceType === "inspection" && addPreset.sourceId ? String(addPreset.sourceId) : "");
    }, [activeAttachment, addPreset, isSlideOverOpen]);

    // Inspection record options for add mode
    useEffect(() => {
        if (!isSlideOverOpen || !isAddMode || !selectedPlatformId) return;
        let cancelled = false;

        (async () => {
            const compIds = components.map((c: any) => c.id).filter(Boolean);
            let query = (supabase as any)
                .from("insp_records")
                .select("insp_id, component_id, inspection_date, inspection_type_code, jobpack_id, sow_report_no")
                .order("inspection_date", { ascending: false });

            if (compIds.length > 0) {
                query = query.or(`structure_id.eq.${selectedPlatformId},component_id.in.(${compIds.join(",")})`);
            } else {
                query = query.eq("structure_id", selectedPlatformId);
            }

            const { data: recs } = await query.limit(300);
            if (cancelled) return;

            let allRecs = recs || [];
            // If preset sourceId was provided but not in loaded recs, fetch it directly
            if (addPreset?.sourceType === "inspection" && addPreset.sourceId && !allRecs.some((r: any) => r.insp_id === addPreset.sourceId)) {
                const { data: presetRec } = await (supabase as any)
                    .from("insp_records")
                    .select("insp_id, component_id, inspection_date, inspection_type_code, jobpack_id, sow_report_no")
                    .eq("insp_id", addPreset.sourceId)
                    .single();
                if (presetRec && !cancelled) {
                    allRecs = [presetRec, ...allRecs];
                }
            }

            const jpIds = Array.from(new Set(allRecs.map((r: any) => r.jobpack_id).filter(Boolean)));
            const jpMap = new Map<number, string>();
            if (jpIds.length) {
                const { data: jps } = await (supabase as any).from("jobpack").select("id, name").in("id", jpIds);
                (jps || []).forEach((j: any) => jpMap.set(j.id, j.name));
            }
            const compMap = new Map<number, string>(components.map((c: any) => [c.id, c.q_id || c.comp_id || c.code]));

            setInspectionOptions(
                allRecs.map((r: any) => {
                    const qid = compMap.get(r.component_id);
                    const labelParts = [
                        r.inspection_date ? moment(r.inspection_date).format("DD/MM/YYYY") : null,
                        r.inspection_type_code || null,
                        qid ? `QID: ${qid}` : null,
                        r.sow_report_no ? `SOW: ${r.sow_report_no}` : null,
                        jpMap.get(r.jobpack_id) || (r.jobpack_id ? `JP ${r.jobpack_id}` : null),
                    ].filter(Boolean);

                    return {
                        id: r.insp_id,
                        label: labelParts.length > 0 ? labelParts.join(" • ") : `Inspection Record #${r.insp_id}`,
                    };
                })
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [isSlideOverOpen, isAddMode, selectedPlatformId, components.length, addPreset, supabase]);

    const onSave = async () => {
        try {
            setIsSaving(true);

            if (activeAttachment) {
                const meta = ((activeAttachment as any).meta || {}) as any;

                const patchRes = await fetch("/api/attachment", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: activeAttachment.id,
                        name: name.trim() || activeAttachment.name,
                        title: isMedia ? name.trim() : title.trim(),
                        description,
                    }),
                });
                if (!patchRes.ok) throw new Error(await readError(patchRes, "Failed to save changes"));

                if (replaceFile) {
                    const form = new FormData();
                    form.append("id", String(activeAttachment.id));
                    form.append("filePath", meta.file_path || (activeAttachment as any).path || "");
                    form.append("file", replaceFile);
                    const putRes = await fetch("/api/attachment", { method: "PUT", body: form });
                    if (!putRes.ok) throw new Error(await readError(putRes, "Failed to replace file"));
                }

                toast.success("Attachment updated");
            } else {
                if (!newFile) {
                    toast.error("Please choose a file to upload");
                    return;
                }

                const sourceType: TargetType = targetType;
                let sourceId: number | null = null;
                if (targetType === "platform") {
                    sourceId = selectedPlatformId;
                    if (!sourceId) {
                        toast.error("Please select a platform in the left pane first");
                        return;
                    }
                } else if (targetType === "component") {
                    sourceId = targetComponentId ? Number(targetComponentId) : null;
                    if (!sourceId) {
                        toast.error("Please select a component QID to attach this file to");
                        return;
                    }
                } else if (targetType === "inspection") {
                    sourceId = targetInspectionId ? Number(targetInspectionId) : null;
                    if (!sourceId) {
                        toast.error("You must select an existing inspection record. Creating a new inspection record is not allowed.");
                        return;
                    }
                }

                const form = new FormData();
                form.append("file", newFile);
                form.append("name", name.trim() || newFile.name);
                form.append("title", title.trim());
                form.append("description", description);
                form.append("source_type", sourceType);
                form.append("source_id", String(sourceId));

                const res = await fetch("/api/attachment", { method: "POST", body: form });
                if (!res.ok) throw new Error(await readError(res, "Failed to upload attachment"));
                toast.success("Attachment added");
            }

            await refreshAttachmentCaches();
            closeSlideOver();
        } catch (e: any) {
            toast.error(e?.message || "Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    const onDelete = async () => {
        if (!activeAttachment) return;
        try {
            setIsDeleting(true);
            const res = await fetch(`/api/attachment?id=${encodeURIComponent(String(activeAttachment.id))}`, { method: "DELETE" });
            if (!res.ok) throw new Error(await readError(res, "Failed to delete attachment"));
            toast.success("Attachment deleted");
            setDeleteOpen(false);
            await refreshAttachmentCaches();
            closeSlideOver();
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete attachment");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownload = async () => {
        if (!activeAttachment) return;
        try {
            const publicUrl = getAttachmentUrl(activeAttachment);
            const { fileUrl: rawFileUrl, fileName: processedName } = processAttachmentUrl(activeAttachment);
            const url = publicUrl || rawFileUrl;

            const saveName = actualFileName || (activeAttachment as any).name || processedName || "attachment";
            if (!url) {
                toast.error("Download URL not found for this attachment.");
                return;
            }

            toast.info(`Preparing download for "${saveName}"...`);

            const downloadUrl = url.includes("/api/attachment/")
                ? `${url}${url.includes("?") ? "&" : "?"}download=true`
                : url;

            const res = await fetch(downloadUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = saveName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);

            toast.success(`Downloaded "${saveName}" to your local drive`);
        } catch (err: any) {
            console.warn("Direct blob download failed, falling back to anchor:", err);
            const publicUrl = getAttachmentUrl(activeAttachment);
            const { fileUrl: rawFileUrl } = processAttachmentUrl(activeAttachment);
            const url = publicUrl || rawFileUrl;
            const saveName = actualFileName || (activeAttachment as any).name || "attachment";
            if (url) {
                const downloadUrl = url.includes("/api/attachment/")
                    ? `${url}${url.includes("?") ? "&" : "?"}download=true`
                    : url;
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = saveName;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toast.success(`Downloading "${saveName}"`);
            } else {
                toast.error("Failed to download attachment.");
            }
        }
    };

    if (!activeAttachment && !isSlideOverOpen) return null;

    const { fileUrl, fileType } = activeAttachment
        ? processAttachmentUrl(activeAttachment)
        : { fileUrl: "", fileType: "" };
    const category = activeAttachment ? getAttachmentCategory(activeAttachment) : "OTHER";
    const enriched = (activeAttachment as any) || {};
    const meta = (enriched.meta || {}) as any;
    const isLegacy = !meta.file_url && (
        /^[A-Za-z]:[\\\/]/.test((activeAttachment as any)?.path || "") ||
        ((activeAttachment as any)?.path || "").startsWith("\\\\") ||
        ((activeAttachment as any)?.path || "").includes("\\")
    );

    const actualFileName = (() => {
        if (!activeAttachment) return "";
        const a = activeAttachment as any;
        const m = (a.meta || {}) as any;
        if (m.original_file_name) return m.original_file_name;
        if (a.file_name) return a.file_name;
        if (m.file_name) return m.file_name;
        const rawPath = a.path || "";
        if (rawPath) {
            const cleanPath = rawPath.split("?")[0].split("#")[0];
            const seg = cleanPath.split(/[/\\]/).pop();
            if (seg && seg.includes(".")) return seg;
        }
        if (a.name && a.name.includes(".")) return a.name;
        return a.name || "File";
    })();

    const detailedFileType = (() => {
        if (!activeAttachment) return { label: "Unknown", ext: "", mime: "" };
        const a = activeAttachment as any;
        const m = (a.meta || {}) as any;
        const fn = actualFileName || a.name || "";
        const extMatch = fn.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1].toUpperCase() : "";
        const mime = m.mime || m.file_type || m.type || (fileType?.includes("/") ? fileType : "");

        let label = ext ? `${ext} File` : "File";
        if (category === "PHOTO" || String(mime).toLowerCase().includes("image") || ["PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG", "BMP", "TIFF"].includes(ext)) {
            label = ext ? `${ext} Image` : "Image";
        } else if (category === "VIDEO" || String(mime).toLowerCase().includes("video") || ["MP4", "MOV", "AVI", "MKV", "WEBM"].includes(ext)) {
            label = ext ? `${ext} Video` : "Video";
        } else if (ext === "PDF" || String(mime).toLowerCase().includes("pdf")) {
            label = "PDF Document";
        } else if (["DOC", "DOCX", "XLS", "XLSX", "PPT", "PPTX", "CSV"].includes(ext)) {
            label = `${ext} Document`;
        }

        return {
            label,
            ext: ext ? `.${ext.toLowerCase()}` : "",
            mime: typeof mime === "string" ? mime : ""
        };
    })();

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
                            {activeAttachment
                                ? "Rename, retitle or replace this file. Changes appear live in the Captured Events log."
                                : "Upload a new file and choose what it is attached to."}
                        </SheetDescription>
                    </SheetHeader>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Preview Section */}
                    {activeAttachment && (
                        <div className="space-y-4">
                            <div className="aspect-video w-full bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center relative shadow-inner">
                                {category === "PHOTO" && fileUrl ? (
                                    <img src={fileUrl} alt={name} className="w-full h-full object-contain" />
                                ) : category === "VIDEO" && fileUrl ? (
                                    <video src={fileUrl} controls className="w-full h-full object-contain bg-black" />
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-slate-400">
                                        {category === "VIDEO" ? <Film className="h-16 w-16 opacity-50" /> : <FileText className="h-16 w-16 opacity-50" />}
                                        <span className="text-xs font-bold uppercase tracking-widest">{fileType}</span>
                                    </div>
                                )}

                                {category !== "VIDEO" && (
                                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                        <Button variant="secondary" size="sm" onClick={() => fileUrl && window.open(fileUrl, "_blank")}>
                                            <ExternalLink className="mr-2 h-4 w-4" /> Open Original
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* File Info Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Actual File Name */}
                                <div className="col-span-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Actual File Name</p>
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate font-mono select-all" title={actualFileName}>
                                                {actualFileName}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                                        onClick={() => {
                                            navigator.clipboard.writeText(actualFileName);
                                            toast.success("File name copied to clipboard");
                                        }}
                                        title="Copy actual file name"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                {/* File Type */}
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
                                    <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0">
                                        <Tag className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">File Type</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                {detailedFileType.label}
                                            </p>
                                            {detailedFileType.ext && (
                                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                                    {detailedFileType.ext}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* File Size */}
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
                                    <div className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shrink-0">
                                        <HardDrive className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">File Size</p>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate mt-0.5">
                                            {formatBytes(meta.file_size || meta.size || 0)}
                                        </p>
                                    </div>
                                </div>

                                {/* Uploaded Date */}
                                <div className="col-span-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
                                    <div className="h-8 w-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 shrink-0">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Uploaded Date</p>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate mt-0.5">
                                            {moment(activeAttachment.created_at || enriched.cr_date).format("DD MMM YYYY, HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Download to Local Drive */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleDownload}
                                className="w-full bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-bold text-xs h-9 transition-colors gap-2 shadow-2xs"
                                title="Download this attachment to your local drive"
                            >
                                <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Download File to Local Drive</span>
                            </Button>

                            {isLegacy && (
                                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
                                        <span>⚠️</span> Legacy File Path
                                    </div>
                                    <p className="text-[11px] leading-relaxed opacity-90">
                                        This attachment references a legacy local/network path: <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono text-[10px] break-all">{meta.file_path || (activeAttachment as any).path}</code>.
                                        If the drive is unmounted, you can upload the physical file below using <strong>Choose</strong> to make it accessible in the cloud.
                                    </p>
                                </div>
                            )}

                            {/* Replace file */}
                            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Replace {category === "VIDEO" ? "video" : category === "PHOTO" ? "photo" : "file"}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                        {replaceFile ? replaceFile.name : "Keep current file"}
                                    </p>
                                </div>
                                <input
                                    ref={replaceInputRef}
                                    type="file"
                                    className="hidden"
                                    accept={isMedia ? (category === "VIDEO" ? "video/*" : "image/*") : undefined}
                                    onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                                />
                                <Button type="button" variant="outline" size="sm" onClick={() => replaceInputRef.current?.click()}>
                                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Choose
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Add mode: file + target */}
                    {isAddMode && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">File</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{newFile ? newFile.name : "No file selected"}</p>
                                </div>
                                <input
                                    ref={newInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] || null;
                                        setNewFile(f);
                                        if (f && !name) setName(f.name);
                                    }}
                                />
                                <Button type="button" variant="outline" onClick={() => newInputRef.current?.click()}>
                                    <Upload className="mr-2 h-4 w-4" /> Browse
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Attach to</Label>
                                <Select
                                    value={targetType}
                                    onValueChange={(v) => {
                                        setTargetType(v as TargetType);
                                        if (v !== "inspection") setTargetInspectionId("");
                                        if (v !== "component") setTargetComponentId("");
                                    }}
                                >
                                    <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="platform">Platform Structure</SelectItem>
                                        <SelectItem value="component">Component (select by QID)</SelectItem>
                                        <SelectItem value="inspection">Inspection record (existing record only)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Platform Structure Info */}
                            {targetType === "platform" && (
                                <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs">
                                    <span className="font-semibold text-blue-800 dark:text-blue-300">Target Structure: </span>
                                    <span className="font-bold text-blue-900 dark:text-blue-200">
                                        {activePlatform?.title || (selectedPlatformId ? `Platform #${selectedPlatformId}` : "No platform selected")}
                                    </span>
                                    <p className="text-[11px] text-blue-700/80 dark:text-blue-400 mt-1">
                                        This file will be attached directly to this platform structure.
                                    </p>
                                </div>
                            )}

                            {/* Component QID selection */}
                            {targetType === "component" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center justify-between">
                                        <span>Component QID <span className="text-red-500">*</span></span>
                                        <span className="text-[10px] text-slate-400 font-normal">({components.length} components available)</span>
                                    </Label>
                                    <Select value={targetComponentId} onValueChange={setTargetComponentId}>
                                        <SelectTrigger className="bg-white dark:bg-slate-900">
                                            <SelectValue placeholder="Select component QID *" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-72">
                                            {components.map((c: any) => {
                                                const qid = c.q_id || c.code || c.comp_id || `Component #${c.id}`;
                                                return (
                                                    <SelectItem key={c.id} value={String(c.id)}>
                                                        <span className="font-semibold">{qid}</span>
                                                        {c.description && c.description.trim().toUpperCase() !== qid.trim().toUpperCase() && (
                                                            <span className="opacity-70 ml-1.5 text-xs">({c.description})</span>
                                                        )}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    {!targetComponentId && (
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                            Please choose a component QID from the list to attach this file.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Inspection Record selection */}
                            {targetType === "inspection" && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center justify-between">
                                        <span>Select Existing Inspection Record <span className="text-red-500">*</span></span>
                                        <span className="text-[10px] text-slate-400 font-normal">({inspectionOptions.length} records available)</span>
                                    </Label>
                                    <Select value={targetInspectionId} onValueChange={setTargetInspectionId}>
                                        <SelectTrigger className={cn("bg-white dark:bg-slate-900", !targetInspectionId && "border-amber-400 dark:border-amber-700")}>
                                            <SelectValue placeholder="Select existing inspection record *" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-72">
                                            {inspectionOptions.map((o) => (
                                                <SelectItem key={o.id} value={String(o.id)}>
                                                    {o.label || `Record #${o.id}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* Notice Banner: strictly require existing inspection record, disallow creation */}
                                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <p className="font-semibold text-[11px]">Inspection Record Required</p>
                                            <p className="text-[11px] opacity-90 leading-tight">
                                                Attachments can only be added to an existing, selected inspection record. Creating a new inspection record here is not permitted.
                                            </p>
                                        </div>
                                    </div>

                                    {!targetInspectionId && (
                                        <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                                            * You must select an existing inspection record from above to proceed.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <Separator />

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="att-name" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                    {isMedia ? "Title / Label" : "File Name / Title"}
                                </Label>
                                {activeAttachment && actualFileName && actualFileName !== name && (
                                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[240px]" title={actualFileName}>
                                        Physical file: {actualFileName}
                                    </span>
                                )}
                            </div>
                            <Input id="att-name" value={name} onChange={(e) => setName(e.target.value)} className="bg-white dark:bg-slate-900" />
                        </div>

                        {!isMedia && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="att-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">Display Title</Label>
                                    <Input id="att-title" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white dark:bg-slate-900" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="att-desc" className="text-xs font-bold uppercase tracking-wide text-slate-500">Description</Label>
                                    <Textarea
                                        id="att-desc"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="bg-white dark:bg-slate-900 resize-none h-24"
                                        placeholder="Add a description for this attachment..."
                                    />
                                </div>
                            </>
                        )}

                        {activeAttachment && (
                            <div className="grid grid-cols-1 gap-4 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Associated Structure</Label>
                                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        {(enriched.structure_name || enriched.source_type) ? (
                                            <span className="text-sm font-medium">
                                                {enriched.structure_name || (
                                                    <span className="capitalize opacity-70">{String(enriched.source_type || "").replace("_", " ")}</span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-slate-400 italic">None linked</span>
                                        )}
                                    </div>
                                </div>
                                {(enriched.component_name || enriched.component_q_id) && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Associated Component</Label>
                                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                            <span className="text-sm font-medium">{enriched.component_name || enriched.component_q_id}</span>
                                        </div>
                                    </div>
                                )}
                                {enriched.jobpack_name && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Jobpack</Label>
                                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                            <span className="text-sm font-medium">{enriched.jobpack_name}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer actions */}
                <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 mt-auto">
                    <SheetFooter className="flex-row gap-3 justify-end w-full">
                        <Button
                            onClick={onSave}
                            disabled={
                                isSaving ||
                                (isAddMode && !newFile) ||
                                (isAddMode && targetType === "inspection" && !targetInspectionId) ||
                                (isAddMode && targetType === "component" && !targetComponentId) ||
                                (isAddMode && targetType === "platform" && !selectedPlatformId)
                            }
                            className="bg-blue-600 hover:bg-blue-700 font-semibold"
                            title={activeAttachment ? "Save Changes" : "Upload Attachment"}
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {activeAttachment ? "Save" : "Upload"}
                        </Button>
                        {activeAttachment && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/30 shadow-2xs"
                                title="Download file to local drive"
                                onClick={handleDownload}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        )}
                        {activeAttachment && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:border-red-900/30"
                                title="Delete"
                                onClick={() => setDeleteOpen(true)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" onClick={closeSlideOver}>Cancel</Button>
                    </SheetFooter>
                </div>

                <DeleteConfirmDialog
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    onConfirm={onDelete}
                    loading={isDeleting}
                    title="Delete Attachment"
                    description="Are you sure you want to permanently delete this attachment? This action cannot be undone."
                />
            </SheetContent>
        </Sheet>
    );
}
