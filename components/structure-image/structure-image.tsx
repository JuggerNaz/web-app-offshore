"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import moment from "moment";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Upload,
  X,
  Loader2,
  ImageIcon,
  Plus,
  Maximize2,
  Trash2,
  ShieldCheck,
  Activity,
  AlertCircle,
  Save,
  FileText,
  HardDrive,
  Cloud,
  Layers,
  LayoutGrid,
  Film,
  RefreshCw,
  FolderOpen
} from "lucide-react";
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
  source_type?: string;
  source_id?: number;
  created_at?: string;
  updated_at?: string;
  is_local_drive?: boolean;
  local_path?: string;
  meta: {
    file_url?: string;
    original_file_name?: string;
    file_size?: number;
    file_type?: string;
    file_path?: string;
    title?: string;
    description?: string;
  };
}

export default function StructureImage() {
  const [pageId] = useAtom(urlId);
  const [pageType] = useAtom(urlType);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<StructureImageData[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "" });
  const [updating, setUpdating] = useState(false);

  // File replacement for legacy / local drive attachments
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [replacingLoading, setReplacingLoading] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // View mode: carousel or gallery grid
  const [viewMode, setViewMode] = useState<"carousel" | "grid">("carousel");

  const supabase = createClient();
  const sourceType = `${pageType}_structure_image`;

  const { data, mutate } = useSWR(
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

  const isLocalDrivePath = (p?: string): boolean => {
    return /^[a-zA-Z]:[\\/]/.test(String(p || "").trim());
  };

  const isItemOfflineLocal = (img: StructureImageData): boolean => {
    const rawPath = String(img.path || img.meta?.file_path || "").trim();
    const hasLocalPath = isLocalDrivePath(rawPath);
    const fileUrl = img.meta?.file_url;
    const hasCloudUrl = Boolean(
      fileUrl &&
      (fileUrl.startsWith("http://") || fileUrl.startsWith("https://") || fileUrl.startsWith("data:")) &&
      !isLocalDrivePath(fileUrl)
    );
    return hasLocalPath && !hasCloudUrl;
  };

  const getItemDisplayUrl = (img: StructureImageData): string | null => {
    if (isItemOfflineLocal(img)) return null;
    if (img.meta?.file_url) return img.meta.file_url;
    if (img.path && (img.path.startsWith("http://") || img.path.startsWith("https://") || img.path.startsWith("data:"))) {
      return img.path;
    }
    if (img.path && !isLocalDrivePath(img.path)) {
      return getStoragePublicUrl("attachments", img.path);
    }
    return null;
  };

  const getItemTitle = (img: StructureImageData): string => {
    return img.meta?.title || img.name || img.meta?.original_file_name || "Visual Attachment";
  };

  const getItemFileName = (img: StructureImageData): string => {
    return img.meta?.original_file_name || img.name || (img.path ? (img.path.split(/[\\/]/).pop() || "Unknown File") : "Unknown File");
  };

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
      if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Format not supported (JPG, PNG, WebP only)");

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
            title: file.name.replace(/\.[^/.]+$/, ""),
          },
        }])
        .select().single();

      if (dbError) throw dbError;
      setImages((prev) => [...prev, dbData]);
      mutate();
      startEdit(dbData);
      toast.success("Visual image uploaded successfully");
    } catch (err: any) {
      setError(err.message || "Upload failed");
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const triggerReplace = (id: number) => {
    setReplacingId(id);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = "";
      replaceFileInputRef.current.click();
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingId) return;

    try {
      setReplacingLoading(true);
      setError(null);

      const MAX_FILE_SIZE = 15 * 1024 * 1024;
      const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 15MB limit");
      if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Format not supported (JPG, PNG, WebP only)");

      const fileExt = file.name.split(".").pop();
      const fileName = `${pageId}-${Date.now()}.${fileExt}`;
      const filePath = `structure-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const targetItem = images.find(i => i.id === replacingId);
      const targetMeta = targetItem?.meta || {};

      const { error: dbError } = await supabase
        .from("attachment")
        .update({
          path: filePath,
          source_type: sourceType,
          name: file.name,
          meta: {
            ...targetMeta,
            original_file_name: file.name,
            file_url: publicUrl,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            title: targetMeta.title || file.name.replace(/\.[^/.]+$/, ""),
          },
        })
        .eq("id", replacingId);

      if (dbError) throw dbError;

      toast.success("Image uploaded to cloud storage and linked successfully!");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to replace image file");
      setError(err.message || "Failed to replace file");
    } finally {
      setReplacingLoading(false);
      setReplacingId(null);
    }
  };

  const deleteImage = async () => {
    if (!deleteId) return;

    try {
      setDeleteLoading(true);
      setError(null);

      await fetcher(`/api/attachment?id=${deleteId}`, {
        method: "DELETE"
      });

      setImages((prev) => prev.filter((i) => i.id !== deleteId));
      mutate();
      setDeleteId(null);
      toast.success("Visual attachment deleted successfully");
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      setError("Deletion failed: " + msg);
      toast.error("Failed to delete visual: " + msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const startEdit = (img: StructureImageData) => {
    setEditingId(img.id);
    setEditForm({
      title: img.meta?.title || img.name || img.meta?.original_file_name || "",
      description: img.meta?.description || "",
    });
  };

  const handleUpdateMeta = async () => {
    if (!editingId) return;

    try {
      setUpdating(true);
      const res = await fetch("/api/attachment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title: editForm.title,
          description: editForm.description,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update");

      toast.success("Visual meta updated successfully");
      mutate();
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const cloudCount = images.filter(i => !isItemOfflineLocal(i)).length;
  const localCount = images.filter(i => isItemOfflineLocal(i)).length;

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Hidden file input for replacing images */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceFile}
        className="hidden"
      />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 border-blue-600 pl-6 py-2">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
            {pageType === "pipeline" ? "Pipeline Photo Library" : "Platform Visual Documentation"}
          </h3>
          <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Engineering Visual Specification
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <Cloud className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-wider font-mono">
              {cloudCount} Cloud Visuals
            </span>
          </div>

          {localCount > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <HardDrive className="h-4 w-4 text-amber-600" />
              <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider font-mono">
                {localCount} Local Drive Records
              </span>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("carousel")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                viewMode === "carousel"
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Film className="h-3.5 w-3.5" />
              <span>Carousel</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Gallery Grid</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 text-xs font-bold animate-shake">
          <Activity className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Edit Metadata Modal/Overlay */}
      {editingId && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider">
                Edit Visual Specification (ID: {editingId})
              </h4>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingId(null)}
              className="h-8 w-8 p-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Visual Title / Face Name
              </label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm((v) => ({ ...v, title: e.target.value }))}
                placeholder="e.g. BODP-A NORTH FACE"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 ring-blue-500/50 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Engineering Notes / Description
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((v) => ({ ...v, description: e.target.value }))}
                placeholder="e.g. Visual inspection overview..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 ring-blue-500/50 outline-none h-20 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setEditingId(null)}
              className="rounded-xl h-9 px-4 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateMeta}
              disabled={updating}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 px-5 text-xs font-bold"
            >
              {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Main Display: Carousel Mode */}
      {viewMode === "carousel" && (
        images.length > 0 ? (
          <div className="relative group w-full bg-slate-50 dark:bg-slate-900/30 rounded-[3rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-inner overflow-hidden">
            <Carousel className="w-full">
              <CarouselContent>
                {images.map((img) => {
                  const isOffline = isItemOfflineLocal(img);
                  const displayUrl = getItemDisplayUrl(img);
                  const title = getItemTitle(img);
                  const fileName = getItemFileName(img);
                  const rawPath = String(img.path || img.meta?.file_path || "");

                  return (
                    <CarouselItem key={img.id} className="flex flex-col items-center">
                      <div className="relative w-full aspect-[16/10] md:aspect-[21/9] rounded-[2rem] overflow-hidden bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 isolate">
                        
                        {isOffline || !displayUrl ? (
                          /* Local Drive Offline Visual Card */
                          <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white relative">
                            {/* Technical Grid Overlay */}
                            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />

                            <div className="relative z-10 flex flex-col items-center max-w-lg text-center space-y-3">
                              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-[10px] font-black uppercase tracking-widest">
                                <HardDrive className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                                <span>Linked to Local Drive</span>
                              </div>

                              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
                                {title}
                              </h3>

                              <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2 font-mono text-[11px]">
                                <div className="flex justify-between items-center text-slate-400 border-b border-white/5 pb-1.5">
                                  <span>Original File:</span>
                                  <span className="font-bold text-white truncate max-w-xs">{fileName}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-400 border-b border-white/5 pb-1.5">
                                  <span>Local Workstation Path:</span>
                                  <span className="font-bold text-amber-300 truncate max-w-xs">{rawPath}</span>
                                </div>
                                {img.meta?.description && (
                                  <div className="text-slate-300 pt-1 font-sans text-xs italic">
                                    "{img.meta.description}"
                                  </div>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-400 max-w-md">
                                This record is linked to an offshore workstation path. Upload the file from your computer to migrate it to cloud storage so it can be previewed and included in PDF exports.
                              </p>

                              <div className="flex flex-wrap justify-center gap-2 pt-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => startEdit(img)}
                                  className="rounded-xl text-xs font-bold"
                                >
                                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                                  Edit Metadata
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => triggerReplace(img.id)}
                                  disabled={replacingLoading}
                                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg"
                                >
                                  {replacingLoading && replacingId === img.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                                  )}
                                  Upload to Cloud
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeleteId(img.id)}
                                  className="rounded-xl text-xs font-bold"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Real Cloud Image Display */
                          <>
                            <Image
                              src={displayUrl}
                              alt={title}
                              fill
                              className="object-contain p-4 transition-all duration-700"
                              priority
                            />

                            {/* Title & Description Overlay */}
                            <div className="absolute top-0 left-0 p-8 z-10 w-full max-w-sm">
                              {(img.meta?.title || img.meta?.description) && (
                                <div className="bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-md p-5 rounded-[2rem] border border-white/10 shadow-xl max-w-sm animate-in fade-in slide-in-from-left duration-700">
                                  {img.meta?.title && (
                                    <h3 className="text-lg font-black text-white tracking-tight leading-tight mb-1.5 uppercase break-words">
                                      {img.meta.title}
                                    </h3>
                                  )}
                                  {img.meta?.description && (
                                    <p className="text-[11px] font-medium text-slate-200/90 leading-relaxed line-clamp-3">
                                      {img.meta.description}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* Top Right Floating Controls */}
                        <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
                          <Button
                            variant="secondary"
                            size="icon"
                            title="Replace / Update Image File"
                            className="h-10 w-10 rounded-full shadow-lg bg-white/90 dark:bg-slate-900/90 hover:scale-110 active:scale-90 transition-all"
                            onClick={() => triggerReplace(img.id)}
                            disabled={uploading || replacingLoading}
                          >
                            <Upload className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            title="Edit Title & Description"
                            className="h-10 w-10 rounded-full shadow-lg bg-white/90 dark:bg-slate-900/90 hover:scale-110 active:scale-90 transition-all"
                            onClick={() => startEdit(img)}
                            disabled={uploading}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            title="Delete Visual"
                            className="h-10 w-10 rounded-full shadow-lg hover:scale-110 active:scale-90 transition-all"
                            onClick={() => setDeleteId(img.id)}
                            disabled={uploading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Bottom Meta Bar */}
                        <div className="absolute bottom-0 inset-x-0 h-14 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 z-20">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono truncate max-w-sm">
                              {fileName}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                              {isOffline ? `Local: ${rawPath}` : `Updated: ${moment(img.updated_at || img.created_at).format("DD MMM YYYY HH:mm")}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                              isOffline ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            )}>
                              {isOffline ? "Local Disk" : "Cloud Storage"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 capitalize hidden sm:inline">
                              Format: {img.meta?.file_type?.split('/')[1] || 'JPEG'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselPrevious className="left-[-20px] h-12 w-12 rounded-full border-none bg-white dark:bg-slate-900 shadow-xl shadow-black/10 hover:bg-slate-50" />
              <CarouselNext className="right-[-20px] h-12 w-12 rounded-full border-none bg-white dark:bg-slate-900 shadow-xl shadow-black/10 hover:bg-slate-50" />
            </Carousel>
          </div>
        ) : (
          <div className="w-full aspect-[21/9] bg-slate-50 dark:bg-slate-900/30 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 text-slate-400">
            <ImageIcon className="h-12 w-12 opacity-20" />
            <p className="text-xs font-black uppercase tracking-widest">
              {pageType === "pipeline" ? "No Photo Records Found" : "No Visual Records Found"}
            </p>
          </div>
        )
      )}

      {/* Gallery Cards Grid (All Attached Visuals Overview) */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
                Attached Visual Records ({images.length})
              </h4>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              Click Edit to modify details, or Upload to link cloud images
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((img, idx) => {
              const isOffline = isItemOfflineLocal(img);
              const displayUrl = getItemDisplayUrl(img);
              const title = getItemTitle(img);
              const fileName = getItemFileName(img);
              const rawPath = String(img.path || img.meta?.file_path || "");

              return (
                <div
                  key={img.id}
                  className={cn(
                    "relative group rounded-2xl border p-4 transition-all duration-300 flex flex-col justify-between bg-white dark:bg-slate-900 hover:shadow-lg",
                    isOffline
                      ? "border-amber-200 dark:border-amber-800/60 bg-amber-50/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-blue-400"
                  )}
                >
                  <div className="space-y-3">
                    {/* Thumbnail / Status Header */}
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center">
                      {!isOffline && displayUrl ? (
                        <Image
                          src={displayUrl}
                          alt={title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-3 text-center text-amber-600 dark:text-amber-400">
                          <HardDrive className="h-8 w-8 mb-1" />
                          <span className="text-[9px] font-black uppercase tracking-wider font-mono">
                            Local File Link
                          </span>
                        </div>
                      )}

                      {/* Visual Number Badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[9px] font-black font-mono">
                        #{idx + 1}
                      </div>

                      {/* Status Tag */}
                      <div className="absolute top-2 right-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                          isOffline
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-blue-600 text-white shadow-sm"
                        )}>
                          {isOffline ? "Local Disk" : "Cloud"}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Content */}
                    <div>
                      <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate" title={title}>
                        {title}
                      </h5>
                      <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5" title={fileName}>
                        {fileName}
                      </p>
                      {rawPath && (
                        <p className={cn(
                          "text-[9px] font-mono truncate mt-1 px-2 py-1 rounded-md",
                          isOffline
                            ? "bg-amber-100/60 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        )} title={rawPath}>
                          {rawPath}
                        </p>
                      )}
                      {img.meta?.description && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 italic">
                          {img.meta.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Replace file with cloud upload"
                      onClick={() => triggerReplace(img.id)}
                      disabled={replacingLoading}
                      className="h-8 px-2 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {isOffline ? "Upload File" : "Replace"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Edit metadata"
                      onClick={() => startEdit(img)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete visual"
                      onClick={() => setDeleteId(img.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modern Upload Zone for Adding New Visuals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className="md:col-span-2 relative group cursor-pointer"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="premium-upload"
            disabled={uploading}
          />
          <label htmlFor="premium-upload" className="block h-full cursor-pointer">
            <div
              className={cn(
                "h-44 rounded-[2rem] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3",
                isDragging
                  ? "border-blue-500 bg-blue-50/50"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 group-hover:bg-slate-100 dark:group-hover:bg-slate-900/40 hover:border-slate-300"
              )}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Transmitting Visual Data...
                  </p>
                </div>
              ) : (
                <>
                  <div className="h-11 w-11 rounded-2xl bg-white dark:bg-slate-900 shadow-md flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
                      Drag & Drop New Visuals
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      or Click to Browse Images (JPG, PNG, WebP)
                    </p>
                  </div>
                </>
              )}
            </div>
          </label>
        </div>

        <div className="bg-slate-900 dark:bg-white rounded-[2rem] p-7 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-700">
            <Plus className="h-32 w-32 text-white dark:text-slate-900" />
          </div>
          <div className="relative z-10">
            <h4 className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em] mb-3">
              Asset Guidelines
            </h4>
            <p className="text-white dark:text-slate-900 font-bold text-xs leading-relaxed">
              Upload North, South, East, and West elevation photos to populate the Structure Visual Summary in the executive report.
            </p>
          </div>
          <p className="text-[10px] font-black uppercase text-slate-400 relative z-10 mt-4">
            Max Payload: 15MB/File
          </p>
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={deleteImage}
        loading={deleteLoading}
        title={pageType === "pipeline" ? "Delete Photo" : "Delete Visual"}
        description={
          pageType === "pipeline"
            ? "Are you sure you want to permanently remove this photo record from the structure? This cannot be undone."
            : "Are you sure you want to permanently remove this visual record from the structure? This cannot be undone."
        }
      />
    </div>
  );
}
