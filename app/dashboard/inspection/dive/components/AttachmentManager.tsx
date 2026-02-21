"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paperclip, X, FileIcon, ImageIcon, Trash2, Eye, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export interface Attachment {
    id: number;
    name: string;
    path: string;
    type: string;
    meta?: {
        size?: number;
        type?: string;
        title?: string;
        description?: string;
        sort_order?: number;
        [key: string]: any;
    };
    created_at: string;
}

export interface PendingFile {
    file: File;
    title: string;
    description: string;
}

interface AttachmentManagerProps {
    sourceId: number | null;
    sourceType: string;
    onPendingFilesChange: (files: PendingFile[]) => void;
    readOnly?: boolean;
}

export default function AttachmentManager({
    sourceId,
    sourceType,
    onPendingFilesChange,
    readOnly = false
}: AttachmentManagerProps) {
    const supabase = createClient();
    const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (sourceId) {
            fetchAttachments();
        } else {
            setExistingAttachments([]);
        }
    }, [sourceId, sourceType]);

    // Notify parent whenever pending files change
    useEffect(() => {
        onPendingFilesChange(pendingFiles);
    }, [pendingFiles, onPendingFilesChange]);

    async function fetchAttachments() {
        if (!sourceId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('attachment')
            .select('*')
            .eq('source_id', sourceId)
            .eq('source_type', sourceType);

        if (error) {
            console.error("Error fetching attachments:", error);
            toast.error("Failed to load attachments");
        } else {
            // Sort by sort_order if exists, then created_at
            const sorted = (data || []).sort((a, b) => {
                const orderA = a.meta?.sort_order ?? 999999;
                const orderB = b.meta?.sort_order ?? 999999;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });
            setExistingAttachments(sorted);
        }
        setLoading(false);
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files).map(f => ({
                file: f,
                title: f.name.split('.')[0], // Default title to filename
                description: ""
            }));
            setPendingFiles(prev => [...prev, ...files]);
        }
    };

    const updatePendingFile = (index: number, field: 'title' | 'description', value: string) => {
        setPendingFiles(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateMetadata = async (att: Attachment, title: string, description: string) => {
        setUpdatingIds(prev => new Set(prev).add(att.id));
        try {
            const newMeta = {
                ...(att.meta || {}),
                title,
                description
            };

            const { error } = await supabase
                .from('attachment')
                .update({ meta: newMeta })
                .eq('id', att.id);

            if (error) throw error;

            toast.success("Attachment updated");
            setExistingAttachments(prev => prev.map(a => a.id === att.id ? { ...a, meta: newMeta } : a));
        } catch (error) {
            console.error("Error updating attachment metadata:", error);
            toast.error("Failed to update attachment");
        } finally {
            setUpdatingIds(prev => {
                const next = new Set(prev);
                next.delete(att.id);
                return next;
            });
        }
    };

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= existingAttachments.length) return;

        const newItems = [...existingAttachments];
        const currentItem = newItems[index];
        const otherItem = newItems[newIndex];

        // Ensure both have sort orders for comparison
        const currentOrder = currentItem.meta?.sort_order ?? index;
        const otherOrder = otherItem.meta?.sort_order ?? newIndex;

        // Swap their orders locally
        const updatedCurrent = { ...currentItem, meta: { ...currentItem.meta, sort_order: otherOrder } };
        const updatedOther = { ...otherItem, meta: { ...otherItem.meta, sort_order: currentOrder } };

        newItems[index] = updatedOther;
        newItems[newIndex] = updatedCurrent;

        // Re-sort to be sure
        newItems.sort((a, b) => (a.meta?.sort_order ?? 0) - (b.meta?.sort_order ?? 0));
        setExistingAttachments(newItems);

        // Update DB
        try {
            await Promise.all([
                supabase.from('attachment').update({ meta: updatedCurrent.meta }).eq('id', currentItem.id),
                supabase.from('attachment').update({ meta: updatedOther.meta }).eq('id', otherItem.id)
            ]);
        } catch (e) {
            console.error("Move error:", e);
            toast.error("Failed to save new order");
        }
    };

    const handleDeleteExisting = async (id: number, path: string) => {
        if (!confirm("Are you sure you want to delete this attachment?")) return;

        // 1. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('attachments')
            .remove([path]);

        if (storageError) {
            console.error("Storage delete error:", storageError);
            toast.error("Failed to delete file from storage");
            return;
        }

        // 2. Delete from DB
        const { error: dbError } = await supabase
            .from('attachment')
            .delete()
            .eq('id', id);

        if (dbError) {
            console.error("DB delete error:", dbError);
            toast.error("Failed to delete attachment record");
        } else {
            toast.success("Attachment deleted");
            setExistingAttachments(prev => prev.filter(a => a.id !== id));
        }
    };

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="h-4 w-4 text-primary" />;
        return <FileIcon className="h-4 w-4 text-muted-foreground" />;
    };

    const isImage = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
    };

    const handlePreview = async (attachment: Attachment) => {
        if (isImage(attachment.name)) {
            const { data } = supabase.storage.from('attachments').getPublicUrl(attachment.path);
            if (data) {
                setViewingImage(data.publicUrl);
            }
        } else {
            const { data } = supabase.storage.from('attachments').getPublicUrl(attachment.path);
            if (data?.publicUrl) {
                window.open(data.publicUrl, '_blank');
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments
                </Label>
            </div>

            {/* List Existing */}
            {existingAttachments.length > 0 && (
                <div className="space-y-3">
                    {existingAttachments.map(att => (
                        <div key={att.id} className="p-3 rounded-lg border bg-muted/20 space-y-2 transition-all hover:bg-muted/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 truncate cursor-pointer hover:underline text-sm font-medium" onClick={() => handlePreview(att)}>
                                    {getFileIcon(att.name)}
                                    <span className="truncate max-w-[200px]" title={att.name}>{att.name}</span>
                                </div>
                                {!readOnly && (
                                    <div className="flex items-center gap-1">
                                        <div className="flex items-center border rounded-md mr-2 bg-background">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 border-r rounded-none"
                                                disabled={existingAttachments.indexOf(att) === 0}
                                                onClick={() => handleMove(existingAttachments.indexOf(att), 'up')}
                                                title="Move Up"
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-none"
                                                disabled={existingAttachments.indexOf(att) === existingAttachments.length - 1}
                                                onClick={() => handleMove(existingAttachments.indexOf(att), 'down')}
                                                title="Move Down"
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1"
                                            disabled={updatingIds.has(att.id)}
                                            onClick={() => {
                                                const title = (document.getElementById(`title-${att.id}`) as HTMLInputElement)?.value;
                                                const desc = (document.getElementById(`desc-${att.id}`) as HTMLInputElement)?.value;
                                                handleUpdateMetadata(att, title, desc);
                                            }}
                                        >
                                            Update
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteExisting(att.id, att.path)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {!readOnly && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <div className="space-y-1">
                                        <Label htmlFor={`title-${att.id}`} className="text-[10px] uppercase text-muted-foreground font-bold">Title</Label>
                                        <Input
                                            id={`title-${att.id}`}
                                            defaultValue={att.meta?.title || ""}
                                            placeholder="Attachment title..."
                                            className="h-8 text-xs bg-background/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor={`desc-${att.id}`} className="text-[10px] uppercase text-muted-foreground font-bold">Description</Label>
                                        <Input
                                            id={`desc-${att.id}`}
                                            defaultValue={att.meta?.description || ""}
                                            placeholder="Description/notes..."
                                            className="h-8 text-xs bg-background/50"
                                        />
                                    </div>
                                </div>
                            )}

                            {readOnly && (att.meta?.title || att.meta?.description) && (
                                <div className="text-xs space-y-1 pl-6 border-l-2 border-primary/20">
                                    {att.meta?.title && <p className="font-semibold">{att.meta.title}</p>}
                                    {att.meta?.description && <p className="text-muted-foreground">{att.meta.description}</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pending Files */}
            {pendingFiles.length > 0 && (
                <div className="space-y-3 mt-4 pt-4 border-t border-dashed">
                    <Label className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Pending Uploads ({pendingFiles.length})
                    </Label>
                    <div className="space-y-3">
                        {pendingFiles.map((pf, idx) => (
                            <div key={idx} className="p-3 rounded-lg border border-blue-100 bg-blue-50/30 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 truncate text-sm font-medium">
                                        {getFileIcon(pf.file.name)}
                                        <span className="truncate max-w-[200px]" title={pf.file.name}>{pf.file.name}</span>
                                        <span className="text-[10px] text-muted-foreground">({(pf.file.size / 1024).toFixed(0)}KB)</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removePendingFile(idx)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Title</Label>
                                        <Input
                                            value={pf.title}
                                            onChange={(e) => updatePendingFile(idx, 'title', e.target.value)}
                                            placeholder="Capture title..."
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Description</Label>
                                        <Input
                                            value={pf.description}
                                            onChange={(e) => updatePendingFile(idx, 'description', e.target.value)}
                                            placeholder="Capture details..."
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload Button */}
            {!readOnly && (
                <div className="mt-4">
                    <Input
                        id="file-upload"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <Button variant="outline" className="w-full dashed border-2 border-slate-200 h-16 flex-col gap-1 text-muted-foreground hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-all" onClick={() => document.getElementById('file-upload')?.click()}>
                        <div className="flex items-center gap-2 font-semibold">
                            <Paperclip className="h-5 w-5" />
                            Add Files (Photo, Video, Doc)
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">Drag and drop or click to browse</span>
                    </Button>
                </div>
            )}

            {/* Image Preview Modal */}
            {viewingImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setViewingImage(null)}>
                    <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center">
                        <img src={viewingImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform hover:scale-[1.02]" />
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-4 right-4 rounded-full shadow-lg bg-white/20 hover:bg-white text-white hover:text-black transition-all"
                            onClick={() => setViewingImage(null)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

