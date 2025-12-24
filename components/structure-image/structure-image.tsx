"use client";
import { useState, useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { getStoragePublicUrl } from "@/utils/storage";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface StructureImageData {
  id: number;
  name: string;
  path: string;
  meta: {
    file_url?: string;
    original_file_name?: string;
    file_size?: number;
    file_type?: string;
    file_path?: string;
  };
}

export default function StructureImage() {
  const [pageId] = useAtom(urlId);
  const [pageType] = useAtom(urlType);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [images, setImages] = useState<StructureImageData[]>([]);

  const supabase = createClient();
  const sourceType = `${pageType}_structure_image`;

  // Fetch existing structure image
  const { data, error: fetchError, mutate } = useSWR(
    `/api/attachment/${sourceType}/${pageId}`,
    fetcher,
    { revalidateOnFocus: true }
  );

  // Load existing images on mount or data change
  useEffect(() => {
    if (data?.data && Array.isArray(data.data)) {
      setImages(data.data);
    } else {
      setImages([]);
    }
  }, [data]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await uploadImage(files[0]);
      }
    },
    [pageId, pageType, sourceType]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await uploadImage(files[0]);
      }
    },
    [pageId, pageType, sourceType]
  );

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      // File validation
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

      if (file.size > MAX_FILE_SIZE) {
        throw new Error("File size exceeds 10MB limit");
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Only image files (JPEG, PNG, WEBP, GIF) are allowed");
      }

      // Delete existing structure image if any -- REMOVED for multiple support
      // if (currentImage) {
      //   await deleteImage(currentImage.id, false);
      // }

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `structure-${pageType}-${pageId}-${Date.now()}.${fileExt}`;
      const filePath = `structure-images/${fileName}`;

      // Upload to storage with progress
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(100);

      // Get public URL
      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      // Store metadata in database
      const { data: dbData, error: dbError } = await supabase
        .from("attachment")
        .insert([
          {
            name: file.name,
            source_id: pageId,
            source_type: sourceType,
            path: filePath,
            meta: {
              original_file_name: file.name,
              file_url: publicUrl,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
            },
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      // Update state
      setImages((prev) => [...prev, dbData]);

      // Revalidate data
      mutate();
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteImage = async (imageId: number) => {
    try {
      const imageToDelete = images.find((img) => img.id === imageId);
      if (!imageToDelete) return;

      setError(null);

      // Delete from storage if path exists
      if (imageToDelete.path || imageToDelete.meta?.file_path) {
        const pathToDelete = imageToDelete.meta?.file_path || imageToDelete.path;
        await supabase.storage.from("attachments").remove([pathToDelete]);
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from("attachment")
        .delete()
        .eq("id", imageId);

      if (deleteError) throw deleteError;

      // Clear state
      setImages((prev) => prev.filter((img) => img.id !== imageId));

      // Revalidate data
      mutate();
    } catch (err: any) {
      setError(err.message || "Failed to delete image");
      console.error("Delete error:", err);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {pageType === "platform" ? "Platform" : "Pipeline"} Structure Image
        </h2>
        {/* Delete button moved to individual carousel items */}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {/* Carousel Display Area */}
      {images.length > 0 && (
        <div className="flex justify-center w-full">
          <Carousel className="w-full max-w-4xl">
            <CarouselContent>
              {images.map((img) => {
                const url = img.meta?.file_url || (img.path.startsWith("http") ? img.path : getStoragePublicUrl("attachments", img.path));

                return (
                  <CarouselItem key={img.id}>
                    <div className="relative border rounded-lg overflow-hidden bg-gray-50">
                      <div className="relative w-full" style={{ minHeight: "400px" }}>
                        <Image
                          src={url}
                          alt="Structure diagram"
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                          priority
                        />
                        <div className="absolute top-2 right-2 z-10">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                            onClick={() => deleteImage(img.id)}
                            disabled={uploading}
                            title="Delete Image"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-2 bg-white border-t">
                        <p className="text-sm text-gray-600">
                          {img.meta?.original_file_name || img.name}
                        </p>
                        {img.meta?.file_size && (
                          <p className="text-xs text-gray-500">
                            {(img.meta.file_size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      )}

      {/* Upload Area */}
      {!uploading && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400"
            } ${uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
              <p className="text-gray-600">Uploading image...</p>
              {uploadProgress > 0 && (
                <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">
                {images.length > 0 ? "Add another image" : "Drop your structure image here"}
              </h3>
              <p className="text-gray-600 mb-4">
                or click to browse files
              </p>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
                id="structure-image-input"
                disabled={uploading}
              />
              <label htmlFor="structure-image-input">
                <Button asChild disabled={uploading}>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Select Image
                  </span>
                </Button>
              </label>
              <p className="text-xs text-gray-500 mt-4">
                Supported formats: JPEG, PNG, WEBP, GIF (max 10MB)
              </p>
            </>
          )}
        </div>
      )}

      {/* Replace Image Button removed as upload area is always visible */}
    </div>
  );
}
