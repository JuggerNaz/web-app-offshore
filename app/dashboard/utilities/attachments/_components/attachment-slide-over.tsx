
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
import { createClient } from "@/utils/supabase/client";
import { fetcher } from "@/utils/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { FileText, Calendar, HardDrive, ExternalLink, Trash2, Save, Loader2, Upload, RefreshCw, Film } from "lucide-react";
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

    // Components of the selected platform (add mode)
    const { data: componentsData } = useSWR(
        isSlideOverOpen && isAddMode && selectedPlatformId ? `/api/structure-components/${selectedPlatformId}` : null,
        fetcher
    );
    const components: any[] = componentsData?.data || [];

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
        setTargetComponentId(addPreset?.sourceType === "component" ? String(addPreset.sourceId) : "");
        setTargetInspectionId(addPreset?.sourceType === "inspection" ? String(addPreset.sourceId) : "");
    }, [activeAttachment, addPreset, isSlideOverOpen]);

    // Inspection record options for add mode
    useEffect(() => {
        if (!isSlideOverOpen || !isAddMode || !selectedPlatformId) return;
        let cancelled = false;

        (async () => {
            const compIds = components.map((c: any) => c.id).filter(Boolean);
            const orFilter = `structure_id.eq.${selectedPlatformId}${compIds.length ? `,component_id.in.(${compIds.join(",")})` : ""}`;
            const { data: recs } = await (supabase as any)
                .from("insp_records")
                .select("insp_id, component_id, inspection_date, inspection_type_code, jobpack_id")
                .or(orFilter)
                .order("inspection_date", { ascending: false })
                .limit(300);
            if (cancelled || !recs) return;

            const jpIds = Array.from(new Set(recs.map((r: any) => r.jobpack_id).filter(Boolean)));
            const jpMap = new Map<number, string>();
            if (jpIds.length) {
                const { data: jps } = await (supabase as any).from("jobpack").select("id, name").in("id", jpIds);
                (jps || []).forEach((j: any) => jpMap.set(j.id, j.name));
            }
            const compMap = new Map<number, string>(components.map((c: any) => [c.id, c.q_id || c.comp_id]));

            setInspectionOptions(
                recs.map((r: any) => ({
                    id: r.insp_id,
                    label: [
                        jpMap.get(r.jobpack_id) || (r.jobpack_id ? `JP ${r.jobpack_id}` : null),
                        r.inspection_date ? moment(r.inspection_date).format("DD MMM YYYY") : null,
                        r.inspection_type_code,
                        compMap.get(r.component_id),
                    ]
                        .filter(Boolean)
                        .join(" • "),
                }))
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [isSlideOverOpen, isAddMode, selectedPlatformId, components.length, supabase]);

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

                let sourceType: TargetType = targetType;
                let sourceId: number | null = null;
                if (targetType === "platform") sourceId = selectedPlatformId;
                if (targetType === "component") sourceId = targetComponentId ? Number(targetComponentId) : null;
                if (targetType === "inspection") sourceId = targetInspectionId ? Number(targetInspectionId) : null;

                if (!sourceId) {
                    toast.error(
                        targetType === "platform"
                            ? "Select a platform in the left pane first"
                            : `Select the ${targetType} to attach this file to`
                    );
                    return;
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

    if (!activeAttachment && !isSlideOverOpen) return null;

    const { fileUrl, fileType } = activeAttachment
        ? processAttachmentUrl(activeAttachment)
        : { fileUrl: "", fileType: "" };
    const category = activeAttachment ? getAttachmentCategory(activeAttachment) : "OTHER";
    const enriched = (activeAttachment as any) || {};
    const meta = (enriched.meta || {}) as any;

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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                        <HardDrive className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">File Size</p>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formatBytes(meta.file_size || meta.size || 0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Uploaded</p>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                            {moment(activeAttachment.created_at || enriched.cr_date).format("DD MMM YYYY")}
                                        </p>
                                    </div>
                                </div>
                            </div>

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
                                <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                                    <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="platform">Platform</SelectItem>
                                        <SelectItem value="component">Component</SelectItem>
                                        <SelectItem value="inspection">Inspection record (shows in Captured Events)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {targetType === "component" && (
                                <Select value={targetComponentId} onValueChange={setTargetComponentId}>
                                    <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue placeholder="Select component" /></SelectTrigger>
                                    <SelectContent className="max-h-72">
                                        {components.map((c: any) => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                                {c.q_id || c.comp_id} {c.description ? `– ${c.description}` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {targetType === "inspection" && (
                                <Select value={targetInspectionId} onValueChange={setTargetInspectionId}>
                                    <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue placeholder="Select inspection record" /></SelectTrigger>
                                    <SelectContent className="max-h-72">
                                        {inspectionOptions.map((o) => (
                                            <SelectItem key={o.id} value={String(o.id)}>{o.label || `Record ${o.id}`}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}

                    <Separator />

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="att-name" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {isMedia ? "Name / Title" : "File Name"}
                            </Label>
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
                        <Button onClick={onSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700" title="Save Changes">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {activeAttachment ? "Save" : "Upload"}
                        </Button>
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
