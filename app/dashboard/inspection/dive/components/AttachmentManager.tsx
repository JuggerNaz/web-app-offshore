"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paperclip, X, FileIcon, ImageIcon, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export interface Attachment {
    id: number;
    name: string;
    path: string;
    type: string;
    created_at: string;
}

interface AttachmentManagerProps {
    sourceId: number | null;
    sourceType: string;
    onPendingFilesChange: (files: File[]) => void;
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
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

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
            .eq('source_type', sourceType)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching attachments:", error);
            toast.error("Failed to load attachments");
        } else {
            setExistingAttachments(data || []);
        }
        setLoading(false);
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setPendingFiles(prev => [...prev, ...files]);
        }
    };

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
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
            // Get public or signed URL
            const { data } = supabase.storage.from('attachments').getPublicUrl(attachment.path);
            if (data) {
                setViewingImage(data.publicUrl);
            }
        } else {
            // Download/Open
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
                <div className="grid grid-cols-2 gap-2">
                    {existingAttachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between p-2 rounded border bg-muted/30 text-xs">
                            <div className="flex items-center gap-2 truncate cursor-pointer hover:underline" onClick={() => handlePreview(att)}>
                                {getFileIcon(att.name)}
                                <span className="truncate max-w-[120px]" title={att.name}>{att.name}</span>
                            </div>
                            {!readOnly && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteExisting(att.id, att.path)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pending Files */}
            {pendingFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                    <Label className="text-xs text-muted-foreground">Pending Uploads ({pendingFiles.length})</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {pendingFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded border bg-blue-50/50 border-blue-100 text-xs">
                                <div className="flex items-center gap-2 truncate">
                                    <span className="truncate max-w-[120px]" title={file.name}>{file.name}</span>
                                    <span className="text-[10px] text-muted-foreground">({(file.size / 1024).toFixed(0)}KB)</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePendingFile(idx)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload Button */}
            {!readOnly && (
                <div className="mt-2">
                    <Input
                        id="file-upload"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <Button variant="outline" size="sm" className="w-full dashed border-2 gap-2 text-muted-foreground hover:text-foreground" onClick={() => document.getElementById('file-upload')?.click()}>
                        <Paperclip className="h-4 w-4" />
                        Add Files (Photo, Video, Doc)
                    </Button>
                </div>
            )}

            {/* Image Preview Modal */}
            {viewingImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setViewingImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
                        <img src={viewingImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-4 right-4 rounded-full"
                            onClick={() => setViewingImage(null)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
