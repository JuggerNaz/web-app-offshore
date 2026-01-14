"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
    currentImageUrl?: string;
    onImageChange: (url: string | null) => void;
    bucketName?: string;
    storagePath: string; // e.g., "CONTRACTOR/AMSB"
    maxSizeMB?: number;
}

export function ImageUpload({
    currentImageUrl,
    onImageChange,
    bucketName = "library-logos",
    storagePath,
    maxSizeMB = 5,
}: ImageUploadProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(currentImageUrl || null);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);

    const supabase = createClient();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validTypes.includes(file.type)) {
            toast.error("Invalid file type. Please upload JPG, PNG, or WebP images.");
            return;
        }

        // Validate file size
        const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
        if (file.size > maxSize) {
            toast.error(`File size must be less than ${maxSizeMB}MB`);
            return;
        }

        // Show preview immediately
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);

        // Upload to Supabase Storage
        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${storagePath}.${fileExt}`;

            // Upload file (upsert to replace existing)
            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileName, file, {
                    upsert: true,
                    contentType: file.type
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileName);

            setImageUrl(publicUrl);
            setPreviewUrl(publicUrl);
            onImageChange(publicUrl);
            toast.success("Logo uploaded successfully!");
        } catch (error: any) {
            console.error("Upload error:", error);
            toast.error(error.message || "Failed to upload image");
            setPreviewUrl(currentImageUrl || null);
        } finally {
            setUploading(false);
            // Clean up object URL
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
    };

    const handleDelete = async () => {
        if (!imageUrl) return;

        try {
            // Extract file path from URL
            const urlParts = imageUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `${storagePath}.${fileName.split('.').pop()}`;

            // Delete from storage
            const { error } = await supabase.storage
                .from(bucketName)
                .remove([filePath]);

            if (error) throw error;

            setImageUrl(null);
            setPreviewUrl(null);
            onImageChange(null);
            toast.success("Logo deleted successfully!");
        } catch (error: any) {
            console.error("Delete error:", error);
            toast.error(error.message || "Failed to delete image");
        }
    };

    return (
        <div className="space-y-3">
            <Label>Contractor Logo</Label>

            {/* Preview */}
            <div className="flex items-center gap-4">
                {previewUrl ? (
                    <div className="relative group">
                        <img
                            src={previewUrl}
                            alt="Logo preview"
                            className="w-24 h-24 rounded border-2 border-slate-300 dark:border-slate-600 object-contain bg-white"
                        />
                        {!uploading && (
                            <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={handleDelete}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                        {uploading && (
                            <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                                <Loader2 className="h-6 w-6 text-white animate-spin" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-24 h-24 rounded border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                        <ImageIcon className="h-8 w-8 text-slate-400" />
                    </div>
                )}

                {/* Upload Button */}
                <div className="flex-1">
                    <input
                        type="file"
                        id="logo-upload"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                    />
                    <label htmlFor="logo-upload">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={uploading}
                            asChild
                        >
                            <span className="cursor-pointer">
                                {uploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        {previewUrl ? "Replace Logo" : "Upload Logo"}
                                    </>
                                )}
                            </span>
                        </Button>
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                        JPG, PNG or WebP. Max {maxSizeMB}MB.
                    </p>
                </div>
            </div>
        </div>
    );
}
