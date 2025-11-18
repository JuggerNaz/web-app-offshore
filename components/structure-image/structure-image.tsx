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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<StructureImageData | null>(null);

  const supabase = createClient();
  const sourceType = `${pageType}_structure_image`;

  // Fetch existing structure image
  const { data, error: fetchError, mutate } = useSWR(
    `/api/attachment/${sourceType}/${pageId}`,
    fetcher,
    { revalidateOnFocus: true }
  );

  // Load existing image on mount or data change
  useEffect(() => {
    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      const existingImage = data.data[0];
      setCurrentImage(existingImage);
      
      // Get the image URL
      if (existingImage.meta?.file_url) {
        setImageUrl(existingImage.meta.file_url);
      } else if (existingImage.path) {
        const url = existingImage.path.startsWith("http")
          ? existingImage.path
          : getStoragePublicUrl("attachments", existingImage.path);
        setImageUrl(url);
      }
    } else {
      setCurrentImage(null);
      setImageUrl(null);
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

      // Delete existing structure image if any
      if (currentImage) {
        await deleteImage(currentImage.id, false);
      }

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
      setCurrentImage(dbData);
      setImageUrl(publicUrl);
      
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

  const deleteImage = async (imageId?: number, shouldMutate: boolean = true) => {
    try {
      const idToDelete = imageId || currentImage?.id;
      if (!idToDelete) return;

      setError(null);

      // Delete from storage if path exists
      if (currentImage?.path || currentImage?.meta?.file_path) {
        const pathToDelete = currentImage.meta?.file_path || currentImage.path;
        await supabase.storage.from("attachments").remove([pathToDelete]);
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from("attachment")
        .delete()
        .eq("id", idToDelete);

      if (deleteError) throw deleteError;

      // Clear state
      setCurrentImage(null);
      setImageUrl(null);
      
      // Revalidate data
      if (shouldMutate) {
        mutate();
      }
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
        {currentImage && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteImage()}
            disabled={uploading}
          >
            <X className="w-4 h-4 mr-2" />
            Delete Image
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {/* Image Display Area */}
      {imageUrl && !uploading ? (
        <div className="relative border rounded-lg overflow-hidden bg-gray-50">
          <div className="relative w-full" style={{ minHeight: "400px" }}>
            <Image
              src={imageUrl}
              alt="Structure diagram"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              priority
            />
          </div>
          <div className="p-2 bg-white border-t">
            <p className="text-sm text-gray-600">
              {currentImage?.meta?.original_file_name || currentImage?.name}
            </p>
            {currentImage?.meta?.file_size && (
              <p className="text-xs text-gray-500">
                {(currentImage.meta.file_size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Upload Area */}
      {!imageUrl || uploading ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
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
              <h3 className="text-lg font-semibold mb-2">Drop your structure image here</h3>
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
      ) : null}

      {/* Replace Image Button when image exists */}
      {imageUrl && !uploading && (
        <div className="flex justify-center">
          <div>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
              id="structure-image-replace"
              disabled={uploading}
            />
            <label htmlFor="structure-image-replace">
              <Button asChild variant="outline">
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Replace Image
                </span>
              </Button>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
