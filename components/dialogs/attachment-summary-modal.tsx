"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { 
  Paperclip, 
  ExternalLink, 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Calendar,
  User,
  Layers,
  Loader2
} from "lucide-react";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AttachmentSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: any | null;
  structureId?: string | number;
};

export function AttachmentSummaryModal({
  open,
  onOpenChange,
  component,
  structureId,
}: AttachmentSummaryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "Component" | "Inspection">("ALL");

  // Fetch all attachments for this component (direct + linked inspections)
  const { data: attachmentsData, isLoading } = useSWR(
    open && component?.id ? `/api/attachment/component/${component.id}` : null,
    fetcher
  );

  const attachments: any[] = useMemo(() => {
    return attachmentsData?.data || [];
  }, [attachmentsData]);

  // Filter attachments
  const filteredAttachments = useMemo(() => {
    return attachments.filter((att) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (att.name && att.name.toLowerCase().includes(q)) ||
        (att.source_name && att.source_name.toLowerCase().includes(q)) ||
        (att.user_name && att.user_name.toLowerCase().includes(q)) ||
        (att.source_type && att.source_type.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeFilter === "ALL") return true;
      if (activeFilter === "Component") return att.source_type?.toLowerCase() === "component";
      if (activeFilter === "Inspection") return att.source_type?.toLowerCase() === "inspection";

      return true;
    });
  }, [attachments, searchQuery, activeFilter]);

  const isImageFile = (path?: string, name?: string) => {
    const ext = (path || name || "").split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "");
  };

  const getAttachmentUrl = (att: any) => {
    if (att.meta?.bucket && att.path) {
      return `/api/attachment/download?path=${encodeURIComponent(att.path)}&bucket=${encodeURIComponent(att.meta.bucket)}`;
    }
    if (att.id && typeof att.id === "number") {
      return `/api/attachment/url?id=${att.id}`;
    }
    if (att.path?.startsWith("http://") || att.path?.startsWith("https://") || att.path?.startsWith("/")) {
      return att.path;
    }
    return `/api/attachment/url?id=${att.id}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-950 border-slate-800 text-slate-200 p-0 rounded-[1.5rem] shadow-2xl">
        <DialogHeader className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Paperclip className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                Attachment Summary
                {component?.q_id && (
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-slate-900 border-slate-700 text-emerald-400">
                    {component.q_id}
                  </Badge>
                )}
              </DialogTitle>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {component?.id_no ? `System ID: ${component.id_no}` : "Component and Inspection Media Records"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Total Files:
            </span>
            <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md">
              {attachments.length}
            </span>
          </div>
        </DialogHeader>

        {/* Toolbar: Search & Filter Tabs */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 group max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
            <Input
              placeholder="Search attachments by name, source, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 rounded-xl border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeFilter === "ALL"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              )}
            >
              All ({attachments.length})
            </button>
            <button
              onClick={() => setActiveFilter("Component")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeFilter === "Component"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              )}
            >
              Direct Component ({attachments.filter(a => a.source_type?.toLowerCase() === "component").length})
            </button>
            <button
              onClick={() => setActiveFilter("Inspection")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeFilter === "Inspection"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              )}
            >
              Inspection ({attachments.filter(a => a.source_type?.toLowerCase() === "inspection").length})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-xs font-black uppercase tracking-widest">Loading Attachments...</p>
            </div>
          ) : filteredAttachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <Layers className="h-10 w-10 text-slate-700 mb-2 stroke-[1.5]" />
              <p className="font-black uppercase tracking-widest text-xs">No Attachments Found</p>
              <p className="text-xs text-slate-500 mt-1">
                {attachments.length === 0
                  ? "No attachments or inspection snapshots have been uploaded for this component."
                  : "No items matched your search filter."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-3">Item / File Name</th>
                    <th className="px-4 py-3">Source Relation</th>
                    <th className="px-4 py-3">Uploaded By</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredAttachments.map((att, idx) => {
                    const isImg = isImageFile(att.path, att.name);
                    const fileUrl = getAttachmentUrl(att);
                    const dateStr = att.created_at || att.cr_date;

                    return (
                      <tr key={att.id || idx} className="hover:bg-slate-800/30 transition-colors group">
                        {/* File Name & Icon */}
                        <td className="px-4 py-3 align-middle font-bold text-white">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
                              isImg 
                                ? "bg-cyan-950/40 border-cyan-800/60 text-cyan-400" 
                                : "bg-slate-800 border-slate-700 text-slate-400"
                            )}>
                              {isImg ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-slate-200 font-bold group-hover:text-emerald-400 transition-colors">
                                {att.name || "Attachment"}
                              </span>
                              {att.path && (
                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[240px]">
                                  {att.path}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-300 text-xs">
                              {att.source_name || "Component"}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                              {att.source_type || "Direct"}
                            </span>
                          </div>
                        </td>

                        {/* User */}
                        <td className="px-4 py-3 align-middle">
                          <span className="text-slate-400 font-medium flex items-center gap-1.5 text-xs">
                            <User className="h-3 w-3 text-slate-500" />
                            {att.user_name || "System"}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 align-middle whitespace-nowrap">
                          <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            {dateStr ? format(new Date(dateStr), "dd MMM yyyy") : "—"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all shadow-sm"
                              title="Open / Download Attachment"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
