"use client";
import { useState, useCallback, useEffect } from "react";
import moment from "moment";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, ImageIcon, Plus, Maximize2, Trash2, ShieldCheck, Activity, AlertCircle } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/dialogs/delete-confirm-dialog";
import { getStoragePublicUrl } from "@/utils/storage";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface StructureImageData {
  id: number;
  name: string;
  path: string;
  created_at?: string;
  updated_at?: string;
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
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabase = createClient();
  const sourceType = `${pageType}_structure_image`;

  const { data, error: fetchError, mutate } = useSWR(
    `/api/attachment/${sourceType}/${pageId}`,
    fetcher,
    { revalidateOnFocus: true }
  );

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
      if (files.length > 0) await uploadImage(files[0]);
    },
    [pageId, pageType, sourceType]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) await uploadImage(files[0]);
    },
    [pageId, pageType, sourceType]
  );

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      const MAX_FILE_SIZE = 15 * 1024 * 1024;
      const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

      if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 15MB limit");
      if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Format not supported");

      const fileExt = file.name.split(".").pop();
      const fileName = `${pageId}-${Date.now()}.${fileExt}`;
      const filePath = `structure-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { data: dbData, error: dbError } = await supabase
        .from("attachment")
        .insert([{
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
        }])
        .select().single();

      if (dbError) throw dbError;
      setImages((prev) => [...prev, dbData]);
      mutate();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async () => {
    if (!deleteId) return;

    try {
      setDeleteLoading(true);
      setError(null);

      console.log(`[StructureImage] Deleting visual attachment with ID: ${deleteId}`);

      await fetcher(`/api/attachment?id=${deleteId}`, {
        method: "DELETE"
      });

      // Update UI and SWR state
      setImages((prev) => prev.filter((i) => i.id !== deleteId));

      // Force a global mutate to ensure all components stay in sync
      const swrKey = `/api/attachment/${sourceType}/${pageId}`;
      mutate(); // bound mutate

      setDeleteId(null);
      toast.success("Visual attachment deleted successfully");
    } catch (err: any) {
      console.error("[StructureImage] Delete exception:", err);
      const msg = err.message || "Unknown error";
      setError("Deletion failed: " + msg);
      toast.error("Failed to delete visual: " + msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 border-blue-600 pl-6 py-2">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Visual Documentation</h3>
          <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Engineering Library</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider font-mono">Verified Records</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 text-xs font-bold animate-shake">
          <Activity className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Main Display Viewport */}
      {images.length > 0 ? (
        <div className="relative group w-full bg-slate-50 dark:bg-slate-900/30 rounded-[3rem] border border-slate-100 dark:border-slate-800 p-8 shadow-inner overflow-hidden">
          <Carousel className="w-full">
            <CarouselContent>
              {images.map((img) => (
                <CarouselItem key={img.id} className="flex flex-col items-center">
                  <div className="relative w-full aspect-[16/10] md:aspect-[21/9] rounded-[2rem] overflow-hidden bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 isolate">
                    <Image
                      src={img.meta?.file_url || getStoragePublicUrl("attachments", img.path)}
                      alt={img.name}
                      fill
                      className="object-contain p-4"
                      priority
                    />

                    {/* Floating Overlay Controls */}
                    <div className="absolute top-6 right-6 flex gap-2">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-10 w-10 rounded-full shadow-lg hover:scale-110 active:scale-90 transition-all"
                        onClick={() => setDeleteId(img.id)}
                        disabled={uploading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Bottom Meta Bar */}
                    <div className="absolute bottom-0 inset-x-0 h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-8">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono truncate max-w-xs">{img.meta?.original_file_name || img.name}</span>
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                          Last updated: {moment(img.updated_at || img.created_at).format("DD MMM YYYY HH:mm")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-400 capitalize">Format: {img.meta?.file_type?.split('/')[1] || 'Unknown'}</span>
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                        <span className="text-[10px] font-bold text-slate-400">Size: {((img.meta?.file_size || 0) / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-[-20px] h-12 w-12 rounded-full border-none bg-white dark:bg-slate-900 shadow-xl shadow-black/10 hover:bg-slate-50" />
            <CarouselNext className="right-[-20px] h-12 w-12 rounded-full border-none bg-white dark:bg-slate-900 shadow-xl shadow-black/10 hover:bg-slate-50" />
          </Carousel>
        </div>
      ) : (
        <div className="w-full aspect-[21/9] bg-slate-50 dark:bg-slate-900/30 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 text-slate-400">
          <ImageIcon className="h-12 w-12 opacity-20" />
          <p className="text-xs font-black uppercase tracking-widest">No Visual Records Found</p>
        </div>
      )}

      {/* Modern Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative group cursor-pointer"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="premium-upload"
            disabled={uploading}
          />
          <label htmlFor="premium-upload" className="block h-full cursor-pointer">
            <div className={cn(
              "h-48 rounded-[2rem] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3",
              isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-200 dark:border-slate-800 bg-slate-50 group-hover:bg-slate-100 hover:border-slate-300"
            )}>
              {uploading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transmitting Image Data...</p>
                </div>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 shadow-lg flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black tracking-tight text-slate-900 dark:text-white">Drag & Drop Visuals</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">or Click to Select Files</p>
                  </div>
                </>
              )}
            </div>
          </label>
        </div>

        <div className="bg-slate-900 dark:bg-white rounded-[2rem] p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-700">
            <Plus className="h-32 w-32 text-white dark:text-slate-900" />
          </div>
          <div className="relative z-10">
            <h4 className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em] mb-4">Pro Tip</h4>
            <p className="text-white dark:text-slate-900 font-bold leading-relaxed">
              Upload your engineering diagrams and site photos to build a comprehensive digital twin.
            </p>
          </div>
          <p className="text-[10px] font-black uppercase text-slate-500 relative z-10">Max payload: 15MB/File</p>
        </div>
      </div>


      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={deleteImage}
        loading={deleteLoading}
        title="Delete Visual"
        description="Are you sure you want to permanently remove this visual record from the structure? This cannot be undone."
      />
    </div >
  );
}

