"use client";

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
  ExternalLink 
} from "lucide-react";
import { toast } from "sonner";

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
}

export function AttachmentSection({ sourceId, sourceType }: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Upload State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attachment/${sourceType}/${sourceId}`);
      const json = await res.json();
      if (json.data) {
        setAttachments(json.data);
      }
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
  }, [sourceId, sourceType]);

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
      
      // Refresh list
      fetchAttachments();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload attachment");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* List */}
      {attachments.length === 0 ? (
        <div className="text-sm text-slate-500 italic py-2">No attachments found.</div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {attachments.map((att) => {
            const isImage = att.meta?.file_type?.startsWith("image/") || att.path?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            const url = att.meta?.file_url || att.path;

            return (
              <div 
                key={att.id} 
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm"
              >
                <div className="flex items-center gap-3">
                  {isImage ? (
                    <ImageIcon className="h-5 w-5 text-indigo-400" />
                  ) : (
                    <FileText className="h-5 w-5 text-blue-400" />
                  )}
                  <div>
                    <span className="font-medium text-slate-200 block">
                      {att.meta?.title || att.name}
                    </span>
                    {att.meta?.description && (
                      <span className="text-xs text-slate-400 block">
                        {att.meta.description}
                      </span>
                    )}
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-400 hover:text-slate-200"
                  asChild
                >
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" /> View
                  </a>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-4 mt-2">
        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1">
          <Upload className="h-3 w-3" /> Add New Attachment
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="att-title">Title</Label>
            <Input 
              id="att-title" 
              placeholder="e.g., Anomaly Photo 1" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-950 border-slate-800 h-8 text-xs"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="att-desc">Description</Label>
            <Input 
              id="att-desc" 
              placeholder="Optional details..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-950 border-slate-800 h-8 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="att-file">File</Label>
          <Input 
            id="att-file" 
            type="file" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="bg-slate-950 border-slate-800 text-xs text-slate-400 file:text-slate-200 file:bg-slate-800 file:border-none file:px-2 file:py-1 file:rounded file:mr-2"
          />
        </div>

        <Button 
          type="submit" 
          size="sm"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={uploading || !file}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload Attachment
        </Button>
      </form>
    </div>
  );
}
