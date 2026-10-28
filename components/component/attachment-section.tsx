"use client";
import { createClient } from "@/utils/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Paperclip, 
  Upload, 
  Loader2, 
  FileText, 
  Image as ImageIcon,
  Video,
  File,
  ExternalLink,
  LayoutGrid,
  List,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { ImageMarkupEditor } from "./image-markup-editor";
import { getAttachmentUrl } from "@/utils/attachment-utils";

interface Attachment {
  id: number;
  name: string;
  path: string;
  cr_date?: string;
  updated_at?: string;
  meta: {
    title?: string;
    description?: string;
    file_type?: string;
    file_url?: string;
  };
}

interface AttachmentSectionProps {
  sourceId: number;
  sourceType: "anomaly" | "inspection";
  inspectionId?: number;
}

export function AttachmentSection({ sourceId, sourceType, inspectionId }: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<"card" | "list">("card");
  
  // Dialog States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Per-attachment cache-bust counters. Bumped only after an in-place
  // overwrite so the editor reloads the fresh image; image URLs are otherwise
  // stable across re-renders so the browser cache actually works.
  const [bustCounters, setBustCounters] = useState<Record<string, number>>({});

  // Upload State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      let allData: Attachment[] = [];

      // 1. Fetch direct sourceType attachments
      const res1 = await fetch(`/api/attachment/${sourceType}/${sourceId}`);
      const json1 = await res1.json();
      const list1: Attachment[] = Array.isArray(json1) ? json1 : (json1?.data || []);
      allData = [...list1];

      // 2. Fetch inspection attachments if it's an anomaly & we have inspectionId
      if (sourceType === "anomaly" && inspectionId) {
        const res2 = await fetch(`/api/attachment/inspection/${inspectionId}`);
        const json2 = await res2.json();
        const list2: Attachment[] = Array.isArray(json2) ? json2 : (json2?.data || []);
        const existingIds = new Set(allData.map(a => a.id));
        list2.forEach((att: Attachment) => {
          if (!existingIds.has(att.id)) {
            allData.push(att);
          }
        });
      }

      setAttachments(allData);
    } catch (error) {
      console.error("Failed to fetch attachments:", error);
      toast.error("Failed to load attachments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sourceId) {
      fetchAttachments();
    }
  }, [sourceId, sourceType, inspectionId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", title || file.name);
      formData.append("source_type", sourceType);
      formData.append("source_id", String(sourceId));
      formData.append("title", title);
      formData.append("description", description);

      const res = await fetch("/api/attachment", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Upload failed");

      toast.success("Attachment uploaded successfully");
      
      // Reset form
      setFile(null);
      setTitle("");
      setDescription("");
      setIsUploadOpen(false);
      
      // Refresh list
      fetchAttachments();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload attachment");
    } finally {
      setUploading(false);
    }
  };

  const handleOverwrite = async (canvasDataUrl: string) => {
    if (!selectedAttachment) return;
    
    setLoading(true);
    try {
      // 1. Convert Base64 data URL to Blob
      const resBlob = await fetch(canvasDataUrl);
      const blob = await resBlob.blob();
      
      // 2. Identify storage target path
      const filePath = selectedAttachment.path;
      if (!filePath) {
         toast.error("Attachment path missing");
         return;
      }

      // 3. Prepare Form Data
      const formData = new FormData();
      formData.append("id", String(selectedAttachment.id));
      formData.append("filePath", filePath);
      formData.append("file", blob, "annotated-image.png");

      // 4. Submit via PUT endpoint
      const res = await fetch("/api/attachment", {
        method: "PUT",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to overwrite");

      toast.success("Image overwritten successfully");
      setIsPreviewOpen(false);
      // In-place overwrites keep the same storage path; bump the bust counter
      // so the next render fetches the fresh image instead of the cached one.
      setBustCounters((prev) => ({
        ...prev,
        [String(selectedAttachment.id)]: (prev[String(selectedAttachment.id)] || 0) + 1,
      }));
      fetchAttachments();
    } catch (error: any) {
      console.error("Overwrite error:", error);
      toast.error(error.message || "Failed to overwrite image");
    } finally {
      setLoading(false);
    }
  };

  // Stable, re-render-safe public image URL.
  const buildImageUrl = (att: Attachment) => {
    let url = getAttachmentUrl(att);
    if (!url) {
      url = att.meta?.file_url || att.path;
      if (url && !url.startsWith("http")) {
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zpsmxtdqlpbdwfzctqzd.supabase.co";
        const bucket = (att.meta as any)?.bucket || "attachments";
        url = `${baseUrl}/storage/v1/object/public/${bucket}/${url}`;
      }
    }
    const version = att.cr_date || att.updated_at || att.id;
    const bust = bustCounters[String(att.id)] || 0;
    const sep = url && url.includes("?") ? "&" : "?";
    return bust > 0 ? `${url}${sep}v=${version}&bust=${bust}` : `${url}${sep}v=${version}`;
  };

  const getFileIcon = (type?: string, path?: string) => {
    const lowerType = type?.toLowerCase() || "";
    const lowerPath = path?.toLowerCase() || "";
    
    if (lowerType.startsWith("image/") || lowerPath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return <ImageIcon className="h-10 w-10 text-indigo-400" />;
    }
    if (lowerType.startsWith("video/") || lowerPath.match(/\.(mp4|webm|ogg|mov)$/)) {
      return <Video className="h-10 w-10 text-rose-400" />;
    }
    if (lowerType.includes("pdf") || lowerPath.match(/\.pdf$/)) {
      return <FileText className="h-10 w-10 text-red-400" />;
    }
    return <File className="h-10 w-10 text-blue-400" />;
  };

  const getFileIconSmall = (type?: string, path?: string) => {
    const lowerType = type?.toLowerCase() || "";
    const lowerPath = path?.toLowerCase() || "";
    
    if (lowerType.startsWith("image/") || lowerPath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return <ImageIcon className="h-4 w-4 text-indigo-400" />;
    }
    if (lowerType.startsWith("video/") || lowerPath.match(/\.(mp4|webm|ogg|mov)$/)) {
      return <Video className="h-4 w-4 text-rose-400" />;
    }
    if (lowerType.includes("pdf") || lowerPath.match(/\.pdf$/)) {
      return <FileText className="h-4 w-4 text-red-400" />;
    }
    return <File className="h-4 w-4 text-blue-400" />;
  };

  const renderThumbnailOrIcon = (att: Attachment, small: boolean = false) => {
    const icon = small ? getFileIconSmall(att.meta?.file_type, att.path) : getFileIcon(att.meta?.file_type, att.path);
    const type = att.meta?.file_type?.toLowerCase() || "";
    const path = att.path?.toLowerCase() || "";
    const isImage = type.startsWith("image/") || path.match(/\.(jpg|jpeg|png|gif|webp)$/);
    
    if (isImage) {
      const url = buildImageUrl(att);
      return (
        <div className={`relative overflow-hidden rounded border border-border bg-muted/30 flex items-center justify-center flex-shrink-0 ${small ? "w-8 h-8" : "w-12 h-12"}`}>
          <img 
            src={url} 
            alt="Thumb" 
            className="w-full h-full object-cover" 
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }} 
          />
        </div>
      );
    }
    
    return icon;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md bg-muted/5 p-4 space-y-4 mt-4">
      {/* Group Header */}
      <div className="flex justify-between items-center border-b border-border pb-2">
        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
          <Paperclip className="h-4 w-4" />
          Attachments ({attachments.length})
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex border border-border rounded-md p-0.5 bg-muted/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewType("card")}
              className={`px-2 h-6 text-xs ${viewType === "card" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewType("list")}
              className={`px-2 h-6 text-xs ${viewType === "list" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          
          {/* Add Button */}
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs flex items-center gap-1"
            onClick={() => setIsUploadOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Content */}
      {attachments.length === 0 ? (
        <div className="text-sm text-muted-foreground italic py-4 text-center">No attachments found.</div>
      ) : viewType === "card" ? (
        /* Card View */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {attachments.map((att) => {
            const type = att.meta?.file_type?.toLowerCase() || "";
            const path = att.path?.toLowerCase() || "";
            const isImage = type.startsWith("image/") || path.match(/\.(jpg|jpeg|png|gif|webp)$/);
            
            const url = isImage ? buildImageUrl(att) : "";

            return (
              <Card 
                key={att.id} 
                className="group relative bg-card border-border hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md overflow-hidden flex flex-col"
                onClick={() => {
                  setSelectedAttachment(att);
                  setIsPreviewOpen(true);
                }}
              >
                {/* Visual Thumbnail Area */}
                <div className="w-full aspect-[16/10] bg-muted/30 relative overflow-hidden flex items-center justify-center border-b border-border">
                  {isImage ? (
                    <AttachmentThumbnail
                      url={url}
                      title={att.meta?.title || att.name}
                      fallbackIcon={getFileIcon(att.meta?.file_type, att.path)}
                    />
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      {getFileIcon(att.meta?.file_type, att.path)}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {type.split("/")[1] || path.split(".").pop() || "FILE"}
                      </span>
                    </div>
                  )}

                  {/* Hover action overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[1px]">
                    <Eye className="w-4 h-4" />
                    <span>Preview & Edit</span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-3 flex flex-col gap-1 flex-1 bg-card">
                  <span 
                    className="font-medium text-xs text-foreground block truncate" 
                    title={att.meta?.title || att.name}
                  >
                    {att.meta?.title || att.name}
                  </span>
                  {att.meta?.description && (
                    <span 
                      className="text-[11px] text-muted-foreground block line-clamp-2 leading-relaxed" 
                      title={att.meta.description}
                    >
                      {att.meta.description}
                    </span>
                  )}
                  <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-muted-foreground/70 border-t border-border/50">
                    <span className="truncate uppercase font-medium">
                      {(att as any).source_type || (att.meta?.file_type?.split("/")[1] || "Attachment")}
                    </span>
                    {att.cr_date && (
                      <span>{new Date(att.cr_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="border border-border rounded-md overflow-hidden bg-card">
          <table className="w-full text-xs text-left text-muted-foreground">
            <thead className="bg-muted text-muted-foreground border-b border-border">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((att) => (
                <tr 
                  key={att.id}
                  className="border-b border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="px-3 py-2">
                    {renderThumbnailOrIcon(att, true)}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {att.meta?.title || att.name}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[150px]">
                    {att.meta?.description || "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setSelectedAttachment(att);
                        setIsPreviewOpen(true);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="bg-card text-foreground border-border max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {selectedAttachment?.meta?.title || selectedAttachment?.name}
            </DialogTitle>
            {selectedAttachment?.meta?.description && (
              <DialogDescription className="text-xs text-muted-foreground">
                {selectedAttachment.meta.description}
              </DialogDescription>
            )}
          </DialogHeader>
          
          <div className="flex-1 flex items-center justify-center p-4 bg-muted/10 rounded-md overflow-auto min-h-[300px]">
            {selectedAttachment && (() => {
              const url = buildImageUrl(selectedAttachment);
              const type = selectedAttachment.meta?.file_type?.toLowerCase() || "";
              const path = selectedAttachment.path?.toLowerCase() || "";
              
              if (type.startsWith("image/") || path.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                return <ImageMarkupEditor imageUrl={url} onSave={handleOverwrite} />;
              }
              if (type.startsWith("video/") || path.match(/\.(mp4|webm|ogg|mov)$/)) {
                return <video src={url} controls className="max-w-full max-h-[50vh]" />;
              }
              if (type.includes("pdf") || path.match(/\.pdf$/)) {
                return (
                  <div className="flex flex-col items-center gap-4">
                    <FileText className="h-16 w-16 text-red-400" />
                    <Button asChild size="sm">
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        Open PDF in New Tab <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                );
              }
              return (
                <div className="flex flex-col items-center gap-4">
                  <File className="h-16 w-16 text-blue-400" />
                  <Button asChild size="sm">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Download File <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="bg-card text-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-1">
              <Upload className="h-4 w-4" /> Add New Attachment
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpload} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="att-title" className="text-xs">Title</Label>
              <Input 
                id="att-title" 
                placeholder="e.g., Anomaly Photo 1" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background border-border h-8 text-xs"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="att-desc" className="text-xs">Description</Label>
              <Input 
                id="att-desc" 
                placeholder="Optional details..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background border-border h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="att-file" className="text-xs">File</Label>
              <Input 
                id="att-file" 
                type="file" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="bg-background border-border text-xs text-muted-foreground file:text-foreground file:bg-muted file:border-none file:px-2 file:py-1 file:rounded file:mr-2 h-9"
              />
            </div>

            <Button 
              type="submit" 
              size="sm"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={uploading || !file}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Attachment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachmentThumbnail({
  url,
  title,
  fallbackIcon,
}: {
  url: string;
  title?: string;
  fallbackIcon: React.ReactNode;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !url) {
    return (
      <div className="flex flex-col items-center justify-center p-3 text-muted-foreground">
        {fallbackIcon}
        <span className="text-[10px] text-muted-foreground/60 mt-1 font-medium">Preview unavailable</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 flex items-center justify-center p-1">
      <img
        src={url}
        alt={title || "Thumbnail"}
        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

