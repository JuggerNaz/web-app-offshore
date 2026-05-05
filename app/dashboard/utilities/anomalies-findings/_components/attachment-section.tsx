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
interface Attachment {
  id: number;
  name: string;
  path: string;
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
      if (json1.data) {
        allData = [...json1.data];
      }

      // 2. Fetch inspection attachments if it's an anomaly & we have inspectionId
      if (sourceType === "anomaly" && inspectionId) {
        const res2 = await fetch(`/api/attachment/inspection/${inspectionId}`);
        const json2 = await res2.json();
        if (json2.data) {
          const existingIds = new Set(allData.map(a => a.id));
          json2.data.forEach((att: Attachment) => {
            if (!existingIds.has(att.id)) {
              allData.push(att);
            }
          });
        }
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
      fetchAttachments();
    } catch (error: any) {
      console.error("Overwrite error:", error);
      toast.error(error.message || "Failed to overwrite image");
    } finally {
      setLoading(false);
    }
  };


  const getFileIcon = (type?: string, path?: string) => {
    const lowerType = type?.toLowerCase() || "";
    const lowerPath = path?.toLowerCase() || "";
    
    if (lowerType.startsWith("image/") || lowerPath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return <ImageIcon className="h-12 w-12 text-indigo-400" />;
    }
    if (lowerType.startsWith("video/") || lowerPath.match(/\.(mp4|webm|ogg|mov)$/)) {
      return <Video className="h-12 w-12 text-rose-400" />;
    }
    if (lowerType.includes("pdf") || lowerPath.match(/\.pdf$/)) {
      return <FileText className="h-12 w-12 text-red-400" />;
    }
    return <File className="h-12 w-12 text-blue-400" />;
  };

  const getFileIconSmall = (type?: string, path?: string) => {
    const lowerType = type?.toLowerCase() || "";
    const lowerPath = path?.toLowerCase() || "";
    
    if (lowerType.startsWith("image/") || lowerPath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return <ImageIcon className="h-5 w-5 text-indigo-400" />;
    }
    if (lowerType.startsWith("video/") || lowerPath.match(/\.(mp4|webm|ogg|mov)$/)) {
      return <Video className="h-5 w-5 text-rose-400" />;
    }
    if (lowerType.includes("pdf") || lowerPath.match(/\.pdf$/)) {
      return <FileText className="h-5 w-5 text-red-400" />;
    }
    return <File className="h-5 w-5 text-blue-400" />;
  };

  const renderIconWithHover = (att: Attachment, small: boolean = false) => {
    const icon = small ? getFileIconSmall(att.meta?.file_type, att.path) : getFileIcon(att.meta?.file_type, att.path);
    const type = att.meta?.file_type?.toLowerCase() || "";
    const path = att.path?.toLowerCase() || "";
    
    const isImage = type.startsWith("image/") || path.match(/\.(jpg|jpeg|png|gif|webp)$/);
    
    if (isImage) {
      let url = att.meta?.file_url || att.path;
      if (url && !url.startsWith("http")) {
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zpsmxtdqlpbdwfzctqzd.supabase.co";
        url = `${baseUrl}/storage/v1/object/public/attachments/${url}`;
      }
      const cacheBustedUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
      
      return (
        <div className={`relative group flex items-center justify-center ${small ? "w-5 h-5" : "w-12 h-12"}`}>
          <div className="absolute inset-0 transition-opacity duration-200 opacity-100 group-hover:opacity-0 flex items-center justify-center">
            {icon}
          </div>
          <div className="absolute inset-0 transition-opacity duration-200 opacity-0 group-hover:opacity-100 flex items-center justify-center">
            <img src={cacheBustedUrl} alt="Thumbnail" className={`object-cover ${small ? "w-5 h-5 rounded-sm" : "w-12 h-12 rounded-md shadow-sm"}`} />
          </div>
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
            
            let url = "";
            if (isImage) {
              url = att.meta?.file_url || att.path;
              if (url && !url.startsWith("http")) {
                const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zpsmxtdqlpbdwfzctqzd.supabase.co";
                url = `${baseUrl}/storage/v1/object/public/attachments/${url}`;
              }
              url = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
            }

            return (
              <Card 
                key={att.id} 
                className="group relative bg-card border-border hover:border-primary/30 transition-all cursor-pointer shadow-sm hover:shadow-md overflow-hidden min-h-[140px]"
                onClick={() => {
                  setSelectedAttachment(att);
                  setIsPreviewOpen(true);
                }}
              >
                {/* Full Card Image Background on Hover */}
                {isImage && (
                  <div className="absolute inset-0 z-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                    <img src={url} alt="Thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" /> {/* Gradient overlay for text readability */}
                  </div>
                )}

                <CardContent className="relative z-10 p-4 flex flex-col items-center justify-center text-center space-y-2 h-full">
                  {/* Graphic Icon Only initially - fade out on hover if it's an image */}
                  <div className={`p-4 bg-muted/30 rounded-full flex items-center justify-center transition-opacity duration-300 ${isImage ? 'group-hover:opacity-0' : ''}`}>
                    {getFileIcon(att.meta?.file_type, att.path)}
                  </div>
                  <div className="w-full mt-auto">
                    <span className={`font-medium text-xs block truncate transition-colors duration-300 ${isImage ? 'text-foreground group-hover:text-white' : 'text-foreground'}`}>
                      {att.meta?.title || att.name}
                    </span>
                    {att.meta?.description && (
                      <span className={`text-[10px] block truncate transition-colors duration-300 ${isImage ? 'text-muted-foreground group-hover:text-gray-300' : 'text-muted-foreground'}`}>
                        {att.meta.description}
                      </span>
                    )}
                  </div>
                </CardContent>
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
                    {renderIconWithHover(att, true)}
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
              let url = selectedAttachment.meta?.file_url || selectedAttachment.path;
              if (url && !url.startsWith("http")) {
                const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zpsmxtdqlpbdwfzctqzd.supabase.co";
                url = `${baseUrl}/storage/v1/object/public/attachments/${url}`;
              }
              const type = selectedAttachment.meta?.file_type?.toLowerCase() || "";
              const path = selectedAttachment.path?.toLowerCase() || "";
              
              if (type.startsWith("image/") || path.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                // Add timestamp to bypass browser cache
                const cacheBustedUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
                return <ImageMarkupEditor imageUrl={cacheBustedUrl} onSave={handleOverwrite} />;
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
